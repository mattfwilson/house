// DTI derivations from the TCO breakdown (AFF-01, D-14) — the gating numerator split for the
// bank-affordability solver. This module owns the single highest-correctness-risk decision in
// the affordability engine: WHICH TCO lines the lender counts as housing cost.
//
// THE D-14 SPLIT (Pitfall 1): the lender's DTI carrying cost is PITI + HOA + PMI —
//   P+I + propertyTax + insurance + pmi + hoa
// It EXCLUDES:
//   - `maintenance`      — an owner reality, NOT a lender underwriting input.
//   - `amortizedClosing` — a t=0 lump (display-amortized in the TCO breakdown), never a
//                          recurring monthly obligation a lender ratios against.
// It is therefore NEVER `tco.total.monthly` (which includes both of those). Using `tco.total`
// here would silently inflate the housing payment and under-approve the borrower — the exact
// bug the D-14 exclusion test pins.
//
// Both ratios use the GROSS-monthly denominator — gross annual income / 12 — NEVER net/take-home
// (Pitfall 2, D-04). There is deliberately NO `× (1 − taxRate)` anywhere near the denominator;
// DTI is a gross-income ratio by definition.
//
// Dec/Money discipline (the tco.ts precedent, D-03 / CORE-02): the numerator is assembled with
// the closed `Money` API (the line monthlies are already cent-pinned Money); the ratios are
// computed in the frozen `Dec` clone (the numerator's `toDecimalString()` over the gross-monthly
// Dec) and returned as a `Dec` so the solver can compare them against the DTI thresholds
// directly. `Dec` is an internal type here — the affordability barrel (Plan 04) decides what,
// if anything, crosses the public boundary.
import { Dec, type DecimalInstance } from '../money/decimal-config.js';
import { Money } from '../money/money.js';
import type { TcoBreakdown } from '../tco/tco.js';

/**
 * The lender's DTI carrying cost (D-14): the recurring monthly housing payment a lender ratios
 * against — `principalAndInterest + propertyTax + insurance + pmi + hoa` (PITI + HOA + PMI).
 *
 * EXCLUDES `tco.maintenance` (an owner reality, not a lender input) and `tco.amortizedClosing`
 * (a t=0 lump). Deliberately does NOT read `tco.total` (Pitfall 1). The TCO line monthlies are
 * already whole-cent `Money`, so the sum is an exact-cent figure.
 */
export function lenderDtiCarryingCost(tco: TcoBreakdown): Money {
  return tco.principalAndInterest.monthly
    .add(tco.propertyTax.monthly)
    .add(tco.insurance.monthly)
    .add(tco.pmi.monthly)
    .add(tco.hoa.monthly);
}

/** Gross MONTHLY income as a `Dec` (gross annual / 12) — the shared DTI denominator (D-04). */
function grossMonthly(grossAnnualIncome: string): DecimalInstance {
  return new Dec(grossAnnualIncome).div(12);
}

/**
 * Front-end (housing) DTI ratio: `lenderDtiCarryingCost / grossMonthly`, in `Dec`.
 *
 * `grossAnnualIncome` is the household's GROSS (pre-tax) annual income — never net (Pitfall 2):
 * the denominator is `grossAnnualIncome / 12` with NO tax haircut. Returned as a `Dec` so the
 * solver can compare it against `assumptions.dti.frontEnd` without re-parsing.
 */
export function frontEndRatio(tco: TcoBreakdown, grossAnnualIncome: string): DecimalInstance {
  const numerator = new Dec(lenderDtiCarryingCost(tco).toDecimalString());
  return numerator.div(grossMonthly(grossAnnualIncome));
}

/**
 * Back-end (total) DTI ratio: `(lenderDtiCarryingCost + existingMonthlyDebt) / grossMonthly`,
 * in `Dec`.
 *
 * `existingMonthlyDebt` is the SINGLE monthly minimum-obligations total (car/student/card
 * minimums) — a monthly payment total, NOT outstanding balances (D-10) — added to the housing
 * numerator in `Dec`. The denominator is the SAME GROSS-monthly income as the front-end
 * (Pitfall 2): no net conversion.
 */
export function backEndRatio(
  tco: TcoBreakdown,
  grossAnnualIncome: string,
  existingMonthlyDebt: string,
): DecimalInstance {
  const numerator = new Dec(lenderDtiCarryingCost(tco).toDecimalString()).plus(
    new Dec(existingMonthlyDebt),
  );
  return numerator.div(grossMonthly(grossAnnualIncome));
}
