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
    expect(DEFAULT_ASSUMPTIONS.schemaVersion).toBe(1);
  });

  test('has every namespaced group (D-04)', () => {
    for (const k of ['tax', 'dti', 'returns', 'inflation', 'maintenance', 'swr', 'pmi'] as const) {
      expect(DEFAULT_ASSUMPTIONS[k]).toBeDefined();
    }
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
    expect(parsed.schemaVersion).toBe(1);
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
});
