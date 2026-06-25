// migrate(old) -> current — the version step-up path (D-05).
//
// A snapshot persisted under an older schemaVersion must be lifted to the CURRENT shape
// before calc reads it; replay gates on the version. Today there is only V1, so this is
// the identity — but it is STRUCTURED as a version-gated step-up so a future V1->V2
// transform slots in as one `case`. An unrecognized version is rejected, not silently
// passed through (defense against a corrupt/forged snapshot — T-03-01).
import { parseAssumptionSet, type CurrentAssumptionSet } from './assumption-set.js';
import { AssumptionsV1, type AnyAssumptionSet, CURRENT_VERSION } from './schema.js';
import { DEFAULT_ASSUMPTIONS } from './defaults.js';
import type { z } from 'zod';

/** The parsed shape of a V1 set (input to the V1->V2 step-up). */
type V1Set = z.infer<typeof AssumptionsV1>;

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
      // V1 -> V2 step-up: fill the new TCO slices from the V2 defaults (a REAL transform,
      // not identity — proven by migrate.test.ts).
      return v1ToV2(set);
    case 2:
      // Already current.
      return set;
    default:
      // `set` is `never` here once every version is handled — an exhaustiveness guard that
      // also throws at runtime for any version that slipped past validation.
      return assertNever(set);
  }
}

/**
 * Lift a parsed V1 set to the current V2 shape (D-05). Copies every V1 slice verbatim,
 * adds the new TCO slices (`appreciation`/`transaction`/`rent`/`closing`) and the new
 * `tax.assessmentRatio` leaf from the V2 defaults, and bumps `schemaVersion` to 2. The
 * result is re-validated by the caller's downstream consumers (it satisfies the V2 schema
 * by construction — a shape drift here would be a compile error against `CurrentAssumptionSet`).
 */
function v1ToV2(set: V1Set): CurrentAssumptionSet {
  return {
    ...set,
    schemaVersion: 2,
    // Preserve V1 `tax` leaves, add the V2-default assessmentRatio.
    tax: {
      ...set.tax,
      assessmentRatio: DEFAULT_ASSUMPTIONS.tax.assessmentRatio,
    },
    // New V2 slices, seeded from the conservative V2 defaults.
    appreciation: { ...DEFAULT_ASSUMPTIONS.appreciation },
    transaction: { ...DEFAULT_ASSUMPTIONS.transaction },
    rent: { ...DEFAULT_ASSUMPTIONS.rent },
    closing: { ...DEFAULT_ASSUMPTIONS.closing },
  };
}

function assertNever(set: never): never {
  // `set` is `never` at compile time; at runtime read the discriminant defensively for the message.
  const version = (set as { schemaVersion?: unknown })?.schemaVersion;
  throw new Error(`Cannot migrate AssumptionSet: unknown schemaVersion ${String(version)} (expected <= ${CURRENT_VERSION}).`);
}
