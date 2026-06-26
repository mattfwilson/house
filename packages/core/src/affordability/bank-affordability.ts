// bankAffordability — the BANK max-price solver (AFF-01), the "can the bank?" anti-funnel
// reference ceiling. It answers "what is the largest PRICE this borrower is approved for?" under
// the LOWER of the front-end (housing) and back-end (total-debt) DTI ceilings.
//
// THE MODEL (a point-in-time, year-0, today's-dollars calculation — D-15; single fixed
// `annualRate`, no separate stress/qualifying rate — D-16):
//   - For a trial PRICE, the household's fixed `downPaymentCash` implies the down-payment
//     fraction `downPaymentCash / price` (D-07): a larger price ⇒ a SMALLER fraction ⇒ a larger
//     loan and higher carrying cost. The trial input is rebuilt via `engineInput()` and run
//     through `computeTco` — the solver NEVER re-derives amortization (Shared P2): the DTI
//     numerator comes from the same TCO breakdown the rest of the engine uses.
//   - `passes(price)` ⇔ `frontEndRatio ≤ assumptions.dti.frontEnd` AND
//     `backEndRatio ≤ assumptions.dti.backEnd` (Shared P4 — thresholds READ from the assumptions,
//     never hardcoded). Both ratios use the GROSS-monthly denominator (Pitfall 2, D-04).
//
// THE SEARCH (monotonic bisection to the cent):
//   - `passes` is monotonic in price: as price rises the loan rises, the carrying cost rises, and
//     both DTI ratios rise — even ACROSS the PMI kink (when the fraction crosses 20% and PMI
//     switches on, the ratio JUMPS UP, never down — Pitfall 4). So there is a single crossover
//     price and bisection is sound.
//   - LOW BOUND is set strictly ABOVE `downPaymentCash` (`downPaymentCash + 1`) so every trial
//     `downPaymentCash / price` is < 1 and the per-trial `engineInput()` never trips the
//     `ScenarioInputsSchema.downPaymentPct ∈ [0,1)` refine (Pitfall 3 low-bound guard, T-03-03).
//   - HIGH BOUND is found by EXPONENTIAL bracketing (double until `passes(high)` is false) — no
//     hard-coded ceiling. A sanity iteration cap bounds both the bracket and the bisection as
//     defense-in-depth against a non-terminating sweep (T-03-04 DoS).
//   - Bisect while `high − low > $0.01`; the result is the largest passing price to the cent.
//
// Dec/Money discipline (the tco.ts / rent-vs-buy.ts precedent, D-03 / CORE-02): all bracketing,
// bisection, ratio comparison, and the `downPaymentPct` derivation happen in the frozen `Dec`
// clone; dollars cross into `Money` only at the result boundary via the
// `toDecimalPlaces(2, ROUND_HALF_EVEN)` cent pin (D-08). `Dec` is not re-exported.
import { Dec, type DecimalInstance } from '../money/decimal-config.js';
import { Money } from '../money/money.js';
import { engineInput, type EngineInput, type Household } from '../engine/engine-input.js';
import { computeTco } from '../tco/tco.js';
import { frontEndRatio, backEndRatio } from './dti.js';

/** Which DTI ceiling is the active (lower-price) constraint at the solved price. */
export type BindingRatio = 'frontEnd' | 'backEnd';

/** The closed bank-affordability result (AFF-01). All dollars are `Money`; ratios are strings. */
export interface BankAffordabilityResult {
  /** The largest approvable purchase price to the cent under the lower DTI ceiling (D-06). */
  readonly bankMaxPrice: Money;
  /** The implied max loan: `bankMaxPrice − downPaymentCash` (D-06). */
  readonly bankMaxLoan: Money;
  /** Front-end (housing) DTI ratio at the solved price, as a canonical decimal string. */
  readonly frontEndRatio: string;
  /** Back-end (total-debt) DTI ratio at the solved price, as a canonical decimal string. */
  readonly backEndRatio: string;
  /** Whichever ceiling is the binding (nearest-its-threshold) constraint at the solved price. */
  readonly bindingRatio: BindingRatio;
}

/**
 * Defense-in-depth iteration cap (T-03-04). The constraint is monotonic and `computeTco` is
 * finite, so bracketing doubles a finite high and bisection terminates at the $0.01 tolerance;
 * this cap bounds BOTH loops against a pathological non-terminating sweep. ~200 doublings spans
 * any realistic price by an astronomical margin; ~1000 bisection steps far exceed the ~60 needed
 * to reach $0.01 from any reachable bracket.
 */
const MAX_BRACKET_DOUBLINGS = 200;
const MAX_BISECTION_STEPS = 1000;

/** The $0.01 bisection tolerance (cent resolution, D-08). */
const CENT = new Dec('0.01');

/**
 * Build the frozen trial `EngineInput` for a candidate `price` (Shared P2). Derives
 * `downPaymentPct = downPaymentCash / price` in `Dec`, pins the price to whole cents (so the
 * scenario `price` is a canonical decimal string and the search runs at cent resolution), and
 * rebuilds through `engineInput()` so the trial scenario is RE-VALIDATED at the trust boundary.
 */
function inputAtPrice(base: EngineInput, household: Household, priceDec: DecimalInstance): EngineInput {
  const price = priceDec.toDecimalPlaces(2, Dec.ROUND_HALF_EVEN).toFixed();
  const downPaymentPct = new Dec(household.downPaymentCash).div(new Dec(price)).toFixed();
  return engineInput({
    asOf: base.asOf,
    assumptions: base.assumptions,
    household,
    scenario: { ...base.scenario, price, downPaymentPct },
  });
}

