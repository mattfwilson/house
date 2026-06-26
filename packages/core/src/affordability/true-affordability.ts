// trueAffordability — the TRUE max-price ceiling (AFF-02), the honest answer the product LEADS
// with: "what does our retirement actually allow?" — not "what will a bank lend us." It is the
// LOWER of two ceilings (D-05):
//
//   A. THE SAVINGS-RATE FLOOR (the AFF-02 proxy). This is a savings-rate floor, NOT a FI-date
//      projection (D-01 — the real FI-date math is Phase 4). It uses the SECOND of the two D-14
//      numerators: the CASH SAVINGS DRAIN (`tco.total − amortizedClosing`, which KEEPS
//      maintenance) — deliberately distinct from the lender DTI numerator (Plan 02), which DROPS
//      maintenance. The premium is INCREMENTAL over the household's `currentRent` (D-03); the
//      baseline savings figure is `currentAnnualSavings` (D-17); the denominator is GROSS income
//      (D-04 — never net). The ceiling is the largest price at which post-purchase savings still
//      clear `targetSavingsRate`.
//
//   B. THE CASH-ON-HAND GATE. The savings floor can say "the monthly works" while the buyer still
//      cannot FUND the purchase. This gate catches that: the largest price where
//      `downPaymentCash + closingCosts(price) <= availableNetWorth − reserve` (D-05). `reserve` is
//      the household field consumed AS-IS — no engine-side default (A1). It reuses `closingCosts`;
//      it never re-derives closing math.
//
// `trueMaxPrice = min(A, B)`, compared to the cent via `Money.toCents()` bigint cents (mirroring
// rent-vs-buy's `winner` cent-exact comparison), and the binding ceiling is reported.
//
// Principal counts as cash out (D-03): the equity offset is Phase 4's job — Phase 3 keeps a
// simple cash measure, exactly `buyMonthlyOutflowAt`'s convention of excluding only the t=0
// closing lump.
//
// THE SEARCH (monotonic bisection to the cent, the Plan 02 solver shape):
//   - Ceiling A is monotonic: as price rises the carrying cost rises, the drain rises, the
//     premium rises, post-purchase savings FALL — so the floor is crossed once. Ceiling B is
//     monotonic too: closing ∝ price, so the cash needed rises with price.
//   - LOW BOUND is strictly ABOVE `downPaymentCash` (`downPaymentCash + 1`) so every trial
//     `downPaymentCash / price` is < 1 and the per-trial `engineInput()` never trips the
//     `ScenarioInputsSchema.downPaymentPct ∈ [0,1)` refine (Pitfall 3 / T-03-05).
//   - HIGH BOUND is found by EXPONENTIAL bracketing (double until the constraint fails) — no
//     hard-coded ceiling. Iteration caps bound both loops as DoS defense-in-depth (T-03-06).
//
// Dec/Money discipline (the tco.ts / bank-affordability.ts precedent, D-03 / CORE-02): all
// bracketing, bisection, ratio comparison, and the `downPaymentPct` derivation happen in the
// frozen `Dec` clone; dollars cross into `Money` only at the cent-pinned result boundary. `Dec`
// is not re-exported.
import { Dec, type DecimalInstance } from '../money/decimal-config.js';
import { Money } from '../money/money.js';
import { engineInput, type EngineInput, type Household } from '../engine/engine-input.js';
import { computeTco, type TcoBreakdown } from '../tco/tco.js';
import { closingCosts } from '../tco/closing-costs.js';

/** Which of the two ceilings is the active (lower-price) constraint at the solved price. */
export type BindingConstraint = 'savingsFloor' | 'cashOnHand';

