// AssumptionSet — the nested type plus the parse/serialize boundary helpers (D-04, D-06).
//
// The TYPES are re-exported from `schema.ts` (single source of truth — Zod infers them, so
// the runtime validator and the compile-time shape can never drift). The HELPERS are the
// only sanctioned way to cross the serialization boundary:
//   - parseAssumptionSet: validates THROUGH Zod (never trusts raw JSON — T-03-03) and
//     throws on anything malformed (corrupt fixture, forged version, float value).
//   - serializeAssumptionSet: emits canonical JSON; because every value is already a
//     decimal STRING, no float can appear in the output (D-06 / T-03-02).
import {
  AssumptionSetSchema,
  type AnyAssumptionSet,
  type CurrentAssumptionSet,
} from './schema.js';

export type {
  AnyAssumptionSet,
  CurrentAssumptionSet,
} from './schema.js';

// Re-export the canonical AssumptionSet alias (the current-version shape downstream reads).
export type AssumptionSet = CurrentAssumptionSet;

/**
 * Validate untrusted data into a trusted AssumptionSet. Throws (with a Zod error) on any
 * malformed input — a missing group, an unknown `schemaVersion`, or a float where a
 * decimal string is required. Callers MUST go through this; never spread raw JSON into
 * config (T-03-01 / T-03-02 / T-03-03).
 */
export function parseAssumptionSet(input: unknown): AnyAssumptionSet {
  return AssumptionSetSchema.parse(input);
}

/**
 * Serialize an AssumptionSet to canonical JSON. Every numeric value is already a decimal
 * string, so the serialized form is float-free by construction (D-06). Input is validated
 * first so we never serialize a malformed set.
 */
export function serializeAssumptionSet(set: AnyAssumptionSet): string {
  return JSON.stringify(AssumptionSetSchema.parse(set));
}
