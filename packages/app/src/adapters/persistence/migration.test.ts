// Migration round-trip test — the [BLOCKING] load-bearing proof that the committed drizzle-kit
// migration materializes a LIVE SQLite schema. A passing `tsc -b` is a FALSE POSITIVE here:
// Drizzle's row types derive from `schema.ts`, so the types compile whether or not the table
// actually exists in the database. ONLY migrating a fresh `:memory:` DB and round-tripping a
// real insert/select proves the schema is real. Written in the gated, plain-assert style of
// `golden.test.ts` (plain `expect(...).toBe(...)`, NOT `toMatchSnapshot`).
import { describe, it, expect } from 'vitest';
import { openDb, runMigrations } from './db.js';
import { profiles, scenarios } from './schema.js';

// A fully-populated profile carrying ALL NINE Household money leaves as canonical decimal
// STRINGS (engine-input.ts:116-154), incl. available_net_worth (PROF-01 "net worth"),
// currentAnnualSavings, and targetAnnualRetirementSpend — the leaves a five-column profile
// would omit. Distinct values per column so a column-swap bug cannot pass silently.
const PROFILE_ROW = {
  id: 'profile-1',
  name: 'Matt & Wife',
  grossAnnualIncome: '285000.00',
  existingMonthlyDebt: '650.00',
  targetSavingsRate: '0.42',
  availableNetWorth: '740000.00',
  currentRent: '3200.00',
  downPaymentCash: '180000.00',
  reserve: '40000.00',
  currentAnnualSavings: '96000.00',
  targetAnnualRetirementSpend: '110000.00',
  createdAt: 1782615343000,
  updatedAt: 1782615343000,
} as const;

const SCENARIO_ROW = {
  id: 'scenario-1',
  profileId: 'profile-1',
  name: 'Newton $850k',
  // A representative canonicalJson EngineInput blob (the real source of truth — D-05).
  snapshot: '{"asOf":"2026-06-27","scenario":{"price":"850000.00"}}',
  createdAt: 1782615343000,
  updatedAt: 1782615343000,
} as const;

describe('migration: live SQLite schema (nine-leaf profiles + scenarios)', () => {
  it('migrates a fresh :memory: DB then round-trips a real nine-leaf profile + scenario insert/select', () => {
    const db = openDb(':memory:');
    runMigrations(db);

    db.insert(profiles).values(PROFILE_ROW).run();
    db.insert(scenarios).values(SCENARIO_ROW).run();

    const profileRows = db.select().from(profiles).all();
    expect(profileRows).toHaveLength(1);
    const p = profileRows[0]!;

    // Every one of the NINE money/rate leaves must round-trip EXACTLY as the stored decimal
    // string (behavior assertion against the live DB — not a type check).
    expect(p.id).toBe('profile-1');
    expect(p.name).toBe('Matt & Wife');
    expect(p.grossAnnualIncome).toBe('285000.00');
    expect(p.existingMonthlyDebt).toBe('650.00');
    expect(p.targetSavingsRate).toBe('0.42');
    expect(p.availableNetWorth).toBe('740000.00'); // PROF-01 "net worth"
    expect(p.currentRent).toBe('3200.00');
    expect(p.downPaymentCash).toBe('180000.00');
    expect(p.reserve).toBe('40000.00');
    expect(p.currentAnnualSavings).toBe('96000.00');
    expect(p.targetAnnualRetirementSpend).toBe('110000.00');
    expect(p.createdAt).toBe(1782615343000);
    expect(p.updatedAt).toBe(1782615343000);

    const scenarioRows = db.select().from(scenarios).all();
    expect(scenarioRows).toHaveLength(1);
    const s = scenarioRows[0]!;
    expect(s.id).toBe('scenario-1');
    expect(s.profileId).toBe('profile-1');
    expect(s.name).toBe('Newton $850k');
    expect(s.snapshot).toBe('{"asOf":"2026-06-27","scenario":{"price":"850000.00"}}');
    expect(s.createdAt).toBe(1782615343000);
    expect(s.updatedAt).toBe(1782615343000);
  });

  it('enforces the unique scenario-name-per-profile index (duplicate (profileId, name) THROWS)', () => {
    const db = openDb(':memory:');
    runMigrations(db);

    db.insert(profiles).values(PROFILE_ROW).run();
    db.insert(scenarios).values(SCENARIO_ROW).run();

    // Same (profileId, name) as SCENARIO_ROW, different id — the unique index (D-11) must BITE
    // at the live DB layer, not merely at the type level.
    expect(() =>
      db
        .insert(scenarios)
        .values({ ...SCENARIO_ROW, id: 'scenario-2' })
        .run(),
    ).toThrow(/UNIQUE/i);
  });
});
