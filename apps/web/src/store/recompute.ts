// Debounced, race-safe recompute coordinator for the live cockpit loop (D-08 / Pitfall 6).
//
// Editing an assumption knob should re-fly the instruments immediately, but a burst of edits must
// NOT spawn a storm of overlapping recomputes, and a slow earlier response must NOT overwrite a
// fresher one. Two mechanisms enforce that:
//   1. Debounce (~300ms, D-08): rapid `requestRecompute` calls inside the window coalesce to ONE
//      issued request — the work fires once, after the user pauses.
//   2. Latest-wins monotonic request id (Pitfall 6 / T-7-09): every issued recompute gets the next
//      id; `settle` applies a resolved result ONLY if its id is still the most recent. An
//      out-of-order (stale) resolution is discarded.
//
// The actual recompute call is INJECTED (`requestRecompute(fn)`), so this coordinator is
// engine-agnostic and unit-testable without a server: the cockpit passes a thunk that invokes the
// `recompareAction`/`trajectoryAction` Server Actions; tests pass a controllable promise. This
// store holds only ephemeral coordination state — no persistence, no Money, no financial math.
import { create } from 'zustand';
import type { StoreApi, UseBoundStore } from 'zustand';

/** Debounce window for the live recompute loop (D-08). */
export const DEBOUNCE_MS = 300;

export interface RecomputeState<T = unknown> {
  /** Monotonic id of the most recently ISSUED recompute (bumped once per debounced flush). */
  readonly requestId: number;
  /** True while an issued recompute is in flight (cleared when its result settles). */
  readonly pending: boolean;
  /** The most recently settled result, or null before the first recompute settles. */
  readonly result: T | null;
  /**
   * Schedule a recompute. Coalesces with any other call inside the debounce window; only the
   * latest `fn` survives the window and is invoked once when it elapses.
   */
  requestRecompute: (fn: () => Promise<T>) => void;
  /**
   * Apply a resolved result — but ONLY if `resultId` is still the latest issued `requestId`.
   * A stale (out-of-order) resolution is dropped (latest-wins, Pitfall 6 / T-7-09).
   */
  settle: (resultId: number, result: T) => void;
}

/**
 * Build an isolated recompute store. Each instance owns its own debounce timer and pending thunk
 * (closure state, not React/global), so tests can spin up fresh coordinators without cross-talk.
 */
export function createRecomputeStore<T = unknown>(
  debounceMs: number = DEBOUNCE_MS,
): UseBoundStore<StoreApi<RecomputeState<T>>> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let pendingFn: (() => Promise<T>) | undefined;

  return create<RecomputeState<T>>((set, get) => ({
    requestId: 0,
    pending: false,
    result: null,

    requestRecompute: (fn) => {
      // Keep only the latest thunk; restart the window. A burst thus collapses to one flush.
      pendingFn = fn;
      if (timer !== undefined) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = undefined;
        const fnToRun = pendingFn;
        pendingFn = undefined;
        if (fnToRun === undefined) return;
        // Bump the monotonic id at FLUSH time (not call time) so a coalesced burst yields ONE id.
        const id = get().requestId + 1;
        set({ requestId: id, pending: true });
        void fnToRun().then((result) => {
          get().settle(id, result);
        });
      }, debounceMs);
    },

    settle: (resultId, result) => {
      if (resultId !== get().requestId) return; // stale resolution — discard (latest-wins)
      set({ result, pending: false });
    },
  }));
}

/** The app-wide recompute coordinator instance for the cockpit live loop. */
export const useRecompute = createRecomputeStore();
