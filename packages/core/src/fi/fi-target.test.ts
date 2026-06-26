// fi-target.test.ts — the asymmetric FI targets (D-01 / D-02, the fairness fulcrum), A1 year-0 basis.
//
// D-02 is the single most load-bearing, most contestable modeling choice in the whole tool:
//   - the RENTER (no-purchase) FI target carries PERPETUAL RENT,
//   - the OWNER FI target carries PERPETUAL property tax + insurance + maintenance (the post-payoff
//     ownership carrying cost).
// Both targets AND both housing components must be SURFACED (never buried) so the user can see and
// defend the comparison. These tests assert the asymmetry, the visibility, and that the SWR knob is
// live (higher swr => lower target) so the Plan-04 tornado can sweep it.
//
// A1 LOCKED — the owner housing basis is YEAR-0 (today's value): assessedValueAt(...,0) /
// homeValueAt(...,0), flat insurance. This avoids the target<->FI-year fixed point (RESEARCH L7),
// revisitable to the appreciated-at-FI-year basis later without an API change.
import { describe, test, expect } from 'vitest';
import { Dec } from '../money/decimal-config.js';
import { computeTco } from '../tco/tco.js';
import { assessedValueAt, annualPropertyTax } from '../tco/property-tax.js';
import { maintenanceAnnual, homeValueAt } from '../tco/carrying-costs.js';
import {
  engineInput,
  type EngineInput,
  type ScenarioInputs,
  type Household,
} from '../engine/engine-input.js';
import { DEFAULT_ASSUMPTIONS } from '../assumptions/defaults.js';
import { calendarDate } from '../time/calendar-date.js';
import { fiTargets } from './fi-target.js';

const ASOF = calendarDate('2026-01-01');

const BASE_SCENARIO: ScenarioInputs = {
  label: 'fi-target solve',
  price: '600000',
  downPaymentPct: '0.20',
  annualRate: '0.06375',
  termMonths: 360,
  holdingYears: 10,
  town: 'Newton',
  insuranceAnnual: '1800',
  hoaMonthly: '0',
  monthlyRent: '3000',
};

const HOUSEHOLD: Household = {
  grossAnnualIncome: '220000',
  existingMonthlyDebt: '300',
  targetSavingsRate: '0.35',
  availableNetWorth: '500000',
  currentRent: '3000', // $3,000/mo -> $36,000/yr perpetual rent (renter side)
  downPaymentCash: '150000',
  reserve: '50000',
  currentAnnualSavings: '90000',
  targetAnnualRetirementSpend: '66000', // the FI-number numerator (today's dollars)
};

const inputFor = (household?: Household): EngineInput =>
  engineInput({ asOf: ASOF, assumptions: DEFAULT_ASSUMPTIONS, scenario: BASE_SCENARIO, household });

describe('fiTargets — asymmetric renter/owner targets (D-01 / D-02)', () => {
  test('surfaces ALL FOUR Money fields (D-02 visibility — the fulcrum is never buried)', () => {
    const t = fiTargets(inputFor(HOUSEHOLD), computeTco(inputFor(HOUSEHOLD)));
    // Each is a Money (toDecimalString is the closed-API proof it is a Money, not a number).
    expect(typeof t.renterTarget.toDecimalString()).toBe('string');
    expect(typeof t.ownerTarget.toDecimalString()).toBe('string');
    expect(typeof t.renterHousingAnnual.toDecimalString()).toBe('string');
    expect(typeof t.ownerHousingAnnual.toDecimalString()).toBe('string');
  });

  test('renter housing = currentRent * 12 (perpetual rent, today\'s dollars)', () => {
    const input = inputFor(HOUSEHOLD);
    const t = fiTargets(input, computeTco(input));
    // 3000 * 12 = 36000.
    expect(new Dec(t.renterHousingAnnual.toDecimalString()).toFixed()).toBe(
      new Dec('3000').times('12').toFixed(),
    );
  });

  test('owner housing = year-0 (A1) annual tax + insurance + maintenance', () => {
    const input = inputFor(HOUSEHOLD);
    const tco = computeTco(input);
    const t = fiTargets(input, tco);

    // Recompute the owner housing INDEPENDENTLY at the year-0 basis (A1) to pin the arithmetic.
    const price = BASE_SCENARIO.price;
    const appr = DEFAULT_ASSUMPTIONS.appreciation.realAnnual;
    const assessed = assessedValueAt(price, DEFAULT_ASSUMPTIONS.tax.assessmentRatio, appr, 0);
    const tax = annualPropertyTax(assessed, tco.resolvedMillRate);
    const maint = maintenanceAnnual(homeValueAt(price, appr, 0), DEFAULT_ASSUMPTIONS.maintenance.annualPctOfValue);
    const expectedOwnerHousing = tax.add(tco.insurance.annualized).add(maint);

    expect(t.ownerHousingAnnual.toDecimalString()).toBe(expectedOwnerHousing.toDecimalString());
  });

  test('renter target = (spend + annualRent) / swr.rate (Dec division, crossed to Money once)', () => {
    const input = inputFor(HOUSEHOLD);
    const t = fiTargets(input, computeTco(input));

    const spend = new Dec('66000');
    const annualRent = new Dec('3000').times('12'); // 36000
    const swr = new Dec(DEFAULT_ASSUMPTIONS.swr.rate); // 0.033
    const expected = spend.plus(annualRent).div(swr);

    // (66000 + 36000) / 0.033 = 102000 / 0.033 = 3,090,909.0909...
    expect(t.renterTarget.toDecimalString()).toBe(expected.toFixed());
  });

  test('owner target reflects tax+ins+maint, renter target reflects rent (the asymmetry bites)', () => {
    const input = inputFor(HOUSEHOLD);
    const tco = computeTco(input);
    const t = fiTargets(input, tco);

    const swr = new Dec(DEFAULT_ASSUMPTIONS.swr.rate);
    const expectedRenter = new Dec(t.renterHousingAnnual.toDecimalString())
      .plus(new Dec('66000'))
      .div(swr);
    const expectedOwner = new Dec(t.ownerHousingAnnual.toDecimalString())
      .plus(new Dec('66000'))
      .div(swr);

    expect(t.renterTarget.toDecimalString()).toBe(expectedRenter.toFixed());
    expect(t.ownerTarget.toDecimalString()).toBe(expectedOwner.toFixed());

    // For THIS fixture (a $600k home, $36k/yr rent) the renter and owner housing differ, so the
    // two targets differ — the fulcrum is a real, visible divergence, not a coincidental tie.
    expect(t.renterTarget.toDecimalString()).not.toBe(t.ownerTarget.toDecimalString());
  });
});

