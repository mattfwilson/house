// AssumptionSet Zod schema: versioned discriminated union, decimal-string boundary (D-04/D-05/D-06).
//
// Runtime behavior (Vitest, types stripped). The schema is the TRUST BOUNDARY: a corrupt
// or forged snapshot must be rejected by safeParse before any calc reads it (T-03-01/02/03).
import { describe, test, expect } from 'vitest';
import { AssumptionSetSchema, CURRENT_VERSION, decStr } from './schema.js';
import { DEFAULT_ASSUMPTIONS } from './defaults.js';

describe('decStr — the decimal-string validator (D-06, T-03-02)', () => {
  test('accepts canonical decimal strings', () => {
    expect(decStr.safeParse('0.035').success).toBe(true);
    expect(decStr.safeParse('-0.01').success).toBe(true);
    expect(decStr.safeParse('1').success).toBe(true);
    expect(decStr.safeParse('100.5').success).toBe(true);
  });

  test('rejects a JS number (float entering the boundary defeats D-06)', () => {
    // A float value must NOT cross — only canonical decimal STRINGS.
    expect(decStr.safeParse(0.035).success).toBe(false);
    expect(decStr.safeParse(1).success).toBe(false);
  });

  test('rejects non-canonical / junk strings', () => {
    expect(decStr.safeParse('').success).toBe(false);
    expect(decStr.safeParse('abc').success).toBe(false);
    expect(decStr.safeParse('0.0.1').success).toBe(false);
    expect(decStr.safeParse('1,000').success).toBe(false);
    expect(decStr.safeParse('1e3').success).toBe(false); // no exponent form — non-canonical
  });
});

