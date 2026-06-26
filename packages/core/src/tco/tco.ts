// computeTco — the top-level TCO aggregator (TCO-06 / SC4), the single composition point
// the Affordability engine (Phase 3 reuses PITI+HOA+PMI for DTI) and the rent-vs-buy model
// (Plan 05) consume. It takes a frozen widened EngineInput, derives the loan basics, resolves
// the town's FY-stamped mill rate, composes the Plan 02 + Plan 03 per-line calculators, and
// returns a CLOSED monthly + annualized breakdown of every line with all dollars as `Money`.
//
// TWO documented conventions this module pins:
//
//   1. MONEY UNIT CONVENTION — the ANNUALIZED figure is the source of truth for every line;
//      the monthly figure is derived as `annualized × (1/12)` in `Dec`, rounded at the `Money`
//      boundary (the `Money` API has no `div`). This is uniform across all seven lines: even
//      P+I, whose natural unit is the monthly scheduled payment, is stored as
//      `annualized = scheduledPayment × 12` and re-derives the same monthly cents (the round
//      trip is exact for the figures in scope). `total` is the EXACT sum of the seven line
//      monthlies (and likewise annualizeds) — summed as `Money`, compared as bigint cents.
//
//   2. BREAKDOWN SNAPSHOT YEAR — the monthly/annualized breakdown is the YEAR-0 snapshot. The
//      appreciating-value schedule (assessed value / home value growing year over year, which
//      drives a rising property-tax and maintenance line) is exercised by the property-tax and
//      carrying-cost SCHEDULES and by the rent-vs-buy net-worth model in Plan 05 — NOT by this
//      single-year breakdown. So `propertyTax` here is the year-0 bill and `maintenance` the
//      year-0 figure; downstream multi-year math reads the per-year schedules directly.
//
//   3. PMI ANNUALIZATION — DROP-OFF-AWARE (WR-02). PMI is a TIME-LIMITED cost: it stops once the
//      scheduled balance reaches the basis threshold (`pmiDropOffMonth`). Annualizing it as a
//      flat `monthlyPremium × 12` overstates the lifetime PMI cost whenever drop-off falls inside
//      the hold (biasing the rent-vs-buy verdict toward "rent"). So the `pmi` line is the HOLD
//      AVERAGE: total PMI actually paid over the hold = `monthlyPremium × min(dropOffMonth,
//      totalMonths)`, divided by `holdingYears` (and /12 for the monthly). The raw drop-off month
//      is also surfaced as `pmiDropOffMonth` so the rent-vs-buy model can charge PMI month by
//      month (it is null when no PMI applies). NOTE: for an amortizing loan the balance cannot
//      fall 2+ LTV points inside the first 12 months, so drop-off never lands in year 0 — the
//      year-0 PMI charge is always the full 12 months; the hold AVERAGE is what differs from flat.
//
// Dec/Money discipline (the canary.ts precedent, D-03 / CORE-02): the loan = price × (1 −
// downPaymentPct) derivation and the 1/12 monthly division happen in the frozen `Dec` clone;
// dollars cross into `Money` only via the closed `Money` API. `Dec`/`Decimal` are NOT exported
// — downstream code never re-opens the bare-float hole.
//
// Snapshot self-containment (Pitfall 11 / D-08): the result CAPTURES `resolvedMillRate` +
// `millRateFy` from `resolveMillRate(town)` so a replay is self-contained — the captured rate,
// not a live re-read of the town table, is the reproducible record.
import { Dec } from '../money/decimal-config.js';
import { Money } from '../money/money.js';
import type { EngineInput } from '../engine/engine-input.js';
import { scheduledPayment, amortizationSchedule } from './amortization.js';
import { computePmi } from './pmi.js';
import { annualPropertyTax, assessedValueAt, PROP_2_5_FLAG } from './property-tax.js';
import { maintenanceAnnual, homeValueAt, insuranceAnnual, hoaAnnual } from './carrying-costs.js';
import { closingCosts, amortizeOverHold, otherOneTimeCosts } from './closing-costs.js';
import { resolveMillRate } from '../towns/town-table.js';

/** One TCO line presented BOTH monthly and annualized (annualized is the source of truth). */
export interface TcoLine {
  readonly monthly: Money;
  readonly annualized: Money;
}

/**
 * The closed TCO breakdown: the seven line items + a `total`, each a `TcoLine` (no bare-number
 * dollar field — enforced by `tco.type-test.ts` in the `tsc -b` graph), plus the captured mill
 * rate + FY for snapshot reproducibility and the qualitative Prop 2½ flag.
 */
