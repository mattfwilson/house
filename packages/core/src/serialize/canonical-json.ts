// canonicalJson — the single canonical serialization used by the golden harness (D-10).
//
// Two properties make a golden compare trustworthy:
//   1. FLOAT-FREE: a `Money` is emitted as its decimal STRING (`toDecimalString()`), never a
//      JS number. A float in the golden master would make "cent-identical" a lie.
//   2. ORDER-INDEPENDENT: object keys are sorted recursively, so two semantically-equal
//      objects with different key insertion order serialize to byte-identical text. Without
//      this, a harmless reordering would spuriously fail (or pass) the golden compare.
//
// Implementation: a recursive normalizer (Money -> string, objects -> key-sorted plain
// objects, arrays -> element order preserved with each element normalized) feeding
// `JSON.stringify`. We normalize-then-stringify rather than relying on a stringify
// replacer because a replacer alone cannot reorder object keys.
import { Money } from '../money/money.js';

/** Recursively normalize a value into a canonical, JSON-stringify-ready shape. */
function normalize(value: unknown): unknown {
  // A Money becomes its full-precision decimal string (no float ever — D-06/D-10).
  if (value instanceof Money) {
    return value.toDecimalString();
  }

  // Arrays: element ORDER is meaningful, so preserve it; normalize each element.
  if (Array.isArray(value)) {
    return value.map(normalize);
  }

  // Plain objects: emit keys in SORTED order so output is order-independent.
  if (value !== null && typeof value === 'object') {
    const source = value as Record<string, unknown>;
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(source).sort()) {
      sorted[key] = normalize(source[key]);
    }
    return sorted;
  }

  // Primitives (string/number/boolean/null) pass through unchanged.
  return value;
}

/**
 * Serialize a value to canonical JSON: `Money` -> decimal string, object keys sorted
 * recursively, deterministic byte output for equal inputs. The canonical form the golden
 * master is compared against (deep-equal on this string).
 */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(normalize(value));
}
