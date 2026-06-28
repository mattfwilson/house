// Race-safety + debounce proof for the live recompute coordinator (D-08 / Pitfall 6 / T-7-09).
// Uses fake timers to drive the ~300ms debounce window and manually-ordered deferred promises to
// force an out-of-order resolution (the earlier request resolving AFTER the later one).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRecomputeStore, DEBOUNCE_MS } from './recompute.js';

/** A promise whose resolution is controlled by the test (manual ordering of in-flight recomputes). */
function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

/** Flush the microtask queue so chained `.then(settle)` callbacks run. */
const flush = async (): Promise<void> => {
  await Promise.resolve();
  await Promise.resolve();
};

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
});

describe('recompute coordinator', () => {
  it('latest-wins: a stale earlier resolution (id N) is discarded when a newer one (id N+1) already settled', async () => {
    const store = createRecomputeStore<string>();
    const first = deferred<string>(); // id 1 — will resolve LATE
    const second = deferred<string>(); // id 2 — will resolve FIRST

    // First recompute -> flush the debounce -> issues request id 1, calls fn (still pending).
    store.getState().requestRecompute(() => first.promise);
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);
    expect(store.getState().requestId).toBe(1);

    // Second recompute -> flush -> issues request id 2, calls fn (still pending).
    store.getState().requestRecompute(() => second.promise);
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);
    expect(store.getState().requestId).toBe(2);

    // The LATER request (id 2) resolves FIRST and is applied.
    second.resolve('NEW');
    await flush();
    expect(store.getState().result).toBe('NEW');
    expect(store.getState().pending).toBe(false);

    // The EARLIER request (id 1) resolves AFTER — it is STALE and must be discarded.
    first.resolve('STALE');
    await flush();
    expect(store.getState().result).toBe('NEW'); // unchanged — stale result dropped
  });

  it('debounce: rapid requestRecompute calls inside the window coalesce to a single issued request id', async () => {
    const store = createRecomputeStore<string>();
    let calls = 0;
    const fn = (): Promise<string> => {
      calls += 1;
      return Promise.resolve('R');
    };

    // Three rapid calls, each separated by less than the debounce window.
    store.getState().requestRecompute(fn);
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS - 100);
    store.getState().requestRecompute(fn);
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS - 100);
    store.getState().requestRecompute(fn);

    // Still inside the window: nothing has fired yet.
    expect(store.getState().requestId).toBe(0);
    expect(calls).toBe(0);

    // Let the window elapse: exactly ONE flush -> ONE request id -> fn called once.
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);
    expect(store.getState().requestId).toBe(1);
    expect(calls).toBe(1);
  });
});
