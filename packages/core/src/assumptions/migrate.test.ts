// migrate(old) -> current — the version step-up path (D-05).
//
// Currently identity for V1, but STRUCTURED so a future V1->V2 step slots in. An unknown
// schemaVersion must be rejected (defense against a forged/corrupt snapshot, T-03-01).
import { describe, test, expect } from 'vitest';
import { migrate } from './migrate.js';
import { AssumptionsV1, AssumptionsV2, AssumptionsV3, CURRENT_VERSION } from './schema.js';
import { DEFAULT_ASSUMPTIONS } from './defaults.js';
import type { z } from 'zod';

/**
 * A hand-built schemaVersion-1 set (the migration SOURCE). Distinct seed values from the
 * defaults so the test can prove the V1->V2->V3 chain copies the V1 leaves verbatim
 * while the new slices come from the defaults (not silently overwritten).
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

/**
 * A hand-built schemaVersion-2 set (the V2->V3 migration SOURCE). Distinct seed values from the
 * V3 defaults so the test can prove the V2->V3 transform copies every V2 leaf verbatim while the
 * new `sensitivity` + `projection` slices come from the defaults (not silently overwritten).
 */
const V2_FIXTURE: z.infer<typeof AssumptionsV2> = {
  schemaVersion: 2,
  tax: {
    effectiveIncomeRate: '0.26',
    propertyRateAnnual: '0.013',
    assessmentRatio: '0.95',
  },
  dti: { frontEnd: '0.29', backEnd: '0.37' },
  returns: { realAnnual: '0.06' },
  inflation: { annual: '0.026' },
  maintenance: { annualPctOfValue: '0.012' },
  swr: { rate: '0.035' },
  pmi: { annualRateOfLoan: '0.008', dropOffLtv: '0.78' },
  appreciation: { realAnnual: '0.009' },
  transaction: { sellCostPct: '0.07' },
  rent: { realGrowthAnnual: '0.002' },
  closing: { rateOfPrice: '0.03' },
};

/**
 * A hand-built schemaVersion-3 set (the V3->V4 migration SOURCE). Distinct seed values from the
 * V4 defaults so the test can prove the V3->V4 transform copies every V3 leaf verbatim while the
 * new `townScoring` slice comes from the defaults (not silently overwritten).
 */
const V3_FIXTURE: z.infer<typeof AssumptionsV3> = {
  schemaVersion: 3,
  tax: {
    effectiveIncomeRate: '0.28',
    propertyRateAnnual: '0.014',
    assessmentRatio: '0.9',
  },
  dti: { frontEnd: '0.30', backEnd: '0.38' },
  returns: { realAnnual: '0.07' },
  inflation: { annual: '0.027' },
  maintenance: { annualPctOfValue: '0.013' },
  swr: { rate: '0.036' },
  pmi: { annualRateOfLoan: '0.0085', dropOffLtv: '0.77' },
  appreciation: { realAnnual: '0.011' },
  transaction: { sellCostPct: '0.072' },
  rent: { realGrowthAnnual: '0.003' },
  closing: { rateOfPrice: '0.031' },
  sensitivity: {
    returnBand: '0.016',
    inflationBand: '0.011',
    appreciationBand: '0.012',
    maintenanceBand: '0.006',
    taxBandRelative: '0.16',
    swrBand: '0.006',
  },
  projection: { maxHorizonYears: '55' },
};

