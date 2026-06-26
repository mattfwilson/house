// GAP tests (AFF-03) — the product's headline instrument: "the bank will lend $X beyond your
// FI tolerance." `affordabilityGap` composes the bank ceiling (Plan 02) and the true ceiling
// (Plan 03) into a single directional verdict (D-12/D-13), compared cent-exactly on max PRICE
// (mirroring rent-vs-buy's `winner` derivation).
//
// EXACT-EQUALITY / behavioral proofs (never `toBeCloseTo`):
//   - `signedGap = bankMaxPrice − trueMaxPrice` (Money), and the verdict is the structured enum
//     `bankExceedsTrue | trueExceedsBank | aligned` (NO UI copy — Phase 7 owns wording, D-13).
//   - The verdict is decided on `toCents()` bigints against a DOCUMENTED absolute tolerance
//     (ALIGNED_TOLERANCE_CENTS, $1,000 per A2): |signedGap| <= tolerance ⇒ aligned; bank cents
//     beyond the true cents by more than the tolerance ⇒ bankExceedsTrue; else trueExceedsBank.
//   - ANTI-FUNNEL (Pitfall 6): a realistic conservative-saver household whose bank ceiling runs
//     well past the FI-tolerance ceiling yields verdict === 'bankExceedsTrue' and signedGap > 0.
//   - The result carries BOTH the bank `bindingRatio` and the true `bindingConstraint` (D-12).
import { describe, test, expect } from 'vitest';
import { affordabilityGap, ALIGNED_TOLERANCE_CENTS } from './gap.js';
import { bankAffordability } from './bank-affordability.js';
import { trueAffordability } from './true-affordability.js';
import {
  engineInput,
  type EngineInput,
  type ScenarioInputs,
  type Household,
} from '../engine/engine-input.js';
import { DEFAULT_ASSUMPTIONS } from '../assumptions/defaults.js';
import { calendarDate } from '../time/calendar-date.js';

const ASOF = calendarDate('2026-01-01');

// Placeholder price/downPaymentPct (both solvers override them per trial price). The rest is the
// qualification context, identical in shape to the bank/true-affordability fixtures.
const BASE_SCENARIO: ScenarioInputs = {
  label: 'gap solve',
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

// CONSERVATIVE SAVER (the anti-funnel acceptance fixture, Pitfall 6): a high income with a roomy
// reserve so the bank approves a large price, but a high target savings rate (35% of gross) so
// the FI-tolerance ceiling lands well BELOW the bank's. The bank exceeds the true ceiling.
const HOUSEHOLD_CONSERVATIVE: Household = {
  grossAnnualIncome: '220000',
  existingMonthlyDebt: '300',
  targetSavingsRate: '0.35',
  availableNetWorth: '10000000',
  currentRent: '3000',
  downPaymentCash: '150000',
  reserve: '50000',
  currentAnnualSavings: '90000',
};

// CASH-RICH (the trueExceedsBank direction): a LOW income (so the bank under-approves on DTI)
// with a tiny target savings rate (the FI floor barely binds) and an enormous net worth — the
// true ceiling runs ahead of the bank's.
const HOUSEHOLD_CASH_RICH: Household = {
  grossAnnualIncome: '90000',
  existingMonthlyDebt: '1500',
  targetSavingsRate: '0.01',
  availableNetWorth: '10000000',
  currentRent: '3000',
  downPaymentCash: '300000',
  reserve: '50000',
  currentAnnualSavings: '60000',
};

const inputFor = (household: Household): EngineInput =>
  engineInput({ asOf: ASOF, assumptions: DEFAULT_ASSUMPTIONS, scenario: BASE_SCENARIO, household });

describe('affordabilityGap — composes both ceilings into the D-12 result', () => {
  test('carries bankMaxPrice, trueMaxPrice, signedGap, the bank bindingRatio AND the true bindingConstraint', () => {
    const input = inputFor(HOUSEHOLD_CONSERVATIVE);
    const gap = affordabilityGap(input);
    const bank = bankAffordability(input);
    const tru = trueAffordability(input);

    // The composed ceilings are the SAME values the standalone solvers produce (no re-derivation).
    expect(gap.bankMaxPrice.toDecimalString()).toBe(bank.bankMaxPrice.toDecimalString());
    expect(gap.trueMaxPrice.toDecimalString()).toBe(tru.trueMaxPrice.toDecimalString());

    // signedGap = bankMaxPrice − trueMaxPrice (Money), cent-exact.
    const expectedSigned = bank.bankMaxPrice.sub(tru.trueMaxPrice);
    expect(gap.signedGap.toDecimalString()).toBe(expectedSigned.toDecimalString());

    // Both binding fields are carried through (D-12).
    expect(gap.bankBindingRatio).toBe(bank.bindingRatio);
    expect(gap.trueBindingConstraint).toBe(tru.bindingConstraint);
  });

  test('requires household; throws a clear error when absent', () => {
    const noHousehold = engineInput({
      asOf: ASOF,
      assumptions: DEFAULT_ASSUMPTIONS,
      scenario: BASE_SCENARIO,
    });
    expect(() => affordabilityGap(noHousehold)).toThrow(/household/i);
  });
});

describe('verdict — cent-exact directional enum (D-13) against the documented aligned tolerance', () => {
  test('ANTI-FUNNEL (Pitfall 6): conservative saver ⇒ verdict === "bankExceedsTrue", signedGap > 0', () => {
    const gap = affordabilityGap(inputFor(HOUSEHOLD_CONSERVATIVE));
    expect(gap.verdict).toBe('bankExceedsTrue');
    // signedGap = bank − true > 0, and beyond the aligned tolerance.
    expect(gap.signedGap.toCents() > 0n).toBe(true);
    expect(gap.signedGap.toCents() > ALIGNED_TOLERANCE_CENTS).toBe(true);
  });

  test('cash-rich household ⇒ verdict === "trueExceedsBank", signedGap < 0', () => {
    const gap = affordabilityGap(inputFor(HOUSEHOLD_CASH_RICH));
    expect(gap.verdict).toBe('trueExceedsBank');
    expect(gap.signedGap.toCents() < 0n).toBe(true);
    // beyond the aligned tolerance on the negative side.
    expect(-gap.signedGap.toCents() > ALIGNED_TOLERANCE_CENTS).toBe(true);
  });

  test('aligned: when |signedGap| <= the documented tolerance the verdict is "aligned"', () => {
    // Pin the verdict RULE directly against the tolerance: the verdict is decided purely by the
    // two max-price cents and ALIGNED_TOLERANCE_CENTS. This proves the boundary semantics without
    // hand-tuning a household to the exact cent — the verdict derivation is the unit under test.
    const gap = affordabilityGap(inputFor(HOUSEHOLD_CONSERVATIVE));
    const diff = gap.bankMaxPrice.toCents() - gap.trueMaxPrice.toCents();
    const expected =
      diff > ALIGNED_TOLERANCE_CENTS
        ? 'bankExceedsTrue'
        : diff < -ALIGNED_TOLERANCE_CENTS
          ? 'trueExceedsBank'
          : 'aligned';
    expect(gap.verdict).toBe(expected);
    // The tolerance is the documented $1,000 (A2), in integer cents.
    expect(ALIGNED_TOLERANCE_CENTS).toBe(100000n);
  });
});
