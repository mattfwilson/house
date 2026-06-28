// container.test.ts — proves the whole imperative shell COMPOSES end-to-end behind the single
// composition root, with ZERO Next.js. `makeContainer(':memory:')` migrates a throwaway DB and
// returns the port-typed `Container`; the test then drives a full flow through the SERVICES and
// the container's ports: saveProfile -> computeAndSaveScenario -> loadScenario (present) ->
// listScenarios (thin meta) -> deleteScenario (gone), plus container.listings.getListings (the
// MockListingsProvider fixtures). The owning profile is saved BEFORE the scenario because the
// SQLite arm enforces a real scenarios->profiles FOREIGN KEY (06-05).
import { describe, expect, it } from 'vitest';
import {
  calendarDate,
  engineInput,
  DEFAULT_ASSUMPTIONS,
  type EngineInput,
  type Household,
  type Profile,
} from '@house/core';
import { makeContainer } from './container.js';
import { saveProfile, listProfiles } from './services/profile-service.js';
import {
  computeAndSaveScenario,
  loadScenario,
  listScenarios,
  deleteScenario,
} from './services/scenario-service.js';

const FIXED_TS = 1782615343000;

function household(): Household {
  return {
    grossAnnualIncome: '200000',
    existingMonthlyDebt: '400',
    targetSavingsRate: '0.20',
    availableNetWorth: '600000',
    currentRent: '2800',
    downPaymentCash: '90000',
    reserve: '30000',
    currentAnnualSavings: '48000',
    targetAnnualRetirementSpend: '60000',
  };
}

function makeProfile(): Profile {
  return { id: 'prof-1', name: 'Matt & Wife', ...household() };
}

function makeEngineInput(): EngineInput {
  return engineInput({
    asOf: calendarDate('2026-01-01'),
    assumptions: DEFAULT_ASSUMPTIONS,
    scenario: {
      label: 'Newton $850k',
      price: '850000',
      downPaymentPct: '0.20',
      annualRate: '0.065',
      termMonths: 360,
      holdingYears: 7,
      town: 'Newton',
      insuranceAnnual: '2000',
      hoaMonthly: '0',
      monthlyRent: '3200',
    },
    household: household(),
  });
}

describe('makeContainer — end-to-end shell composition (zero Next.js)', () => {
  it('migrates at construction and exposes the three ports', () => {
    const c = makeContainer(':memory:');
    // The ports are callable immediately — the schema is live (runMigrations ran at construction).
    expect(c.profiles.count()).toBe(0);
    expect(c.scenarios.listByProfile('nobody')).toEqual([]);
    expect(c.listings.getListings({}).length).toBeGreaterThan(0);
  });

  it('drives a full saveProfile -> computeAndSaveScenario -> loadScenario flow through the container', () => {
    const c = makeContainer(':memory:');

    // 1. Save the owning profile (the scenario FK requires it to exist first).
    saveProfile(c.profiles, makeProfile());
    expect(listProfiles(c.profiles).map((p) => p.id)).toEqual(['prof-1']);

    // 2. Compute + persist a scenario via the Pattern-1 service (timestamp supplied by the shell).
    const saved = computeAndSaveScenario(c.scenarios, {
      id: 'scn-1',
      profileId: 'prof-1',
      name: 'Newton $850k',
      input: makeEngineInput(),
      now: FIXED_TS,
    });
    expect(saved.createdAt).toBe(FIXED_TS);
    expect(saved.updatedAt).toBe(FIXED_TS);

    // 3. Load it back — the frozen snapshot is present and re-validated by the adapter.
    const loaded = loadScenario(c.scenarios, 'scn-1');
    expect(loaded).not.toBeNull();
    expect(loaded?.name).toBe('Newton $850k');
    expect(loaded?.input.scenario.town).toBe('Newton');
    expect(loaded?.input.household?.grossAnnualIncome).toBe('200000');

    // 4. The thin meta projection lists it for the owning profile.
    const metas = listScenarios(c.scenarios, 'prof-1');
    expect(metas.map((m) => m.id)).toEqual(['scn-1']);

    // 5. Delete removes it.
    deleteScenario(c.scenarios, 'scn-1');
    expect(loadScenario(c.scenarios, 'scn-1')).toBeNull();
  });

  it('serves the MockListingsProvider fixtures through container.listings', () => {
    const c = makeContainer(':memory:');
    const all = c.listings.getListings({});
    expect(all.length).toBeGreaterThan(0);
    // A town filter narrows the result set (port behavior, fixtures wired).
    const newton = c.listings.getListings({ town: 'Newton' });
    expect(newton.every((l) => l.town === 'Newton')).toBe(true);
  });
});
