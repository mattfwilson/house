// migrate(old) -> current — the version step-up path (D-05).
//
// Currently identity for V1, but STRUCTURED so a future V1->V2 step slots in. An unknown
// schemaVersion must be rejected (defense against a forged/corrupt snapshot, T-03-01).
import { describe, test, expect } from 'vitest';
import { migrate } from './migrate.js';
import { CURRENT_VERSION } from './schema.js';
import { DEFAULT_ASSUMPTIONS } from './defaults.js';

describe('migrate — gates on schemaVersion', () => {
  test('returns a current set unchanged when input is already current', () => {
    const out = migrate(DEFAULT_ASSUMPTIONS);
    expect(out.schemaVersion).toBe(CURRENT_VERSION);
    expect(out).toStrictEqual(DEFAULT_ASSUMPTIONS);
  });

  test('the migrated result parses against the current schema', () => {
    const out = migrate(DEFAULT_ASSUMPTIONS);
    // parseAssumptionSet is the boundary; migrate output must satisfy it.
    expect(out.schemaVersion).toBe(CURRENT_VERSION);
  });

  test('rejects an unknown schemaVersion (T-03-01)', () => {
    // Cast through unknown: an out-of-range version is exactly the corrupt-snapshot case.
    const forged = { ...DEFAULT_ASSUMPTIONS, schemaVersion: 99 } as unknown as Parameters<typeof migrate>[0];
    expect(() => migrate(forged)).toThrow();
  });
});
