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
  test('CURRENT_VERSION is the integer 1', () => {
    expect(CURRENT_VERSION).toBe(1);
  });

  test('DEFAULT_ASSUMPTIONS parses cleanly against the current schema', () => {
    const r = AssumptionSetSchema.safeParse(DEFAULT_ASSUMPTIONS);
    expect(r.success).toBe(true);
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

  test('a canonical-decimal-string value round-trips without becoming a binary float', () => {
    const parsed = AssumptionSetSchema.parse(DEFAULT_ASSUMPTIONS);
    const json = JSON.stringify(parsed);
    // No float artifact like 0.035000000000000003 ever appears in the serialized form.
    expect(json).not.toMatch(/000000000\d/);
    const reparsed = AssumptionSetSchema.parse(JSON.parse(json));
    expect(reparsed).toStrictEqual(parsed);
  });
});
