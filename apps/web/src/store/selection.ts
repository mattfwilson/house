// Ephemeral Zustand store for SELECTION / EXPANSION state (D-03) — pure transient UI state with
// NO persistence. Tracks the active profile + scenario (the header switchers, D-02), which
// scenario row is inline-expanded in the cockpit comparison (D-03), and the set of scenarios
// currently held in the side-by-side comparison. Server-truth lives in SQLite; this store holds
// only what the user is currently looking at.
import { create } from 'zustand';

export interface SelectionState {
  /** The active profile (header switcher; 07-11's profile editor sets this after a save). */
  readonly activeProfileId: string | null;
  /** The active scenario (header switcher). */
  readonly activeScenarioId: string | null;
  /** The single inline-expanded scenario row in the cockpit (D-03), or null when all are collapsed. */
  readonly expandedScenarioId: string | null;
  /** The scenarioIds currently in the side-by-side comparison (apples-to-apples set). */
  readonly comparedScenarioIds: readonly string[];

  setActiveProfile: (profileId: string | null) => void;
  setActiveScenario: (scenarioId: string | null) => void;
  /** Expand a row, or collapse it if the same row is toggled again (D-03 inline expand). */
  toggleExpanded: (scenarioId: string) => void;
  setExpanded: (scenarioId: string | null) => void;
  setComparedScenarios: (scenarioIds: readonly string[]) => void;
}

export const useSelection = create<SelectionState>((set) => ({
  activeProfileId: null,
  activeScenarioId: null,
  expandedScenarioId: null,
  comparedScenarioIds: [],

  setActiveProfile: (profileId) => set({ activeProfileId: profileId }),
  setActiveScenario: (scenarioId) => set({ activeScenarioId: scenarioId }),
  toggleExpanded: (scenarioId) =>
    set((state) => ({
      expandedScenarioId: state.expandedScenarioId === scenarioId ? null : scenarioId,
    })),
  setExpanded: (scenarioId) => set({ expandedScenarioId: scenarioId }),
  setComparedScenarios: (scenarioIds) => set({ comparedScenarioIds: scenarioIds }),
}));
