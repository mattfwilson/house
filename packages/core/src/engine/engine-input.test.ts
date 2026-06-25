// EngineInput — the immutable snapshot-unit type (D-11) AND the ScenarioInputs trust
// boundary (CR-03 / T-07-*).
//
// Runtime behavior (Vitest, types stripped — the CalendarDate type constraint is proven
// separately in engine-input.type-test.ts, which is in the `tsc -b` graph). Here we assert
// that the factory freezes the object and that asOf is threaded explicitly, never derived
// from Date.now (the determinism guard would throw if it tried), AND that the scenario is
// Zod-validated at the boundary: a well-formed scenario parses to itself, every forged case
// (negative/zero/non-integer counts, downPaymentPct outside [0,1), non-canonical decimal
// strings, unknown extra keys) throws — mirroring the AssumptionSet discipline.
import { describe, test, expect } from 'vitest';
import { calendarDate } from '../time/calendar-date.js';
import { DEFAULT_ASSUMPTIONS } from '../assumptions/defaults.js';
import {
  engineInput,
  parseScenarioInputs,
  ScenarioInputsSchema,
  type ScenarioInputs,
} from './engine-input.js';

/**
 * A well-formed scenario (the FIXED_SCENARIO shape used by the golden harness): canonical
 * decimal strings for every dollar/rate field, positive-integer counts, a seeded town.
 */
const VALID_SCENARIO: ScenarioInputs = {
  label: 'boundary-valid: Newton $450k',
  price: '450000',
  downPaymentPct: '0.20',
  annualRate: '0.065',
  termMonths: 360,
  holdingYears: 10,
  town: 'Newton',
  insuranceAnnual: '2000',
  hoaMonthly: '0',
  monthlyRent: '2800',
};

const baseParts = () => ({
  asOf: calendarDate('2026-06-23'),
  assumptions: DEFAULT_ASSUMPTIONS,
  scenario: VALID_SCENARIO,
});

describe('engineInput factory — the immutable snapshot unit (D-11)', () => {
  test('assembles an object with asOf + assumptions + scenario', () => {
    const input = engineInput(baseParts());
    expect(input.asOf).toBe('2026-06-23');
    expect(input.assumptions.schemaVersion).toBe(2);
    expect(input.scenario.label).toBe('boundary-valid: Newton $450k');
  });

  test('returns a frozen object (immutable)', () => {
    const input = engineInput(baseParts());
    expect(Object.isFrozen(input)).toBe(true);
    expect(Object.isFrozen(input.scenario)).toBe(true);
  });

  test('mutation attempts do not change the object', () => {
    const input = engineInput(baseParts());
    expect(() => {
      // @ts-expect-error -- readonly at compile time; this proves frozen at runtime too.
      input.asOf = calendarDate('2030-01-01');
    }).toThrow();
    expect(input.asOf).toBe('2026-06-23');
  });

  test('asOf is threaded explicitly — never derived from Date.now', () => {
    // The determinism guard makes Date.now throw inside core tests; engineInput must not
    // call it. We assert the asOf is exactly the value we passed in (no clock involved).
    const input = engineInput({ ...baseParts(), asOf: calendarDate('1999-12-31') });
    expect(input.asOf).toBe('1999-12-31');
  });

  test('the assembled object deep-equals its own re-serialization shape (snapshot unit)', () => {
    const input = engineInput(baseParts());
    const roundTripped = JSON.parse(JSON.stringify(input));
    expect(roundTripped).toStrictEqual({
      asOf: '2026-06-23',
      assumptions: DEFAULT_ASSUMPTIONS,
      scenario: VALID_SCENARIO,
    });
  });

  test('engineInput parses the scenario through the schema — a forged scenario throws', () => {
    const forged = { ...VALID_SCENARIO, holdingYears: -1 };
    expect(() => engineInput({ ...baseParts(), scenario: forged as ScenarioInputs })).toThrow();
  });
});

