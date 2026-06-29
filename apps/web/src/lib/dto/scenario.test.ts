// dto/scenario.test.ts — the load-bearing Wave-0 boundary tests for the Money→string DTO mappers
// (RESEARCH Pitfall 1 RSC-serialization; test map Pitfall 1 + D-04/D-05). These prove the single
// invariant the whole DTO layer exists to enforce: NO `Money`/class instance ever crosses the React
// server→client boundary, and the core's anti-funnel ranking survives the map verbatim (FI-06).
//
// Fixtures are built via REAL core calls through `engineInput(...)` (parse, never a cast) so the DTO
// is exercised against the genuine `CompareResult`/`AffordabilityGapResult`/`FiImpactResult` shapes,
// not a hand-rolled stand-in.
import { describe, test, expect } from 'vitest';
import {
  engineInput,
  compareScenarios,
  evaluateScenario,
  affordabilityGap,
  fiImpact,
  calendarDate,
  DEFAULT_ASSUMPTIONS,
  type EngineInput,
  type ScenarioInputs,
  type Household,
} from '@house/core';
import { toCompareDTO, toEvaluateDTO, toGapDTO, toFiImpactDTO } from './scenario';

const ASOF = calendarDate('2026-01-01');

// A comfortable scenario where BOTH the renter baseline and the buy path reach FI within the horizon.
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

// A strained scenario: the ownership premium swamps savings, so the BUY path never reaches FI (the
// honest "don't buy" row that must sort LAST, FI-06).
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

/**
 * Recursively detect any value still carrying the `Money` closed-API surface (`.toDecimalString`).
 * A DTO that leaks a `Money`/class instance returns `true` — the boundary has been breached.
 */
function containsMoneyLike(value: unknown): boolean {
  if (value === null || typeof value !== 'object') return false;
  if (typeof (value as { toDecimalString?: unknown }).toDecimalString === 'function') return true;
  return Object.values(value as Record<string, unknown>).some(containsMoneyLike);
}

describe('toCompareDTO — RSC-serializable + ranking-preserving (Pitfall 1 / FI-06)', () => {
  test('is fully serializable — JSON round-trip deep-equals, no Money instance survives', () => {
    const result = compareScenarios(inputFor(COMFORTABLE_SCENARIO, COMFORTABLE_HOUSEHOLD), [
      inputFor(COMFORTABLE_SCENARIO, COMFORTABLE_HOUSEHOLD),
    ]);
    const dto = toCompareDTO(result);
    expect(JSON.parse(JSON.stringify(dto))).toEqual(dto);
    expect(containsMoneyLike(dto)).toBe(false);
  });

  test('preserves the core ranking — rows[0] is the baseline, every unreached row sorts last', () => {
    const result = compareScenarios(inputFor(COMFORTABLE_SCENARIO, COMFORTABLE_HOUSEHOLD), [
      inputFor(COMFORTABLE_SCENARIO, COMFORTABLE_HOUSEHOLD), // reached buy
      inputFor(STRAINED_SCENARIO, STRAINED_HOUSEHOLD), // unreached buy (don't-buy)
    ]);
    const dto = toCompareDTO(result);

    expect(dto.rows[0]!.isBaseline).toBe(true);

    const reachedIdx = dto.rows
      .map((row, i) => ({ row, i }))
      .filter((x) => x.row.outcomeKind === 'reached')
      .map((x) => x.i);
    const unreachedIdx = dto.rows
      .map((row, i) => ({ row, i }))
      .filter((x) => x.row.outcomeKind === 'unreached')
      .map((x) => x.i);

    // The strained buy must surface as an unreached row (the honest don't-buy outcome).
    expect(unreachedIdx.length).toBeGreaterThan(0);
    // Every unreached row sorts AFTER every reached row (FI-06 — don't-buy sorts worst).
    for (const u of unreachedIdx) {
      for (const r of reachedIdx) {
        expect(u).toBeGreaterThan(r);
      }
    }
  });
});

describe('toGapDTO — the bank-vs-true gap framing (D-06 / SC-4)', () => {
  test('exposes signedGap as a string + the verdict enum, with no Money instance surviving', () => {
    const gap = affordabilityGap(inputFor(COMFORTABLE_SCENARIO, COMFORTABLE_HOUSEHOLD));
    const dto = toGapDTO(gap);

    expect(typeof dto.signedGap).toBe('string');
    expect(typeof dto.bankMaxPrice).toBe('string');
    expect(typeof dto.trueMaxPrice).toBe('string');
    expect(['bankExceedsTrue', 'trueExceedsBank', 'aligned']).toContain(dto.verdict);

    expect(containsMoneyLike(dto)).toBe(false);
    expect(JSON.parse(JSON.stringify(dto))).toEqual(dto);
  });
});

describe('toFiImpactDTO / toEvaluateDTO — Money targets → strings, plain reports', () => {
  test('toFiImpactDTO maps the four Money FI targets to strings (serializable)', () => {
    const dto = toFiImpactDTO(fiImpact(inputFor(COMFORTABLE_SCENARIO, COMFORTABLE_HOUSEHOLD)));
    expect(typeof dto.targets.renterTarget).toBe('string');
    expect(typeof dto.targets.ownerTarget).toBe('string');
    expect(containsMoneyLike(dto)).toBe(false);
    expect(JSON.parse(JSON.stringify(dto))).toEqual(dto);
  });

  test('toEvaluateDTO returns a plain serializable report (already string/boolean fields)', () => {
    const dto = toEvaluateDTO(evaluateScenario(inputFor(COMFORTABLE_SCENARIO, COMFORTABLE_HOUSEHOLD)));
    expect(typeof dto.frontEndRatio).toBe('string');
    expect(typeof dto.frontEndPass).toBe('boolean');
    expect(containsMoneyLike(dto)).toBe(false);
    expect(JSON.parse(JSON.stringify(dto))).toEqual(dto);
  });
});
