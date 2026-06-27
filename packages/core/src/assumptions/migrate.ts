// migrate(old) -> current — the version step-up path (D-05).
//
// A snapshot persisted under an older schemaVersion must be lifted to the CURRENT shape
// before calc reads it; replay gates on the version. Today there is only V1, so this is
// the identity — but it is STRUCTURED as a version-gated step-up so a future V1->V2
// transform slots in as one `case`. An unrecognized version is rejected, not silently
// passed through (defense against a corrupt/forged snapshot — T-03-01).
import { parseAssumptionSet, type CurrentAssumptionSet } from './assumption-set.js';
import {
  AssumptionsV1,
  AssumptionsV2,
  AssumptionsV3,
  AssumptionsV4,
  type AnyAssumptionSet,
  CURRENT_VERSION,
} from './schema.js';
import { DEFAULT_ASSUMPTIONS } from './defaults.js';
import type { z } from 'zod';

/** The parsed shape of a V1 set (input to the V1->V2 step-up). */
type V1Set = z.infer<typeof AssumptionsV1>;
/** The parsed shape of a V2 set (input to the V2->V3 step-up). */
type V2Set = z.infer<typeof AssumptionsV2>;
/** The parsed shape of a V3 set (input to the V3->V4 step-up). */
type V3Set = z.infer<typeof AssumptionsV3>;

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

  let migrated: CurrentAssumptionSet;
  switch (set.schemaVersion) {
    case 1:
      // V1 -> current: chain V1->V2->V3->V4 so a V1 snapshot lands a COMPLETE V4 (the TCO slices
      // from v1ToV2, the FI/sensitivity slices from v2ToV3, AND the townScoring slice from v3ToV4).
      // A REAL transform, not identity — proven by migrate.test.ts.
      migrated = v3ToV4(v2ToV3(v1ToV2(set)));
      break;
    case 2:
      // V2 -> current: chain V2->V3->V4 so the FI/sensitivity AND townScoring slices are filled
      // from the defaults (V2 is no longer current — a REAL transform, proven by migrate.test.ts).
      migrated = v3ToV4(v2ToV3(set));
      break;
    case 3:
      // V3 -> V4 step-up: fill the new townScoring slice from the V4 defaults (V3 is no longer
      // current — a REAL transform, proven by migrate.test.ts).
      migrated = v3ToV4(set);
      break;
    case 4:
      // Already current.
      migrated = set;
      break;
    default:
      // `set` is `never` here once every version is handled — an exhaustiveness guard that
      // also throws at runtime for any version that slipped past validation.
      return assertNever(set);
  }

  // Re-validate the migrated output against the CURRENT (V4) schema before returning it as a
  // trusted set. The `parseAssumptionSet` above validates `input` against ITS OWN version, but
  // V1/V2 `swr.rate` is a bare `decStr` with NO positivity refine (that refine exists only on
  // V3/V4). Without this, a legacy V1/V2 snapshot carrying `swr.rate: '0'` (or negative) would
  // migrate through verbatim and be returned as "trusted", re-opening the `Money.of('Infinity')`
  // divide-by-SWR crash in FI calc. Parsing here rejects it at the trust boundary. Strictly
  // additive for well-formed snapshots — a valid set re-parses to an identical value, so the
  // reproducibility goldens stay byte-identical.
  return AssumptionsV4.parse(migrated);
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
 * Lift a parsed V2 set to the V3 shape (D-05). Copies every V2 slice verbatim, seeds the new
 * FI/sensitivity slices (`sensitivity` six bands + `projection.maxHorizonYears`) from the defaults,
 * and bumps `schemaVersion` to 3. V3 is no longer current, so this returns a `V3Set` (an
 * intermediate); the caller chains it through `v3ToV4` to reach the current shape.
 */
function v2ToV3(set: V2Set): V3Set {
  return {
    ...set,
    schemaVersion: 3,
    // V3 slices, seeded from the defaults (the LOCKED band + horizon values).
    sensitivity: { ...DEFAULT_ASSUMPTIONS.sensitivity },
    projection: { ...DEFAULT_ASSUMPTIONS.projection },
  };
}

/**
 * Lift a parsed V3 set to the current V4 shape (D-05). Copies every V3 slice verbatim, seeds the
 * new `townScoring` slice (weights + amenityWeights + ranges + bucket.stretchFactor) from the V4
 * defaults, and bumps `schemaVersion` to 4. The result satisfies the V4 schema by construction (a
 * shape drift here would be a compile error against `CurrentAssumptionSet`). STRICTLY ADDITIVE —
 * every prior V3 leaf is preserved, so a round-tripped/migrated set computes identical results.
 */
function v3ToV4(set: V3Set): CurrentAssumptionSet {
  return {
    ...set,
    schemaVersion: 4,
    // New V4 slice, seeded from the defaults (the [ASSUMED] townScoring weights/ranges/stretch).
    townScoring: { ...DEFAULT_ASSUMPTIONS.townScoring },
  };
}

function assertNever(set: never): never {
  // `set` is `never` at compile time; at runtime read the discriminant defensively for the message.
  const version = (set as { schemaVersion?: unknown })?.schemaVersion;
  throw new Error(`Cannot migrate AssumptionSet: unknown schemaVersion ${String(version)} (expected <= ${CURRENT_VERSION}).`);
}
