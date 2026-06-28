// profile-form.test.ts — the two load-bearing behaviors of the pure profile-form mappers (D-16):
//   1. formToRawProfile maps every numeric leaf + the name to a canonical decimal STRING — no
//      bare-number money ever crosses to the action (T-7-04).
//   2. fieldErrorsFromZod keys a REAL core parse failure (parseProfile / parseHousehold) to the
//      offending leaf, so the editor surfaces field errors WITHOUT holding its own schema (T-7-01).
// Both run against the real `parseProfile` core boundary — the mappers never duplicate a rule.
import { describe, it, expect } from 'vitest';
import { parseProfile } from '@house/core';
import { HOUSEHOLD_FIELDS, formToRawProfile, fieldErrorsFromZod } from './profile-form';

/** A complete, valid set of the nine Household leaves expressed as bare JS numbers (the worst case). */
const VALID_VALUES = {
  grossAnnualIncome: 120000,
  existingMonthlyDebt: 0,
  targetSavingsRate: 0.4,
  availableNetWorth: 50000,
  currentRent: 2500,
  downPaymentCash: 100000,
  reserve: 20000,
  currentAnnualSavings: 40000,
  targetAnnualRetirementSpend: 80000,
} as const;

describe('formToRawProfile', () => {
  it('maps every numeric leaf + the name to a canonical decimal string (no bare-number money)', () => {
    const raw = formToRawProfile(VALID_VALUES, 'Matt & Wife', 'p1');

    // Every Household leaf AND the name are strings — not a single JS number crosses the edge.
    expect(typeof raw.name).toBe('string');
    for (const { key } of HOUSEHOLD_FIELDS) {
      expect(typeof raw[key]).toBe('string');
    }
    // A numeric `120000` becomes the canonical decimal string "120000"; `0.4` becomes "0.4".
    expect(raw.grossAnnualIncome).toBe('120000');
    expect(raw.targetSavingsRate).toBe('0.4');

    // And the result round-trips through the REAL core boundary (decimal-string contract intact).
    const profile = parseProfile(raw);
    expect(profile.id).toBe('p1');
    expect(profile.name).toBe('Matt & Wife');
    expect(profile.grossAnnualIncome).toBe('120000');
  });
});

describe('fieldErrorsFromZod', () => {
  it('keys a core parseProfile error to the offending leaf (out-of-range + missing)', () => {
    // targetSavingsRate 1.5 is a canonical decimal string but fails the [0,1) refine in the core.
    const badRate = formToRawProfile({ ...VALID_VALUES, targetSavingsRate: 1.5 }, 'X', 'p1');
    let threwRate = false;
    try {
      parseProfile(badRate);
    } catch (err) {
      threwRate = true;
      expect(fieldErrorsFromZod(err).targetSavingsRate).toBeDefined();
    }
    expect(threwRate).toBe(true);

    // A missing required leaf is keyed to that leaf.
    const { grossAnnualIncome: _omitted, ...rawMissing } = formToRawProfile(VALID_VALUES, 'X', 'p1');
    let threwMissing = false;
    try {
      parseProfile(rawMissing);
    } catch (err) {
      threwMissing = true;
      expect(fieldErrorsFromZod(err).grossAnnualIncome).toBeDefined();
    }
    expect(threwMissing).toBe(true);
  });

  it('returns an empty error map when there is no error (valid input)', () => {
    const raw = formToRawProfile(VALID_VALUES, 'X', 'p1');
    expect(() => parseProfile(raw)).not.toThrow();
    expect(fieldErrorsFromZod(undefined)).toEqual({});
  });
});