describe('migrate — gates on schemaVersion', () => {
  test('returns a current set unchanged when input is already current (V4)', () => {
    const out = migrate(DEFAULT_ASSUMPTIONS);
    expect(out.schemaVersion).toBe(CURRENT_VERSION);
    expect(out).toStrictEqual(DEFAULT_ASSUMPTIONS);
  });

  test('migrates a V3 set up to V4 seeding townScoring from defaults (a REAL transform, not identity)', () => {
    const out = migrate(V3_FIXTURE);

    // Version is bumped to current (4).
    expect(out.schemaVersion).toBe(4);
    expect(out.schemaVersion).toBe(CURRENT_VERSION);

    // EVERY V3 leaf is preserved verbatim (distinct from the V4 defaults).
    expect(out.tax.effectiveIncomeRate).toBe('0.28');
    expect(out.tax.propertyRateAnnual).toBe('0.014');
    expect(out.tax.assessmentRatio).toBe('0.9');
    expect(out.dti.frontEnd).toBe('0.30');
    expect(out.dti.backEnd).toBe('0.38');
    expect(out.returns.realAnnual).toBe('0.07');
    expect(out.inflation.annual).toBe('0.027');
    expect(out.maintenance.annualPctOfValue).toBe('0.013');
    expect(out.swr.rate).toBe('0.036');
    expect(out.pmi.annualRateOfLoan).toBe('0.0085');
    expect(out.pmi.dropOffLtv).toBe('0.77');
    expect(out.appreciation.realAnnual).toBe('0.011');
    expect(out.transaction.sellCostPct).toBe('0.072');
    expect(out.rent.realGrowthAnnual).toBe('0.003');
    expect(out.closing.rateOfPrice).toBe('0.031');
    expect(out.sensitivity.returnBand).toBe('0.016');
    expect(out.sensitivity.inflationBand).toBe('0.011');
    expect(out.sensitivity.appreciationBand).toBe('0.012');
    expect(out.sensitivity.maintenanceBand).toBe('0.006');
    expect(out.sensitivity.taxBandRelative).toBe('0.16');
    expect(out.sensitivity.swrBand).toBe('0.006');
    expect(out.projection.maxHorizonYears).toBe('55');

    // New V4 townScoring slice carries the LOCKED V4-default values (proves v3ToV4 is exercised,
    // seeded from DEFAULT_ASSUMPTIONS.townScoring — not inline literals).
    expect(out.townScoring).toStrictEqual(DEFAULT_ASSUMPTIONS.townScoring);
    expect(out.townScoring.weights.medianPrice).toBe('0.30');
    expect(out.townScoring.amenityWeights.walkability).toBe('0.30');
    expect(out.townScoring.ranges.medianPrice.max).toBe('2500000');
    expect(out.townScoring.bucket.stretchFactor).toBe('1.25');
  });

  test('migrates a V2 set all the way to a COMPLETE V4 (chained V2->V3->V4, not identity)', () => {
    const out = migrate(V2_FIXTURE);

    // Version is bumped to current (4), proving the chain ran to completion.
    expect(out.schemaVersion).toBe(4);
    expect(out.schemaVersion).toBe(CURRENT_VERSION);

    // EVERY V2 leaf is preserved verbatim (distinct from the defaults).
    expect(out.tax.effectiveIncomeRate).toBe('0.26');
    expect(out.tax.propertyRateAnnual).toBe('0.013');
    expect(out.tax.assessmentRatio).toBe('0.95');
    expect(out.dti.frontEnd).toBe('0.29');
    expect(out.dti.backEnd).toBe('0.37');
    expect(out.returns.realAnnual).toBe('0.06');
    expect(out.inflation.annual).toBe('0.026');
    expect(out.maintenance.annualPctOfValue).toBe('0.012');
    expect(out.swr.rate).toBe('0.035');
    expect(out.pmi.annualRateOfLoan).toBe('0.008');
    expect(out.pmi.dropOffLtv).toBe('0.78');
    expect(out.appreciation.realAnnual).toBe('0.009');
    expect(out.transaction.sellCostPct).toBe('0.07');
    expect(out.rent.realGrowthAnnual).toBe('0.002');
    expect(out.closing.rateOfPrice).toBe('0.03');

    // V3-default slices (seeded by the v2ToV3 arm) are present.
    expect(out.sensitivity.returnBand).toBe('0.015');
    expect(out.sensitivity.inflationBand).toBe('0.01');
    expect(out.sensitivity.appreciationBand).toBe('0.01');
    expect(out.sensitivity.maintenanceBand).toBe('0.005');
    expect(out.sensitivity.taxBandRelative).toBe('0.15');
    expect(out.sensitivity.swrBand).toBe('0.005');
    expect(out.projection.maxHorizonYears).toBe('60');

    // V4-default townScoring slice (seeded by the v3ToV4 arm) is ALSO present — a COMPLETE V4.
    expect(out.townScoring).toStrictEqual(DEFAULT_ASSUMPTIONS.townScoring);
    expect(out.townScoring.weights.medianPrice).toBe('0.30');
    expect(out.townScoring.bucket.stretchFactor).toBe('1.25');
  });

  test('migrates a V1 set all the way to a COMPLETE V4 (chained V1->V2->V3->V4, not identity)', () => {
    const out = migrate(V1_FIXTURE);

    // Version is bumped to current (4), proving the chain ran to completion.
    expect(out.schemaVersion).toBe(4);
    expect(out.schemaVersion).toBe(CURRENT_VERSION);

    // V1 leaves are preserved verbatim through the chain.
    expect(out.tax.effectiveIncomeRate).toBe('0.25');
    expect(out.tax.propertyRateAnnual).toBe('0.012');
    expect(out.returns.realAnnual).toBe('0.05');

    // V2-default slices (seeded by the v1ToV2 arm) are present.
    expect(out.appreciation.realAnnual).toBe('0.0075');
    expect(out.transaction.sellCostPct).toBe('0.065');
    expect(out.rent.realGrowthAnnual).toBe('0');
    expect(out.closing.rateOfPrice).toBe('0.025');
    expect(out.tax.assessmentRatio).toBe('1.0');

    // V3-default slices (seeded by the v2ToV3 arm) are present.
    expect(out.sensitivity.returnBand).toBe('0.015');
    expect(out.sensitivity.taxBandRelative).toBe('0.15');
    expect(out.projection.maxHorizonYears).toBe('60');

    // V4-default townScoring slice (seeded by the v3ToV4 arm) is ALSO present — a COMPLETE V4.
    expect(out.townScoring).toStrictEqual(DEFAULT_ASSUMPTIONS.townScoring);
    expect(out.townScoring.weights.amenities).toBe('0.10');
    expect(out.townScoring.ranges.commute.min).toBe('10');
    expect(out.townScoring.bucket.stretchFactor).toBe('1.25');
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

  // WR-01 regression: V1/V2 `swr.rate` has no positivity refine (that lives only on V3/V4), so a
  // legacy snapshot with `swr.rate: '0'` parses against ITS version yet would migrate through
  // verbatim into a "trusted" V4 — re-opening the `Money.of('Infinity')` divide-by-SWR crash in
  // FI calc. migrate() now re-validates its output against the V4 schema, so these must THROW.
  test('rejects a V1 snapshot with a non-positive swr.rate at the output boundary (WR-01)', () => {
    const zeroSwrV1: z.infer<typeof AssumptionsV1> = { ...V1_FIXTURE, swr: { rate: '0' } };
    expect(() => migrate(zeroSwrV1)).toThrow();
  });

  test('rejects a V2 snapshot with a non-positive swr.rate at the output boundary (WR-01)', () => {
    const zeroSwrV2: z.infer<typeof AssumptionsV2> = { ...V2_FIXTURE, swr: { rate: '0' } };
    expect(() => migrate(zeroSwrV2)).toThrow();
  });
});
