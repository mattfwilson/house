// AssumptionSet parse/serialize helpers + DEFAULT_ASSUMPTIONS shape (D-04, D-07).
//
// Helpers wrap the Zod boundary: parseAssumptionSet rejects malformed snapshots (never
// trusts raw JSON — T-03-03), serializeAssumptionSet emits canonical decimal-string JSON.
import { describe, test, expect } from 'vitest';
import { Dec } from '../money/decimal-config.js';
import {
  parseAssumptionSet,
  serializeAssumptionSet,
} from './assumption-set.js';
import { DEFAULT_ASSUMPTIONS } from './defaults.js';

describe('DEFAULT_ASSUMPTIONS — versioned pure seed data (D-07)', () => {
  test('declares the current schemaVersion', () => {
    expect(DEFAULT_ASSUMPTIONS.schemaVersion).toBe(4);
  });

  test('has every namespaced group (D-04), including the V2 TCO + V3 FI/sensitivity + V4 townScoring slices', () => {
    for (const k of [
      'tax', 'dti', 'returns', 'inflation', 'maintenance', 'swr', 'pmi',
      'appreciation', 'transaction', 'rent', 'closing',
      'sensitivity', 'projection',
      'townScoring',
    ] as const) {
      expect(DEFAULT_ASSUMPTIONS[k]).toBeDefined();
    }
  });

  test('the V4 townScoring slice carries every sub-group as decimal strings (TOWN-01/TOWN-02)', () => {
    const ts = DEFAULT_ASSUMPTIONS.townScoring;
    for (const k of ['weights', 'amenityWeights', 'ranges', 'bucket'] as const) {
      expect(ts[k]).toBeDefined();
    }
    // Spot-check leaves are decimal STRINGS, never JS numbers.
    expect(typeof ts.weights.medianPrice).toBe('string');
    expect(typeof ts.amenityWeights.walkability).toBe('string');
    expect(typeof ts.ranges.medianPrice.min).toBe('string');
    expect(typeof ts.ranges.medianPrice.max).toBe('string');
    expect(typeof ts.bucket.stretchFactor).toBe('string');
  });

  test('swr.rate is a long-horizon default (< 0.04, ~0.033 — locked SWR decision)', () => {
    expect(new Dec(DEFAULT_ASSUMPTIONS.swr.rate).lt(new Dec('0.04'))).toBe(true);
  });

  test('every numeric tunable is a decimal STRING, never a JS number', () => {
    // Spot-check the leaf rate fields across groups.
    expect(typeof DEFAULT_ASSUMPTIONS.returns.realAnnual).toBe('string');
    expect(typeof DEFAULT_ASSUMPTIONS.inflation.annual).toBe('string');
    expect(typeof DEFAULT_ASSUMPTIONS.maintenance.annualPctOfValue).toBe('string');
    expect(typeof DEFAULT_ASSUMPTIONS.swr.rate).toBe('string');
    expect(typeof DEFAULT_ASSUMPTIONS.dti.frontEnd).toBe('string');
    expect(typeof DEFAULT_ASSUMPTIONS.dti.backEnd).toBe('string');
  });

  test('decimal-string values parse to Dec cleanly', () => {
    // A downstream module reads its slice as a string and lifts it to Dec.
    const swr = new Dec(DEFAULT_ASSUMPTIONS.swr.rate);
    expect(swr.gt(0)).toBe(true);
  });
});

describe('parseAssumptionSet / serializeAssumptionSet (boundary helpers)', () => {
  test('parseAssumptionSet returns the validated set for good data', () => {
    const parsed = parseAssumptionSet(DEFAULT_ASSUMPTIONS);
    expect(parsed.schemaVersion).toBe(4);
  });

  test('parseAssumptionSet throws on malformed data (never trusts raw JSON — T-03-03)', () => {
    expect(() => parseAssumptionSet({ schemaVersion: 1 })).toThrow();
    expect(() => parseAssumptionSet({ schemaVersion: 99 })).toThrow();
    expect(() => parseAssumptionSet({})).toThrow();
  });

  test('serialize -> parse is a clean round-trip (canonical JSON)', () => {
    const json = serializeAssumptionSet(DEFAULT_ASSUMPTIONS);
    expect(typeof json).toBe('string');
    const back = parseAssumptionSet(JSON.parse(json));
    expect(back).toStrictEqual(DEFAULT_ASSUMPTIONS);
  });

  test('serialized JSON contains decimal strings, not floats', () => {
    const json = serializeAssumptionSet(DEFAULT_ASSUMPTIONS);
    // The SWR rate is present as a quoted string, not a bare number.
    expect(json).toContain(`"rate":"${DEFAULT_ASSUMPTIONS.swr.rate}"`);
  });

  test('serialization is truly canonical: insertion order does not change the bytes (WR-01)', () => {
    // Build a semantically-identical set whose top-level keys are in a DIFFERENT insertion
    // order (as a spread/merge would produce). Raw JSON.stringify would emit different bytes;
    // the canonical serializer sorts keys recursively, so the output must be byte-identical.
    const reordered = Object.fromEntries(
      Object.keys(DEFAULT_ASSUMPTIONS)
        .reverse()
        .map((k) => [k, (DEFAULT_ASSUMPTIONS as Record<string, unknown>)[k]]),
    ) as typeof DEFAULT_ASSUMPTIONS;

    expect(serializeAssumptionSet(reordered)).toBe(serializeAssumptionSet(DEFAULT_ASSUMPTIONS));
  });
});
