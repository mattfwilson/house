// fi-paths.ts — the SHARED builder of the two honest FI paths (buy + keep-renting baseline).
//
// This is the single source of the opportunity-cost symmetry that is the product's correctness
// core (D-04 / D-05). It was extracted from `fi-impact.ts` verbatim so that BOTH `fiImpact` (which
// projects each path to its scalar FI date) AND `fiTrajectory` (which emits the month-by-month
// net-worth series for the D-07 chart) build the EXACT same `PathBundle`s — same seed, same
// contribution, same liquidated-equity convention. Neither caller re-derives the seed/premium/
// equity math; they share `buildFiPaths`, so the series and the FI crossing cannot disagree (SC-2).
//
//   - BUY (D-04): buying SINKS cash the renter keeps invested. At t=0 the down payment + closing is
//     FOREGONE investment, so the buy seed = current investable NW − (downPayment + closing). Each
//     month the ownership premium (`buyMonthlyOutflowAt(month) − grown rent`) is a FOREGONE
//     contribution: the buy path contributes `monthlySavings − premium` (which can go NEGATIVE — the
//     honest don't-buy direction). The buy NW toward its target counts liquid side-portfolio +
//     LIQUIDATED home equity (A5, via `equityFor`). Projected against the OWNER target.
//
//   - RENTER BASELINE (D-05): keep renting at `currentRent` and invest every dollar the buy path
//     sank — the DP+closing cash stays liquid (seed = current investable NW) and the monthly premium
//     is invested too (the renter contributes the FULL `monthlySavings`). No `equityFor` (no house
//     to sell). Projected against the RENTER target. Independent of the house price.
//
// Dec/Money discipline (CORE-02): the seed/premium/equity math lives in the frozen `Dec` clone;
// dollars enter as `Money` and cross to the projection as canonical decimal STRINGS. `Dec` is NOT
// re-exported from the barrel — `PathBundle`/`buildFiPaths` consume/return the internal `Dec` type
// and stay internal (T-7-05). Determinism (D-13): no `Date.now`/`Math.random`; every rate + the
// loop bound come from the input.
import { Dec } from '../money/decimal-config.js';
import { Money } from '../money/money.js';
import type { EngineInput } from '../engine/engine-input.js';
import { monthlyGrowthFactor } from '../tco/compounding.js';
import { computeTco } from '../tco/tco.js';
import { buyMonthlyOutflowAt } from '../tco/rent-vs-buy.js';
import { closingCosts, otherOneTimeCosts } from '../tco/closing-costs.js';
import { amortizationSchedule } from '../tco/amortization.js';
import { homeValueAt } from '../tco/carrying-costs.js';
import { fiTargets, type FiTargets } from './fi-target.js';

/** The exact 1/12 rate string (full Dec precision) for an annual = monthly × 12 split. */
const ONE_TWELFTH = new Dec(1).div(12).toFixed();

/**
 * A built path's projection inputs (seed + contribution + optional equity). This is structurally
 * the `ProjectFiDateOptions` shape — `fiImpact` feeds it straight into `projectFiDate`, and
 * `fiTrajectory` runs the same contribute-then-compound loop over it to emit the series.
 */
export interface PathBundle {
  readonly seedDollars: string;
  readonly target: Money;
  readonly contributionFor: (month: number) => InstanceType<typeof Dec>;
  readonly factor: InstanceType<typeof Dec>;
  readonly equityFor?: (month: number) => InstanceType<typeof Dec>;
  readonly maxHorizonMonths: number;
}

/** Both built paths plus the surfaced targets + the shared horizon cap — the unit both callers reuse. */
export interface FiPaths {
  readonly buy: PathBundle;
  readonly baseline: PathBundle;
  readonly targets: FiTargets;
  readonly maxHorizonMonths: number;
}

/**
 * The t=0 cash the BUY path sinks into the transaction (D-04 / D-11): down payment + closing +
 * any other one-time costs. Reuses `closingCosts` + the down-payment derivation EXACTLY as
 * `rentVsBuy` (rent-vs-buy.ts 182-187) — never re-derives the closing %-of-price math.
 */
function buyUpfront(input: EngineInput): Money {
  const { scenario, assumptions } = input;
  const { price, downPaymentPct, closingCostsOverride, otherOneTimeCosts: other } = scenario;
  const downPayment = Money.of(price).mul(downPaymentPct);
  const closingLump = closingCosts(price, assumptions.closing.rateOfPrice, closingCostsOverride);
  return other !== undefined
    ? downPayment.add(closingLump).add(otherOneTimeCosts(other))
    : downPayment.add(closingLump);
}