export interface TcoBreakdown {
  readonly principalAndInterest: TcoLine;
  readonly propertyTax: TcoLine;
  readonly insurance: TcoLine;
  readonly maintenance: TcoLine;
  readonly hoa: TcoLine;
  readonly pmi: TcoLine;
  readonly amortizedClosing: TcoLine;
  readonly total: TcoLine;
  /**
   * True exactly when PMI applies — origination LTV > 80% / down payment < 20% — independent of
   * whether drop-off occurs within the term. Pairs with the nullable `pmiDropOffMonth` so callers
   * can distinguish "no PMI" (applies false) from "PMI that never terminates within the term"
   * (applies true, drop-off null). The rent-vs-buy model gates the per-month PMI charge on this
   * (CR-01): a null drop-off no longer silently means "$0 PMI", which biased the verdict to BUY.
   */
  readonly pmiApplies: boolean;
  /**
   * The 1-based scheduled month PMI drops off (balance reaches the basis threshold), or null
   * when no PMI applies. Surfaced so the rent-vs-buy model can charge PMI ONLY while
   * `month <= pmiDropOffMonth` (WR-02) rather than re-deriving it.
   */
  readonly pmiDropOffMonth: number | null;
  /** The resolved residential mill rate (per $1,000, as published) captured for replay. */
  readonly resolvedMillRate: string;
  /** The fiscal year the captured mill rate was published for (snapshot self-containment). */
  readonly millRateFy: number;
  /** Qualitative note: Prop 2½ caps the LEVY, not your individual bill (PROP_2_5_FLAG). */
  readonly propTwoAndHalfFlag: typeof PROP_2_5_FLAG;
}

/** The 1/12 rate string (full `Dec` precision) used to derive monthly = annualized / 12. */
const ONE_TWELFTH = new Dec(1).div(12).toFixed();

/**
 * Pin a `Money` to whole cents (HALF_EVEN) so each PRESENTED line is an exact-cent figure and
 * the `total` is the exact sum of the per-line cents (the acceptance contract). Rounding at the
 * line boundary — not only at the final `total` — is the displayed-breakdown cadence: every
 * line is shown in whole cents and the total adds those displayed cents (no sub-cent drift
 * hidden in the sum). Goes through `Dec.toDecimalPlaces(2)` then back into the closed `Money`
 * API via `.toFixed()` (the canary precedent — never `.toString()`).
 */
function pinToCents(m: Money): Money {
  return Money.of(new Dec(m.toDecimalString()).toDecimalPlaces(2, Dec.ROUND_HALF_EVEN).toFixed());
}

/**
 * Build a `TcoLine` from its ANNUALIZED source figure; monthly = annualized / 12 (in Dec). Both
 * figures are pinned to whole cents so the breakdown is presented in exact cents and `total`
 * sums those cents exactly.
 */
function lineFromAnnual(annualized: Money): TcoLine {
  return {
    monthly: pinToCents(annualized.mul(ONE_TWELFTH)),
    annualized: pinToCents(annualized),
  };
}

/**
 * Aggregate the full year-0 TCO breakdown for a frozen widened EngineInput.
 *
 * Reads `input.scenario` (price, downPaymentPct, annualRate, termMonths, holdingYears, town,
 * insuranceAnnual, hoaMonthly, optional closingCostsOverride, optional otherOneTimeCosts) and
 * `input.assumptions` (V2 slices: tax.assessmentRatio, appreciation.realAnnual,
 * maintenance.annualPctOfValue, closing.rateOfPrice, pmi.annualRateOfLoan). Derives
 * `loan = price × (1 − downPaymentPct)` in `Dec`, resolves the town mill rate (captured into
 * the result), composes every per-line calculator, and returns the closed breakdown.
 */
