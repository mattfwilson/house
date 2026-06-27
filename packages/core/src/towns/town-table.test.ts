// Town mill-rate table + resolver — runtime behavior (Vitest, types stripped).
//
// The table is the TCO-02 data half: a seeded, FY-stamped greater-Boston subset behind a
// Zod boundary. Assert (a) the table is meaningfully sized, (b) every row parses through
// townRowSchema (no float mill rate sneaks past — T-02-02), (c) the resolver returns the
// EXACT seeded { rate, fy } pair (snapshot self-containment — D-08 / Pitfall 11), and
// (d) the resolver throws on an unknown town (no silent default).
import { describe, test, expect } from 'vitest';
import { CANONICAL_DECIMAL_RE } from '../assumptions/schema.js';
import { townRowSchema } from './town-table.schema.js';
import { TOWN_RATE_TABLE, resolveMillRate } from './town-table.js';

describe('TOWN_RATE_TABLE — seeded greater-Boston mill rates (TCO-02 data half)', () => {
  test('has at least 20 curated towns', () => {
    expect(TOWN_RATE_TABLE.length).toBeGreaterThanOrEqual(20);
  });

  test('every row parses through townRowSchema (no float mill rate, no extra keys)', () => {
    for (const row of TOWN_RATE_TABLE) {
      expect(townRowSchema.safeParse(row).success).toBe(true);
    }
  });

  test('every residentialMillRate is a string (canonical decimal), never a JS number', () => {
    for (const row of TOWN_RATE_TABLE) {
      expect(typeof row.residentialMillRate).toBe('string');
      expect(Number.isInteger(row.fy)).toBe(true);
    }
  });
});

describe('TOWN_RATE_TABLE — stamped scoring metrics (D-02, canonical strings)', () => {
  // Every present stamp across every row: value is a canonical decimal STRING and asOf an int.
  test('every present stamped metric value is a string and asOf an integer (never a bare number)', () => {
    const assertStamp = (stamp: { value: unknown; asOf: unknown; source: unknown } | undefined) => {
      if (stamp === undefined) return; // absent = missing (D-03) — nothing to assert
      expect(typeof stamp.value).toBe('string');
      expect(CANONICAL_DECIMAL_RE.test(stamp.value as string)).toBe(true);
      expect(Number.isInteger(stamp.asOf)).toBe(true);
      expect(typeof stamp.source).toBe('string');
    };
    for (const row of TOWN_RATE_TABLE) {
      assertStamp(row.medianPrice);
      assertStamp(row.school);
      assertStamp(row.commute?.downtownBoston);
      assertStamp(row.commute?.kendallCambridge);
      assertStamp(row.commute?.route128Burlington);
      assertStamp(row.amenities?.walkability);
      assertStamp(row.amenities?.transit);
      assertStamp(row.amenities?.dining);
      assertStamp(row.amenities?.parks);
    }
  });
});

describe('TOWN_RATE_TABLE — honest missing data (D-03: absent, never imputed)', () => {
  test('Winchester omits medianPrice entirely (undefined, NOT 0/null)', () => {
    const winchester = TOWN_RATE_TABLE.find((r) => r.town === 'Winchester')!;
    expect(winchester).toBeDefined();
    expect(winchester.medianPrice).toBe(undefined);
    // It is genuinely absent — not zero-, empty-, or null-filled.
    expect('medianPrice' in winchester).toBe(false);
  });

  test('Weymouth omits the amenities.transit sub-metric (undefined, NOT 0/null)', () => {
    const weymouth = TOWN_RATE_TABLE.find((r) => r.town === 'Weymouth')!;
    expect(weymouth).toBeDefined();
    expect(weymouth.amenities).toBeDefined();
    expect(weymouth.amenities!.transit).toBe(undefined);
    // The sibling amenity sub-metrics ARE present, proving the gap is targeted, not wholesale.
    expect(weymouth.amenities!.walkability).toBeDefined();
  });
});

describe('TOWN_RATE_TABLE — curated MA flags (D-05: betterment/title5/40b, never prop25)', () => {
  test('every flags array parses and contains only betterment/title5/40b (no prop25)', () => {
    const allowed = new Set(['betterment', 'title5', '40b']);
    let sawNonEmpty = false;
    for (const row of TOWN_RATE_TABLE) {
      if (row.flags === undefined) continue;
      // Each flags array round-trips through the row schema (asserted in the parse loop above),
      // and here we pin the allowed enum membership explicitly.
      for (const flag of row.flags) {
        expect(allowed.has(flag)).toBe(true);
        expect(flag).not.toBe('prop25');
        sawNonEmpty = true;
      }
    }
    // At least one row carries a non-empty curated flags array (the contract is exercised).
    expect(sawNonEmpty).toBe(true);
  });
});

describe('townRowSchema — boundary rejects unknown keys (.strict()) and floats (decStr)', () => {
  // A valid baseline row reused by the rejection cases (deep-cloned per test).
  const baseRow = () => ({
    town: 'Testville',
    fy: 2024,
    residentialMillRate: '10.00',
    medianPrice: { value: '750000', asOf: 2025, source: 'hand-seeded estimate' },
  });

  test('rejects a row with an unknown extra key (.strict())', () => {
    const row = { ...baseRow(), bogusKey: 'nope' };
    expect(townRowSchema.safeParse(row).success).toBe(false);
  });

  test('rejects a stamped metric whose value is a bare float (decStr) — passed as a string', () => {
    // A non-canonical float-style string (trailing exponent) must fail decStr.
    const row = {
      ...baseRow(),
      medianPrice: { value: '7.5e5', asOf: 2025, source: 'hand-seeded estimate' },
    };
    expect(townRowSchema.safeParse(row).success).toBe(false);
  });

  test('rejects a stamped metric whose value is a bare JS number (decStr requires a string)', () => {
    const row = {
      ...baseRow(),
      // @ts-expect-error — deliberately wrong: a bare number must not satisfy decStr.
      medianPrice: { value: 750000, asOf: 2025, source: 'hand-seeded estimate' },
    };
    expect(townRowSchema.safeParse(row).success).toBe(false);
  });
});

describe('resolveMillRate — validate-and-throw resolver (D-08)', () => {
  test('returns the EXACT seeded { residentialMillRate, fy } pair for a seeded town', () => {
    // Pick a row directly from the table and assert string + int equality (NOT toBeCloseTo).
    const cambridge = TOWN_RATE_TABLE.find((r) => r.town === 'Cambridge');
    expect(cambridge).toBeDefined();
    const resolved = resolveMillRate('Cambridge');
    expect(resolved.residentialMillRate).toBe(cambridge!.residentialMillRate);
    expect(resolved.fy).toBe(cambridge!.fy);
  });

  test('resolves a second seeded town to its own distinct pair', () => {
    const boston = TOWN_RATE_TABLE.find((r) => r.town === 'Boston')!;
    const resolved = resolveMillRate('Boston');
    expect(resolved.residentialMillRate).toBe(boston.residentialMillRate);
    expect(resolved.fy).toBe(boston.fy);
  });

  test('throws on an unknown town (no silent default)', () => {
    expect(() => resolveMillRate('Nonexistent')).toThrow();
  });
});