describe('fiTargets — the SWR knob is live (so the tornado can sweep it, D-13)', () => {
  test('a HIGHER swr yields a LOWER target (smaller denominator divides a fixed numerator)', () => {
    const base = inputFor(HOUSEHOLD);
    const tco = computeTco(base);
    const lowSwr = fiTargets(base, tco); // swr 0.033

    const higherSwrAssumptions = {
      ...DEFAULT_ASSUMPTIONS,
      swr: { rate: '0.04' },
    };
    const highSwrInput = engineInput({
      asOf: ASOF,
      assumptions: higherSwrAssumptions,
      scenario: BASE_SCENARIO,
      household: HOUSEHOLD,
    });
    const highSwr = fiTargets(highSwrInput, computeTco(highSwrInput));

    expect(
      new Dec(highSwr.renterTarget.toDecimalString()).lessThan(
        new Dec(lowSwr.renterTarget.toDecimalString()),
      ),
    ).toBe(true);
    expect(
      new Dec(highSwr.ownerTarget.toDecimalString()).lessThan(
        new Dec(lowSwr.ownerTarget.toDecimalString()),
      ),
    ).toBe(true);
  });
});

describe('fiTargets — divideBySwr defense-in-depth guard (CR-01, GAP 2)', () => {
  // A forged input that BYPASSES the Zod boundary (e.g. a non-positive swr.rate slipped past
  // parse) must throw a CLEAR error naming swr.rate — NOT Money.of("Infinity") (zero) and NOT a
  // silent NEGATIVE FI target read as "reached at month 0" (negative). We forge the rate directly
  // onto a built input to reach the function in depth.
  const forgeSwr = (rate: string): EngineInput => {
    const base = inputFor(HOUSEHOLD);
    return {
      ...base,
      assumptions: { ...base.assumptions, swr: { ...base.assumptions.swr, rate } },
    } as EngineInput;
  };

  test('a zero swr.rate reaching the divide throws a clear error (not Money.of("Infinity"))', () => {
    const input = forgeSwr('0');
    expect(() => fiTargets(input, computeTco(inputFor(HOUSEHOLD)))).toThrow(/swr\.rate/);
  });

  test('a negative swr.rate reaching the divide throws a clear error (not a negative target)', () => {
    const input = forgeSwr('-0.01');
    expect(() => fiTargets(input, computeTco(inputFor(HOUSEHOLD)))).toThrow(/swr\.rate/);
  });

  test('a normal positive swr.rate still divides correctly (guard does not perturb the happy path)', () => {
    const input = inputFor(HOUSEHOLD);
    const targets = fiTargets(input, computeTco(input));
    expect(targets.renterTarget.toCents()).toBeGreaterThan(0n);
    expect(targets.ownerTarget.toCents()).toBeGreaterThan(0n);
  });
});

describe('fiTargets — requires household (the FI number lives on household.targetAnnualRetirementSpend)', () => {
  test('throws a clear error when household is absent', () => {
    const input = inputFor(undefined);
    expect(() => fiTargets(input, computeTco(input))).toThrow(/household/i);
  });
});
