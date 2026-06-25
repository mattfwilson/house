// rentVsBuy — the two-portfolio rent-vs-buy net-worth engine (TCO-07 / SC5).
//
// This is the flagship-enabling substrate Phase 4 (FI-Impact) layers FI-date / ranking /
// sensitivity on top of — Phase 4 does NOT rebuild trajectory math. It is the gating defense
// against the two existential pitfalls of a rent-vs-buy comparison:
//
//   PITFALL 6 (opportunity-cost asymmetry): a naive calculator invests the difference for the
//     renter but lets the owner's "savings" vanish, or grows home equity at the stock-market
//     return. BOTH are wrong and both bias toward "buy". This engine is SYMMETRIC — whichever
//     path is cheaper EACH MONTH invests the absolute difference into ITS OWN portfolio — and
//     grows home equity at a SEPARATE, conservative `appreciation.realAnnual` (NOT the
//     portfolio `returns.realAnnual`), liquidated with the explicit `transaction.sellCostPct`
//     haircut at the horizon (D-04 / D-05).
//
//   PITFALL 5 (naive real-vs-nominal): subtracting inflation from a nominal return
//     (`nominal - inflation`) overstates the real return. The Fisher relation
//     `(1+nominal)/(1+inflation) - 1` is correct. This module exposes `toReal` for the case a
//     NOMINAL knob exists — but the project convention (D-02) is ALL-REAL (today's dollars):
//     `returns.realAnnual`, `appreciation.realAnnual`, and `rent.realGrowthAnnual` are ALREADY
//     real and are consumed DIRECTLY, never double-converted through `toReal`. Because
//     everything is real, inflation does not enter the compounding at all.
//
// THE MODEL (all in today's dollars — D-02):
//   - t=0: the BUY path commits cash up front = down payment + closing costs + any other
//     one-time costs (D-11/D-13). The RENT path invests exactly that cash as the seed of its
//     portfolio (the renter keeps the money the buyer sank into the transaction).
//   - Each month over the hold: the BUY monthly outflow is the recurring TCO total EXCLUDING
//     the amortized-closing line (closing is the t=0 lump, not a monthly cost — D-11); the
//     RENT monthly outflow is `monthlyRent`, grown at `rent.realGrowthAnnual` (flat by default,
//     D-06). The cheaper path invests the absolute monthly difference into ITS OWN portfolio.
//     Both portfolios compound MONTHLY at the real return (annual real -> monthly factor in Dec).
//   - BUY home equity each year = home value (price grown at `appreciation.realAnnual`) minus
//     the remaining loan balance read from the amortization schedule (principal paid IS forced
//     savings). At the horizon the equity is LIQUIDATED: `equity x (1 - sellCostPct)`.
//   - ENDING NET WORTH: BUY = liquidated equity + BUY side-portfolio; RENT = RENT portfolio.
//   - CROSSOVER YEAR = the first hold year whose BUY ending net worth >= RENT ending net worth
//     (recomputing the "what if we sold at year k" ending net worth for each k), else null.
//
// Dec/Money discipline (the canary.ts precedent, D-03 / CORE-02): all compounding, the Fisher
// math, and every comparison happen in the frozen `Dec` clone (34-digit, HALF_EVEN); dollars
// cross into `Money` only via `Money.of(d.toFixed())` and the closed `Money` API. `Dec` is NOT
// re-exported — downstream never re-opens the bare-float hole.
import { Dec } from '../money/decimal-config.js';
import { Money } from '../money/money.js';
import type { EngineInput } from '../engine/engine-input.js';
import { computeTco } from './tco.js';
import { amortizationSchedule } from './amortization.js';
import { maintenanceAnnual, homeValueAt } from './carrying-costs.js';
import { annualPropertyTax, assessedValueAt } from './property-tax.js';
import { closingCosts, otherOneTimeCosts } from './closing-costs.js';

/** The exact 1/12 rate string (full Dec precision) used to derive a monthly = annual / 12. */
const ONE_TWELFTH = new Dec(1).div(12).toFixed();

