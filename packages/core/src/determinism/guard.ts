// Runtime determinism guard (D-12/D-13, runtime half) — the belt to the lint suspenders.
//
// The ESLint rules (Plan 01-01) statically forbid `Date.now` / `Math.random` / `new Date`
// / `performance.now` / `crypto` / env reads in `packages/core/src/**`. This guard is the
// RUNTIME safety net: a TEST-TIME ONLY mechanism that overwrites those ambient hazards so
// any core code that somehow reaches for them during a test fails loudly instead of
// silently introducing nondeterminism. It is the runtime parity for the lint rules —
// every clock/entropy door the lint layer bans is also poisoned here.
//
// Coverage (mirrors WR-02/WR-03):
//   - Date.now()                  -> throws
//   - Math.random()               -> throws
//   - new Date()       (zero-arg clock read) -> throws
//   - new Date(arg)    (explicit, deterministic) -> ALLOWED (preserved via Proxy)
//   - performance.now()           -> throws (if `performance` exists in the env)
//   - crypto.getRandomValues(...) -> throws (if `crypto` exists in the env)
//
// IMPORTANT: do NOT call this from shipped library code paths — mutating globals at runtime
// is itself a side effect. It is installed only via the core Vitest setupFile (guard.setup.ts).
// It is reversible: callers that need the genuine globals back (guard.test.ts) save and
// restore them around an explicit install.
export function installDeterminismGuard(): void {
  const ban =
    (name: string) =>
    (): never => {
      throw new Error(`Nondeterminism in core: ${name} is forbidden (D-12).`);
    };

  // Date.now / Math.random — direct overrides.
  Date.now = ban('Date.now') as unknown as typeof Date.now;
  Math.random = ban('Math.random') as unknown as typeof Math.random;

  // new Date() — the zero-arg form is a clock read and is forbidden (D-13). Construction
  // from an explicit argument (`new Date(ms)`, `new Date(iso)`) is deterministic and stays
  // allowed. A Proxy preserves static members (Date.now is separately banned above) and the
  // prototype chain, so `instanceof Date` and existing Date instances are unaffected.
  const OriginalDate = globalThis.Date;
  globalThis.Date = new Proxy(OriginalDate, {
    construct(target, args, newTarget) {
      if (args.length === 0) {
        throw new Error('Nondeterminism in core: new Date() (clock read) is forbidden (D-13).');
      }
      return Reflect.construct(target, args, newTarget);
    },
  }) as DateConstructor;

  // performance.now() — high-resolution clock; poison it if the host exposes `performance`.
  const perf = (globalThis as { performance?: { now?: unknown } }).performance;
  if (perf && typeof perf.now === 'function') {
    perf.now = ban('performance.now') as unknown as typeof perf.now;
  }

  // crypto.getRandomValues() — ambient entropy; poison it if the host exposes `crypto`.
  const cryptoObj = (globalThis as { crypto?: { getRandomValues?: unknown } }).crypto;
  if (cryptoObj && typeof cryptoObj.getRandomValues === 'function') {
    cryptoObj.getRandomValues = ban(
      'crypto.getRandomValues',
    ) as unknown as typeof cryptoObj.getRandomValues;
  }
}
