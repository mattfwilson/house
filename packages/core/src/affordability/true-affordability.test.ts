// TRUE affordability tests (AFF-02) — the honest ceiling the product leads with: the LOWER of
// the savings-rate floor and the cash-on-hand gate (D-05). This is the AFF-02 PROXY — a
// savings-rate floor, NOT a FI-date projection (D-01; the real FI-date math is Phase 4).
//
// EXACT-EQUALITY / behavioral proofs (never `toBeCloseTo`):
//   - `cashSavingsDrain` is the SECOND D-14 numerator: `tco.total − amortizedClosing` — it KEEPS
//     maintenance (so it differs from the lender DTI numerator by exactly maintenance, and from
//     `tco.total` by exactly amortizedClosing). A hand-verified fixture pins both differences.
//   - The savings-rate ceiling solves to the cent: at the solved price the post-purchase savings
//     rate (over GROSS income, D-04) sits at/just above the target, and +$0.01 drops below it.
//   - The cash-on-hand ceiling = largest price where `downPaymentCash + closingCosts(price) <=
//     availableNetWorth − reserve` (D-05), reusing `closingCosts`.
//   - `trueMaxPrice = min(savingsRateCeiling, cashOnHandCeiling)` with the binding constraint
//     reported: a tight `availableNetWorth − reserve` makes `cashOnHand` bind; a roomy one makes
//     the `savingsFloor` bind. Both assert the `min`.
import { describe, test, expect } from 'vitest';
import { trueAffordability, cashSavingsDrain } from './true-affordability.js';
import { lenderDtiCarryingCost } from './dti.js';
import { computeTco } from '../tco/tco.js';
import { closingCosts } from '../tco/closing-costs.js';
import {
  engineInput,
  type EngineInput,
  type ScenarioInputs,
  type Household,
} from '../engine/engine-input.js';
import { DEFAULT_ASSUMPTIONS } from '../assumptions/defaults.js';
import { calendarDate } from '../time/calendar-date.js';
import { Dec } from '../money/decimal-config.js';

const ASOF = calendarDate('2026-01-01');