describe('parseScenarioInputs — the scenario half of the snapshot trust boundary (CR-03)', () => {
  test('ACCEPTS a well-formed scenario and returns it (deep-equals the input)', () => {
    const parsed = parseScenarioInputs(VALID_SCENARIO);
    expect(parsed).toStrictEqual(VALID_SCENARIO);
  });

  test('ACCEPTS the optional one-time cost fields when present', () => {
    const withOptionals: ScenarioInputs = {
      ...VALID_SCENARIO,
      closingCostsOverride: '15000',
      otherOneTimeCosts: '5000',
    };
    expect(parseScenarioInputs(withOptionals)).toStrictEqual(withOptionals);
  });

  describe('REJECTS forged counts (termMonths / holdingYears must be positive integers)', () => {
    test('negative holdingYears throws', () => {
      expect(() => parseScenarioInputs({ ...VALID_SCENARIO, holdingYears: -1 })).toThrow();
    });
    test('zero holdingYears throws', () => {
      expect(() => parseScenarioInputs({ ...VALID_SCENARIO, holdingYears: 0 })).toThrow();
    });
    test('non-integer holdingYears throws', () => {
      expect(() => parseScenarioInputs({ ...VALID_SCENARIO, holdingYears: 10.5 })).toThrow();
    });
    test('zero termMonths throws', () => {
      expect(() => parseScenarioInputs({ ...VALID_SCENARIO, termMonths: 0 })).toThrow();
    });
    test('negative termMonths throws', () => {
      expect(() => parseScenarioInputs({ ...VALID_SCENARIO, termMonths: -360 })).toThrow();
    });
    test('non-integer termMonths throws', () => {
      expect(() => parseScenarioInputs({ ...VALID_SCENARIO, termMonths: 360.5 })).toThrow();
    });
  });

  describe('downPaymentPct is admitted only in [0,1)', () => {
    test("'0' is accepted (zero down)", () => {
      expect(parseScenarioInputs({ ...VALID_SCENARIO, downPaymentPct: '0' }).downPaymentPct).toBe('0');
    });
    test("'0.99' is accepted", () => {
      expect(parseScenarioInputs({ ...VALID_SCENARIO, downPaymentPct: '0.99' }).downPaymentPct).toBe('0.99');
    });
    test("'1' is rejected (would zero the loan)", () => {
      expect(() => parseScenarioInputs({ ...VALID_SCENARIO, downPaymentPct: '1' })).toThrow();
    });
    test("'1.5' is rejected (would produce a negative loan)", () => {
      expect(() => parseScenarioInputs({ ...VALID_SCENARIO, downPaymentPct: '1.5' })).toThrow();
    });
    test("'-0.1' is rejected (negative down payment)", () => {
      expect(() => parseScenarioInputs({ ...VALID_SCENARIO, downPaymentPct: '-0.1' })).toThrow();
    });
  });

  describe('REJECTS non-canonical decimal strings in decStr fields', () => {
    test("thousands separator '1,000' in price throws", () => {
      expect(() => parseScenarioInputs({ ...VALID_SCENARIO, price: '1,000' })).toThrow();
    });
    test("exponent form '1e6' in price throws", () => {
      expect(() => parseScenarioInputs({ ...VALID_SCENARIO, price: '1e6' })).toThrow();
    });
    test("double-dot '0.06.5' in annualRate throws", () => {
      expect(() => parseScenarioInputs({ ...VALID_SCENARIO, annualRate: '0.06.5' })).toThrow();
    });
    test('a non-canonical insuranceAnnual throws', () => {
      expect(() => parseScenarioInputs({ ...VALID_SCENARIO, insuranceAnnual: 'NaN' })).toThrow();
    });
    test('a non-canonical optional closingCostsOverride throws when present', () => {
      expect(() => parseScenarioInputs({ ...VALID_SCENARIO, closingCostsOverride: '1,000' })).toThrow();
    });
  });

  describe('REJECTS structurally-forged scenarios', () => {
    test('an unknown extra key throws (.strict())', () => {
      expect(() =>
        parseScenarioInputs({ ...VALID_SCENARIO, smuggledField: 'evil' }),
      ).toThrow();
    });
    test('an empty label throws (.min(1))', () => {
      expect(() => parseScenarioInputs({ ...VALID_SCENARIO, label: '' })).toThrow();
    });
    test('an empty town throws (.min(1))', () => {
      expect(() => parseScenarioInputs({ ...VALID_SCENARIO, town: '' })).toThrow();
    });
    test('a missing required field throws', () => {
      const { price, ...missing } = VALID_SCENARIO;
      void price;
      expect(() => parseScenarioInputs(missing)).toThrow();
    });
  });

  test('ScenarioInputsSchema is .strict() (rejects unknown keys directly)', () => {
    expect(ScenarioInputsSchema.safeParse({ ...VALID_SCENARIO, extra: 1 }).success).toBe(false);
  });
});
