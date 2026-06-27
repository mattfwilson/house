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
  parseHousehold,
  ScenarioInputsSchema,
  HouseholdSchema,
  type ScenarioInputs,
  type Household,
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

/**
 * A well-formed household (the person-vs-house block, D-09): canonical decimal strings for
 * every dollar field, targetSavingsRate in [0,1), incl. currentAnnualSavings (D-17).
 */
const VALID_HOUSEHOLD: Household = {
  grossAnnualIncome: '200000',
  existingMonthlyDebt: '500',
  targetSavingsRate: '0.30',
  availableNetWorth: '350000',
  currentRent: '2800',
  downPaymentCash: '120000',
  reserve: '30000',
  currentAnnualSavings: '60000',
  targetAnnualRetirementSpend: '60000',
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
    expect(input.assumptions.schemaVersion).toBe(4);
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

  test('engineInput WITH a household freezes it and round-trips it (D-09)', () => {
    const input = engineInput({ ...baseParts(), household: VALID_HOUSEHOLD });
    expect(input.household).toStrictEqual(VALID_HOUSEHOLD);
    expect(Object.isFrozen(input.household)).toBe(true);
    expect(Object.isFrozen(input)).toBe(true);
  });

  test('engineInput WITHOUT a household yields household === undefined (optional, A3)', () => {
    const input = engineInput(baseParts());
    expect(input.household).toBeUndefined();
    expect(Object.isFrozen(input)).toBe(true);
  });

  test('a TCO-only engineInput omits the household key entirely (golden stays byte-identical)', () => {
    const input = engineInput(baseParts());
    expect(Object.prototype.hasOwnProperty.call(input, 'household')).toBe(false);
  });

  test('engineInput parses the household through the schema — a forged household throws', () => {
    const forged = { ...VALID_HOUSEHOLD, targetSavingsRate: '1.5' };
    expect(() =>
      engineInput({ ...baseParts(), household: forged as Household }),
    ).toThrow();
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

describe('parseHousehold — the household half of the affordability trust boundary (T-03-01..02)', () => {
  test('ACCEPTS a well-formed household and returns it (deep-equals the input)', () => {
    const parsed = parseHousehold(VALID_HOUSEHOLD);
    expect(parsed).toStrictEqual(VALID_HOUSEHOLD);
  });

  describe('targetSavingsRate is admitted only in [0,1)', () => {
    test("'0' is accepted (zero savings target)", () => {
      expect(
        parseHousehold({ ...VALID_HOUSEHOLD, targetSavingsRate: '0' }).targetSavingsRate,
      ).toBe('0');
    });
    test("'0.5' is accepted (mid value)", () => {
      expect(
        parseHousehold({ ...VALID_HOUSEHOLD, targetSavingsRate: '0.5' }).targetSavingsRate,
      ).toBe('0.5');
    });
    test("'0.99' is accepted", () => {
      expect(
        parseHousehold({ ...VALID_HOUSEHOLD, targetSavingsRate: '0.99' }).targetSavingsRate,
      ).toBe('0.99');
    });
    test("'1' is rejected (out of [0,1))", () => {
      expect(() => parseHousehold({ ...VALID_HOUSEHOLD, targetSavingsRate: '1' })).toThrow();
    });
    test("'1.5' is rejected (>= 1)", () => {
      expect(() => parseHousehold({ ...VALID_HOUSEHOLD, targetSavingsRate: '1.5' })).toThrow();
    });
    test("'-0.1' is rejected (negative)", () => {
      expect(() => parseHousehold({ ...VALID_HOUSEHOLD, targetSavingsRate: '-0.1' })).toThrow();
    });
  });

  describe('REJECTS non-canonical decimal strings in decStr fields', () => {
    test("thousands separator '100,000' in grossAnnualIncome throws", () => {
      expect(() => parseHousehold({ ...VALID_HOUSEHOLD, grossAnnualIncome: '100,000' })).toThrow();
    });
    test("exponent form '1e5' in availableNetWorth throws", () => {
      expect(() => parseHousehold({ ...VALID_HOUSEHOLD, availableNetWorth: '1e5' })).toThrow();
    });
    test("whitespace '  5 ' in reserve throws", () => {
      expect(() => parseHousehold({ ...VALID_HOUSEHOLD, reserve: '  5 ' })).toThrow();
    });
    test("'NaN' in currentAnnualSavings throws", () => {
      expect(() => parseHousehold({ ...VALID_HOUSEHOLD, currentAnnualSavings: 'NaN' })).toThrow();
    });
  });

  describe('REJECTS structurally-forged households (V5 / T-03-V5)', () => {
    test('an unknown extra key throws (.strict() — forged-snapshot control)', () => {
      expect(() => parseHousehold({ ...VALID_HOUSEHOLD, smuggledField: 'evil' })).toThrow();
    });
    test('a missing required field throws (omit currentAnnualSavings)', () => {
      const { currentAnnualSavings, ...missing } = VALID_HOUSEHOLD;
      void currentAnnualSavings;
      expect(() => parseHousehold(missing)).toThrow();
    });
  });

  test('HouseholdSchema is .strict() (rejects unknown keys directly)', () => {
    expect(HouseholdSchema.safeParse({ ...VALID_HOUSEHOLD, extra: 1 }).success).toBe(false);
  });

  describe('targetAnnualRetirementSpend is a required, canonical decStr leaf (D-01, FI-01/FI-02)', () => {
    test('a canonical value round-trips through parseHousehold', () => {
      const parsed = parseHousehold({ ...VALID_HOUSEHOLD, targetAnnualRetirementSpend: '60000' });
      expect(parsed.targetAnnualRetirementSpend).toBe('60000');
    });
    test("a thousands-separated value ('60,000') is rejected (decStr regex)", () => {
      expect(() =>
        parseHousehold({ ...VALID_HOUSEHOLD, targetAnnualRetirementSpend: '60,000' }),
      ).toThrow();
    });
    test('a bare JS number (60000) is rejected (decStr is string-only)', () => {
      expect(() =>
        parseHousehold({ ...VALID_HOUSEHOLD, targetAnnualRetirementSpend: 60000 as unknown as string }),
      ).toThrow();
    });
    test('a missing targetAnnualRetirementSpend throws (REQUIRED leaf — no honest default)', () => {
      const { targetAnnualRetirementSpend, ...missing } = VALID_HOUSEHOLD;
      void targetAnnualRetirementSpend;
      expect(() => parseHousehold(missing)).toThrow();
    });
  });
});
