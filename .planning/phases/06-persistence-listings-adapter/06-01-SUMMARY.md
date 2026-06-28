---
phase: 06-persistence-listings-adapter
plan: 01
subsystem: api
tags: [zod, typescript, ports, dependency-inversion, persistence, listings, decimal-string]

# Dependency graph
requires:
  - phase: 03-affordability
    provides: "Household interface + HouseholdSchema/parseHousehold (the nine-leaf money/rate trust boundary reused verbatim by Profile)"
  - phase: 01-foundation
    provides: "EngineInput snapshot unit + decStr canonical-decimal boundary (embedded frozen in SavedScenario)"
provides:
  - "ProfileRepository + ScenarioRepository pure synchronous ports (ports/repositories.ts)"
  - "ListingsProvider + ListingsQuery pure synchronous port (ports/listings.ts) — LIST-01 satisfied"
  - "Profile interface + ProfileSchema + parseProfile (nine-leaf, extends HouseholdSchema)"
  - "Listing interface + ListingSchema + parseListing (Boston-home, decStr money)"
  - "SavedScenario (frozen EngineInput snapshot) + SavedScenarioMeta thin projection"
  - "Barrel exports for all Phase-6 contracts from @house/core"
  - "persistence.type-test.ts pinning no-bare-number money + synchronous ports in the tsc -b graph"
affects: [06-02, 06-03, 06-04, 06-05, 06-06, persistence-adapters, scenario-service, mock-listings-provider]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Ports-and-adapters: core defines pure synchronous interfaces; app supplies concrete impls (D-02 dependency inversion)"
    - "Persisted domain type = extend the existing Zod boundary schema, never author a parallel money validator (Profile extends HouseholdSchema)"
    - "Frozen self-contained snapshot embedded in the saved record (SavedScenario.input: EngineInput) — reproducibility never re-joins the live profile (PROF-04)"

key-files:
  created:
    - packages/core/src/types/profile.ts
    - packages/core/src/types/listing.ts
    - packages/core/src/types/saved-scenario.ts
    - packages/core/src/ports/repositories.ts
    - packages/core/src/ports/listings.ts
    - packages/core/src/types/persistence.type-test.ts
    - packages/core/src/types/profile.test.ts
    - packages/core/src/types/listing.test.ts
  modified:
    - packages/core/src/index.ts

key-decisions:
  - "Profile = { id, name } & Household, modeled by ProfileSchema = HouseholdSchema.extend({id,name}).strict() — reuses the nine-leaf validators verbatim; PROF-01 net worth IS availableNetWorth (no separate net-worth leaf)"
  - "SavedScenario is type-only (no Zod): the embedded EngineInput is re-validated on load by the SAME parsers it was assembled with (parseAssumptionSet/parseScenarioInputs/parseHousehold via engineInput) — duplicating Zod here would risk a divergent boundary"
  - "Listing.propertyType is a closed enum (single-family/condo/multi-family/townhouse), not a free string — a forged type is rejected and downstream UI can switch exhaustively"
  - "All ports synchronous (D-08): the SQLite driver is synchronous, so async signatures would be cosmetic"

patterns-established:
  - "Port purity: ports/*.ts contain ONLY interface declarations — zero framework/ORM imports, enforced by boundaries/external"
  - "No-bare-number money pinned at the type level via *.type-test.ts in the tsc -b graph (esbuild/Vitest ignore @ts-expect-error)"

requirements-completed: [PROF-01, PROF-02, PROF-03, LIST-01]

# Metrics
duration: 6min
completed: 2026-06-28
---

# Phase 6 Plan 01: Phase-6 Contracts (Ports + Domain Types) Summary

**Pure inward-facing Phase-6 contracts in `packages/core`: `Profile` (nine-leaf, extends `HouseholdSchema`), `Listing` (Boston-home, decStr money), `SavedScenario` (frozen `EngineInput` snapshot), and the synchronous `ProfileRepository`/`ScenarioRepository`/`ListingsProvider` ports — every dollar a canonical decimal string behind a Zod `.strict()` boundary, zero framework deps added to core.**

## Performance

- **Duration:** 6 min
- **Started:** 2026-06-28T02:38:48Z
- **Completed:** 2026-06-28T02:44:06Z
- **Tasks:** 3
- **Files modified:** 9 (8 created, 1 modified)