/** The closed rent-vs-buy result: ending net worth per path + the crossover + the verdict. */
export interface RentVsBuyResult {
  /** Liquidated home equity (after the sell haircut) + the BUY side-portfolio at the horizon. */
  readonly buyEndingNetWorth: Money;
  /** The RENT portfolio at the horizon (DP + closing seed + invested monthly differences). */
  readonly rentEndingNetWorth: Money;
  /** First hold year (1-based) BUY ending NW >= RENT ending NW; null if never within the hold. */
  readonly crossoverYear: number | null;
  /** The verdict at the horizon. */
  readonly winner: 'buy' | 'rent' | 'tie';
  /** The hold length (years) the comparison was run over. */
  readonly holdingYears: number;
}

/**
 * The Fisher real return: `(1 + nominal) / (1 + inflation) - 1`, in `Dec` (NEVER the naive
 * `nominal - inflation`, which overstates the real return — Pitfall 5). Exposed for the case a
 * caller has a NOMINAL knob to convert; the all-real project convention (D-02) means the
 * engine's own real rates are consumed directly and are NOT passed through this.
 */
export function toReal(nominal: string, inflation: string): InstanceType<typeof Dec> {
  return new Dec(1).plus(new Dec(nominal)).div(new Dec(1).plus(new Dec(inflation))).minus(1);
}

/**
 * The monthly compounding factor for an ANNUAL real rate `r`: `(1 + r)^(1/12)`, kept at full
 * `Dec` precision. Monthly compounding of an annual real return (not a naive `r/12`) so the
 * portfolio grows consistently with the annual figure.
 */
function monthlyGrowthFactor(annualReal: string): InstanceType<typeof Dec> {
  return new Dec(1).plus(new Dec(annualReal)).pow(new Dec(1).div(12));
}

/**
 * The BUY path's recurring monthly outflow for a given 1-based hold `month` (WR-02 + WR-03).
 *
 * Unlike the year-0 `computeTco` snapshot, this is a TIME-VARYING outflow:
 *   - P+I, insurance, HOA are FLAT (their real semantics — D-15): taken from the year-0 TCO
 *     line monthlies (the closing line is excluded — closing is the t=0 lump, D-11).
 *   - PROPERTY TAX + MAINTENANCE GROW with appreciation (WR-03): recomputed for the month's hold
 *     year on the appreciating assessed/home value (`assessedValueAt` / `homeValueAt`), using the
 *     SAME captured mill rate (`tco.resolvedMillRate`) as the TCO breakdown so the rates agree.
 *   - PMI is charged ONLY while `month <= pmiDropOffMonth` (WR-02): the FULL monthly premium each
 *     month up to and including drop-off, $0.00 after (a time-limited cost, not a flat lifetime
 *     charge). When no PMI applies (`pmiDropOffMonth` null) it is $0.00 throughout.
 *
 * All growth/division in `Dec`; the result crosses into `Money` once via `.toFixed()`. Exported
 * for the rent-vs-buy loop and its locking tests (an internal-but-testable helper, like `toReal`).
 */
