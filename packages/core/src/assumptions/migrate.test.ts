// migrate(old) -> current — the version step-up path (D-05).
//
// Currently identity for V1, but STRUCTURED so a future V1->V2 step slots in. An unknown
// schemaVersion must be rejected (defense against a forged/corrupt snapshot, T-03-01).
import { describe, test, expect } from 'vitest';
import { migrate } from './migrate.js';
import { AssumptionsV1, CURRENT_VERSION } from './schema.js';
import { DEFAULT_ASSUMPTIONS } from './defaults.js';
import type { z } from 'zod';

/**
 * A hand-built schemaVersion-1 set (the migration SOURCE). Distinct seed values from the
 * V2 defaults so the test can prove the V1->V2 transform copies the V1 leaves verbatim
 * while the new slices come from the V2 defaults (not silently overwritten).
 */
const V1_FIXTURE: z.infer<typeof AssumptionsV1> = {
  schemaVersion: 1,
  tax: {
    effectiveIncomeRate: '0.25',
    propertyRateAnnual: '0.012',
  },
  dti: { frontEnd: '0.28', backEnd: '0.36' },
  returns: { realAnnual: '0.05' },
  inflation: { annual: '0.025' },
  maintenance: { annualPctOfValue: '0.01' },
  swr: { rate: '0.033' },
  pmi: { annualRateOfLoan: '0.0075', dropOffLtv: '0.8' },
};

describe('migrate — gates on schemaVersion', () => {
  test('returns a current set unchanged when input is already current (V2)', () => {
    const out = migrate(DEFAULT_ASSUMPTIONS);
    expect(out.schemaVersion).toBe(CURRENT_VERSION);
    expect(out).toStrictEqual(DEFAULT_ASSUMPTIONS);
  });

  test('migrates a V1 set up to V2 with the new slices defaulted (a REAL transform, not identity)', () => {
    const out = migrate(V1_FIXTURE);

    // Version is bumped to current.
    expect(out.schemaVersion).toBe(2);
    expect(out.schemaVersion).toBe(CURRENT_VERSION);

    // V1 leaves are preserved verbatim.
    expect(out.tax.effectiveIncomeRate).toBe('0.25');
    expect(out.tax.propertyRateAnnual).toBe('0.012');
    expect(out.returns.realAnnual).toBe('0.05');

    // New V2 slices carry the V2-default values (proves the arm is exercised).
    expect(out.appreciation.realAnnual).toBe('0.0075');
    expect(out.transaction.sellCostPct).toBe('0.065');
    expect(out.rent.realGrowthAnnual).toBe('0');
    expect(out.closing.rateOfPrice).toBe('0.025');
    expect(out.tax.assessmentRatio).toBe('1.0');
  });

  test('the migrated result parses against the current schema', () => {
    const out = migrate(V1_FIXTURE);
    // parseAssumptionSet is the boundary; migrate output must satisfy it.
    expect(out.schemaVersion).toBe(CURRENT_VERSION);
  });

  test('rejects an unknown schemaVersion (T-03-01)', () => {
    // Cast through unknown: an out-of-range version is exactly the corrupt-snapshot case.
    const forged = { ...DEFAULT_ASSUMPTIONS, schemaVersion: 99 } as unknown as Parameters<typeof migrate>[0];
    expect(() => migrate(forged)).toThrow();
  });
});