## Accomplishments
- `Profile` modeled as `{ id, name } & Household` via `HouseholdSchema.extend(...).strict()` — reuses the existing nine-leaf money/rate validators verbatim; `parseProfile` is the only loader (mirrors `parseHousehold`, no bare cast). PROF-01 "net worth" maps to `availableNetWorth` (no separate leaf).
- `Listing` mirrors the `ScenarioInputs` triad: `listPrice`/`baths` are `decStr` (never `z.number()`), counts are positive ints, `propertyType` a closed enum, `.strict()` closes the object; `parseListing` is the listings trust boundary.
- `SavedScenario` embeds a FROZEN `EngineInput` snapshot (type-only) with `SavedScenarioMeta` as the thin `listByProfile` projection (D-06).
- `ProfileRepository`/`ScenarioRepository`/`ListingsProvider` defined as pure SYNCHRONOUS interfaces (D-08) with zero framework/ORM imports (D-02); LIST-01 satisfied.
- Barrel re-exports all contracts from `@house/core`; `persistence.type-test.ts` pins no-bare-number money + synchronous ports as a `tsc -b` guarantee. Core suite 426 green (up from 399), goldens byte-identical.

## Task Commits

Each task was committed atomically (TDD tasks have test → feat commits):

1. **Task 1: Profile + SavedScenario types** — `bbe032c` (test, RED) → `a1d7a7f` (feat, GREEN)
2. **Task 2: Listing + repository/listings ports** — `7ade6b4` (test, RED) → `2f90863` (feat, GREEN)
3. **Task 3: Barrel exports + no-bare-number type-test** — `356837a` (feat)
4. **Source-grounding comment refinement** — `63d55fd` (docs)

## Files Created/Modified
- `packages/core/src/types/profile.ts` - `Profile` interface + `ProfileSchema` (extends `HouseholdSchema`) + `parseProfile`
- `packages/core/src/types/listing.ts` - `Listing` interface + `ListingSchema` + `parseListing` (Boston-home, decStr money, closed propertyType enum)
- `packages/core/src/types/saved-scenario.ts` - `SavedScenario` (frozen `EngineInput` snapshot) + `SavedScenarioMeta` (type-only)
- `packages/core/src/ports/repositories.ts` - `ProfileRepository` + `ScenarioRepository` pure sync interfaces
- `packages/core/src/ports/listings.ts` - `ListingsProvider` + `ListingsQuery` pure sync interfaces
- `packages/core/src/types/persistence.type-test.ts` - type-level no-bare-number + sync-port guard (tsc -b graph)
- `packages/core/src/types/profile.test.ts` - parseProfile runtime boundary tests (13)
- `packages/core/src/types/listing.test.ts` - parseListing runtime boundary tests (12)
- `packages/core/src/index.ts` - appended the Phase-6 contracts export block

## Decisions Made
- **Profile reuses `HouseholdSchema` via `.extend(...).strict()`** rather than a parallel money schema — guarantees the nine leaves validate identically to the affordability solvers' input and cannot drift. PROF-01 net worth IS `availableNetWorth`.
- **`SavedScenario` is type-only (no Zod)** — the embedded `EngineInput` is re-validated on load by the same parsers it was assembled with; a second Zod schema here would risk a divergent boundary.
- **`Listing.propertyType` is a closed enum**, not a free string (discretion within D-09) — rejects forged types and enables exhaustive downstream switching.
- **All ports synchronous (D-08)** — the SQLite driver is synchronous; async would be cosmetic ceremony.

## Deviations from Plan

None - plan executed exactly as written. (One follow-up housekeeping commit, `63d55fd`, reworded a few explanatory comments so the plan's grep-based source-grounding assertions — `netWorth`/`Promise<`/`class `/ORM-name return 0 hits — hold against the comments as well as the code. No behavior, type, or export changed.)

## Issues Encountered
None. RED→GREEN cycles passed first try for both TDD tasks; tsc, full Vitest suite (426 tests), and ESLint all green.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- The Wave-2/3 adapters (06-03..06-06: `SqliteProfileRepository`, `SqliteScenarioRepository`, in-memory fakes, `MockListingsProvider`) and the `packages/app` shell can now be written against the locked, exported contracts in `@house/core` — interface-first ordering satisfied.
- No blockers. Concrete classes, the drizzle schema, the DI container, and the save/load round-trip path (the `golden.test.ts` `roundTrip` promoted to production) are downstream plans.

---
*Phase: 06-persistence-listings-adapter*
*Completed: 2026-06-28*

## Self-Check: PASSED

All 7 created files verified present on disk; all 7 commits (bbe032c, a1d7a7f, 7ade6b4, 2f90863, 356837a, 63d55fd, 7cadd1b) verified in git history.
