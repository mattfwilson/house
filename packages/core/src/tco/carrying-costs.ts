// Carrying costs (TCO-03, D-15) — the recurring per-year ownership line items beyond P+I
// and property tax:
//   - MAINTENANCE is a percentage (`maintenance.annualPctOfValue`) of the home value, and it
//     tracks the APPRECIATING value: as the home appreciates, the maintenance dollar figure
//     grows with it (D-15). We reuse `assessedValueAt` with an assessmentRatio of "1.0" as the
//     appreciating home-value helper, rather than re-implementing the `(1+r)^year` idiom.
//   - INSURANCE is a flat $/yr figure held constant in today's dollars across the hold.
//   - HOA is a flat $/mo figure; the annual line is monthly × 12, also held flat.
//
// Dec/Money discipline (the canary.ts precedent, D-03 / CORE-02): the appreciation power lives
// in `Dec` (inside `assessedValueAt`); maintenance/insurance/HOA dollars are all `Money`,
// produced via `Money.of` / `Money.mul(rateStr)` — never bare-number math.
import { Money } from '../money/money.js';
import { assessedValueAt } from './property-tax.js';

/** The three carrying-cost lines for a single hold year (all Money). */
export interface CarryingCostsYear {
  readonly maintenance: Money;
  readonly insurance: Money;
  readonly hoa: Money;
}

/**
 * Annual maintenance = `annualPctOfValue × homeValue`. The caller passes the home value FOR
 * THE YEAR (the appreciating value), so this is a pure percent-of-value multiply in `Money`.
 */
export function maintenanceAnnual(homeValue: Money, annualPctOfValue: string): Money {
  return homeValue.mul(annualPctOfValue);
}

/**
 * The appreciating home value in a given hold year: `price` grown by appreciation, with no
 * assessment haircut (ratio "1.0"). Thin re-use of `assessedValueAt` so the appreciation
 * idiom lives in exactly one place (DRY — D-15 maintenance basis matches the tax basis).
 */
export function homeValueAt(price: string, appreciationRealAnnual: string, year: number): Money {
  return assessedValueAt(price, '1.0', appreciationRealAnnual, year);
}

/**
 * Annual insurance, held FLAT in today's dollars across the hold (year 0 === year N). Simply
 * lifts the canonical decimal-string input into `Money`.
 */
export function insuranceAnnual(insuranceAnnualInput: string): Money {
  return Money.of(insuranceAnnualInput);
}

/**
 * Annual HOA = `hoaMonthly × 12`, held FLAT across the hold. The ×12 is a `Money.mul` by the
 * dimensionless rate string "12" (never a bare-number multiply).
 */
export function hoaAnnual(hoaMonthly: string): Money {
  return Money.of(hoaMonthly).mul('12');
}

/**
 * The full carrying-cost bundle for a single hold year: maintenance against the APPRECIATING
 * home value, flat insurance, flat HOA — the three Money lines Plan 04's `computeTco` sums
 * into the breakdown (D-15).
 */
export function carryingCostsForYear(opts: {
  price: string;
  maintenancePctOfValue: string;
  appreciationRealAnnual: string;
  insuranceAnnualInput: string;
  hoaMonthly: string;
  year: number;
}): CarryingCostsYear {
  const {
    price,
    maintenancePctOfValue,
    appreciationRealAnnual,
    insuranceAnnualInput,
    hoaMonthly,
    year,
  } = opts;

  const homeValue = homeValueAt(price, appreciationRealAnnual, year);
  return {
    maintenance: maintenanceAnnual(homeValue, maintenancePctOfValue),
    insurance: insuranceAnnual(insuranceAnnualInput),
    hoa: hoaAnnual(hoaMonthly),
  };
}
