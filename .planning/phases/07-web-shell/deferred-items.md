# Phase 07 — Deferred Items

Out-of-scope discoveries logged during execution (not fixed — they predate the current task and are
outside its scope per the executor SCOPE BOUNDARY rule).

## From plan 07-04 (2026-06-28)

- **Pre-existing `tsc --noEmit` errors in two 07-03 test files** (surfaced only by a direct
  `npx tsc --noEmit -p apps/web/tsconfig.json`, which is NOT a project verification gate — apps/web uses
  `noEmit` and Next owns the build; the plan gates are `eslint apps/web` + `vitest run apps/web`):
  - `apps/web/src/app/actions/scenarios.test.ts(80)` — `Object is possibly 'undefined'` on `dto.rows[0].isBaseline` (`noUncheckedIndexedAccess`).
  - `apps/web/src/lib/dto/scenario.test.ts(109)` — same `noUncheckedIndexedAccess` indexing pattern.
  - These are in plan 07-03's files, not caused by 07-04. Trivial fixes (a guard or non-null assertion on the indexed access). Left for a 07-03 follow-up or a phase-wide typecheck-gate decision.

## From plan 07-06 (2026-06-28)

- **Same two pre-existing 07-03 `tsc` errors re-confirmed.** 07-06's acceptance gate runs
  `npx tsc -p apps/web/tsconfig.json --noEmit`, which still exits 1 solely because of the two
  07-03 test-file errors above. The 07-06 store files (`working-set.ts`, `selection.ts`,
  `recompute.ts`) contribute ZERO type errors (`grep "store/"` finds none in the tsc output) and
  `npx eslint apps/web/src/store` exits 0. Still out of scope (07-06 is directed to touch
  `apps/web/src/store/*` only; prior-plan files are locked).
