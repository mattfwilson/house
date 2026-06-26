// migrate(old) -> current — the version step-up path (D-05).
//
// A snapshot persisted under an older schemaVersion must be lifted to the CURRENT shape
// before calc reads it; replay gates on the version. Today there is only V1, so this is
// the identity — but it is STRUCTURED as a version-gated step-up so a future V1->V2
// transform slots in as one `case`. An unrecognized version is rejected, not silently
// passed through (defense against a corrupt/forged snapshot — T-03-01).
import { parseAssumptionSet, type CurrentAssumptionSet } from './assumption-set.js';
import { AssumptionsV1, AssumptionsV2, type AnyAssumptionSet, CURRENT_VERSION } from './schema.js';
import { DEFAULT_ASSUMPTIONS } from './defaults.js';
import type { z } from 'zod';

/** The parsed shape of a V1 set (input to the V1->V2 step-up). */
type V1Set = z.infer<typeof AssumptionsV1>;
/** The parsed shape of a V2 set (input to the V2->V3 step-up). */
type V2Set = z.infer<typeof AssumptionsV2>;

/**
 * Step a parsed AssumptionSet of any known version up to the current version.
 *
 * @param input an already-Zod-validated `AnyAssumptionSet` (parse first, then migrate).
 * @returns the equivalent `CurrentAssumptionSet`.
 * @throws if `input.schemaVersion` is not a recognized version.
 */
export function migrate(input: AnyAssumptionSet): CurrentAssumptionSet {
  // Re-validate at the boundary: migrate must never trust an unvalidated shape, and this
  // also rejects a forged out-of-range schemaVersion before the switch (T-03-01).
  const set = parseAssumptionSet(input);

  switch (set.schemaVersion) {
    case 1:
      // V1 -> current: chain V1->V2->V3 so a V1 snapshot lands a COMPLETE V3 (the TCO slices
      // from v1ToV2 AND the FI/sensitivity slices from v2ToV3). A REAL transform, not identity
      // — proven by migrate.test.ts.
      return v2ToV3(v1ToV2(set));
    case 2:
      // V2 -> V3 step-up: fill the new FI/sensitivity slices from the V3 defaults (V2 is no
      // longer current — a REAL transform, proven by migrate.test.ts).
      return v2ToV3(set);
    case 3:
      // Already current.
      return set;
    default:
      // `set` is `never` here once every version is handled — an exhaustiveness guard that
      // also throws at runtime for any version that slipped past validation.
      return assertNever(set);
  }
}

/**
 * Lift a parsed V1 set to the V2 shape (D-05). Copies every V1 slice verbatim, adds the TCO
 * slices (`appreciation`/`transaction`/`rent`/`closing`) and the `tax.assessmentRatio` leaf
 * from the defaults, and bumps `schemaVersion` to 2. V2 is no longer current, so this returns a
 * `V2Set` (an intermediate); the caller chains it through `v2ToV3` to reach the current shape.
 */
function v1ToV2(set: V1Set): V2Set {
  return {
    ...set,
    schemaVersion: 2,
    // Preserve V1 `tax` leaves, add the default assessmentRatio.
    tax: {
      ...set.tax,
      assessmentRatio: DEFAULT_ASSUMPTIONS.tax.assessmentRatio,
    },
    // V2 slices, seeded from the conservative defaults.
    appreciation: { ...DEFAULT_ASSUMPTIONS.appreciation },
    transaction: { ...DEFAULT_ASSUMPTIONS.transaction },
    rent: { ...DEFAULT_ASSUMPTIONS.rent },
    closing: { ...DEFAULT_ASSUMPTIONS.closing },
  };
}

/**
 * Lift a parsed V2 set to the current V3 shape (D-05). Copies every V2 slice verbatim, seeds the
 * new FI/sensitivity slices (`sensitivity` six bands + `projection.maxHorizonYears`) from the V3
 * defaults, and bumps `schemaVersion` to 3. The result satisfies the V3 schema by construction (a
 * shape drift here would be a compile error against `CurrentAssumptionSet`).
 */
function v2ToV3(set: V2Set): CurrentAssumptionSet {
  return {
    ...set,
    schemaVersion: 3,
    // New V3 slices, seeded from the defaults (the LOCKED band + horizon values).
    sensitivity: { ...DEFAULT_ASSUMPTIONS.sensitivity },
    projection: { ...DEFAULT_ASSUMPTIONS.projection },
  };
}

function assertNever(set: never): never {
  // `set` is `never` at compile time; at runtime read the discriminant defensively for the message.
  const version = (set as { schemaVersion?: unknown })?.schemaVersion;
  throw new Error(`Cannot migrate AssumptionSet: unknown schemaVersion ${String(version)} (expected <= ${CURRENT_VERSION}).`);
}
