// fi-trajectory.test.ts — the pure net-worth-over-time SERIES entry (SC-2, Open Q1).
//
// `fiTrajectory` surfaces the month-by-month net worth that `projectFiDate` computes and then
// DISCARDS (it keeps only the FI crossing). The D-07 hero chart needs the whole series for BOTH
// paths — the buy scenario and the keep-renting baseline — plus the FI-threshold line and the two
// crossover markers. The correctness contract is "agree by construction": because `fiTrajectory`
// reuses the EXACT same contribute-then-compound loop, the same path bundles, and the same
// comparison NW as `projectFiDate`, the emitted series and the scalar FI date cannot disagree.
//
// The three behaviors pinned here:
//   1. RECONCILIATION — `buyFiMonth`/`rentFiMonth` equal `projectFiDate`'s month (surfaced through
//      `fiImpact`, the public composer of `projectFiDate` over the same two bundles).
//   2. FINITENESS / Money-only — the series emits to the horizon cap; every NW is a finite `Money`;
//      `canonicalJson(result)` does not throw (no non-finite number, no method-bearing field).
//   3. THRESHOLD + anti-funnel — `fiThreshold` is the owner FI target; an unreachable strained input
//      yields `buyFiMonth === null` while the series still emits to the cap.
import { describe, test, expect } from 'vitest';
import {
  engineInput,
  type EngineInput,
  type ScenarioInputs,
  type Household,
} from '../engine/engine-input.js';
import { DEFAULT_ASSUMPTIONS } from '../assumptions/defaults.js';
import { calendarDate } from '../time/calendar-date.js';
import { canonicalJson } from '../serialize/canonical-json.js';
import { fiImpact } from './fi-impact.js';
import { fiTrajectory } from './fi-trajectory.js';

const ASOF = calendarDate('2026-01-01');

// The comfortable fixture (copied from fi-impact.test.ts): both paths reach FI within the horizon,
// so the reconciliation asserts real `reached` months, not a degenerate null===null.
const COMFORTABLE_SCENARIO: ScenarioInputs = {
  label: 'fi-trajectory comfortable',
  price: '600000',
  downPaymentPct: '0.20',
  annualRate: '0.06375',
  termMonths: 360,
  holdingYears: 30,
  town: 'Newton',
  insuranceAnnual: '1800',
  hoaMonthly: '0',
  monthlyRent: '3000',
};

const COMFORTABLE_HOUSEHOLD: Household = {
  grossAnnualIncome: '300000',
  existingMonthlyDebt: '300',
  targetSavingsRate: '0.35',
  availableNetWorth: '800000',
  currentRent: '3000',
  downPaymentCash: '120000',
  reserve: '50000',
  currentAnnualSavings: '120000',
  targetAnnualRetirementSpend: '80000',
};

// The strained fixture (copied from fi-impact.test.ts): the ownership premium swamps savings, so
// the buy path never reaches FI within the horizon — the anti-funnel "don't buy" series.
const STRAINED_SCENARIO: ScenarioInputs = {
  label: 'fi-trajectory strained',
  price: '1400000',
  downPaymentPct: '0.20',
  annualRate: '0.07',
  termMonths: 360,
  town: 'Newton',
  holdingYears: 30,
  insuranceAnnual: '4000',
  hoaMonthly: '0',
  monthlyRent: '3000',
};

const STRAINED_HOUSEHOLD: Household = {
  grossAnnualIncome: '180000',
  existingMonthlyDebt: '500',
  targetSavingsRate: '0.20',
  availableNetWorth: '300000',
  currentRent: '3000',
  downPaymentCash: '280000',
  reserve: '40000',
  currentAnnualSavings: '36000',
  targetAnnualRetirementSpend: '70000',
};

const inputFor = (scenario: ScenarioInputs, household?: Household): EngineInput =>
  engineInput({ asOf: ASOF, assumptions: DEFAULT_ASSUMPTIONS, scenario, household });

// The horizon cap is V3 stored data (maxHorizonYears * 12) — Number() only at the count boundary.
const MAX_HORIZON_MONTHS = Number(DEFAULT_ASSUMPTIONS.projection.maxHorizonYears) * 12;

describe('fiTrajectory — reconciliation with projectFiDate (agree by construction)', () => {
  test('buyFiMonth/rentFiMonth equal projectFiDate (via fiImpact) on the same input', () => {
    const input = inputFor(COMFORTABLE_SCENARIO, COMFORTABLE_HOUSEHOLD);
    const t = fiTrajectory(input);
    const fi = fiImpact(input);

    // Constructed so both paths reach — the reconciliation pins real months, not null===null.
    expect(fi.buy.kind).toBe('reached');
    expect(fi.baseline.kind).toBe('reached');

    const expectedBuy = fi.buy.kind === 'reached' ? fi.buy.month : null;
    const expectedRent = fi.baseline.kind === 'reached' ? fi.baseline.month : null;
    expect(t.buyFiMonth).toBe(expectedBuy);
    expect(t.rentFiMonth).toBe(expectedRent);
  });
});

describe('fiTrajectory — finiteness + Money-only series (canonicalJson-safe)', () => {
  test('emits a sampled series to the horizon cap; every NW is finite Money', () => {
    const input = inputFor(COMFORTABLE_SCENARIO, COMFORTABLE_HOUSEHOLD);
    const t = fiTrajectory(input);

    expect(t.points.length).toBeGreaterThanOrEqual(1);
    expect(t.points[t.points.length - 1]!.month).toBe(MAX_HORIZON_MONTHS);

    for (const p of t.points) {
      // Every dollar is a Money whose canonical string parses finite.
      expect(Number.isFinite(Number(p.buyNetWorth.toDecimalString()))).toBe(true);
      expect(Number.isFinite(Number(p.rentNetWorth.toDecimalString()))).toBe(true);
    }

    // canonicalJson throws on a non-finite number or a method-bearing field — proving the whole
    // result is float-free and serialization-safe (T-7-04).
    expect(() => canonicalJson(t)).not.toThrow();
  });
});

describe('fiTrajectory — fiThreshold + the anti-funnel unreachable series', () => {
  test('fiThreshold is the owner FI target (the D-07 threshold line)', () => {
    const input = inputFor(COMFORTABLE_SCENARIO, COMFORTABLE_HOUSEHOLD);
    const t = fiTrajectory(input);
    expect(t.fiThreshold.toDecimalString()).toBe(
      fiImpact(input).targets.ownerTarget.toDecimalString(),
    );
  });

  test('an unreachable strained buy yields buyFiMonth null while the series still emits to the cap', () => {
    const input = inputFor(STRAINED_SCENARIO, STRAINED_HOUSEHOLD);
    const t = fiTrajectory(input);

    expect(fiImpact(input).buy.kind).toBe('unreached');
    expect(t.buyFiMonth).toBeNull();
    expect(t.points[t.points.length - 1]!.month).toBe(MAX_HORIZON_MONTHS);
  });
});