/**
 * The renter's monthly rent for a given 1-based hold `month`, grown at the (flat-by-default) real
 * rent growth factor — the SAME convention `rentVsBuy` uses (rent-vs-buy.ts 209-239), so the
 * ownership premium here matches the trajectory engine's premium. Computed in `Dec`.
 */
function grownRentAt(
  monthlyRent: string,
  rentMonthlyFactor: InstanceType<typeof Dec>,
  month: number,
): InstanceType<typeof Dec> {
  // rentVsBuy applies `currentRent.times(rentMonthly)` at the END of each month, so month 1 pays the
  // un-grown rent; month m pays rent × factor^(m-1). Match that exactly.
  return new Dec(monthlyRent).times(rentMonthlyFactor.pow(new Dec(month - 1)));
}

/**
 * The buy path's liquidated home equity at a 1-based hold `month` (A5): `(homeValueAt − schedule
 * balance) × (1 − sellCostPct)`. This is the MONTHLY analogue of rentVsBuy's year-boundary equity
 * snapshot (rent-vs-buy.ts:242-253), RECONCILED to share its valuation basis — NOT a blind copy
 * (WR-01 / IN-04):
 *
 *   - HOME-VALUE YEAR (the bit that was silently diverging): `Math.max(0, Math.floor(month / 12))`.
 *     At every year boundary this EQUALS rentVsBuy's `month / 12` — month 12 → year 1, month 24 →
 *     year 2 — so the two instruments value the same hold-month-12 home at the SAME appreciated year
 *     (the old `floor((month-1)/12)` valued month 12 at year 0, one year of appreciation too few).
 *     Between boundaries the FI path values monthly at the just-passed year (months 1-11 → year 0).
 *     The `Math.max(0, …)` clamp pins month 0 → year 0 (never a NEGATIVE year — closes IN-02, since
 *     projection.ts:85 seeds the month-0 check with `equityFor(0)`).
 *   - SCHEDULE-BALANCE INDEX: `month - 1` with the same out-of-range clamp as rentVsBuy
 *     (rent-vs-buy.ts:249) — a hold past the amortization term means the loan is paid off, balance
 *     $0.00. This index ALREADY agreed between the two instruments and is unchanged.
 *
 * Exported (module-level, pure — `Dec` in/out) so the convention is unit-pinned in the test suite
 * (T-04-G4: a future blind "reconcile" of the two equity conventions fails CI).
 */
export function buyEquityAt(opts: {
  price: string;
  appreciationRealAnnual: string;
  schedule: ReturnType<typeof amortizationSchedule>;
  sellRetain: InstanceType<typeof Dec>;
  month: number;
}): InstanceType<typeof Dec> {
  const { price, appreciationRealAnnual, schedule, sellRetain, month } = opts;
  // Reconciled home-value year: agrees with rentVsBuy's `month/12` at every boundary; never < 0.
  const year = Math.max(0, Math.floor(month / 12));
  const homeValue = new Dec(homeValueAt(price, appreciationRealAnnual, year).toDecimalString());
  // Schedule-balance index `month - 1`, clamped: a hold past payoff means $0.00 balance (full equity).
  const row = month - 1 >= 0 && month - 1 < schedule.rows.length ? schedule.rows[month - 1]! : undefined;
  const remainingBalance = row ? new Dec(row.balance.toDecimalString()) : new Dec(0);
  return homeValue.minus(remainingBalance).times(sellRetain);
}

/**
 * Build the BUY path (D-04): seed = investable NW − (DP + closing); monthly contribution =
 * `monthlySavings − ownership premium`, premium = `buyMonthlyOutflowAt(month) − grown rent`
 * (reusing `buyMonthlyOutflowAt` — NEVER re-summing P+I/tax/ins/maint/PMI); NW = liquid + liquidated
 * home equity (A5, via `buyEquityAt`). Projected against the OWNER target.
 */