describe('AssumptionSetSchema — discriminated union on schemaVersion (D-05)', () => {
  test('CURRENT_VERSION is the integer 3', () => {
    expect(CURRENT_VERSION).toBe(3);
  });

  test('DEFAULT_ASSUMPTIONS parses cleanly against the current schema', () => {
    const r = AssumptionSetSchema.safeParse(DEFAULT_ASSUMPTIONS);
    expect(r.success).toBe(true);
  });

  test('a V3 object (new sensitivity + projection slices present) parses against the union', () => {
    // DEFAULT_ASSUMPTIONS is V3-shaped; assert the carried-over TCO slices AND the new
    // Phase-4 sensitivity + projection slices are present and accepted.
    const r = AssumptionSetSchema.safeParse(DEFAULT_ASSUMPTIONS);
    expect(r.success).toBe(true);
    expect(DEFAULT_ASSUMPTIONS.schemaVersion).toBe(3);
    expect(DEFAULT_ASSUMPTIONS.appreciation.realAnnual).toBe('0.0075');
    expect(DEFAULT_ASSUMPTIONS.transaction.sellCostPct).toBe('0.065');
    expect(DEFAULT_ASSUMPTIONS.rent.realGrowthAnnual).toBe('0');
    expect(DEFAULT_ASSUMPTIONS.closing.rateOfPrice).toBe('0.025');
    expect(DEFAULT_ASSUMPTIONS.tax.assessmentRatio).toBe('1.0');
    // The six tornado sensitivity bands (D-12) + the max-horizon projection cap (D-07).
    expect(DEFAULT_ASSUMPTIONS.sensitivity.returnBand).toBe('0.015');
    expect(DEFAULT_ASSUMPTIONS.sensitivity.taxBandRelative).toBe('0.15');
    expect(DEFAULT_ASSUMPTIONS.sensitivity.swrBand).toBe('0.005');
    expect(DEFAULT_ASSUMPTIONS.projection.maxHorizonYears).toBe('60');
  });

  test('rejects a float on a new V2 tunable (appreciation.realAnnual as a number) — T-02-01', () => {
    const bad = {
      ...DEFAULT_ASSUMPTIONS,
      appreciation: { realAnnual: 0.0075 }, // a NUMBER, not a decimal string
    };
    expect(AssumptionSetSchema.safeParse(bad).success).toBe(false);
  });

  test('rejects an unknown schemaVersion (e.g. 99) — T-03-01', () => {
    const forged = { ...DEFAULT_ASSUMPTIONS, schemaVersion: 99 };
    expect(AssumptionSetSchema.safeParse(forged).success).toBe(false);
  });

  test('rejects a float assumption value (returns.realAnnual as a number) — T-03-02', () => {
    const bad = {
      ...DEFAULT_ASSUMPTIONS,
      returns: { realAnnual: 0.035 }, // a NUMBER, not a decimal string
    };
    expect(AssumptionSetSchema.safeParse(bad).success).toBe(false);
  });

  test('rejects a missing group (no swr)', () => {
    const { swr: _omitted, ...withoutSwr } = DEFAULT_ASSUMPTIONS;
    void _omitted;
    expect(AssumptionSetSchema.safeParse(withoutSwr).success).toBe(false);
  });

  test('a V3 set WITHOUT tax.millRateOverride still parses (the leaf is optional)', () => {
    // The override is absent from DEFAULT_ASSUMPTIONS; the optional leaf must not be required.
    const r = AssumptionSetSchema.safeParse(DEFAULT_ASSUMPTIONS);
    expect(r.success).toBe(true);
    expect('millRateOverride' in DEFAULT_ASSUMPTIONS.tax).toBe(false);
  });

  test('a V3 set WITH a canonical tax.millRateOverride parses and round-trips the value', () => {
    const withOverride = {
      ...DEFAULT_ASSUMPTIONS,
      tax: { ...DEFAULT_ASSUMPTIONS.tax, millRateOverride: '13.50' },
    };
    const r = AssumptionSetSchema.safeParse(withOverride);
    expect(r.success).toBe(true);
    if (r.success && r.data.schemaVersion === 3) {
      expect(r.data.tax.millRateOverride).toBe('13.50');
    }
  });

  test('rejects a non-canonical tax.millRateOverride (decStr guard holds)', () => {
    for (const bad of ['13,5', 'Infinity', '1e3', 'abc']) {
      const r = AssumptionSetSchema.safeParse({
        ...DEFAULT_ASSUMPTIONS,
        tax: { ...DEFAULT_ASSUMPTIONS.tax, millRateOverride: bad },
      });
      expect(r.success).toBe(false);
    }
  });

  test('the strict tax group still rejects an unknown tax key (override did not loosen .strict())', () => {
    const r = AssumptionSetSchema.safeParse({
      ...DEFAULT_ASSUMPTIONS,
      tax: { ...DEFAULT_ASSUMPTIONS.tax, bogusTaxKey: '1.0' },
    });
    expect(r.success).toBe(false);
  });

  test('rejects a zero swr.rate at the boundary (CR-01 — the FI number is spend / swr.rate)', () => {
    const r = AssumptionSetSchema.safeParse({
      ...DEFAULT_ASSUMPTIONS,
      swr: { rate: '0' },
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(JSON.stringify(r.error.issues)).toMatch(/swr\.rate/);
    }
  });

  test('rejects a negative swr.rate at the boundary (CR-01 — no negative FI target)', () => {
    const r = AssumptionSetSchema.safeParse({
      ...DEFAULT_ASSUMPTIONS,
      swr: { rate: '-0.001' },
    });
    expect(r.success).toBe(false);
  });

  test('accepts a positive swr.rate (default 0.033 and a tiny positive both parse)', () => {
    expect(AssumptionSetSchema.safeParse(DEFAULT_ASSUMPTIONS).success).toBe(true);
    expect(
      AssumptionSetSchema.safeParse({ ...DEFAULT_ASSUMPTIONS, swr: { rate: '0.0001' } }).success,
    ).toBe(true);
  });

  test('a canonical-decimal-string value round-trips without becoming a binary float', () => {
    const parsed = AssumptionSetSchema.parse(DEFAULT_ASSUMPTIONS);
    const json = JSON.stringify(parsed);
    // No float artifact like 0.035000000000000003 ever appears in the serialized form.
    expect(json).not.toMatch(/000000000\d/);
    const reparsed = AssumptionSetSchema.parse(JSON.parse(json));
    expect(reparsed).toStrictEqual(parsed);
  });
});
