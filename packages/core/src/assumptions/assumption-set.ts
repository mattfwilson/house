// AssumptionSet — the nested type plus the parse/serialize boundary helpers (D-04, D-06).
//
// The TYPES are re-exported from `schema.ts` (single source of truth — Zod infers them, so
// the runtime validator and the compile-time shape can never drift). The HELPERS are the
// only sanctioned way to cross the serialization boundary:
//   - parseAssumptionSet: validates THROUGH Zod (never trusts raw JSON — T-03-03) and
//     throws on anything malformed (corrupt fixture, forged version, float value).
//   - serializeAssumptionSet: emits canonical JSON via the shared `canonicalJson` serializer
//     (recursive key sort + float-free). Because every value is already a decimal STRING, no
//     float can appear in the output (D-06 / T-03-02), and the key sort makes it genuinely
//     order-independent (WR-01) — not merely stable by authored key order.
import {
  AssumptionSetSchema,
  type AnyAssumptionSet,
  type CurrentAssumptionSet,
} from './schema.js';
import { canonicalJson } from '../serialize/canonical-json.js';

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
 * Serialize an AssumptionSet to canonical JSON via the single canonical serializer
 * (`canonicalJson` — recursive key sort + float-free). This is genuinely canonical, NOT
 * insertion-order-dependent: two semantically-equal sets built with different key order
 * (e.g. via spreading/merging) serialize to byte-identical text, so hashing/snapshot
 * comparison is stable (WR-01). Input is validated through Zod first so we never serialize
 * a malformed set, and every numeric value is already a decimal string (float-free, D-06).
 */
export function serializeAssumptionSet(set: AnyAssumptionSet): string {
  return canonicalJson(AssumptionSetSchema.parse(set));
}
