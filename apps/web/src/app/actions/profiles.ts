'use server';
// profiles.ts — the profile Server Actions. Same THIN validate→call-once→map shape as scenarios.ts
// (RESEARCH Pattern 1/2/3, the profile-service.ts precedent):
//   1. VALIDATE raw client input THROUGH the existing core Zod schema (`parseProfile`, which extends
//      `HouseholdSchema` — D-16); a forged profile is rejected at the boundary before persistence.
//   2. CALL exactly ONE `@house/app` service (`saveProfile` / `listProfiles` / `deleteProfile`).
//   3. MAP to a plain DTO (`toProfileDTO`) before returning.
//
// The ≤2-profile soft cap is a SERVICE-LAYER invariant enforced inside `saveProfile` (D-10) — it is
// NEVER re-checked here. `MAX_PROFILES` is surfaced for DISPLAY COPY only via `maxProfilesAction`
// (a 'use server' module may export only async functions, so the constant crosses as an async getter).
import { parseProfile } from '@house/core';
import { saveProfile, listProfiles, deleteProfile, MAX_PROFILES, type Container } from '@house/app';
import { toProfileDTO, type ProfileDTO } from '@/lib/dto/profile';

/**
 * Resolve the container: the injected one in tests (`:memory:`), else the real server-only singleton
 * via a LAZY import (so importing this module never eagerly pulls `server-only` into a non-RSC env).
 */
async function resolveContainer(injected?: Container): Promise<Container> {
  if (injected) return injected;
  const mod = await import('@/lib/container.server');
  return mod.container();
}

/**
 * Validate + persist a profile (PROF-01/PROF-02). `parseProfile` is the single trust boundary (D-16);
 * `saveProfile` enforces the ≤2 cap (creating a THIRD distinct profile throws — NEVER re-checked here;
 * an EDIT of an existing id is always allowed). Returns the saved profile as a plain DTO.
 */
export async function saveProfileAction(raw: unknown, injected?: Container): Promise<ProfileDTO> {
  const profile = parseProfile(raw);
  const container = await resolveContainer(injected);
  saveProfile(container.profiles, profile);
  return toProfileDTO(profile);
}

/** List every saved profile as plain DTOs (each money leaf is already a decimal string). */
export async function listProfilesAction(injected?: Container): Promise<ProfileDTO[]> {
  const container = await resolveContainer(injected);
  return listProfiles(container.profiles).map(toProfileDTO);
}

/**
 * Delete a profile by id. Deletion only ever frees a slot, so there is no cap check; the
 * scenarios→profiles foreign key means a profile that still owns saved scenarios cannot be deleted
 * until those scenarios are removed (the service/adapter surfaces that constraint error).
 */
export async function deleteProfileAction(id: string, injected?: Container): Promise<void> {
  const container = await resolveContainer(injected);
  deleteProfile(container.profiles, id);
}

/** The ≤2-profile soft cap, surfaced for DISPLAY COPY only (no enforcement — that lives in the service). */
export async function maxProfilesAction(): Promise<number> {
  return MAX_PROFILES;
}
