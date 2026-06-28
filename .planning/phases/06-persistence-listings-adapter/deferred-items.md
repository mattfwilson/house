# Phase 06 — Deferred Items

Out-of-scope discoveries logged during execution (not fixed — they fall outside the current task's
changed files per the executor SCOPE BOUNDARY).

## Pre-existing repo-wide `eslint .` failures in `packages/core` test files

**Found during:** 06-06 Task 3 (running full `npm run lint` for the D-03 acceptance gate).

**Status:** Pre-existing — reproduced under the prior committed `eslint.config.ts` (HEAD before
06-06), so NOT introduced by this plan. Prior Phase-6 plans linted only their own new files, so
`eslint .` was never run to completion and these never surfaced.

**Errors (7, all `@typescript-eslint/no-unused-vars`):**
- `packages/core/src/tco/rent-vs-buy.test.ts:23` — `'computeTco' is defined but never used`
- `packages/core/src/types/persistence.type-test.ts:47,49,55,57,65,66` — unused `_q` / `_id` /
  `_p` type-test bindings

**Why deferred:** These are in `packages/core` test/type-test files, unrelated to the 06-06 D-03
boundary work (which touches only `packages/app/**` + an app-scoped `eslint.config.ts` override).
App code lints clean (`eslint "packages/app/src/**/*.ts"` → exit 0). Fixing core test hygiene is a
separate concern; likely a quick follow-up that prefixes the unused vars or removes the dead import.
