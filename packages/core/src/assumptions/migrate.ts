// migrate(old) -> current — the version step-up path (D-05).
//
// A snapshot persisted under an older schemaVersion must be lifted to the CURRENT shape
// before calc reads it; replay gates on the version. Today there is only V1, so this is
// the identity — but it is STRUCTURED as a version-gated step-up so a future V1->V2
// transform slots in as one `case`. An unrecognized version is rejected, not silently
// passed through (defense against a corrupt/forged snapshot — T-03-01).
import { parseAssumptionSet, type CurrentAssumptionSet } from './assumption-set.js';
import { type AnyAssumptionSet, CURRENT_VERSION } from './schema.js';

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
      // Already current. (When V2 lands: `case 1: return v1ToV2(set); // falls through`)
      return set;
    default:
      // `set` is `never` here once every version is handled — an exhaustiveness guard that
      // also throws at runtime for any version that slipped past validation.
      return assertNever(set.schemaVersion);
  }
}

function assertNever(version: never): never {
  throw new Error(`Cannot migrate AssumptionSet: unknown schemaVersion ${String(version)} (expected <= ${CURRENT_VERSION}).`);
}
