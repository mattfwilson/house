// Ephemeral Zustand store for the COMPARISON INPUT context that the live recompute loop needs
// beyond the shared working set (D-08). The assumptions rail owns the editable AssumptionSet
// (working-set.ts), but a `recompareAction` also needs the household, the keep-renting baseline,
// the N buy scenarios, and the as-of date to re-fly the instruments. Those pieces are NOT knobs —
// they are the comparison context the cockpit (07-08) assembles when scenarios are opened.
//
// This store is the integration seam between the cockpit (which knows the scenarios) and the
// persistent rail (mounted in the shared layout with no props). The cockpit calls
// `setComparisonInput(...)` when the comparison set changes; the rail reads `input` to build the
// recompare payload (working-set assumptions + this context) inside the debounced thunk.
//
// Pure transient UI state: NO persistence, NO Money, NO financial math. The raw scenario/household
// pieces stay as the plain decimal-string DTO `unknown` shape the Server Action's Zod boundary
// validates (D-16) — nothing is interpreted here.
import { create } from 'zustand';

/** The non-knob inputs a `recompareAction` needs alongside the shared working-set assumptions. */
export interface ComparisonInput {
  /** The as-of calendar date string the engine inputs are framed against. */
  readonly asOf: string;
  /** The household DTO (validated at the action's Zod boundary, opaque here). */
  readonly household: unknown;
  /** The keep-renting baseline scenario DTO. */
  readonly baseline: unknown;
  /** The N buy scenarios in the apples-to-apples comparison. */
  readonly scenarios: readonly unknown[];
}

export interface ComparisonInputState {
  /** The current comparison context, or null before a comparison is assembled (rail skips recompute). */
  readonly input: ComparisonInput | null;
  /** Set (or clear) the comparison context. Called by the cockpit when the comparison set changes. */
  setComparisonInput: (input: ComparisonInput | null) => void;
}

export const useComparisonInput = create<ComparisonInputState>((set) => ({
  input: null,
  setComparisonInput: (input) => set({ input }),
}));

/** Read selector: the current comparison context (or null before a comparison is assembled). */
export const selectComparisonInput = (state: ComparisonInputState): ComparisonInput | null =>
  state.input;
