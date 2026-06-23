// Runtime determinism guard (D-12, runtime half) — the belt to the lint suspenders.
//
// The ESLint rules (Plan 01-01) statically forbid `Date.now` / `Math.random` / `new Date`
// / env reads in `packages/core/src/**`. This guard is the RUNTIME safety net: a TEST-TIME
// ONLY mechanism that overwrites those ambient hazards so any core code that somehow reaches
// for them during a test fails loudly instead of silently introducing nondeterminism.
//
// IMPORTANT: do NOT call this from shipped library code paths — mutating globals at runtime
// is itself a side effect. It is installed only via the core Vitest setupFile (guard.setup.ts).
export function installDeterminismGuard(): void {
  const ban =
    (name: string) =>
    (): never => {
      throw new Error(`Nondeterminism in core: ${name} is forbidden (D-12).`);
    };

  // Replace the hazards the lint rule guards. Cast through the genuine signatures so the
  // assignment type-checks; the replacement always throws, so the return type is irrelevant.
  Date.now = ban('Date.now') as unknown as typeof Date.now;
  Math.random = ban('Math.random') as unknown as typeof Math.random;
}
