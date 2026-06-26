// Bank max-price solver tests (AFF-01) — the "can the bank?" anti-funnel reference ceiling.
//
// EXACT-EQUALITY / behavioral proofs (never `toBeCloseTo`) of the solver's correctness
// properties:
//   - It solves the LARGEST price that passes BOTH DTI ceilings to the cent: at the solved
//     bankMaxPrice the binding ratio sits at/just under its threshold, and a price one cent
//     higher FAILS (the "to the cent" guarantee).
//   - `bindingRatio` reports whichever ceiling is the active (nearest-its-threshold) constraint
//     — `frontEnd` for a low-debt household, `backEnd` when existing debt dominates — and both
//     ratios are returned at the solved price.
//   - `bankMaxLoan === bankMaxPrice − downPaymentCash` (D-06).
//   - MONOTONICITY across the PMI kink (price just below vs just above ~5× downPaymentCash, where
//     the down-payment fraction crosses 20% and PMI switches on): the binding ratio is
//     non-decreasing in price, so the bisection stays sound (Pitfall 4).
//   - The solver NEVER throws the Zod `downPaymentPct must be in [0,1)` error — the low bound is
//     strictly above `downPaymentCash` (Pitfall 3 low-bound guard).
import { describe, test, expect } from 'vitest';
import { bankAffordability } from './bank-affordability.js';
import { computeTco } from '../tco/tco.js';
import { frontEndRatio, backEndRatio } from './dti.js';
import { engineInput, type EngineInput, type ScenarioInputs, type Household } from '../engine/engine-input.js';
import { DEFAULT_ASSUMPTIONS } from '../assumptions/defaults.js';
import { calendarDate } from '../time/calendar-date.js';
import { Dec } from '../money/decimal-config.js';

const ASOF = calendarDate('2026-01-01');

// The scenario's `price`/`downPaymentPct` are placeholders — the solver overrides them per trial
// price. The other fields (rate/term/town/insurance) are the qualification context.
const BASE_SCENARIO: ScenarioInputs = {
  label: 'bank-affordability solve',
  price: '500000',
  downPaymentPct: '0.20',
  annualRate: '0.06375',
  termMonths: 360,
  holdingYears: 10,
  town: 'Newton',
  insuranceAnnual: '1800',
  hoaMonthly: '0',
  monthlyRent: '3000',
};

const HOUSEHOLD_LOW_DEBT: Household = {
  grossAnnualIncome: '180000',
  existingMonthlyDebt: '400',
  targetSavingsRate: '0.2',
  availableNetWorth: '200000',
  currentRent: '3000',
  downPaymentCash: '100000',
  reserve: '20000',
  currentAnnualSavings: '40000',
};

// Same household but debt-heavy: the back-end ceiling (0.36) becomes the binding constraint.
const HOUSEHOLD_DEBT_HEAVY: Household = { ...HOUSEHOLD_LOW_DEBT, existingMonthlyDebt: '2500' };

const inputFor = (household: Household, scenario: ScenarioInputs = BASE_SCENARIO): EngineInput =>
  engineInput({ asOf: ASOF, assumptions: DEFAULT_ASSUMPTIONS, scenario, household });

// Rebuild the trial input the SAME way the solver does, so the test can recompute the ratios at
// an arbitrary price (used by the +$0.01 and monotonicity assertions).
const inputAtPrice = (household: Household, price: string): EngineInput => {
  const pct = new Dec(household.downPaymentCash).div(new Dec(price)).toFixed();
  return engineInput({
    asOf: ASOF,
    assumptions: DEFAULT_ASSUMPTIONS,
    scenario: { ...BASE_SCENARIO, price, downPaymentPct: pct },
    household,
  });
};

