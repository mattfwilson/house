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
import { fieldErrorsFromZod } from '@/components/profile/profile-form';

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

/**
 * The serializable result of a profile-save attempt (D-16). `saveProfileAction` THROWS a `ZodError` on
 * a forged/invalid profile, and a thrown error does NOT cross the Server Action boundary with its
 * `.issues` intact — so the editor cannot read per-field messages from it directly. This wrapper
 * mirrors `saveScenarioFormAction` (07-08): it translates the core's parse failure into a plain
 * `{ fieldErrors }` map WITHOUT duplicating any validation (the schema still lives in core), and maps
 * any non-validation failure (e.g. the ≤2-profile cap thrown by `saveProfile`) to a generic message.
 */
export interface SaveProfileResult {
  readonly ok: boolean;
  readonly saved?: ProfileDTO;
  readonly fieldErrors?: Readonly<Record<string, string>>;
  readonly formError?: string;
}

/** Generic copy for a non-validation save failure (e.g. the soft cap) — keeps cap enforcement server-side. */
const SAVE_PROFILE_ERROR_COPY =
  "Couldn't save the profile. It wasn't stored — you may already have the maximum number of profiles. " +
  'Remove one and try again.';

/**
 * Validate + persist a profile and SURFACE the core's validation result (D-16). Wraps
 * `saveProfileAction`; on a Zod parse failure it returns the per-field error map (translated from the
 * core's `issues`), on any other failure the generic copy, and on success the saved DTO. The editor
 * holds NO schema — it only renders what this returns.
 */
export async function saveProfileFormAction(
  raw: unknown,
  injected?: Container,
): Promise<SaveProfileResult> {
  try {
    const saved = await saveProfileAction(raw, injected);
    return { ok: true, saved };
  } catch (error) {
    const fieldErrors = fieldErrorsFromZod(error);
    if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };
    return { ok: false, formError: SAVE_PROFILE_ERROR_COPY };
  }
}
