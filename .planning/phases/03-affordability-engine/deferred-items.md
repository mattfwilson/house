# Deferred Items — Phase 03 (affordability-engine)

Out-of-scope discoveries logged during execution. NOT fixed by the executor (per the SCOPE
BOUNDARY rule — only issues directly caused by the current plan's changes are auto-fixed).

| Discovered In | Item | File | Notes |
|---------------|------|------|-------|
| 03-04 Task 3 | Pre-existing ESLint error: `'computeTco' is defined but never used` (`@typescript-eslint/no-unused-vars`) | `packages/core/src/tco/rent-vs-buy.test.ts:23` | Pre-existing from a Phase 2 quick task (commit d4d0ac2), unmodified by Plan 03-04. `npm run lint` fails on this single error; the rest of the repo lints clean. Remove the unused `computeTco` import in a follow-up quick task. |
