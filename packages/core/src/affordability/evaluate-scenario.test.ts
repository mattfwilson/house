// evaluateScenario tests (D-06) — the per-scenario REPORT path: it does NOT solve for a max price,
// it reports the DTI ratios, pass/fail flags, savings-rate impact, and headroom AT a fixed price.
// It runs `computeTco` ONCE on the already-priced scenario and reuses `dti.ts` + `cashSavingsDrain`
// (no re-derived ratio math).
//
// EXACT-EQUALITY / behavioral proofs (never `toBeCloseTo`):
//   - frontEndRatio / backEndRatio equal the standalone `dti.ts` derivations on the same TCO.
//   - frontEndPass ⇔ ratio <= assumptions.dti.frontEnd; backEndPass ⇔ ratio <= dti.backEnd.
//   - headroom is the Dec margin below the BINDING (nearest-its-threshold) DTI ceiling; its sign
//     is >= 0 when both ratios pass and < 0 when the binding ratio fails.
//   - savingsRateImpact is the post-purchase savings rate (the same D-03/D-04/D-17 derivation the
//     true-affordability floor uses).
import { describe, test, expect } from 'vitest';
import { evaluateScenario } from './evaluate-scenario.js';
import { frontEndRatio, backEndRatio } from './dti.js';
import { cashSavingsDrain } from './true-affordability.js';
import { computeTco } from '../tco/tco.js';
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

// A comfortably-affordable priced scenario for a strong household: both DTI ratios pass.
const SCENARIO_PASS: ScenarioInputs = {
  label: 'evaluate: affordable',
  price: '400000',
  downPaymentPct: '0.20',
  annualRate: '0.06375',
  termMonths: 360,
  holdingYears: 10,
  town: 'Newton',
  insuranceAnnual: '1800',
  hoaMonthly: '0',
  monthlyRent: '3000',
};

// A stretch price for a more modest household: the back-end (with existing debt) fails.
const SCENARIO_FAIL: ScenarioInputs = { ...SCENARIO_PASS, label: 'evaluate: stretch', price: '900000' };

const HOUSEHOLD_STRONG: Household = {
  grossAnnualIncome: '220000',
  existingMonthlyDebt: '300',
  targetSavingsRate: '0.2',
  availableNetWorth: '10000000',
  currentRent: '3000',
  downPaymentCash: '80000',
  reserve: '20000',
  currentAnnualSavings: '60000',
  targetAnnualRetirementSpend: '66000',
};

const HOUSEHOLD_MODEST: Household = {
  grossAnnualIncome: '110000',
  existingMonthlyDebt: '1200',
  targetSavingsRate: '0.15',
  availableNetWorth: '10000000',
  currentRent: '2500',
  downPaymentCash: '180000',
  reserve: '20000',
  currentAnnualSavings: '25000',
  targetAnnualRetirementSpend: '33000',
};

const inputFor = (scenario: ScenarioInputs, household: Household): EngineInput =>
  engineInput({ asOf: ASOF, assumptions: DEFAULT_ASSUMPTIONS, scenario, household });

describe('evaluateScenario — per-scenario DTI + savings report (D-06)', () => {
  test('ratios match the standalone dti.ts derivations on the same single-pass TCO', () => {
    const input = inputFor(SCENARIO_PASS, HOUSEHOLD_STRONG);
    const result = evaluateScenario(input);
    const tco = computeTco(input);

    expect(result.frontEndRatio).toBe(frontEndRatio(tco, HOUSEHOLD_STRONG.grossAnnualIncome).toFixed());
    expect(result.backEndRatio).toBe(
      backEndRatio(
        tco,
        HOUSEHOLD_STRONG.grossAnnualIncome,
        HOUSEHOLD_STRONG.existingMonthlyDebt,
      ).toFixed(),
    );
  });

  test('pass flags reflect the ratios vs assumptions.dti thresholds; both pass for the affordable scenario', () => {
    const result = evaluateScenario(inputFor(SCENARIO_PASS, HOUSEHOLD_STRONG));
    const front = new Dec(result.frontEndRatio);
    const back = new Dec(result.backEndRatio);
    expect(result.frontEndPass).toBe(front.lessThanOrEqualTo(new Dec(DEFAULT_ASSUMPTIONS.dti.frontEnd)));
    expect(result.backEndPass).toBe(back.lessThanOrEqualTo(new Dec(DEFAULT_ASSUMPTIONS.dti.backEnd)));
    expect(result.frontEndPass).toBe(true);
    expect(result.backEndPass).toBe(true);
    // Both pass ⇒ headroom (margin below the binding threshold) is non-negative.
    expect(new Dec(result.headroom).greaterThanOrEqualTo(0)).toBe(true);
  });

  test('a stretch price for a modest household FAILS the back-end; headroom goes negative', () => {
    const result = evaluateScenario(inputFor(SCENARIO_FAIL, HOUSEHOLD_MODEST));
    expect(result.backEndPass).toBe(false);
    // The binding ceiling fails ⇒ headroom (the margin below the binding threshold) is negative.
    expect(new Dec(result.headroom).lessThan(0)).toBe(true);
  });

  test('savingsRateImpact is the post-purchase savings rate (D-03/D-04/D-17), as a decimal string', () => {
    const input = inputFor(SCENARIO_PASS, HOUSEHOLD_STRONG);
    const result = evaluateScenario(input);
    const tco = computeTco(input);
    const drain = cashSavingsDrain(tco);
    const premium = new Dec(drain.toDecimalString())
      .minus(new Dec(HOUSEHOLD_STRONG.currentRent))
      .times(12);
    const post = new Dec(HOUSEHOLD_STRONG.currentAnnualSavings).minus(premium);
    const expected = post.div(new Dec(HOUSEHOLD_STRONG.grossAnnualIncome)).toFixed();
    expect(result.savingsRateImpact).toBe(expected);
  });

  test('requires household; throws a clear error when absent', () => {
    const noHousehold = engineInput({
      asOf: ASOF,
      assumptions: DEFAULT_ASSUMPTIONS,
      scenario: SCENARIO_PASS,
    });
    expect(() => evaluateScenario(noHousehold)).toThrow(/household/i);
  });
});
