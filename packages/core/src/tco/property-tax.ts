// Property tax (TCO-02) — the gating correctness pitfall of the TCO breakdown (Pitfall 9).
//
// THE PITFALL: Massachusetts Proposition 2½ caps the growth of a town's total LEVY (the
// aggregate amount a municipality may raise), NOT any individual homeowner's bill. Modeling
// property tax as a flat % of value, or clamping each year's bill growth at 2.5%, is wrong.
// The correct model is:
//   - bill = assessed value × mill rate, where the mill rate is published per $1,000 of
//     assessed value (Assumption A3 — the town table stores it AS PUBLISHED, so the /1000
//     happens HERE, inside the function);
//   - assessed value = price × assessmentRatio, grown each year at appreciation.realAnnual
//     under a HELD-CONSTANT mill rate (only the assessed value grows — D-10). The mill rate
//     re-set every year to keep the levy under Prop 2½ is a town-level concern out of scope;
//     a constant mill rate is the conservative, transparent default.
// A qualitative flag is surfaced so the UI can explain the levy-vs-bill distinction.
//
// Dec/Money discipline (the canary.ts precedent, D-03 / CORE-02): the /1000 division and the
// (1 + appreciation)^year power happen in the frozen `Dec` clone (34-digit, HALF_EVEN);
// dollars cross into `Money` only via `Money.of(d.toFixed())` and `Money.mul(rateStr)`.
import { Dec } from '../money/decimal-config.js';
import { Money } from '../money/money.js';

/**
 * The qualitative note surfaced on every property-tax schedule: Prop 2½ is a LEVY cap, not a
 * bill cap. This is the human-readable half of the Pitfall-9 mitigation (the math half is
 * "no 2.5% clamp, mill-rate-sensitive bill").
 */
export const PROP_2_5_FLAG =
  'Prop 2½ caps the town levy, not your individual bill' as const;

/** One year of the property-tax schedule: the assessed value and the bill it produces. */
export interface PropertyTaxYear {
  readonly year: number;
  readonly assessedValue: Money;
  readonly tax: Money;
}

/** A full per-year property-tax schedule plus the qualitative Prop 2½ flag. */
export interface PropertyTaxSchedule {
  readonly perYear: readonly PropertyTaxYear[];
  /** The held-constant mill rate (per $1,000) the whole schedule was computed at. */
  readonly millRatePerThousand: string;
  /** Qualitative note: Prop 2½ caps the LEVY, not your bill (always PROP_2_5_FLAG). */
  readonly prop25Flag: typeof PROP_2_5_FLAG;
}

/**
 * The annual property-tax bill: `assessedValue × (millRatePerThousand / 1000)`.
 *
 * The mill rate is stored AS PUBLISHED by the DOR (dollars per $1,000 of assessed value, A3),
 * so the /1000 happens here, in `Dec`, and the resulting dimensionless rate is fed to
 * `Money.mul`. This is NEVER a flat percentage of value and NEVER clamped at 2.5% (Pitfall 9).
 */
export function annualPropertyTax(assessedValue: Money, millRatePerThousand: string): Money {
  return assessedValue.mul(new Dec(millRatePerThousand).div(1000).toFixed());
}

/**
 * The assessed value in a given hold year: base assessed (`price × assessmentRatio`) grown by
 * `(1 + appreciationRealAnnual)^year` at full `Dec` precision. Year 0 is the base assessed.
 * Mirrors the canary's `(1 + r)^n` compounding idiom — only the assessed value grows; the
 * mill rate is held constant by the caller (D-10).
 */
export function assessedValueAt(
  price: string,
  assessmentRatio: string,
  appreciationRealAnnual: string,
  year: number,
): Money {
  const baseAssessed = Money.of(price).mul(assessmentRatio);
  const growthFactor = new Dec(1).plus(new Dec(appreciationRealAnnual)).pow(year);
  return baseAssessed.mul(growthFactor.toFixed());
}

/**
 * Build the per-year property-tax schedule over `holdingYears` (years 0..holdingYears-1).
 * Each year: assessed value grows at appreciation; the mill rate is HELD CONSTANT; the bill
 * is `annualPropertyTax(assessedValueAt(...year), millRate)`. The result carries the
 * qualitative Prop 2½ flag (Pitfall 9 / D-10).
 */
export function propertyTaxSchedule(opts: {
  price: string;
  assessmentRatio: string;
  appreciationRealAnnual: string;
  millRatePerThousand: string;
  holdingYears: number;
}): PropertyTaxSchedule {
  const { price, assessmentRatio, appreciationRealAnnual, millRatePerThousand, holdingYears } =
    opts;

  const perYear: PropertyTaxYear[] = [];
  for (let year = 0; year < holdingYears; year++) {
    const assessedValue = assessedValueAt(price, assessmentRatio, appreciationRealAnnual, year);
    perYear.push({
      year,
      assessedValue,
      tax: annualPropertyTax(assessedValue, millRatePerThousand),
    });
  }

  return { perYear, millRatePerThousand, prop25Flag: PROP_2_5_FLAG };
}