function buyPath(
  input: EngineInput,
  targets: FiTargets,
  monthlySavings: InstanceType<typeof Dec>,
  factor: InstanceType<typeof Dec>,
  rentMonthlyFactor: InstanceType<typeof Dec>,
  maxHorizonMonths: number,
): PathBundle {
  const { scenario, assumptions } = input;
  const { price, downPaymentPct, annualRate, termMonths, monthlyRent } = scenario;
  const appreciationRealAnnual = assumptions.appreciation.realAnnual;
  const sellRetain = new Dec(1).minus(new Dec(assumptions.transaction.sellCostPct));

  // Seed = current investable NW minus the t=0 transaction cash (foregone investment, D-04).
  const availableNetWorth = Money.of(input.household!.availableNetWorth);
  const seed = availableNetWorth.sub(buyUpfront(input));

  // Amortization schedule for the forced-equity balance (reused, not re-derived).
  const loan = new Dec(price).times(new Dec(1).minus(new Dec(downPaymentPct))).toFixed();
  const schedule = amortizationSchedule(loan, annualRate, termMonths);

  // Contribution = monthlySavings − ownership premium. Premium = ownership outflow − grown rent
  // (the renter pays only rent, so the EXTRA cost of owning is foregone savings). Can go NEGATIVE
  // (premium > savings) — the honest don't-buy direction (NW erodes; the path goes unreached).
  const contributionFor = (month: number): InstanceType<typeof Dec> => {
    const ownershipOutflow = new Dec(buyMonthlyOutflowAt(input, month).toDecimalString());
    const premium = ownershipOutflow.minus(grownRentAt(monthlyRent, rentMonthlyFactor, month));
    return monthlySavings.minus(premium);
  };

  // A5: liquidated home equity per month, via the reconciled `buyEquityAt` (home-value year agrees
  // with rentVsBuy at boundaries; schedule-balance index `month - 1` shared; month 0 clamped to
  // year 0 — see `buyEquityAt`).
  const equityFor = (month: number): InstanceType<typeof Dec> =>
    buyEquityAt({ price, appreciationRealAnnual, schedule, sellRetain, month });

  return {
    seedDollars: seed.toDecimalString(),
    target: targets.ownerTarget,
    contributionFor,
    factor,
    equityFor,
    maxHorizonMonths,
  };
}

/**
 * Build the RENTER BASELINE (D-05): keep renting at `currentRent` and invest every dollar the buy
 * path sank. Seed = current investable NW (the DP+closing cash stays liquid — the renter never buys
 * a house); contribution = the FULL `monthlySavings` (the renter pays only rent). No `equityFor`
 * (no house to sell). Projected against the RENTER target. Independent of the house price.
 */
function renterBaselinePath(
  input: EngineInput,
  targets: FiTargets,
  monthlySavings: InstanceType<typeof Dec>,
  factor: InstanceType<typeof Dec>,
  maxHorizonMonths: number,
): PathBundle {
  const availableNetWorth = Money.of(input.household!.availableNetWorth);
  return {
    seedDollars: availableNetWorth.toDecimalString(),
    target: targets.renterTarget,
    contributionFor: () => monthlySavings,
    factor,
    maxHorizonMonths,
  };
}

/**
 * Build BOTH honest FI paths for a household + scenario (the shared substrate `fiImpact` and
 * `fiTrajectory` both consume). Requires `input.household` — the FI number
 * (`targetAnnualRetirementSpend`) and the savings/NW that drive both paths live there — throwing a
 * clear error if absent (mirroring `fiImpact` / `fiTargets`). Computes the TCO + targets ONCE,
 * derives the shared compounding factor + monthly savings, and returns the two `PathBundle`s plus
 * the surfaced targets and the horizon cap.
 */
export function buildFiPaths(input: EngineInput): FiPaths {
  const household = input.household;
  if (household === undefined) {
    throw new Error(
      'fiImpact/fiTrajectory require input.household — the FI-impact compares the buy path against ' +
        'the keep-renting baseline, both driven by the household FI number ' +
        '(targetAnnualRetirementSpend), savings, and net worth. Build the EngineInput with a ' +
        'household block.',
    );
  }

  const tco = computeTco(input);
  const targets = fiTargets(input, tco);

  // Shared real monthly compounding factor (L1) and the rent-growth factor (matching rentVsBuy).
  const factor = monthlyGrowthFactor(input.assumptions.returns.realAnnual);
  const rentMonthlyFactor = monthlyGrowthFactor(input.assumptions.rent.realGrowthAnnual);

  // Monthly savings baseline = currentAnnualSavings / 12 (the renter invests the full amount; the
  // buyer invests this minus the ownership premium).
  const monthlySavings = new Dec(household.currentAnnualSavings).times(ONE_TWELFTH);

  // The cap from V3 stored data — Number() only at the loop-bound boundary (decStr stays a string).
  const maxHorizonMonths = Number(input.assumptions.projection.maxHorizonYears) * 12;

  const buy = buyPath(input, targets, monthlySavings, factor, rentMonthlyFactor, maxHorizonMonths);
  const baseline = renterBaselinePath(input, targets, monthlySavings, factor, maxHorizonMonths);

  return { buy, baseline, targets, maxHorizonMonths };
}