/** The closed TRUE-affordability result (AFF-02). All dollars are `Money`. */
export interface TrueAffordabilityResult {
  /** `min(savingsRateCeiling, cashOnHandCeiling)` to the cent (D-05). */
  readonly trueMaxPrice: Money;
  /** Largest price whose post-purchase savings rate still clears the target (Ceiling A). */
  readonly savingsRateCeiling: Money;
  /** Largest price the buyer can FUND from net worth after the reserve (Ceiling B, D-05). */
  readonly cashOnHandCeiling: Money;
  /** Whichever ceiling is the binding (lower) constraint — the one `trueMaxPrice` equals. */
  readonly bindingConstraint: BindingConstraint;
}

/**
 * Defense-in-depth iteration caps (T-03-06). Both constraints are monotonic and `computeTco` /
 * `closingCosts` are finite, so bracketing doubles a finite high and bisection terminates at the
 * $0.01 tolerance; these caps bound both loops against a pathological non-terminating sweep.
 */
const MAX_BRACKET_DOUBLINGS = 200;
const MAX_BISECTION_STEPS = 1000;

/** The $0.01 bisection tolerance (cent resolution, D-08). */
const CENT = new Dec('0.01');

/**
 * The CASH SAVINGS DRAIN (the SECOND D-14 numerator): `tco.total.monthly − tco.amortizedClosing`.
 *
 * It KEEPS `maintenance` (an owner reality — it IS a real monthly cash cost, unlike the lender's
 * underwriting view) and excludes ONLY the t=0 closing lump (display-amortized in the breakdown),
 * exactly `buyMonthlyOutflowAt`'s convention (D-03 / D-14). Principal counts as cash out — the
 * equity offset is Phase 4. Deliberately distinct from `lenderDtiCarryingCost`, which DROPS
 * maintenance; the two numerators differ by exactly the maintenance line.
 */
export function cashSavingsDrain(tco: TcoBreakdown): Money {
  return tco.total.monthly.sub(tco.amortizedClosing.monthly);
}

/**
 * Build the frozen trial `EngineInput` for a candidate `price` (Shared P2), identical to the
 * bank-affordability solver: derive `downPaymentPct = downPaymentCash / price` in `Dec`, pin the
 * price to whole cents, and rebuild through `engineInput()` so the trial scenario is RE-VALIDATED
 * at the trust boundary (the in-solver poisoning backstop, T-03-05).
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
 * Generic monotonic max-price solver (the Plan 02 bisection shape, shared by both ceilings):
 * the largest price (to the cent) for which `passes(price)` is true, given `passes` is true at
 * `downPaymentCash + 1` and eventually false as price rises.
 *
 * LOW strictly above `downPaymentCash` (Pitfall 3 / T-03-05); HIGH exponentially bracketed (no
 * hard ceiling); bisect while `high − low > $0.01`; iteration caps as DoS defense (T-03-06).
 */
function solveMaxPrice(cash: DecimalInstance, passes: (price: DecimalInstance) => boolean): Money {
  const low0 = cash.plus(1);

  // CR-01 GUARD: the bisection invariant REQUIRES `passes(low0)`. If even the minimum trial price
  // fails the constraint, NO price passes — return a $0 ceiling rather than silently bisecting an
  // unbracketed interval down to ≈downPaymentCash+1 (a fundable-looking wrong answer, T-03-09).
  // This single guard fixes BOTH ceilings (savings floor + cash gate) since they share this solver.
  if (!passes(low0)) {
    return Money.zero();
  }

  let low = low0;
  let high = cash.times(2);
  let doublings = 0;
  while (passes(high) && doublings < MAX_BRACKET_DOUBLINGS) {
    high = high.times(2);
    doublings += 1;
  }

  // CR-02 GUARD: if the bracket loop exited because the doubling CAP was hit while `passes(high)` is
  // STILL true, the failing-side invariant is violated and bisection would return a non-maximal
  // (silently wrong) ceiling. Surface it as a loud, diagnosable Error (T-03-10). Before bisection.
  if (passes(high)) {
    throw new Error(
      `solveMaxPrice (true-affordability): exhausted MAX_BRACKET_DOUBLINGS (${MAX_BRACKET_DOUBLINGS}) ` +
        'without bracketing a failing price — the constraint never became false within the search ' +
        'range (check passes() monotonicity).',
    );
  }

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

  return Money.of(low.toDecimalPlaces(2, Dec.ROUND_HALF_EVEN).toFixed());
}