// Placeholder price/downPaymentPct (the solver overrides them per trial price). The rest is the
// qualification context, identical in shape to the bank-affordability fixtures.
const BASE_SCENARIO: ScenarioInputs = {
  label: 'true-affordability solve',
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

// Roomy cash (huge available net worth) → the savings floor is the binding ceiling.
const HOUSEHOLD_ROOMY_CASH: Household = {
  grossAnnualIncome: '180000',
  existingMonthlyDebt: '400',
  targetSavingsRate: '0.2',
  availableNetWorth: '10000000',
  currentRent: '3000',
  downPaymentCash: '100000',
  reserve: '20000',
  currentAnnualSavings: '40000',
  targetAnnualRetirementSpend: '54000',
};

// Tight cash (availableNetWorth − reserve = $110,000) → the cash-on-hand gate binds first.
const HOUSEHOLD_TIGHT_CASH: Household = { ...HOUSEHOLD_ROOMY_CASH, availableNetWorth: '130000' };

// INFEASIBLE CASH GATE (CR-01): availableNetWorth − reserve = $90,000 < downPaymentCash ($100,000),
// so `passesCash(low0)` is false at the minimum trial (need $102,500.025 > $90,000 budget). The
// savings floor stays feasible (roomy income), so the $0 cash ceiling binds: trueMaxPrice === $0,
// bindingConstraint === 'cashOnHand'.
const HOUSEHOLD_INFEASIBLE_CASH: Household = { ...HOUSEHOLD_ROOMY_CASH, availableNetWorth: '110000' };

// INFEASIBLE SAVINGS FLOOR (CR-01): roomy cash (so the cash gate is NOT the binder) but a savings
// baseline so low that even at the minimum trial price the post-purchase savings rate (0.1845) is
// already below the 0.2 target — `passesFloor(low0)` is false at every price. The $0 savings
// ceiling binds: trueMaxPrice === $0, bindingConstraint === 'savingsFloor'.
const HOUSEHOLD_INFEASIBLE_SAVINGS: Household = {
  ...HOUSEHOLD_ROOMY_CASH,
  currentAnnualSavings: '1000',
};

const inputFor = (household: Household): EngineInput =>
  engineInput({ asOf: ASOF, assumptions: DEFAULT_ASSUMPTIONS, scenario: BASE_SCENARIO, household });

// Rebuild the trial input the SAME way the solver does, so the test can recompute the
// post-purchase savings rate / drain at an arbitrary price (the +$0.01 floor assertion).
const inputAtPrice = (household: Household, price: string): EngineInput => {
  const pct = new Dec(household.downPaymentCash).div(new Dec(price)).toFixed();
  return engineInput({
    asOf: ASOF,
    assumptions: DEFAULT_ASSUMPTIONS,
    scenario: { ...BASE_SCENARIO, price, downPaymentPct: pct },
    household,
  });
};

// The post-purchase savings rate at a trial price, rebuilt exactly as the solver computes it
// (D-03 incremental premium over currentRent, D-17 currentAnnualSavings baseline, D-04 gross
// denominator). Used to prove the solved price is the largest passing one to the cent.
const postPurchaseSavingsRate = (household: Household, price: string) => {
  const tco = computeTco(inputAtPrice(household, price));
  const drain = cashSavingsDrain(tco);
  const premium = new Dec(drain.toDecimalString()).minus(new Dec(household.currentRent)).times(12);
  const post = new Dec(household.currentAnnualSavings).minus(premium);
  return post.div(new Dec(household.grossAnnualIncome));
};

describe('cashSavingsDrain — the SECOND D-14 numerator (keeps maintenance, drops closing)', () => {
  // Hand-verified at price = $500,000 / 20% down (DEFAULT_ASSUMPTIONS, town Newton): the engine's
  // own breakdown gives total.monthly $3577.15, amortizedClosing.monthly $104.17,
  // maintenance.monthly $416.67, and the lender numerator (PITI+HOA+PMI) $3056.31. So the drain
  // ($3472.98) = total − closing, KEEPS maintenance, and = lenderNumerator + maintenance.
  const tco = computeTco(inputAtPrice(HOUSEHOLD_ROOMY_CASH, '500000'));

  test('cashSavingsDrain === tco.total.monthly − tco.amortizedClosing.monthly', () => {
    const expected = tco.total.monthly.sub(tco.amortizedClosing.monthly);
    expect(cashSavingsDrain(tco).toDecimalString()).toBe(expected.toDecimalString());
    expect(cashSavingsDrain(tco).toDecimalString()).toBe('3472.98');
  });

  test('differs from tco.total by exactly amortizedClosing (excludes ONLY the t=0 closing lump)', () => {
    const diff = tco.total.monthly.sub(cashSavingsDrain(tco));
    expect(diff.toDecimalString()).toBe(tco.amortizedClosing.monthly.toDecimalString());
  });

  test('KEEPS maintenance: differs from the lender DTI numerator by exactly maintenance', () => {
    // lenderDtiCarryingCost EXCLUDES maintenance; cashSavingsDrain KEEPS it. So the gap between
    // the two numerators is exactly the maintenance line.
    const gap = cashSavingsDrain(tco).sub(lenderDtiCarryingCost(tco));
    expect(gap.toDecimalString()).toBe(tco.maintenance.monthly.toDecimalString());
    expect(gap.toDecimalString()).toBe('416.67');
  });
});

describe('savings-rate ceiling — solved to the cent against the GROSS-income target', () => {
  test('roomy-cash household: the savings floor binds; trueMaxPrice === savingsRateCeiling', () => {
    const result = trueAffordability(inputFor(HOUSEHOLD_ROOMY_CASH));
    expect(result.bindingConstraint).toBe('savingsFloor');
    // Deterministic solved price (hand-reconciled against the engine breakdown).
    expect(result.savingsRateCeiling.toDecimalString()).toBe('482309.67');
    expect(result.trueMaxPrice.toDecimalString()).toBe('482309.67');
  });

  test('the solved savings ceiling is the LARGEST passing price: at it the rate >= target, +$0.01 fails', () => {
    const result = trueAffordability(inputFor(HOUSEHOLD_ROOMY_CASH));
    const solved = result.savingsRateCeiling.toDecimalString();
    const target = new Dec(HOUSEHOLD_ROOMY_CASH.targetSavingsRate);

    // At the solved price the post-purchase savings rate is at/just above the target (gross, D-04).
    expect(postPurchaseSavingsRate(HOUSEHOLD_ROOMY_CASH, solved).greaterThanOrEqualTo(target)).toBe(
      true,
    );
    // One cent higher drops below the target (savings fall as price rises — monotonic).
    const onePlus = new Dec(solved).plus(new Dec('0.01')).toFixed();
    expect(postPurchaseSavingsRate(HOUSEHOLD_ROOMY_CASH, onePlus).greaterThanOrEqualTo(target)).toBe(
      false,
    );
  });
});

describe('cash-on-hand gate + trueMaxPrice = min(savingsRateCeiling, cashOnHandCeiling)', () => {
  test('tight-cash household: the cash gate binds; trueMaxPrice === cashOnHandCeiling', () => {
    const result = trueAffordability(inputFor(HOUSEHOLD_TIGHT_CASH));
    expect(result.bindingConstraint).toBe('cashOnHand');
    // availableNetWorth − reserve = $110,000; closing = price × 0.025; cash = $100,000:
    //   100000 + 0.025·price <= 110000  ⇒  price <= $400,000 (exact).
    expect(result.cashOnHandCeiling.toDecimalString()).toBe('400000');
    expect(result.trueMaxPrice.toDecimalString()).toBe('400000');
  });

  test('cash ceiling: downPaymentCash + closingCosts(ceiling) <= availableNetWorth − reserve, +$0.01 fails', () => {
    const result = trueAffordability(inputFor(HOUSEHOLD_TIGHT_CASH));
    const budget = new Dec(HOUSEHOLD_TIGHT_CASH.availableNetWorth).minus(
      new Dec(HOUSEHOLD_TIGHT_CASH.reserve),
    );
    const needAt = (price: string) =>
      new Dec(HOUSEHOLD_TIGHT_CASH.downPaymentCash).plus(
        new Dec(
          closingCosts(
            price,
            DEFAULT_ASSUMPTIONS.closing.rateOfPrice,
            BASE_SCENARIO.closingCostsOverride,
          ).toDecimalString(),
        ),
      );
    const solved = result.cashOnHandCeiling.toDecimalString();
    expect(needAt(solved).lessThanOrEqualTo(budget)).toBe(true);
    const onePlus = new Dec(solved).plus(new Dec('0.01')).toFixed();
    expect(needAt(onePlus).lessThanOrEqualTo(budget)).toBe(false);
  });

  test('trueMaxPrice === min(savingsRateCeiling, cashOnHandCeiling) in BOTH regimes (cent-exact)', () => {
    for (const household of [HOUSEHOLD_ROOMY_CASH, HOUSEHOLD_TIGHT_CASH]) {
      const r = trueAffordability(inputFor(household));
      const lower = r.savingsRateCeiling.toCents() <= r.cashOnHandCeiling.toCents()
        ? r.savingsRateCeiling
        : r.cashOnHandCeiling;
      expect(r.trueMaxPrice.toDecimalString()).toBe(lower.toDecimalString());
      const expectedBinding =
        r.savingsRateCeiling.toCents() <= r.cashOnHandCeiling.toCents()
          ? 'savingsFloor'
          : 'cashOnHand';
      expect(r.bindingConstraint).toBe(expectedBinding);
    }
  });

  test('requires household; throws a clear error when absent', () => {
    const noHousehold = engineInput({
      asOf: ASOF,
      assumptions: DEFAULT_ASSUMPTIONS,
      scenario: BASE_SCENARIO,
    });
    expect(() => trueAffordability(noHousehold)).toThrow(/household/i);
  });
});

describe('CR-01 — infeasible inputs yield a $0 ceiling via the shared solveMaxPrice guard', () => {
  test('infeasible cash gate (budget < downPaymentCash): cashOnHandCeiling === $0, binds the result', () => {
    // Premise: at the low-bound trial price, downPaymentCash + closing already exceeds the budget,
    // so passesCash(low0) is false and NO price can be funded.
    const budget = new Dec(HOUSEHOLD_INFEASIBLE_CASH.availableNetWorth).minus(
      new Dec(HOUSEHOLD_INFEASIBLE_CASH.reserve),
    );
    const low0 = new Dec(HOUSEHOLD_INFEASIBLE_CASH.downPaymentCash).plus(1).toFixed();
    const needAtLow0 = new Dec(HOUSEHOLD_INFEASIBLE_CASH.downPaymentCash).plus(
      new Dec(
        closingCosts(
          low0,
          DEFAULT_ASSUMPTIONS.closing.rateOfPrice,
          BASE_SCENARIO.closingCostsOverride,
        ).toDecimalString(),
      ),
    );
    expect(needAtLow0.lessThanOrEqualTo(budget)).toBe(false);

    const result = trueAffordability(inputFor(HOUSEHOLD_INFEASIBLE_CASH));
    expect(result.cashOnHandCeiling.toDecimalString()).toBe('0');
    // $0 cash ceiling is the lower of the two, so it binds the headline true price.
    expect(result.trueMaxPrice.toDecimalString()).toBe('0');
    expect(result.bindingConstraint).toBe('cashOnHand');
  });

  test('infeasible savings floor (rate < target at every price): savingsRateCeiling === $0, binds the result', () => {
    // Premise: at the low-bound trial price the post-purchase savings rate is already below target
    // (its maximum, since savings fall as price rises), so passesFloor(low0) is false everywhere.
    const low0 = new Dec(HOUSEHOLD_INFEASIBLE_SAVINGS.downPaymentCash).plus(1).toFixed();
    const target = new Dec(HOUSEHOLD_INFEASIBLE_SAVINGS.targetSavingsRate);
    expect(
      postPurchaseSavingsRate(HOUSEHOLD_INFEASIBLE_SAVINGS, low0).greaterThanOrEqualTo(target),
    ).toBe(false);

    const result = trueAffordability(inputFor(HOUSEHOLD_INFEASIBLE_SAVINGS));
    expect(result.savingsRateCeiling.toDecimalString()).toBe('0');
    // $0 savings ceiling is the lower (roomy cash), so it binds; ties resolve to savingsFloor.
    expect(result.trueMaxPrice.toDecimalString()).toBe('0');
    expect(result.bindingConstraint).toBe('savingsFloor');
  });
});
