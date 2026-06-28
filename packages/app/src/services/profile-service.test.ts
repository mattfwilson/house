// profile-service.test.ts — proves the ≤2 soft cap is a REAL service-layer invariant (D-10 /
// T-06-16), driven through the `InMemoryProfileRepository` fake (adapter-agnostic: the guard lives
// in the service, not in SQLite). Selected by `-t profile`.
//
// The headline assertions:
//   - profiles #1 and #2 save successfully;
//   - a THIRD distinct profile throws (the cap);
//   - re-saving an EXISTING id (an edit) does NOT trip the cap even at the limit (count unchanged).
import { describe, expect, it } from 'vitest';
import type { Household, Profile } from '@house/core';
import { InMemoryProfileRepository } from '../adapters/persistence/in-memory-repos.js';
import { MAX_PROFILES, listProfiles, saveProfile } from './profile-service.js';

/** A valid nine-leaf household (canonical decimal strings) — the affordability-engine input shape. */
function household(): Household {
  return {
    grossAnnualIncome: '200000',
    existingMonthlyDebt: '400',
    targetSavingsRate: '0.20',
    availableNetWorth: '600000',
    currentRent: '2800',
    downPaymentCash: '90000',
    reserve: '30000',
    currentAnnualSavings: '48000',
    targetAnnualRetirementSpend: '60000',
  };
}

function makeProfile(id: string, name = id): Profile {
  return { id, name, ...household() };
}

describe('profile-service ≤2 guard (D-10 / PROF-02)', () => {
  it('saves profile #1 and #2 successfully', () => {
    const repo = new InMemoryProfileRepository();
    saveProfile(repo, makeProfile('prof-1'));
    saveProfile(repo, makeProfile('prof-2'));
    expect(repo.count()).toBe(2);
    expect(listProfiles(repo).map((p) => p.id).sort()).toEqual(['prof-1', 'prof-2']);
  });

  it('throws when a THIRD distinct profile is saved (the cap is a real invariant)', () => {
    const repo = new InMemoryProfileRepository();
    saveProfile(repo, makeProfile('prof-1'));
    saveProfile(repo, makeProfile('prof-2'));
    expect(() => saveProfile(repo, makeProfile('prof-3'))).toThrow(/cap/i);
    // The rejected profile was NOT persisted.
    expect(repo.count()).toBe(MAX_PROFILES);
    expect(repo.load('prof-3')).toBeNull();
  });

  it('does NOT trip the cap when EDITING an existing id at the limit (count unchanged)', () => {
    const repo = new InMemoryProfileRepository();
    saveProfile(repo, makeProfile('prof-1', 'Original'));
    saveProfile(repo, makeProfile('prof-2'));
    // Re-save prof-1 with an edited name — an EDIT, not a new profile.
    expect(() => saveProfile(repo, makeProfile('prof-1', 'Edited'))).not.toThrow();
    expect(repo.count()).toBe(2);
    expect(repo.load('prof-1')?.name).toBe('Edited');
  });
});
