// repository-contract.test.ts — ONE shared `repositoryContract` factory run against BOTH the
// SQLite adapters (a migrated `:memory:` DB) AND the InMemory fakes. If the SAME assertion suite
// passes against both, the contract genuinely lives in the PORT (`ScenarioRepository` /
// `ProfileRepository`), not in either implementation — the dependency-inversion proof (D-02).
//
// This is the persistence analog of the core golden harness: byte-identity is asserted with plain
// `expect(produced).toBe(stored)`, NEVER an auto-blessing inline-snapshot matcher (which re-blesses
// drift on `-u` and would silently erase a reproducibility regression — T-06-15). The headline tests:
//   - reproducibility (-t round-trip): save -> reload -> canonicalJson(loaded.input) is
//     BYTE-IDENTICAL to the stored blob, with AND without a household snapshot (PROF-04).
//   - frozen household (-t frozen): editing the owning profile AFTER a scenario is saved does NOT
//     change the reloaded scenario snapshot — the load path rebuilds solely from the self-contained
//     blob and never re-joins the live profile (PROF-04 / RESEARCH Pitfall 7).
//   - fresh-connection reload (-t reload): the SQLite arm reopens a NEW connection to a file-backed
//     DB and still finds the saved scenario (PROF-03 — "save and reload in a later session").
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  canonicalJson,
  calendarDate,
  engineInput,
  DEFAULT_ASSUMPTIONS,
  type EngineInput,
  type Household,
  type Profile,
  type ProfileRepository,
  type SavedScenario,
  type ScenarioInputs,
  type ScenarioRepository,
} from '@house/core';
import { openDb, runMigrations, type Db } from './db.js';
import { SqliteScenarioRepository, serializeSnapshot } from './scenario-repo.js';
import { SqliteProfileRepository } from './profile-repo.js';
import { InMemoryScenarioRepository, InMemoryProfileRepository } from './in-memory-repos.js';

// ---------------------------------------------------------------------------------------------
// Fixtures — built fresh per test so a mutation in one case cannot leak into another.
// ---------------------------------------------------------------------------------------------

const FIXED_TS = 1782615343000;

/** A valid house scenario (mirrors the core golden FIXED_SCENARIO — a seeded town resolves). */
function makeScenarioInputs(): ScenarioInputs {
  return {
    label: 'contract: Newton $850k',
    price: '850000',
    downPaymentPct: '0.20',
    annualRate: '0.065',
    termMonths: 360,
    holdingYears: 7,
    town: 'Newton',
    insuranceAnnual: '2000',
    hoaMonthly: '0',
    monthlyRent: '3200',
  };
}