export function computeTco(input: EngineInput): TcoBreakdown {
  const { scenario, assumptions } = input;
  const {
    price,
    downPaymentPct,
    annualRate,
    termMonths,
    holdingYears,
    town,
    insuranceAnnual: insuranceAnnualInput,
    hoaMonthly,
    closingCostsOverride,
    otherOneTimeCosts: otherOneTimeCostsInput,
  } = scenario;
  const assessmentRatio = assumptions.tax.assessmentRatio;
  const appreciationRealAnnual = assumptions.appreciation.realAnnual;
  const maintenancePctOfValue = assumptions.maintenance.annualPctOfValue;
  const closingRateOfPrice = assumptions.closing.rateOfPrice;
  const pmiAnnualRateOfLoan = assumptions.pmi.annualRateOfLoan;

  // Loan = price × (1 − downPaymentPct), derived in Dec (D-14) and surfaced as a canonical
  // dollar string the calculators consume.
  const loan = new Dec(price).times(new Dec(1).minus(new Dec(downPaymentPct))).toFixed();

  // Snapshot self-containment (Pitfall 11): capture the resolved rate + FY, not a live re-read.
  const resolved = resolveMillRate(town);
  // GAP 1: an OPTIONAL assumption-boundary override wins over the town-table resolution. This is
  // the SINGLE resolution point both `ownerHousingAt` (fi-target.ts) and `buyMonthlyOutflowAt`
  // (rent-vs-buy.ts) inherit via `tco.resolvedMillRate`, so the override flows through BOTH the
  // owner perpetual-tax target AND the monthly ownership premium with no further wiring (ASMP-02 /
  // D-12). The captured rate becomes the override; `millRateFy` stays the town's published FY (the
  // override changes the rate, not the provenance — kept for traceability).
  const effectiveMillRate = assumptions.tax.millRateOverride ?? resolved.residentialMillRate;

  // --- P+I: natural unit is the monthly scheduled payment; annualized = payment × 12. ---
  const principalAndInterest = lineFromAnnual(
    scheduledPayment(loan, annualRate, termMonths).mul('12'),
  );

  // --- Property tax (year-0 bill): assessed value × mill rate (per $1,000). ---
  const assessedValueYear0 = assessedValueAt(price, assessmentRatio, appreciationRealAnnual, 0);
  const propertyTax = lineFromAnnual(annualPropertyTax(assessedValueYear0, effectiveMillRate));

  // --- Insurance (flat) + maintenance (year-0 home value) + HOA (×12 flat). ---
  const insurance = lineFromAnnual(insuranceAnnual(insuranceAnnualInput));
  const homeValueYear0 = homeValueAt(price, appreciationRealAnnual, 0);
  const maintenance = lineFromAnnual(maintenanceAnnual(homeValueYear0, maintenancePctOfValue));
  const hoa = lineFromAnnual(hoaAnnual(hoaMonthly));

  // --- PMI: monthly premium (zero when DP >= 20% / LTV <= 80%); annualized = premium × 12. ---
  const schedule = amortizationSchedule(loan, annualRate, termMonths);
  const pmiResult = computePmi({
    originalValue: price,
    loan,
    schedule,
    annualRateOfLoan: pmiAnnualRateOfLoan,
    basis: 'auto-78',
  });
  // WR-02 drop-off-aware annualization: PMI is charged for only the months up to drop-off (or
  // the whole hold if drop-off is later / never). The annualized figure is the HOLD AVERAGE —
  // total PMI paid over the hold / holdingYears — so it does NOT overstate a time-limited cost.
  const totalMonthsHeld = holdingYears * 12;
  const pmiChargedMonths = pmiResult.applies
    ? Math.min(pmiResult.dropOffMonth ?? totalMonthsHeld, totalMonthsHeld)
    : 0;
  // annualized PMI = monthlyPremium × pmiChargedMonths / holdingYears (the per-year average over
  // the hold); the /holdingYears is done in Dec via Money.mul by the (chargedMonths/holdingYears)
  // rate so the ×12 → ÷12 round trip in lineFromAnnual reproduces the monthly average exactly.
  const pmiAnnualizedRate =
    holdingYears > 0 ? new Dec(pmiChargedMonths).div(holdingYears).toFixed() : '0';
  const pmi = lineFromAnnual(pmiResult.monthlyPremium.mul(pmiAnnualizedRate));

  // --- Amortized closing: (closing costs + other one-time costs) spread over the hold. ---
  const closingLump = closingCosts(price, closingRateOfPrice, closingCostsOverride);
  const oneTimeTotal =
    otherOneTimeCostsInput !== undefined
      ? closingLump.add(otherOneTimeCosts(otherOneTimeCostsInput))
      : closingLump;
  const amortizedClosing = lineFromAnnual(amortizeOverHold(oneTimeTotal, holdingYears).annual);

  // --- Total: EXACT sum of the seven lines (monthly and annualized), summed as Money. ---
  const lines = [
    principalAndInterest,
    propertyTax,
    insurance,
    maintenance,
    hoa,
    pmi,
    amortizedClosing,
  ];
  const totalMonthly = lines.reduce((acc, l) => acc.add(l.monthly), Money.zero());
  const totalAnnualized = lines.reduce((acc, l) => acc.add(l.annualized), Money.zero());
  const total: TcoLine = { monthly: totalMonthly, annualized: totalAnnualized };

  return {
    principalAndInterest,
    propertyTax,
    insurance,
    maintenance,
    hoa,
    pmi,
    amortizedClosing,
    total,
    pmiApplies: pmiResult.applies,
    pmiDropOffMonth: pmiResult.applies ? pmiResult.dropOffMonth : null,
    resolvedMillRate: effectiveMillRate,
    millRateFy: resolved.fy,
    propTwoAndHalfFlag: PROP_2_5_FLAG,
  };
}