describe('bankAffordability — max price to the cent under the lower DTI ceiling', () => {
  test('requires household; throws a clear error when absent', () => {
    const noHousehold = engineInput({ asOf: ASOF, assumptions: DEFAULT_ASSUMPTIONS, scenario: BASE_SCENARIO });
    expect(() => bankAffordability(noHousehold)).toThrow(/household/i);
  });

  test('low-debt household: front-end (0.28) is the binding ceiling', () => {
    const result = bankAffordability(inputFor(HOUSEHOLD_LOW_DEBT));
    expect(result.bindingRatio).toBe('frontEnd');
    // Deterministic solved price (hand-reconciled against the engine breakdown).
    expect(result.bankMaxPrice.toDecimalString()).toBe('635347.53');
  });

  test('debt-heavy household: back-end (0.36) is the binding ceiling, sitting AT its threshold', () => {
    const result = bankAffordability(inputFor(HOUSEHOLD_DEBT_HEAVY));
    expect(result.bindingRatio).toBe('backEnd');
    expect(result.bankMaxPrice.toDecimalString()).toBe('477861.63');
    // The back-end ratio at the solved price is at/just under 0.36.
    expect(new Dec(result.backEndRatio).lessThanOrEqualTo(new Dec('0.36'))).toBe(true);
  });

  test('solved price is the LARGEST passing price to the cent: +$0.01 fails both checks-gate', () => {
    const household = HOUSEHOLD_LOW_DEBT;
    const result = bankAffordability(inputFor(household));
    const solved = result.bankMaxPrice.toDecimalString();

    const passes = (price: string): boolean => {
      const tco = computeTco(inputAtPrice(household, price));
      const f = frontEndRatio(tco, household.grossAnnualIncome);
      const b = backEndRatio(tco, household.grossAnnualIncome, household.existingMonthlyDebt);
      return f.lessThanOrEqualTo(new Dec(DEFAULT_ASSUMPTIONS.dti.frontEnd))
        && b.lessThanOrEqualTo(new Dec(DEFAULT_ASSUMPTIONS.dti.backEnd));
    };

    // The solved price passes; one cent higher does not.
    expect(passes(solved)).toBe(true);
    const onePlus = new Dec(solved).plus(new Dec('0.01')).toFixed();
    expect(passes(onePlus)).toBe(false);
  });

  test('bankMaxLoan === bankMaxPrice − downPaymentCash (D-06)', () => {
    const household = HOUSEHOLD_LOW_DEBT;
    const result = bankAffordability(inputFor(household));
    // Decimal-string identity: loan = price − cash.
    const expectedLoan = new Dec(result.bankMaxPrice.toDecimalString())
      .minus(new Dec(household.downPaymentCash))
      .toFixed();
    expect(result.bankMaxLoan.toDecimalString()).toBe(expectedLoan);
    // Exact-cents cross-check via the closed Money surface: price − cash === loan.
    const cashMoney = result.bankMaxPrice.sub(result.bankMaxLoan); // price − loan === cash
    expect(cashMoney.toDecimalString()).toBe('100000');
  });

  test('both ratios are returned at the solved price (front <= 0.28 AND back <= 0.36)', () => {
    const result = bankAffordability(inputFor(HOUSEHOLD_LOW_DEBT));
    expect(new Dec(result.frontEndRatio).lessThanOrEqualTo(new Dec('0.28'))).toBe(true);
    expect(new Dec(result.backEndRatio).lessThanOrEqualTo(new Dec('0.36'))).toBe(true);
  });
});

describe('Pitfall 3 + Pitfall 4 — boundary safety + monotonicity', () => {
  test('the solver never throws a Zod downPaymentPct [0,1) error across the solve', () => {
    // A modest cash buffer relative to income exercises a wide bracket sweep; the low bound being
    // strictly above downPaymentCash keeps every trial pct < 1, so no Zod throw occurs.
    expect(() => bankAffordability(inputFor(HOUSEHOLD_LOW_DEBT))).not.toThrow();
    expect(() => bankAffordability(inputFor(HOUSEHOLD_DEBT_HEAVY))).not.toThrow();
  });

  test('binding ratio is monotonic non-decreasing across the PMI kink (~5x cash)', () => {
    const household = HOUSEHOLD_LOW_DEBT; // front-end binding -> compare the front ratio
    // cash = $100,000 -> the 20%-down kink is at price = $500,000. Just below: 20.04% down (PMI
    // OFF). Just above: 19.96% down (PMI ON). Across that jump the front ratio must NOT decrease.
    const below = frontEndRatio(
      computeTco(inputAtPrice(household, '499000')),
      household.grossAnnualIncome,
    );
    const above = frontEndRatio(
      computeTco(inputAtPrice(household, '501000')),
      household.grossAnnualIncome,
    );
    // Sanity: PMI genuinely switches on across the kink.
    expect(computeTco(inputAtPrice(household, '499000')).pmiApplies).toBe(false);
    expect(computeTco(inputAtPrice(household, '501000')).pmiApplies).toBe(true);
    // Monotonic: the higher price has a >= binding ratio (search stays sound).
    expect(above.greaterThanOrEqualTo(below)).toBe(true);
  });
});
