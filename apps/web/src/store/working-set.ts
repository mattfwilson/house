// Ephemeral Zustand store for the SHARED working AssumptionSet (D-09).
//
// One working set drives the whole apples-to-apples comparison. It is LOADED from a saved
// scenario's frozen snapshot when that scenario is opened (`loadFrozenSet`) and edited
// knob-by-knob in the live cockpit loop (`updateKnob`). It is held in the plain
// decimal-string DTO form the core's AssumptionSet boundary already uses — NEVER as `Money`
// instances (a `Money` must not cross into a client store; Pitfall 1). Only a TYPE is imported
// from @house/core, so no value (and no native dependency) is pulled into the client bundle.
//
// PROF-04 / T-7-08 — CRITICAL INVARIANT: this store performs NO persistence. It is NEVER
// auto-written back to a snapshot on navigation or on a knob edit. Freezing the working set
// into a reproducible snapshot happens ONLY via the explicit save Server Action
// (`computeAndSaveScenarioAction`, plan 07-03). A grep gate confirms no save call lives here.
import { create } from 'zustand';
import type { AssumptionSet } from '@house/core';

export interface WorkingSetState {
  /** The shared working AssumptionSet (plain decimal-string DTO), or null before a scenario is opened. */
  readonly assumptions: AssumptionSet | null;
  /**
   * Replace the working set with a saved scenario's FROZEN snapshot assumptions (D-09).
   * Called when a saved scenario is opened. This is a load (a read of stored truth into
   * ephemeral state), never a persist back to the snapshot.
   */
  loadFrozenSet: (snapshot: AssumptionSet) => void;
  /**
   * Edit ONE tunable in place (the live cockpit loop). `path` is a dot-path into the nested set
   * (e.g. "returns.realAnnual", "townScoring.weights.commute"); `value` is a canonical decimal
   * string (validation happens at the core Zod boundary on recompute/save, not here). Immutable
   * nested update with structural sharing — no persistence side-effect.
   */
  updateKnob: (path: string, value: string) => void;
}

export const useWorkingSet = create<WorkingSetState>((set) => ({
  assumptions: null,
  loadFrozenSet: (snapshot) => set({ assumptions: snapshot }),
  updateKnob: (path, value) =>
    set((state) =>
      state.assumptions === null
        ? state
        : { assumptions: setDeep(state.assumptions, path.split('.'), value) as AssumptionSet },
    ),
}));

/** Read selector: the current working set (or null before a scenario is opened). */
export const selectWorkingSet = (state: WorkingSetState): AssumptionSet | null => state.assumptions;

/**
 * Immutably set a nested leaf to `value`, cloning only the touched path (structural sharing).
 * Operates on the plain decimal-string DTO shape; returns a new top-level object.
 */
function setDeep(node: unknown, keys: readonly string[], value: string): unknown {
  const [head, ...rest] = keys;
  if (head === undefined) return value;
  const record = node as Record<string, unknown>;
  return {
    ...record,
    [head]: setDeep(record[head], rest, value),
  };
}