export function buyMonthlyOutflowAt(input: EngineInput, month: number): Money {
  const { scenario, assumptions } = input;
  const { price, downPaymentPct } = scenario;
  const assessmentRatio = assumptions.tax.assessmentRatio;
  const appreciationRealAnnual = assumptions.appreciation.realAnnual;
  const maintenancePctOfValue = assumptions.maintenance.annualPctOfValue;
  const pmiAnnualRateOfLoan = assumptions.pmi.annualRateOfLoan;

  const tco = computeTco(input);

  // FLAT components (real semantics): P+I + insurance + HOA, all monthly.
  const flatMonthly = tco.principalAndInterest.monthly
    .add(tco.insurance.monthly)
    .add(tco.hoa.monthly);

  // GROWING components (WR-03): property tax + maintenance recomputed for THIS month's hold year
  // (0-based: months 1-12 are year 0). Uses the captured mill rate so the rate matches the TCO.
  const holdYear = Math.floor((month - 1) / 12);
  const assessedValue = assessedValueAt(price, assessmentRatio, appreciationRealAnnual, holdYear);
  const propertyTaxMonthly = annualPropertyTax(assessedValue, tco.resolvedMillRate).mul(ONE_TWELFTH);
  const homeValue = homeValueAt(price, appreciationRealAnnual, holdYear);
  const maintenanceMonthly = maintenanceAnnual(homeValue, maintenancePctOfValue).mul(ONE_TWELFTH);

  // MONTH-GATED PMI (WR-02): the full monthly premium only while month <= drop-off, else $0.00.
  let pmiMonthly = Money.zero();
  if (tco.pmiDropOffMonth !== null && month <= tco.pmiDropOffMonth) {
    const loan = new Dec(price).times(new Dec(1).minus(new Dec(downPaymentPct))).toFixed();
    const monthlyPmiRate = new Dec(pmiAnnualRateOfLoan).div(12).toFixed();
    pmiMonthly = Money.of(loan).mul(monthlyPmiRate);
  }

  return flatMonthly.add(propertyTaxMonthly).add(maintenanceMonthly).add(pmiMonthly);
}

/**
 * Compute the two-portfolio rent-vs-buy result for a frozen widened EngineInput.
 *
 * Reads `scenario` (price, downPaymentPct, holdingYears, monthlyRent, + the fields `computeTco`
 * consumes) and `assumptions` (`returns.realAnnual`, `appreciation.realAnnual`,
 * `rent.realGrowthAnnual`, `transaction.sellCostPct`, `closing.rateOfPrice`). Projects the two
 * symmetric portfolios month by month and reports ending net worth per path + the crossover.
 */