/**
 * Solve the bank's maximum approvable purchase price under the LOWER of the front-end (housing)
 * and back-end (total-debt) DTI ceilings (AFF-01).
 *
 * Requires `input.household` — affordability entry points qualify a borrower, not a bare house
 * (throws a clear error if absent). Reads the DTI thresholds from `input.assumptions.dti.*`
 * (Shared P4) and the `downPaymentCash` / income / existing-debt from `input.household`.
 */
export function bankAffordability(input: EngineInput): BankAffordabilityResult {
  const household = input.household;
  if (household === undefined) {
    throw new Error(
      'bankAffordability requires input.household — an affordability solve qualifies a borrower, ' +
        'not a bare house. Build the EngineInput with a household block.',
    );
  }

  const frontThreshold = new Dec(input.assumptions.dti.frontEnd);
  const backThreshold = new Dec(input.assumptions.dti.backEnd);
  const grossAnnualIncome = household.grossAnnualIncome;
  const existingMonthlyDebt = household.existingMonthlyDebt;
  const cash = new Dec(household.downPaymentCash);

  // Both DTI ratios at a trial price (from the engine's own TCO breakdown — never re-derived).
  const ratiosAt = (priceDec: DecimalInstance): { front: DecimalInstance; back: DecimalInstance } => {
    const tco = computeTco(inputAtPrice(input, household, priceDec));
    return {
      front: frontEndRatio(tco, grossAnnualIncome),
      back: backEndRatio(tco, grossAnnualIncome, existingMonthlyDebt),
    };
  };

  // passes ⇔ BOTH ceilings hold (the binding constraint is whichever fails first as price rises).
  const passes = (priceDec: DecimalInstance): boolean => {
    const { front, back } = ratiosAt(priceDec);
    return front.lessThanOrEqualTo(frontThreshold) && back.lessThanOrEqualTo(backThreshold);
  };

  // LOW BOUND strictly above downPaymentCash so downPaymentCash / price < 1 always (Pitfall 3).
  const low0 = cash.plus(1);

  // CR-01 GUARD: the bisection invariant REQUIRES `passes(low0)`. If even the minimum trial price
  // already fails a DTI ceiling, NO price clears both — there is no fundable ceiling. Return a $0
  // ceiling (NOT a silently-bisected ≈downPaymentCash+1 garbage price) so an infeasible household
  // can never receive a fundable-looking number (T-03-09 / "trustworthiness is the product"). The
  // result SHAPE is unchanged: report the REAL ratios at the infeasible floor and the binding one
  // (whichever is furthest OVER its threshold) via the existing frontGap<=backGap tie convention.
  if (!passes(low0)) {
    const { front, back } = ratiosAt(low0);
    const frontGap = frontThreshold.minus(front);
    const backGap = backThreshold.minus(back);
    const bindingRatio: BindingRatio = frontGap.lessThanOrEqualTo(backGap) ? 'frontEnd' : 'backEnd';
    return {
      bankMaxPrice: Money.zero(),
      bankMaxLoan: Money.zero().sub(Money.of(cash.toFixed())),
      frontEndRatio: front.toFixed(),
      backEndRatio: back.toFixed(),
      bindingRatio,
    };
  }

  let low = low0;
  // HIGH BOUND: exponentially bracket until it FAILS (no hard-coded ceiling). Start at 2× cash.
  let high = cash.times(2);
  let doublings = 0;
  while (passes(high) && doublings < MAX_BRACKET_DOUBLINGS) {
    high = high.times(2);
    doublings += 1;
  }

  // CR-02 GUARD: the bracket loop can also exit because the doubling CAP was hit while `passes(high)`
  // is STILL true — the failing-side invariant is then violated and bisection would narrow around
  // still-passing prices, returning a non-maximal (silently wrong) ceiling. Surface it as a loud,
  // diagnosable Error instead (T-03-10). Placed BEFORE the bisection loop.
  if (passes(high)) {
    throw new Error(
      `bankAffordability: exhausted MAX_BRACKET_DOUBLINGS (${MAX_BRACKET_DOUBLINGS}) without ` +
        'bracketing a failing price — the constraint never became false within the search range ' +
        '(check passes() monotonicity).',
    );
  }

  // Bisect to the cent: invariant `passes(low) && !passes(high)`, narrowed to $0.01.
  let steps = 0;
  while (high.minus(low).greaterThan(CENT) && steps < MAX_BISECTION_STEPS) {
    const mid = low.plus(high).div(2);
    if (passes(mid)) {
      low = mid;
    } else {
      high = mid;
    }
    steps += 1;
  }

  // The largest passing price to the cent (low is the passing side of the bracket).
  const solvedPriceDec = low.toDecimalPlaces(2, Dec.ROUND_HALF_EVEN);
  const bankMaxPrice = Money.of(solvedPriceDec.toFixed());
  const bankMaxLoan = bankMaxPrice.sub(Money.of(cash.toFixed()));

  // Ratios + binding constraint at the solved price. Binding = the ceiling NEAREST its threshold
  // (smallest remaining headroom); front-end wins ties (it is the tighter ceiling).
  const { front, back } = ratiosAt(solvedPriceDec);
  const frontGap = frontThreshold.minus(front);
  const backGap = backThreshold.minus(back);
  const bindingRatio: BindingRatio = frontGap.lessThanOrEqualTo(backGap) ? 'frontEnd' : 'backEnd';

  return {
    bankMaxPrice,
    bankMaxLoan,
    frontEndRatio: front.toFixed(),
    backEndRatio: back.toFixed(),
    bindingRatio,
  };
}
