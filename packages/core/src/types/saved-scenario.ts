// SavedScenario — the persisted, REPRODUCIBLE scenario record (PROF-04 / D-05). A saved
// scenario embeds a FROZEN copy of the `EngineInput` snapshot (`{ asOf, assumptions, scenario,
// household? }`) as of the moment it was saved. The snapshot is SELF-CONTAINED: reload rebuilds
// the result solely from the embedded blob (re-parsing every leaf through the existing Zod
// boundary validators) and NEVER re-joins the live profile row, so a later profile edit can
// never retroactively change a saved scenario's result (RESEARCH Pitfall 7).
//
// This is a TYPE-ONLY module — no Zod here. The embedded `EngineInput` is validated on load by
// the SAME parsers it was assembled with (`parseAssumptionSet` / `parseScenarioInputs` /
// `parseHousehold` via `engineInput()`); duplicating that validation here would risk a divergent
// boundary. `createdAt` / `updatedAt` are epoch-ms numbers GENERATED in the app shell — core
// forbids `Date.now()` (the determinism guard), so the TYPE lives here while the values are
// stamped by the imperative layer.
import type { EngineInput } from '../engine/engine-input.js';

/**
 * A saved scenario: a named, owned, timestamped wrapper around a frozen `EngineInput` snapshot.
 *
 * `input` is the as-of-save snapshot — its embedded `household` (when present) is a FROZEN copy
 * independent of the live profile row. Reproducibility rests on re-parsing the embedded leaves
 * through the existing parsers on load; the load path MUST NEVER re-derive the household from the
 * current profile (PROF-04).
 */
export interface SavedScenario {
  /** Stable primary key (the persistence row id). */
  readonly id: string;
  /** The owning profile's id (the foreign key — used only to scope listing, never re-joined into `input`). */
  readonly profileId: string;
  /** Human label for the scenario (unique per profile). */
  readonly name: string;
  /** The FROZEN as-of-save EngineInput snapshot — the sole source of truth for a replay (D-05). */
  readonly input: EngineInput;
  /** Creation timestamp, epoch-ms — stamped in the app shell, never in core (no `Date.now()` here). */
  readonly createdAt: number;
  /** Last-update timestamp, epoch-ms — stamped in the app shell. */
  readonly updatedAt: number;
}

/**
 * SavedScenarioMeta — the thin, queryable projection of `SavedScenario` (id / profileId / name /
 * createdAt / updatedAt) returned by `ScenarioRepository.listByProfile` (D-06). It deliberately
 * OMITS the heavy embedded `input` snapshot so a list view never deserializes every blob.
 */
export interface SavedScenarioMeta {
  readonly id: string;
  readonly profileId: string;
  readonly name: string;
  readonly createdAt: number;
  readonly updatedAt: number;
}
