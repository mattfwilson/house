// Profile — the persisted person-vs-house contract (PROF-01/PROF-02/PROF-03). A `Profile` is a
// saved `Household` with an identity: `{ id, name } & Household`. It is NOT a parallel money
// schema — it REUSES the existing nine-leaf `HouseholdSchema` validators verbatim (D-09/D-10),
// so a forged/corrupt profile is rejected at exactly the same boundary the affordability solvers
// already trust (T-06-01). Every dollar leaf is a canonical decimal STRING (`decStr`, inherited
// from Household) — a JS float can never re-enter here (CORE-02 / D-06).
//
// PROF-01 "net worth" maps to the engine field `availableNetWorth` — there is NO separate
// separate net-worth leaf. A profile carrying only the PROF-01-visible fields could not drive the
// affordability/FI engines; the full nine Household leaves are required.
import { z } from 'zod';
import { HouseholdSchema, type Household } from '../engine/engine-input.js';

/**
 * A saved financial profile: the full nine-leaf `Household` plus a stable identity. The two
 * profiles a private two-user tool stores (PROF-02) are distinguished by `id`/`name`; every
 * financial leaf is inherited from `Household`, so the affordability/FI engines consume a
 * `Profile` exactly as they consume a `Household`.
 */
export interface Profile extends Household {
  /** Stable primary key (the persistence row id). */
  readonly id: string;
  /** Human label for the profile (e.g. "Matt & Wife"). */
  readonly name: string;
}

/**
 * ProfileSchema — the Zod 4 runtime mirror of `Profile` and the persisted-profile trust
 * boundary (T-06-01). Built by EXTENDING `HouseholdSchema` with the two identity columns and
 * re-applying `.strict()`, so it reuses the existing nine-leaf money/rate validators verbatim
 * (every dollar leaf `decStr`, `targetSavingsRate` constrained to [0,1)) rather than authoring a
 * parallel — and potentially divergent — money schema. `.strict()` rejects unknown keys, so a
 * forged/corrupt profile blob cannot smuggle extra fields past the boundary.
 */
export const ProfileSchema = HouseholdSchema.extend({
  id: z.string().min(1),
  name: z.string().min(1),
}).strict();

/**
 * Validate untrusted data into a trusted `Profile`. Throws (with a Zod error) on any
 * forged/corrupt profile — a non-canonical decimal string, a bare JS number, a
 * `targetSavingsRate` outside [0,1), an unknown extra key, or a missing required leaf. The
 * profile repository loader MUST go through this; never spread raw JSON into the calc (mirrors
 * `parseHousehold` at engine-input.ts:198 — never an `as` cast on raw JSON).
 */
export function parseProfile(input: unknown): Profile {
  return ProfileSchema.parse(input) as Profile;
}