export function rentVsBuy(input: EngineInput): RentVsBuyResult {
  const { scenario, assumptions } = input;
  const {
    price,
    downPaymentPct,
    annualRate,
    termMonths,
    holdingYears,
    monthlyRent,
    closingCostsOverride,
    otherOneTimeCosts: otherOneTimeCostsInput,
  } = scenario;

  const realAnnual = assumptions.returns.realAnnual; // already REAL — consumed directly (D-02).
  const appreciationRealAnnual = assumptions.appreciation.realAnnual;
  const rentGrowthRealAnnual = assumptions.rent.realGrowthAnnual;
  const sellCostPct = assumptions.transaction.sellCostPct;
  const closingRateOfPrice = assumptions.closing.rateOfPrice;

  // --- t=0 lump the BUY path commits (D-11/D-13): down payment + closing + other one-time. ---
  const downPayment = Money.of(price).mul(downPaymentPct);
  const closingLump = closingCosts(price, closingRateOfPrice, closingCostsOverride);
  const upfront =
    otherOneTimeCostsInput !== undefined
      ? downPayment.add(closingLump).add(otherOneTimeCosts(otherOneTimeCostsInput))
      : downPayment.add(closingLump);

  // --- The recurring BUY monthly outflow is TIME-VARYING (WR-02 + WR-03): P+I/ins/HOA flat,
  // property-tax + maintenance GROW with appreciation, and PMI is charged only through its
  // drop-off month. It excludes the amortized-closing line (closing is the t=0 lump, D-11).
  // Computed per month via `buyMonthlyOutflowAt` (NOT held flat at the year-0 TCO total). ---

  // --- Amortization schedule: remaining loan balance per month (forced-savings principal). ---
  const loan = new Dec(price).times(new Dec(1).minus(new Dec(downPaymentPct))).toFixed();
  const schedule = amortizationSchedule(loan, annualRate, termMonths);

  // --- Monthly compounding factors (real, monthly) for the two portfolios. ---
  const portfolioMonthly = monthlyGrowthFactor(realAnnual);
  // Monthly rent growth factor: annual real rent growth spread monthly.
  const rentMonthly = monthlyGrowthFactor(rentGrowthRealAnnual);

  const totalMonths = holdingYears * 12;

  // Portfolios carried as full-precision Dec (rounded to Money only at the reported boundary).
  // RENT portfolio is seeded with the upfront cash the buyer sank; BUY side-portfolio starts 0.
  let rentPortfolio = new Dec(upfront.toDecimalString());
  let buyPortfolio = new Dec(0);
  // Current month's rent (grows monthly at the real rent growth factor).
  let currentRent = new Dec(monthlyRent);

  const sellRetain = new Dec(1).minus(new Dec(sellCostPct)); // (1 - sellCostPct)

  // The "ending net worth if we sold at the end of year k" for crossover detection, plus the
  // final figures. We replay month by month, and at each year boundary snapshot the would-be
  // ending net worth of each path.
  const buyEndingByYear: InstanceType<typeof Dec>[] = [];
  const rentEndingByYear: InstanceType<typeof Dec>[] = [];

  for (let month = 1; month <= totalMonths; month++) {
    // Symmetric invest-the-difference: the cheaper path invests |buy - rent| into ITS portfolio.
    // The BUY outflow is recomputed PER MONTH (grows with appreciation; PMI gated at drop-off).
    const buyOut = new Dec(buyMonthlyOutflowAt(input, month).toDecimalString());
    const rentOut = currentRent;
    const diff = buyOut.minus(rentOut).abs();
    if (rentOut.lessThan(buyOut)) {
      // Renting is cheaper this month -> the RENT portfolio invests the difference.
      rentPortfolio = rentPortfolio.plus(diff);
    } else if (buyOut.lessThan(rentOut)) {
      // Buying is cheaper this month -> the BUY side-portfolio invests the difference.
      buyPortfolio = buyPortfolio.plus(diff);
    }

    // Compound both portfolios one month at the real return.
    rentPortfolio = rentPortfolio.times(portfolioMonthly);
    buyPortfolio = buyPortfolio.times(portfolioMonthly);

    // Grow next month's rent at the (flat-by-default) real rent growth factor.
    currentRent = currentRent.times(rentMonthly);

    // At each year boundary, snapshot each path's ending net worth as if sold now.
    if (month % 12 === 0) {
      const year = month / 12;
      // BUY equity at year-end = home value (appreciated) - remaining loan balance, liquidated.
      const homeValue = new Dec(homeValueAt(price, appreciationRealAnnual, year).toDecimalString());
      // CR-01: clamp the schedule index. When the hold runs PAST the amortization term
      // (totalMonths > schedule.rows.length), out-of-range months mean the loan is fully paid
      // off — the remaining balance is $0.00 (full equity), never an out-of-bounds read.
      const row = month - 1 < schedule.rows.length ? schedule.rows[month - 1]! : undefined;
      const remainingBalance = row ? new Dec(row.balance.toDecimalString()) : new Dec(0);
      const equity = homeValue.minus(remainingBalance);
      const liquidatedEquity = equity.times(sellRetain);
      buyEndingByYear.push(liquidatedEquity.plus(buyPortfolio));
      rentEndingByYear.push(rentPortfolio);
    }
  }

  // Ending net worth = the horizon (last) year's snapshot.
  const buyEndDec = buyEndingByYear[holdingYears - 1]!;
  const rentEndDec = rentEndingByYear[holdingYears - 1]!;

  // Crossover = first year BUY ending NW >= RENT ending NW.
  let crossoverYear: number | null = null;
  for (let y = 0; y < holdingYears; y++) {
    if (buyEndingByYear[y]!.greaterThanOrEqualTo(rentEndingByYear[y]!)) {
      crossoverYear = y + 1;
      break;
    }
  }

  const buyEndingNetWorth = Money.of(buyEndDec.toFixed());
  const rentEndingNetWorth = Money.of(rentEndDec.toFixed());

  // Verdict at the horizon (exact bigint-cent comparison via Money).
  const buyCents = buyEndingNetWorth.toCents();
  const rentCents = rentEndingNetWorth.toCents();
  const winner: 'buy' | 'rent' | 'tie' =
    buyCents > rentCents ? 'buy' : rentCents > buyCents ? 'rent' : 'tie';

  return { buyEndingNetWorth, rentEndingNetWorth, crossoverYear, winner, holdingYears };
}