/**
 * Compute the TRUE affordability ceiling (AFF-02): `min` of the savings-rate floor and the
 * cash-on-hand gate, with the binding constraint reported.
 *
 * Requires `input.household` — TRUE affordability qualifies a SAVER against their own goals, not
 * a bare house (throws a clear error if absent).
 */
export function trueAffordability(input: EngineInput): TrueAffordabilityResult {
  const household = input.household;
  if (household === undefined) {
    throw new Error(
      'trueAffordability requires input.household — a TRUE-affordability solve measures a house ' +
        'against the household savings goal and cash on hand. Build the EngineInput with a ' +
        'household block.',
    );
  }

  const cash = new Dec(household.downPaymentCash);
  const currentRent = new Dec(household.currentRent);
  const currentAnnualSavings = new Dec(household.currentAnnualSavings);
  const grossAnnualIncome = new Dec(household.grossAnnualIncome);
  const targetSavingsRate = new Dec(household.targetSavingsRate);

  // --- Ceiling A: the savings-rate floor (D-03 / D-04 / D-17). ---
  // The post-purchase savings RATE at a trial price, all in Dec:
  //   premium = (cashSavingsDrain − currentRent) × 12   (incremental over rent, D-03)
  //   postPurchaseAnnualSavings = currentAnnualSavings − premium   (D-17)
  //   rate = postPurchaseAnnualSavings / grossAnnualIncome   (gross denominator, D-04)
  // Savings fall as price rises, so `rate >= target` holds up to a single crossover price.
  const passesFloor = (priceDec: DecimalInstance): boolean => {
    const tco = computeTco(inputAtPrice(input, household, priceDec));
    const drain = new Dec(cashSavingsDrain(tco).toDecimalString());
    const annualOwnershipPremium = drain.minus(currentRent).times(12);
    const postPurchaseAnnualSavings = currentAnnualSavings.minus(annualOwnershipPremium);
    return postPurchaseAnnualSavings.div(grossAnnualIncome).greaterThanOrEqualTo(targetSavingsRate);
  };
  const savingsRateCeiling = solveMaxPrice(cash, passesFloor);

  // --- Ceiling B: the cash-on-hand gate (D-05). ---
  // passesCash(price) ⇔ downPaymentCash + closingCosts(price) <= availableNetWorth − reserve.
  // `reserve` is read AS-IS from the household — no engine-side default (A1). closingCosts is
  // reused verbatim (no re-derived closing math); it honors any per-scenario dollar override.
  const cashBudget = new Dec(household.availableNetWorth).minus(new Dec(household.reserve));
  const rateOfPrice = input.assumptions.closing.rateOfPrice;
  const override = input.scenario.closingCostsOverride;
  const passesCash = (priceDec: DecimalInstance): boolean => {
    const price = priceDec.toDecimalPlaces(2, Dec.ROUND_HALF_EVEN).toFixed();
    const closing = new Dec(closingCosts(price, rateOfPrice, override).toDecimalString());
    return cash.plus(closing).lessThanOrEqualTo(cashBudget);
  };
  const cashOnHandCeiling = solveMaxPrice(cash, passesCash);

  // --- trueMaxPrice = min(A, B), cent-exact via bigint cents (mirroring rent-vs-buy's winner). ---
  const savingsCents = savingsRateCeiling.toCents();
  const cashCents = cashOnHandCeiling.toCents();
  const bindingConstraint: BindingConstraint =
    savingsCents <= cashCents ? 'savingsFloor' : 'cashOnHand';
  const trueMaxPrice = bindingConstraint === 'savingsFloor' ? savingsRateCeiling : cashOnHandCeiling;

  return { trueMaxPrice, savingsRateCeiling, cashOnHandCeiling, bindingConstraint };
}
