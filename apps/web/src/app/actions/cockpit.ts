'use server';
// cockpit.ts — the cockpit's small supporting Server Actions (07-08). Each is a THIN read that
// returns plain, RSC-serializable data so the client cockpit/editor never imports a core VALUE (the
// town table / default assumptions stay server-side; only their plain projections cross). No money
// math, no ranking — the flagship ranking lives in `recompareAction` (scenarios.ts), the trajectory
// in `fiTrajectoryAction` (trajectory.ts). These three just feed the editor's manual-entry surface
// and the OPTIONAL "prefill from a sample listing" affordance (D-14 — listings are never required).
import { TOWN_NAMES, DEFAULT_ASSUMPTIONS, type AssumptionSet } from '@house/core';
import type { Container } from '@house/app';
import { computeAndSaveScenarioAction, type SavedScenarioDTO } from '@/app/actions/scenarios';

/** One sample listing the editor can optionally prefill from (D-14) — a plain pass-through DTO. */
export interface ListingDTO {
  readonly id: string;
  readonly address: string;
  readonly town: string;
  readonly listPrice: string;
  readonly beds: number;
  readonly baths: string;
  readonly livingSqft: number;
  readonly propertyType: string;
}

/** Optional filter for {@link browseListingsAction} — all fields optional (empty = everything). */
export interface ListingsQueryRaw {
  readonly town?: string;
  readonly minPrice?: string;
  readonly maxPrice?: string;
}

/**
 * Resolve the container: the injected one in tests (`:memory:`), else the real server-only singleton
 * via a LAZY import — so importing this module never eagerly pulls `server-only` into a non-RSC env.
 */
async function resolveContainer(injected?: Container): Promise<Container> {
  if (injected) return injected;
  const mod = await import('@/lib/container.server');
  return mod.container();
}

/**
 * The curated greater-Boston town names for the editor's town selector (D-14). Sourced from the
 * single canonical core registry (`TOWN_NAMES`) so the UI offers exactly the set the engine resolves
 * a mill rate against — no duplicated/forked town list in the web layer.
 */
export async function listTownsAction(): Promise<readonly string[]> {
  return TOWN_NAMES;
}

/**
 * The seed `AssumptionSet` for a brand-new working set (the FIRST scenario, before any saved snapshot
 * exists to load — D-09). The rail then tunes it live; saving freezes it into the snapshot. Returned
 * as plain data so the client never imports the core value directly.
 */
export async function defaultAssumptionsAction(): Promise<AssumptionSet> {
  return DEFAULT_ASSUMPTIONS;
}

/** The raw scenario-save payload from the inline editor (D-15). */
export interface SaveScenarioFormRaw {
  readonly id: string;
  readonly profileId: string;
  readonly name: string;
  readonly asOf: string;
  readonly household: unknown;
  readonly assumptions: unknown;
  readonly scenario: unknown;
}

/**
 * The serializable result of a save attempt. On a core Zod rejection the per-field messages are
 * surfaced (D-16) — a thrown `ZodError` does NOT cross the Server Action boundary with its `.issues`
 * intact, so the editor cannot read them directly; this wrapper translates the core's parse failure
 * into a plain field-error map WITHOUT duplicating any validation (the schema still lives in core).
 */
export interface SaveScenarioResult {
  readonly ok: boolean;
  readonly saved?: SavedScenarioDTO;
  readonly fieldErrors?: Readonly<Record<string, string>>;
  readonly formError?: string;
}

/** UI-SPEC error-state copy for a non-validation save failure (07-UI-SPEC §Microcopy). */
const SAVE_ERROR_COPY =
  "Couldn't run the numbers. The calculation didn't complete — check your inputs and try again. " +
  'If it persists, the saved snapshot may be malformed.';

/** A Zod-like error: an object carrying an `issues` array (duck-typed so `zod` need not be imported). */
function toFieldErrors(error: unknown): Readonly<Record<string, string>> | null {
  if (
    typeof error !== 'object' ||
    error === null ||
    !Array.isArray((error as { issues?: unknown }).issues)
  ) {
    return null;
  }
  const issues = (error as { issues: ReadonlyArray<{ path?: unknown; message?: unknown }> }).issues;
  const fieldErrors: Record<string, string> = {};
  for (const issue of issues) {
    const path = Array.isArray(issue.path) ? issue.path : [];
    const key = path.length > 0 ? String(path[path.length - 1]) : '_form';
    if (fieldErrors[key] === undefined && typeof issue.message === 'string') {
      fieldErrors[key] = issue.message;
    }
  }
  return fieldErrors;
}

/**
 * Freeze + persist a scenario from the inline editor (D-15) and SURFACE the core's validation result
 * (D-16). It calls `computeAndSaveScenarioAction` (which validates every leaf through the core Zod
 * boundary and freezes the snapshot); a `ZodError` is translated into a plain `{ fieldErrors }` map so
 * the editor can show field-level errors WITHOUT holding its own schema. Any other failure surfaces the
 * generic error copy. On success the editor re-lists + re-ranks via `recompareAction`.
 */
export async function saveScenarioFormAction(raw: SaveScenarioFormRaw): Promise<SaveScenarioResult> {
  try {
    const saved = await computeAndSaveScenarioAction(raw);
    return { ok: true, saved };
  } catch (error) {
    const fieldErrors = toFieldErrors(error);
    if (fieldErrors !== null) return { ok: false, fieldErrors };
    return { ok: false, formError: SAVE_ERROR_COPY };
  }
}

/**
 * Browse the MockListingsProvider fixtures for the OPTIONAL "prefill from a sample listing" affordance
 * (D-14). Manual entry is always the default path — this only offers a convenience starting point and
 * is NEVER the required entry point. Returns plain DTOs (reconstructed objects, no class instance).
 */
export async function browseListingsAction(
  query: ListingsQueryRaw = {},
  injected?: Container,
): Promise<readonly ListingDTO[]> {
  const container = await resolveContainer(injected);
  return container.listings.getListings(query).map((listing) => ({
    id: listing.id,
    address: listing.address,
    town: listing.town,
    listPrice: listing.listPrice,
    beds: listing.beds,
    baths: listing.baths,
    livingSqft: listing.livingSqft,
    propertyType: listing.propertyType,
  }));
}
