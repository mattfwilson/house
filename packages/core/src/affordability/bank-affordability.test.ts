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
  targetAnnualRetirementSpend: '54000',
};

// Same household but debt-heavy: the back-end ceiling (0.36) becomes the binding constraint.
const HOUSEHOLD_DEBT_HEAVY: Household = { ...HOUSEHOLD_LOW_DEBT, existingMonthlyDebt: '2500' };

// INFEASIBLE bank household (CR-01): gross income so low that the back-end DTI ratio already
// EXCEEDS 0.36 at the minimum trial price (downPaymentCash + 1 = $100,001) — so `passes(low0)` is
// false and NO price clears both ceilings. The pre-guard solver silently returned ≈$100,001; the
// guard must return a $0 ceiling instead. (front stays under 0.28 at the floor; back is the
// blocking ratio, ~0.5057 > 0.36 — verified by the floor-ratio assertion below.)
const HOUSEHOLD_INFEASIBLE: Household = { ...HOUSEHOLD_LOW_DEBT, grossAnnualIncome: '15000' };

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

describe('CR-01 — infeasible household yields a $0 ceiling, never a fundable-looking ≈cash+1 price', () => {
  test('the back-end ratio already EXCEEDS 0.36 at the low-bound trial price (the infeasibility premise)', () => {
    // Confirm via the SAME trial rebuild the solver uses: at downPaymentCash + 1, back > 0.36 so
    // `passes(low0)` is false. This is the precondition the guard must defend.
    const price = new Dec(HOUSEHOLD_INFEASIBLE.downPaymentCash).plus(1).toFixed();
    const tco = computeTco(inputAtPrice(HOUSEHOLD_INFEASIBLE, price));
    const back = backEndRatio(tco, HOUSEHOLD_INFEASIBLE.grossAnnualIncome, HOUSEHOLD_INFEASIBLE.existingMonthlyDebt);
    expect(back.greaterThan(new Dec(DEFAULT_ASSUMPTIONS.dti.backEnd))).toBe(true);
  });

  test('bankMaxPrice === $0 and bankMaxLoan === 0 − downPaymentCash for an infeasible household', () => {
    const result = bankAffordability(inputFor(HOUSEHOLD_INFEASIBLE));
    expect(result.bankMaxPrice.toDecimalString()).toBe('0');
    // The implied loan is still bankMaxPrice − downPaymentCash = 0 − 100000 (D-06 shape preserved).
    expect(result.bankMaxLoan.toDecimalString()).toBe('-100000');
  });

  test('the $0 result still populates ratios + bindingRatio (from the infeasible floor), shape unchanged', () => {
    const result = bankAffordability(inputFor(HOUSEHOLD_INFEASIBLE));
    // Ratios reported are the REAL, reportable ratios at the minimum trial price.
    expect(result.frontEndRatio).toBe('0.185744');
    expect(result.backEndRatio).toBe('0.505744');
    // Binding = whichever is furthest OVER its threshold (back-end here), via the existing
    // frontGap <= backGap tie convention (frontGap 0.0942 <= backGap -0.1457 is false ⇒ backEnd).
    expect(result.bindingRatio).toBe('backEnd');
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
