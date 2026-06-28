// @vitest-environment node
//
// scenarios.test.ts — the load-bearing Wave-0 boundary tests for the scenario Server Actions:
//   - D-16: a malformed scenario is REJECTED at the core Zod parse, BEFORE any engine call (the
//     action validates raw client input through the existing core schemas — RESEARCH Pitfall 7).
//   - PROF-04: a saved scenario freezes the working set into the snapshot; reloading replays the
//     FROZEN snapshot byte-for-byte (no live re-join, snapshot not mutated).
//
// The actions accept an INJECTED container (the plan sanctions a `:memory:` container) so these tests
// never touch the real `container.server` singleton (which `import 'server-only'` would make throw
// outside an RSC env, and which would write a real ./house.sqlite file).
import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { makeContainer, type Container } from '@house/app';
import { DEFAULT_ASSUMPTIONS, type ScenarioInputs, type Household } from '@house/core';
import {
  recompareAction,
  computeAndSaveScenarioAction,
  loadScenarioAction,
} from '@/app/actions/scenarios';

const ASOF = '2026-01-01';

const SCENARIO: ScenarioInputs = {
  label: 'Newton $600k',
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

const HOUSEHOLD: Household = {
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

let container: Container;

beforeEach(() => {
  container = makeContainer(':memory:');
});

afterEach(() => {
  container.close();
});

describe('recompareAction — validate-through-Zod before the engine (D-16)', () => {
  test('rejects a malformed scenario at the core parse and never reaches the engine', async () => {
    const badScenario = { ...SCENARIO, price: 600000 }; // bare-number money — decStr rejects it
    await expect(
      recompareAction({
        asOf: ASOF,
        household: HOUSEHOLD,
        assumptions: DEFAULT_ASSUMPTIONS,
        baseline: SCENARIO,
        scenarios: [badScenario],
      }),
    ).rejects.toMatchObject({ name: 'ZodError' });
  });

  test('returns a serializable CompareDTO for valid input (baseline row first)', async () => {
    const dto = await recompareAction({
      asOf: ASOF,
      household: HOUSEHOLD,
      assumptions: DEFAULT_ASSUMPTIONS,
      baseline: SCENARIO,
      scenarios: [SCENARIO],
    });
    expect(dto.rows[0].isBaseline).toBe(true);
    expect(JSON.parse(JSON.stringify(dto))).toEqual(dto);
  });
});

describe('computeAndSaveScenarioAction + loadScenarioAction — snapshot replay (PROF-04)', () => {
  test('reloading replays the frozen snapshot — reloaded DTO deep-equals the saved DTO', async () => {
    // Seed the owning profile first (the scenarios->profiles FK is enforced on the connection).
    container.profiles.save({ id: 'prof-1', name: 'Matt & Wife', ...HOUSEHOLD });

    const saveRaw = {
      id: 'scn-1',
      profileId: 'prof-1',
      name: 'Newton $600k',
      asOf: ASOF,
      household: HOUSEHOLD,
      assumptions: DEFAULT_ASSUMPTIONS,
      scenario: SCENARIO,
    };

    const saved = await computeAndSaveScenarioAction(saveRaw, container);
    const reloaded = await loadScenarioAction('scn-1', container);

    expect(reloaded).not.toBeNull();
    expect(reloaded).toEqual(saved);
    // The reloaded snapshot is plain + serializable (no Money/class instance crosses).
    expect(JSON.parse(JSON.stringify(reloaded))).toEqual(reloaded);
  });
});
