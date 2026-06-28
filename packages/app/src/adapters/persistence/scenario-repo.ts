// SqliteScenarioRepository — the reproducibility load-bearing save/load path (PROF-03/PROF-04,
// D-05). This is `golden.test.ts`'s `roundTrip()` helper PROMOTED from a test to production:
//   SAVE serializes the FROZEN `EngineInput` snapshot via `canonicalJson` into the
//        `scenarios.snapshot` TEXT blob (the source of truth);
//   LOAD `JSON.parse`s that blob and rebuilds the `EngineInput` by re-validating EVERY leaf
//        through the existing Zod boundary parsers (`parseAssumptionSet` / `parseScenarioInputs`
//        / `parseHousehold` via `engineInput`, `asOf` through `calendarDate`) — NEVER an `as`
//        cast, so a forged/corrupt blob (e.g. a float smuggled into the snapshot) throws here
//        instead of being silently computed (T-06-12).
//
// FROZEN HOUSEHOLD (PROF-04 / RESEARCH Pitfall 7): the load path rebuilds the snapshot SOLELY
// from the self-contained blob and NEVER re-joins the live owning-profile row. The `profile_id`
// FK is for ownership / listing scope only — editing the owning profile AFTER a scenario is saved
// can never retroactively change that scenario's reloaded snapshot.
import { eq } from 'drizzle-orm';
import {
  canonicalJson,
  engineInput,
  calendarDate,
  parseAssumptionSet,
  parseScenarioInputs,
  parseHousehold,
  type CurrentAssumptionSet,
  type EngineInput,
  type SavedScenario,
  type SavedScenarioMeta,
  type ScenarioRepository,
} from '@house/core';
import type { Db } from './db.js';
import { scenarios } from './schema.js';

/** The JSON shape of a stored snapshot blob (untrusted until re-parsed leaf-by-leaf). */
interface RawSnapshot {
  readonly asOf: string;
  readonly assumptions: unknown;
  readonly scenario: unknown;
  readonly household?: unknown;
}

/**
 * Serialize a frozen `EngineInput` to its canonical-JSON snapshot blob (the SAVE half). The
 * optional `household` uses the conditional-spread OMIT idiom (Pitfall 2): the key is omitted
 * ENTIRELY when absent — never set to `undefined`/`null` — because the canonical bytes depend on
 * it (a TCO-only snapshot must serialize byte-identically with or without persistence).
 */
export function serializeSnapshot(input: EngineInput): string {
  return canonicalJson({
    asOf: input.asOf,
    assumptions: input.assumptions,
    scenario: input.scenario,
    ...(input.household ? { household: input.household } : {}),
  });
}

/**
 * Rebuild a trusted `EngineInput` from a stored snapshot blob (the LOAD half). Every leaf goes
 * back THROUGH its Zod boundary parser — a forged blob throws, never silently computes (T-06-12).
 * The household is omitted when the snapshot carried none (exactOptionalPropertyTypes).
 */
export function deserializeSnapshot(blob: string): EngineInput {
  const raw = JSON.parse(blob) as RawSnapshot;
  return engineInput({
    asOf: calendarDate(raw.asOf),
    assumptions: parseAssumptionSet(raw.assumptions) as CurrentAssumptionSet,
    scenario: parseScenarioInputs(raw.scenario),
    ...(raw.household !== undefined ? { household: parseHousehold(raw.household) } : {}),
  });
}

/**
 * SQLite-backed `ScenarioRepository`. Depends only on the `Db` handle (the schema-typed Drizzle
 * connection) — Drizzle parameterizes every insert/select/delete (T-06-14, no string-built SQL).
 */
export class SqliteScenarioRepository implements ScenarioRepository {
  constructor(private readonly db: Db) {}

  /**
   * Persist a scenario. The snapshot is serialized via `canonicalJson` into the `snapshot` TEXT
   * blob (D-05). `onConflictDoUpdate` on the primary key makes save idempotent for an EDIT (D-11)
   * — re-saving the same id updates in place. A DIFFERENT id reusing a `(profileId, name)` pair
   * still trips the unique index (the duplicate-name rejection is preserved).
   */
  save(s: SavedScenario): void {
    const blob = serializeSnapshot(s.input);
    this.db
      .insert(scenarios)
      .values({
        id: s.id,
        profileId: s.profileId,
        name: s.name,
        snapshot: blob,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
      })
      .onConflictDoUpdate({
        target: scenarios.id,
        set: { profileId: s.profileId, name: s.name, snapshot: blob, updatedAt: s.updatedAt },
      })
      .run();
  }

  /**
   * Load a scenario by id, rebuilding the FROZEN snapshot solely from the blob (never re-joining
   * the live profile — PROF-04). Returns `null` for an absent id. A forged/corrupt blob throws
   * at the Zod boundary inside `deserializeSnapshot`.
   */
  load(id: string): SavedScenario | null {
    const row = this.db.select().from(scenarios).where(eq(scenarios.id, id)).get();
    if (row === undefined) return null;
    return {
      id: row.id,
      profileId: row.profileId,
      name: row.name,
      input: deserializeSnapshot(row.snapshot),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  /**
   * The thin `SavedScenarioMeta` projection (D-06): selects ONLY the queryable metadata columns
   * for a profile and deserializes NO blobs — a list view never pays the snapshot-parse cost.
   */
  listByProfile(profileId: string): SavedScenarioMeta[] {
    return this.db
      .select({
        id: scenarios.id,
        profileId: scenarios.profileId,
        name: scenarios.name,
        createdAt: scenarios.createdAt,
        updatedAt: scenarios.updatedAt,
      })
      .from(scenarios)
      .where(eq(scenarios.profileId, profileId))
      .all();
  }

  /** Remove a scenario row (a subsequent `load` returns `null`) — D-11. */
  delete(id: string): void {
    this.db.delete(scenarios).where(eq(scenarios.id, id)).run();
  }
}
