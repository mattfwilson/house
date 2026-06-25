// Town mill-rate table + resolver — runtime behavior (Vitest, types stripped).
//
// The table is the TCO-02 data half: a seeded, FY-stamped greater-Boston subset behind a
// Zod boundary. Assert (a) the table is meaningfully sized, (b) every row parses through
// townRowSchema (no float mill rate sneaks past — T-02-02), (c) the resolver returns the
// EXACT seeded { rate, fy } pair (snapshot self-containment — D-08 / Pitfall 11), and
// (d) the resolver throws on an unknown town (no silent default).
import { describe, test, expect } from 'vitest';
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