/** Household "A" — the as-of-save snapshot in the frozen test (distinct money leaves). */
function makeHouseholdA(): Household {
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

/** Household "B" — the EDITED owning profile in the frozen test; every leaf differs from A. */
function makeHouseholdB(): Household {
  return {
    grossAnnualIncome: '320000',
    existingMonthlyDebt: '1100',
    targetSavingsRate: '0.35',
    availableNetWorth: '950000',
    currentRent: '4100',
    downPaymentCash: '210000',
    reserve: '55000',
    currentAnnualSavings: '130000',
    targetAnnualRetirementSpend: '125000',
  };
}

function makeEngineInputWithHousehold(): EngineInput {
  return engineInput({
    asOf: calendarDate('2026-01-01'),
    assumptions: DEFAULT_ASSUMPTIONS,
    scenario: makeScenarioInputs(),
    household: makeHouseholdA(),
  });
}

function makeEngineInputNoHousehold(): EngineInput {
  return engineInput({
    asOf: calendarDate('2026-01-01'),
    assumptions: DEFAULT_ASSUMPTIONS,
    scenario: makeScenarioInputs(),
  });
}

function makeSavedScenario(overrides: Partial<SavedScenario> = {}): SavedScenario {
  return {
    id: 'scn-1',
    profileId: 'prof-1',
    name: 'Newton $850k',
    input: makeEngineInputWithHousehold(),
    createdAt: FIXED_TS,
    updatedAt: FIXED_TS,
    ...overrides,
  };
}

function makeProfile(overrides: Partial<Profile> = {}): Profile {
  return { id: 'prof-1', name: 'Matt & Wife', ...makeHouseholdA(), ...overrides };
}

interface Repos {
  readonly scenarioRepo: ScenarioRepository;
  readonly profileRepo: ProfileRepository;
}

/**
 * Seed the owning profile rows a scenario's FK references. A scenario without an owning profile is
 * not a valid domain state — the SQLite arm enforces this with a real FOREIGN KEY constraint, and
 * seeding here keeps the contract identical (and harmless) for the InMemory fake.
 */
function seedProfiles(profileRepo: ProfileRepository, ...ids: readonly string[]): void {
  for (const id of ids) {
    profileRepo.save(makeProfile({ id, name: id }));
  }
}

// ---------------------------------------------------------------------------------------------
// The shared contract factory — invoked once per implementation.
// ---------------------------------------------------------------------------------------------

function repositoryContract(name: string, makeRepos: () => Repos): void {
  describe(`repositoryContract [${name}]`, () => {
    describe('scenario repository', () => {
      it('scenario save then load returns the SavedScenario', () => {
        const { scenarioRepo, profileRepo } = makeRepos();
        seedProfiles(profileRepo, 'prof-1');
        scenarioRepo.save(makeSavedScenario());
        const loaded = scenarioRepo.load('scn-1');
        expect(loaded).not.toBeNull();
        expect(loaded!.id).toBe('scn-1');
        expect(loaded!.profileId).toBe('prof-1');
        expect(loaded!.name).toBe('Newton $850k');
        expect(loaded!.input.scenario.price).toBe('850000');
      });

      it('scenario load of an absent id returns null', () => {
        const { scenarioRepo } = makeRepos();
        expect(scenarioRepo.load('nope')).toBeNull();
      });

      it('scenario listByProfile returns ONLY the thin metadata columns (no input blob)', () => {
        const { scenarioRepo, profileRepo } = makeRepos();
        seedProfiles(profileRepo, 'prof-1', 'prof-other');
        scenarioRepo.save(makeSavedScenario({ id: 'scn-1', name: 'A' }));
        scenarioRepo.save(makeSavedScenario({ id: 'scn-2', name: 'B' }));
        scenarioRepo.save(makeSavedScenario({ id: 'scn-3', name: 'C', profileId: 'prof-other' }));

        const metas = scenarioRepo.listByProfile('prof-1');
        expect(metas.map((m) => m.id).sort()).toEqual(['scn-1', 'scn-2']);
        for (const meta of metas) {
          expect(Object.keys(meta).sort()).toEqual([
            'createdAt',
            'id',
            'name',
            'profileId',
            'updatedAt',
          ]);
          expect('input' in meta).toBe(false);
        }
      });

      it('scenario delete removes the row (subsequent load returns null)', () => {
        const { scenarioRepo, profileRepo } = makeRepos();
        seedProfiles(profileRepo, 'prof-1');
        scenarioRepo.save(makeSavedScenario());
        expect(scenarioRepo.load('scn-1')).not.toBeNull();
        scenarioRepo.delete('scn-1');
        expect(scenarioRepo.load('scn-1')).toBeNull();
      });

      it('scenario duplicate name within a profile is REJECTED', () => {
        const { scenarioRepo, profileRepo } = makeRepos();
        seedProfiles(profileRepo, 'prof-1');
        scenarioRepo.save(makeSavedScenario({ id: 'scn-1', name: 'Same' }));
        expect(() =>
          scenarioRepo.save(makeSavedScenario({ id: 'scn-2', name: 'Same' })),
        ).toThrow(/unique/i);
      });

      it('scenario re-save of the SAME id is an idempotent edit (no duplicate)', () => {
        const { scenarioRepo, profileRepo } = makeRepos();
        seedProfiles(profileRepo, 'prof-1');
        scenarioRepo.save(makeSavedScenario({ id: 'scn-1', name: 'Edit me' }));
        scenarioRepo.save(makeSavedScenario({ id: 'scn-1', name: 'Edited', updatedAt: FIXED_TS + 1 }));
        expect(scenarioRepo.listByProfile('prof-1')).toHaveLength(1);
        expect(scenarioRepo.load('scn-1')!.name).toBe('Edited');
      });
    });

    describe('reproducibility', () => {
      it('round-trip: save -> reload is BYTE-IDENTICAL canonical JSON (household PRESENT)', () => {
        const { scenarioRepo, profileRepo } = makeRepos();
        seedProfiles(profileRepo, 'prof-1');
        const input = makeEngineInputWithHousehold();
        const storedBlob = serializeSnapshot(input);
        scenarioRepo.save(makeSavedScenario({ input }));
        const loaded = scenarioRepo.load('scn-1');
        expect(canonicalJson(loaded!.input)).toBe(storedBlob);
      });

      it('round-trip: save -> reload is BYTE-IDENTICAL canonical JSON (household ABSENT)', () => {
        const { scenarioRepo, profileRepo } = makeRepos();
        seedProfiles(profileRepo, 'prof-1');
        const input = makeEngineInputNoHousehold();
        const storedBlob = serializeSnapshot(input);
        scenarioRepo.save(makeSavedScenario({ input }));
        const loaded = scenarioRepo.load('scn-1');
        expect(canonicalJson(loaded!.input)).toBe(storedBlob);
        // The omitted-household snapshot must NOT resurrect the key on reload.
        expect(loaded!.input.household).toBeUndefined();
      });
    });

    describe('frozen household', () => {
      it('frozen: a post-save profile EDIT does NOT mutate the saved scenario snapshot', () => {
        const { scenarioRepo, profileRepo } = makeRepos();
        const householdA = makeHouseholdA();
        const householdB = makeHouseholdB();

        // Save the owning profile (household A) and a scenario carrying household A.
        profileRepo.save(makeProfile({ id: 'prof-1', ...householdA }));
        scenarioRepo.save(
          makeSavedScenario({
            id: 'scn-1',
            profileId: 'prof-1',
            input: engineInput({
              asOf: calendarDate('2026-01-01'),
              assumptions: DEFAULT_ASSUMPTIONS,
              scenario: makeScenarioInputs(),
              household: householdA,
            }),
          }),
        );

        // EDIT the owning profile to household B (every money leaf differs).
        profileRepo.save(makeProfile({ id: 'prof-1', ...householdB }));

        // Reload the scenario — its household must STILL be A (frozen), never the edited B.
        const loaded = scenarioRepo.load('scn-1');
        expect(canonicalJson(loaded!.input.household)).toBe(canonicalJson(householdA));
        expect(canonicalJson(loaded!.input.household)).not.toBe(canonicalJson(householdB));
      });
    });

    describe('profile repository', () => {
      it('profile save then load round-trips all NINE money leaves byte-identical', () => {
        const { profileRepo } = makeRepos();
        const profile = makeProfile();
        profileRepo.save(profile);
        const loaded = profileRepo.load('prof-1');
        expect(loaded).not.toBeNull();
        expect(loaded).toEqual(profile);
        // Spot-check the leaves a five-column profile would omit.
        expect(loaded!.availableNetWorth).toBe('600000');
        expect(loaded!.currentAnnualSavings).toBe('48000');
        expect(loaded!.targetAnnualRetirementSpend).toBe('60000');
      });

      it('profile load of an absent id returns null', () => {
        const { profileRepo } = makeRepos();
        expect(profileRepo.load('nope')).toBeNull();
      });

      it('profile list + count reflect the saved rows', () => {
        const { profileRepo } = makeRepos();
        expect(profileRepo.count()).toBe(0);
        profileRepo.save(makeProfile({ id: 'prof-1', name: 'Matt' }));
        profileRepo.save(makeProfile({ id: 'prof-2', name: 'Wife' }));
        expect(profileRepo.count()).toBe(2);
        expect(profileRepo.list().map((p) => p.id).sort()).toEqual(['prof-1', 'prof-2']);
      });
    });
  });
}

// ---------------------------------------------------------------------------------------------
// Arm 1 — the SQLite adapters over a migrated :memory: DB (the real implementation).
// ---------------------------------------------------------------------------------------------

function migratedMemoryDb(): Db {
  const db = openDb(':memory:');
  runMigrations(db);
  return db;
}

repositoryContract('SQLite (:memory:)', () => {
  const db = migratedMemoryDb();
  return {
    scenarioRepo: new SqliteScenarioRepository(db),
    profileRepo: new SqliteProfileRepository(db, () => FIXED_TS),
  };
});

// ---------------------------------------------------------------------------------------------
// Arm 2 — the InMemory fakes (the adapter-agnostic proof).
// ---------------------------------------------------------------------------------------------

repositoryContract('InMemory fake', () => ({
  scenarioRepo: new InMemoryScenarioRepository(),
  profileRepo: new InMemoryProfileRepository(),
}));

// ---------------------------------------------------------------------------------------------
// PROF-03 — SQLite-only: a FRESH connection (a "later session") reloads the saved scenario.
// :memory: DBs are per-connection, so this uses a real file-backed DB opened twice.
// ---------------------------------------------------------------------------------------------

describe('PROF-03 fresh-connection reload (SQLite, file-backed)', () => {
  const dirs: string[] = [];

  afterEach(() => {
    for (const dir of dirs.splice(0)) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('reload: save in one connection, reopen a fresh connection, the scenario is present', () => {
    const dir = mkdtempSync(join(tmpdir(), 'house-repo-'));
    dirs.push(dir);
    const dbFile = join(dir, 'house.sqlite');

    // Session 1: migrate, seed the owning profile (FK), save the scenario, then CLOSE the handle
    // (Windows cannot delete an open file; closing also checkpoints WAL into the main file).
    const db1 = migratedFileDb(dbFile);
    new SqliteProfileRepository(db1, () => FIXED_TS).save(makeProfile({ id: 'prof-1' }));
    new SqliteScenarioRepository(db1).save(makeSavedScenario());
    db1.$client.close();

    // Session 2: a brand-new connection to the same file — the snapshot must survive (PROF-03).
    const db2 = openDb(dbFile);
    const loaded = new SqliteScenarioRepository(db2).load('scn-1');
    expect(loaded).not.toBeNull();
    expect(canonicalJson(loaded!.input)).toBe(serializeSnapshot(makeEngineInputWithHousehold()));
    db2.$client.close();
  });
});

function migratedFileDb(file: string): Db {
  const db = openDb(file);
  runMigrations(db);
  return db;
}

// ---------------------------------------------------------------------------------------------
// WR-02 — SQLite-only: the scenarios->profiles FOREIGN KEY is ENFORCED, not merely declared.
// This proves the `PRAGMA foreign_keys = ON` in `openDb` actually rejects an orphan scenario
// (a profileId pointing at no profile row), rather than the constraint being asserted only in
// prose. Not part of the shared contract: the InMemory fake intentionally models no FK.
// ---------------------------------------------------------------------------------------------

describe('FK enforcement (SQLite)', () => {
  it('saving a scenario whose profileId references no profile row throws a FOREIGN KEY error', () => {
    const db = migratedMemoryDb();
    const scenarioRepo = new SqliteScenarioRepository(db);
    // No profile is seeded — the owning profileId points at nothing.
    expect(() =>
      scenarioRepo.save(makeSavedScenario({ id: 'scn-orphan', profileId: 'ghost-profile' })),
    ).toThrow(/FOREIGN KEY/i);
    db.$client.close();
  });
});
