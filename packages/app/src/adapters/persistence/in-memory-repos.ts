// In-memory repository FAKES — the adapter-agnostic proof that the ports (`ScenarioRepository` /
// `ProfileRepository`) are honored by something OTHER than SQLite. ONE shared `repositoryContract`
// factory (repository-contract.test.ts) runs the SAME assertion suite against these fakes AND the
// SQLite adapters; if both pass, the contract is genuinely in the PORT, not the implementation.
//
// Frozen-snapshot fidelity: the scenario fake stores the canonical-JSON BLOB (not the live object)
// and rebuilds the `EngineInput` on load through the same `serializeSnapshot`/`deserializeSnapshot`
// the SQLite adapter uses. So a later external mutation of the caller's object can NEVER
// retroactively change a stored scenario — identical observable semantics to the TEXT-blob DB.
import {
  parseProfile,
  type Profile,
  type ProfileRepository,
  type SavedScenario,
  type SavedScenarioMeta,
  type ScenarioRepository,
} from '@house/core';
import { deserializeSnapshot, serializeSnapshot } from './scenario-repo.js';

/** The minimal row a fake scenario store holds — the metadata columns + the serialized blob. */
interface ScenarioRow {
  readonly profileId: string;
  readonly name: string;
  readonly snapshot: string;
  readonly createdAt: number;
  readonly updatedAt: number;
}

/**
 * In-memory `ScenarioRepository` fake backed by a `Map<id, ScenarioRow>`. It serializes the
 * snapshot to a blob on save and re-parses it on load — the SAME deep-copy-through-canonicalJson
 * round-trip the SQLite adapter performs — so the frozen-household semantics are byte-identical.
 */
export class InMemoryScenarioRepository implements ScenarioRepository {
  private readonly rows = new Map<string, ScenarioRow>();

  save(s: SavedScenario): void {
    // Enforce scenario-name-uniqueness-within-profile explicitly (the SQLite arm gets this from
    // the unique index, D-11). A different id reusing a `(profileId, name)` pair is rejected; the
    // SAME id re-saving is an idempotent EDIT (upsert parity).
    for (const [existingId, row] of this.rows) {
      if (existingId !== s.id && row.profileId === s.profileId && row.name === s.name) {
        throw new Error(
          `UNIQUE constraint failed: scenario name "${s.name}" already exists for profile ${s.profileId}`,
        );
      }
    }
    this.rows.set(s.id, {
      profileId: s.profileId,
      name: s.name,
      snapshot: serializeSnapshot(s.input),
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
    });
  }

  load(id: string): SavedScenario | null {
    const row = this.rows.get(id);
    if (row === undefined) return null;
    return {
      id,
      profileId: row.profileId,
      name: row.name,
      input: deserializeSnapshot(row.snapshot),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  listByProfile(profileId: string): SavedScenarioMeta[] {
    const metas: SavedScenarioMeta[] = [];
    for (const [id, row] of this.rows) {
      if (row.profileId === profileId) {
        metas.push({
          id,
          profileId: row.profileId,
          name: row.name,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
        });
      }
    }
    return metas;
  }

  delete(id: string): void {
    this.rows.delete(id);
  }
}

/**
 * In-memory `ProfileRepository` fake backed by a `Map<id, Profile>`. On save/load/list it re-parses
 * each profile through `parseProfile` — the same defense-in-depth re-validation the SQLite adapter
 * applies to DB rows — so the two implementations honor the port identically. `Profile` carries no
 * timestamps (those are SQLite persistence metadata), so the fake needs no clock.
 */
export class InMemoryProfileRepository implements ProfileRepository {
  private readonly rows = new Map<string, Profile>();

  save(p: Profile): void {
    // Re-validate on the way IN so the fake can never hold a forged profile (parity with the
    // SQLite adapter's load-time `parseProfile`).
    this.rows.set(p.id, parseProfile(p));
  }

  load(id: string): Profile | null {
    const p = this.rows.get(id);
    if (p === undefined) return null;
    return parseProfile(p);
  }

  list(): Profile[] {
    return [...this.rows.values()].map((p) => parseProfile(p));
  }

  count(): number {
    return this.rows.size;
  }

  delete(id: string): void {
    this.rows.delete(id);
  }
}
