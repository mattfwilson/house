// scenario-service — the Pattern-1 imperative shell for the saved-scenario lifecycle (PROF-03/
// PROF-04, D-05). It depends ONLY on the `ScenarioRepository` PORT and the PURE engines from
// @house/core (`import type` for the port, value import for the engine) — NEVER on a concrete
// adapter (D-03, mechanized by the eslint app boundary in this plan). The container is the only
// site that names the concrete SQLite scenario adapter.
//
// Pattern 1 (gather I/O -> call the pure engine ONCE -> persist):
//   - computeAndSaveScenario recomputes the frozen `EngineInput` through the pure engine once
//     (`computeTco`), so a snapshot that cannot drive the engine is rejected BEFORE it is
//     persisted (T-06-19). `computeTco` is the universal recompute: it validates any valid
//     EngineInput whether or not a household is attached (the FI engine requires a household; the
//     TCO engine does not), so the service stays general.
//   - createdAt/updatedAt are stamped HERE from the caller-supplied `now` (epoch-ms), never from a
//     wall-clock read inside this shell and never inside core (the determinism guard) — the
//     snapshot stays reproducible (T-06-18).
import {
  computeTco,
  type EngineInput,
  type SavedScenario,
  type SavedScenarioMeta,
  type ScenarioRepository,
} from '@house/core';

/** The inputs to {@link computeAndSaveScenario} — identity + the frozen snapshot + the shell clock. */
export interface ComputeAndSaveParams {
  readonly id: string;
  readonly profileId: string;
  readonly name: string;
  readonly input: EngineInput;
  /** Epoch-ms timestamp supplied by the shell/caller — stamped onto createdAt/updatedAt (no wall-clock read here). */
  readonly now: number;
}

/**
 * Recompute the frozen snapshot through the pure engine ONCE (validation/use), then persist it as a
 * `SavedScenario` with service-generated timestamps. Returns the persisted record. The `input` is
 * already a validated, frozen `EngineInput` (assembled via `engineInput()`); the recompute proves
 * the engine accepts it before it reaches storage (Pattern 1).
 */
export function computeAndSaveScenario(
  repo: ScenarioRepository,
  params: ComputeAndSaveParams,
): SavedScenario {
  // Pattern 1: call the pure engine once. `computeTco` re-validates the snapshot drives the model
  // (it throws on an unseeded town / bad input) before we persist a scenario that cannot replay.
  computeTco(params.input);

  const scenario: SavedScenario = {
    id: params.id,
    profileId: params.profileId,
    name: params.name,
    input: params.input,
    createdAt: params.now,
    updatedAt: params.now,
  };
  repo.save(scenario);
  return scenario;
}

/** Load a saved scenario by id (the adapter re-validates the frozen snapshot through Zod on load). */
export function loadScenario(repo: ScenarioRepository, id: string): SavedScenario | null {
  return repo.load(id);
}

/** List the thin `SavedScenarioMeta` projection for a profile (no heavy blobs deserialized — D-06). */
export function listScenarios(repo: ScenarioRepository, profileId: string): SavedScenarioMeta[] {
  return repo.listByProfile(profileId);
}

/** Delete a saved scenario by id (a subsequent `loadScenario` returns `null`). */
export function deleteScenario(repo: ScenarioRepository, id: string): void {
  repo.delete(id);
}
