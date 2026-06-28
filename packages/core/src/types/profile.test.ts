// Profile — the persisted person-vs-house contract (PROF-01/PROF-02/PROF-03): the durable
// `{ id, name } & Household` row Phase 6 saves and reloads.
//
// Runtime behavior (Vitest, types stripped — the no-bare-number money guarantee is proven
// separately in persistence.type-test.ts, which is in the `tsc -b` graph). Here we assert the
// profile reuses the existing nine-leaf Household validators VERBATIM: a forged profile (extra
// key, float money, out-of-range savings rate, a missing leaf) throws, and a well-formed
// profile carrying all nine Household leaves round-trips to itself (parse is identity on values).
import { describe, test, expect } from 'vitest';
import { parseProfile, ProfileSchema, type Profile } from './profile.js';

/**
 * A well-formed profile: a valid id/name plus ALL NINE Household leaves (canonical decimal
 * strings, targetSavingsRate in [0,1)). PROF-01 "net worth" IS `availableNetWorth` — there is
 * NO separate `netWorth` leaf.
 */
const VALID_PROFILE: Profile = {
  id: 'profile-1',
  name: 'Matt & Wife',
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

describe('parseProfile — the persisted profile trust boundary (PROF-01..03, T-06-01)', () => {
  test('ACCEPTS a well-formed nine-leaf profile and returns it (deep-equals the input)', () => {
    const parsed = parseProfile(VALID_PROFILE);
    expect(parsed).toStrictEqual(VALID_PROFILE);
  });

  test('round-trips a profile carrying ALL NINE Household leaves (parse is identity on values)', () => {
    const parsed = parseProfile(VALID_PROFILE);
    // Every nine Household leaves survive verbatim.
    expect(parsed.grossAnnualIncome).toBe('200000');
    expect(parsed.existingMonthlyDebt).toBe('500');
    expect(parsed.targetSavingsRate).toBe('0.30');
    expect(parsed.availableNetWorth).toBe('350000');
    expect(parsed.currentRent).toBe('2800');
    expect(parsed.downPaymentCash).toBe('120000');
    expect(parsed.reserve).toBe('30000');
    expect(parsed.currentAnnualSavings).toBe('60000');
    expect(parsed.targetAnnualRetirementSpend).toBe('60000');
    // ...and the identity columns.
    expect(parsed.id).toBe('profile-1');
    expect(parsed.name).toBe('Matt & Wife');
  });

  test('REJECTS a non-canonical money string (thousands separator) — reuses decStr', () => {
    expect(() => parseProfile({ ...VALID_PROFILE, availableNetWorth: '100,000' })).toThrow();
  });

  test('REJECTS a bare JS number where a money leaf is expected (decStr is string-only)', () => {
    expect(() =>
      parseProfile({ ...VALID_PROFILE, availableNetWorth: 350000 as unknown as string }),
    ).toThrow();
  });

  describe('targetSavingsRate is admitted only in [0,1) (reuses the Household refine)', () => {
    test("'0' is accepted", () => {
      expect(parseProfile({ ...VALID_PROFILE, targetSavingsRate: '0' }).targetSavingsRate).toBe('0');
    });
    test("'1' is rejected (out of [0,1))", () => {
      expect(() => parseProfile({ ...VALID_PROFILE, targetSavingsRate: '1' })).toThrow();
    });
    test("'-0.1' is rejected (negative)", () => {
      expect(() => parseProfile({ ...VALID_PROFILE, targetSavingsRate: '-0.1' })).toThrow();
    });
  });

  test('REJECTS an unknown extra key (.strict() — a forged profile cannot smuggle fields)', () => {
    expect(() => parseProfile({ ...VALID_PROFILE, smuggledField: 'evil' })).toThrow();
  });

  test('ProfileSchema is .strict() (rejects unknown keys directly)', () => {
    expect(ProfileSchema.safeParse({ ...VALID_PROFILE, extra: 1 }).success).toBe(false);
  });

  describe('REJECTS a profile MISSING any of the nine Household leaves', () => {
    test('omitting targetAnnualRetirementSpend throws (required leaf, no honest default)', () => {
      const { targetAnnualRetirementSpend, ...missing } = VALID_PROFILE;
      void targetAnnualRetirementSpend;
      expect(() => parseProfile(missing)).toThrow();
    });
    test('omitting availableNetWorth throws (PROF-01 net worth is a required leaf)', () => {
      const { availableNetWorth, ...missing } = VALID_PROFILE;
      void availableNetWorth;
      expect(() => parseProfile(missing)).toThrow();
    });
  });

  describe('REJECTS a profile missing its identity columns', () => {
    test('an empty id throws (.min(1))', () => {
      expect(() => parseProfile({ ...VALID_PROFILE, id: '' })).toThrow();
    });
    test('an empty name throws (.min(1))', () => {
      expect(() => parseProfile({ ...VALID_PROFILE, name: '' })).toThrow();
    });
  });
});
