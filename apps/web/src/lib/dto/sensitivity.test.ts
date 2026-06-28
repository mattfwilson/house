// dto/sensitivity.test.ts — the load-bearing boundary tests for the tornado + trajectory DTO mappers
// (07-04 Task 1; RESEARCH test map FI-05 no-Infinity + Pitfall 5 float-confined-to-chart-edge). These
// pin the two contracts the data-dense views depend on:
//   - Tornado (FI-05): every `swingMonths` crosses as a FINITE number and the DTO serializes through
//     `JSON.stringify` with NO `Infinity` — even when an endpoint is the discriminated `unreached`
//     verdict (the strained fixture, where the buy path never reaches FI). `topDrivers` is ≤ 3.
//   - Trajectory (Pitfall 5): every dollar field (`buyNetWorth`/`rentNetWorth`/`fiThreshold`) crosses
//     as a decimal STRING — never a number, never a `Money` — so the single float conversion is
//     deferred to the chart edge. The FI-month markers pass through as `number | null`.
//
// Fixtures are built via REAL core calls through `engineInput(...)` (parse, never a cast), exercising
// the genuine `TornadoResult`/`FiTrajectoryResult` shapes — including the unreached "don't buy" path.
import { describe, test, expect } from 'vitest';
import {
  engineInput,
  tornado,
  fiTrajectory,
  calendarDate,
  DEFAULT_ASSUMPTIONS,
  type EngineInput,
  type ScenarioInputs,
  type Household,
} from '@house/core';
import { toTornadoDTO } from './sensitivity';
import { toTrajectoryDTO } from './trajectory';

const ASOF = calendarDate('2026-01-01');

// A comfortable scenario where BOTH paths reach FI within the horizon (reached endpoints).
const COMFORTABLE_SCENARIO: ScenarioInputs = {
  label: 'comfortable',
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

// A strained scenario: the ownership premium swamps savings, so the BUY path never reaches FI — the
// discriminated `unreached` endpoint whose bound is the horizon cap (where a naive |high−low| swing
// would risk `Infinity`). This is the FI-05 case the no-Infinity contract exists for.
const STRAINED_SCENARIO: ScenarioInputs = {
  label: 'strained',
  price: '1400000',
  downPaymentPct: '0.20',
  annualRate: '0.07',
  termMonths: 360,
  holdingYears: 30,
  town: 'Newton',
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

const inputFor = (scenario: ScenarioInputs, household: Household): EngineInput =>
  engineInput({ asOf: ASOF, assumptions: DEFAULT_ASSUMPTIONS, scenario, household });

const COMFORTABLE = inputFor(COMFORTABLE_SCENARIO, COMFORTABLE_HOUSEHOLD);
const STRAINED = inputFor(STRAINED_SCENARIO, STRAINED_HOUSEHOLD);

describe('toTornadoDTO — finite swings, no Infinity (FI-05)', () => {
  test('every swingMonths is a finite number for both reached and unreached endpoints', () => {
    for (const input of [COMFORTABLE, STRAINED]) {
      const dto = toTornadoDTO(tornado(input));
      expect(dto.rows.length).toBeGreaterThan(0);
      for (const row of dto.rows) {
        expect(typeof row.swingMonths).toBe('number');
        expect(Number.isFinite(row.swingMonths)).toBe(true);
      }
    }
  });

  test('JSON.stringify does not throw and the serialized DTO contains no "Infinity"', () => {
    const dto = toTornadoDTO(tornado(STRAINED));
    let json = '';
    expect(() => {
      json = JSON.stringify(dto);
    }).not.toThrow();
    expect(json).not.toContain('Infinity');
    // A non-finite number serializes to `null` where a number is expected — assert none slipped in.
    for (const row of dto.rows) {
      expect(row.swingMonths).not.toBeNull();
    }
  });

  test('topDrivers carries at most three driver names', () => {
    const dto = toTornadoDTO(tornado(COMFORTABLE));
    expect(dto.topDrivers.length).toBeLessThanOrEqual(3);
    // Each flagged driver corresponds to an actual row.
    const drivers = new Set(dto.rows.map((r) => r.driver));
    for (const d of dto.topDrivers) expect(drivers.has(d)).toBe(true);
  });

  test('the DTO round-trips through JSON with no class instance surviving', () => {
    const dto = toTornadoDTO(tornado(COMFORTABLE));
    expect(JSON.parse(JSON.stringify(dto))).toEqual(dto);
  });
});

describe('toTrajectoryDTO — dollars cross as decimal strings (Pitfall 5)', () => {
  test('every net-worth field and the threshold are decimal STRINGS, not numbers or Money', () => {
    const dto = toTrajectoryDTO(fiTrajectory(COMFORTABLE));
    expect(dto.points.length).toBeGreaterThan(0);
    for (const point of dto.points) {
      expect(typeof point.buyNetWorth).toBe('string');
      expect(typeof point.rentNetWorth).toBe('string');
      expect(typeof point.month).toBe('number');
    }
    expect(typeof dto.fiThreshold).toBe('string');
  });

  test('buyFiMonth/rentFiMonth pass through as number | null (null for the unreached buy path)', () => {
    const dto = toTrajectoryDTO(fiTrajectory(STRAINED));
    for (const marker of [dto.buyFiMonth, dto.rentFiMonth]) {
      expect(marker === null || typeof marker === 'number').toBe(true);
    }
    // The strained buy path never reaches FI within the horizon — the honest "don't buy" null marker.
    expect(dto.buyFiMonth).toBeNull();
  });

  test('the DTO round-trips through JSON with no class instance surviving', () => {
    const dto = toTrajectoryDTO(fiTrajectory(COMFORTABLE));
    expect(JSON.parse(JSON.stringify(dto))).toEqual(dto);
  });
});
