// fi-target.ts — the asymmetric FI targets (D-01 / D-02, the fairness fulcrum), A1 year-0 basis.
//
// THE FI NUMBER (D-01): the standard FIRE definition, target = annualNeed / swr.rate. The annual
// need is `targetAnnualRetirementSpend` PLUS the path's perpetual housing cost (D-02):
//   - RENTER (no-purchase) target carries PERPETUAL RENT       => (spend + annualRent) / swr
//   - OWNER target carries PERPETUAL tax + insurance + maint   => (spend + ownerHousing) / swr
// This is the honest, anti-funnel-correct framing — it neither pretends a paid-off house is free
// (owner side) nor that a renter ever stops paying housing (renter side). It is the STRONGEST
// pro-buy force in the model, so BOTH targets AND their housing components are SURFACED on the
// result (D-02 visibility), never buried.
//
// A1 LOCKED — OWNER HOUSING BASIS = YEAR-0 (TODAY'S VALUE). The owner perpetual tax + maintenance
// are evaluated at `assessedValueAt(...,0)` / `homeValueAt(...,0)` (insurance flat). This is the
// simpler all-real treatment that AVOIDS the target<->FI-year fixed point (RESEARCH Open Q1 / L7:
// the appreciated-at-FI-year basis would make the target depend on the FI year, which depends on
// the target). The function takes `fiYear` so the appreciated-basis variant is a one-line change
// later WITHOUT an API change; Plan callers pass year 0. [ASSUMED] year-0 basis (D-02) — the
// appreciated-at-FI-year basis is deferred to avoid the fixed point (RESEARCH L7), revisitable.
//
// Dec/Money discipline (the evaluate-scenario.ts savingsRateAt precedent, CORE-02): division is the
// ONE operation `Money` deliberately does NOT expose — so the `(spend + housing) / swr` divide lives
// in the frozen `Dec` clone, and the result crosses back to `Money` ONCE via `Money.of(d.toFixed())`.
// `Money` is NOT widened with a `div` (the Phase 2/3 precedent). `Dec` is not re-exported.
import { Dec } from '../money/decimal-config.js';
import { Money } from '../money/money.js';
import type { EngineInput } from '../engine/engine-input.js';
import type { TcoBreakdown } from '../tco/tco.js';
import { assessedValueAt, annualPropertyTax } from '../tco/property-tax.js';
import { maintenanceAnnual, homeValueAt } from '../tco/carrying-costs.js';

/**
 * The closed asymmetric FI-target result (D-02). ALL FOUR fields are `Money` and all four are
 * surfaced — the fairness fulcrum (renter-carries-rent vs owner-carries-tax+ins+maint) must be
 * visible and defensible, never buried inside a single opaque number.
 */
export interface FiTargets {
  /** Renter (no-purchase) FI target = (spend + annualRent) / swr.rate (D-02). */
  readonly renterTarget: Money;
  /** Owner FI target = (spend + ownerHousingAnnual) / swr.rate (D-02). */
  readonly ownerTarget: Money;
  /** The renter perpetual housing = currentRent * 12 (today's dollars). */
  readonly renterHousingAnnual: Money;
  /** The owner perpetual housing = year-0 (A1) annual property tax + insurance + maintenance. */
  readonly ownerHousingAnnual: Money;
}

/**
 * The owner's perpetual annual housing cost at a given hold `fiYear` (A1 — Plan callers pass 0):
 * property tax (on the appreciated assessed value) + flat insurance + maintenance (on the
 * appreciated home value). Reuses the appreciating-value helpers verbatim (DRY — never re-derives
 * `(1+appr)^year`) and the SAME captured mill rate as the TCO breakdown so the rates agree.
 */
function ownerHousingAt(input: EngineInput, tco: TcoBreakdown, fiYear: number): Money {
  const { price } = input.scenario;
  const { assessmentRatio } = input.assumptions.tax;
  const appr = input.assumptions.appreciation.realAnnual;
  const maintPct = input.assumptions.maintenance.annualPctOfValue;

  const assessed = assessedValueAt(price, assessmentRatio, appr, fiYear);
  const tax = annualPropertyTax(assessed, tco.resolvedMillRate);
  const maint = maintenanceAnnual(homeValueAt(price, appr, fiYear), maintPct);
  const insurance = tco.insurance.annualized; // flat in today's dollars (carrying-costs.ts)
  return tax.add(insurance).add(maint);
}

/** Divide a `Money` numerator by the swr RATE string in `Dec`, crossing back to `Money` once. */
function divideBySwr(numerator: Money, swrRate: string): Money {
  // CR-01 defense in depth: a non-positive swr.rate must NOT reach the divide. The Zod boundary
  // refine rejects it at parse, but a forged input bypassing the boundary would otherwise yield
  // Money.of('Infinity') (zero → decimal.js Infinity) or a negative FI target read as "reached at
  // month 0" (negative). Convert that remaining edge into an HONEST thrown error.
  const r = new Dec(swrRate);
  if (r.lessThanOrEqualTo(0)) {
    throw new Error(
      `fiTargets: swr.rate must be > 0 (got ${swrRate}); the FI number is annualNeed / swr.rate`,
    );
  }
  // Division lives in Dec (Money has no `div`); the result re-enters as Money via `.toFixed()`.
  const d = new Dec(numerator.toDecimalString()).div(r);
  return Money.of(d.toFixed());
}

/**
 * The asymmetric FI targets for a household + scenario (D-01 / D-02). Requires `input.household`
 * (the FI number `targetAnnualRetirementSpend` lives there) — throws a clear error if absent,
 * mirroring `affordabilityGap`'s headline guard.
 *
 * Owner housing is evaluated at the year-0 basis (A1); pass the already-computed `tco` so the
 * captured mill rate + flat insurance line match the TCO breakdown (no re-resolve).
 */
export function fiTargets(input: EngineInput, tco: TcoBreakdown): FiTargets {
  const household = input.household;
  if (household === undefined) {
    throw new Error(
      'fiTargets requires input.household — the FI number is targetAnnualRetirementSpend ÷ swr.rate, ' +
        'and the spend (plus the perpetual rent for the renter target) lives on the household. ' +
        'Build the EngineInput with a household block.',
    );
  }

  const swrRate = input.assumptions.swr.rate;
  const spend = Money.of(household.targetAnnualRetirementSpend);

  // Renter perpetual housing = currentRent * 12 (today's dollars — rent.realGrowthAnnual is 0 by
  // default, so the renter's forever-rent is today's annualized rent).
  const renterHousingAnnual = Money.of(household.currentRent).mul('12');

  // Owner perpetual housing = year-0 (A1) tax + insurance + maintenance.
  const ownerHousingAnnual = ownerHousingAt(input, tco, 0);

  const renterTarget = divideBySwr(spend.add(renterHousingAnnual), swrRate);
  const ownerTarget = divideBySwr(spend.add(ownerHousingAnnual), swrRate);

  return { renterTarget, ownerTarget, renterHousingAnnual, ownerHousingAnnual };
}
