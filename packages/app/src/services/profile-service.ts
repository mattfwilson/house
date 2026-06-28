// profile-service — the imperative shell for the profile lifecycle (PROF-01/PROF-02). It depends
// ONLY on the `ProfileRepository` PORT (`import type` from @house/core), never on a concrete
// adapter (D-03, mechanized by the eslint app boundary in this plan). The container is the single
// place that names the concrete SQLite profile adapter; everything here is adapter-agnostic.
//
// The ≤2 soft cap (D-10) is a REAL service-layer invariant, not a UI convention: this two-user
// tool persists exactly two household profiles. `saveProfile` counts existing rows via the port's
// `count()` and throws when a THIRD distinct profile would be created — but an EDIT of an existing
// id (the same profile re-saved) never trips it (the count is unchanged). The guard is proven by
// profile-service.test.ts (T-06-16).
//
// Timestamps: `Profile` carries no timestamps (those are SQLite persistence metadata stamped by
// the adapter's injected clock — the 06-05 hand-off), so the profile shell needs no `now` param
// and never reads a wall clock (the determinism discipline holds here too — T-06-18). The clock
// lives in the adapter the container constructs.
import type { Profile, ProfileRepository } from '@house/core';

/** The maximum number of distinct household profiles this two-user tool persists (D-10 / PROF-02). */
export const MAX_PROFILES = 2;

/**
 * Persist a profile, enforcing the ≤2 soft cap as a service-layer invariant (D-10).
 *
 * Creating a THIRD distinct profile throws; re-saving an EXISTING profile id (an edit) is always
 * allowed because the row count does not grow. "Distinct" is determined by whether the id already
 * exists (`repo.load`) — only then is the `repo.count()` gate consulted. Depends only on the PORT.
 */
export function saveProfile(repo: ProfileRepository, profile: Profile): void {
  const isNew = repo.load(profile.id) === null;
  if (isNew && repo.count() >= MAX_PROFILES) {
    throw new Error(
      `Profile cap reached: this tool stores at most ${MAX_PROFILES} household profiles (D-10). ` +
        `Edit or delete an existing profile before adding a new one (attempted to add "${profile.id}").`,
    );
  }
  repo.save(profile);
}

/** List every saved profile (port pass-through). */
export function listProfiles(repo: ProfileRepository): Profile[] {
  return repo.list();
}

/**
 * Delete a profile by id (port pass-through) — mirrors `deleteScenario`. The ≤2 cap is a SAVE-side
 * invariant; deletion is always allowed (it only ever frees a slot). The scenarios→profiles foreign
 * key means a profile that still owns saved scenarios cannot be deleted until those are removed.
 */
export function deleteProfile(repo: ProfileRepository, id: string): void {
  repo.delete(id);
}
