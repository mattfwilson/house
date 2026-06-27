---
phase: 05-town-scoring-heatmap
plan: 02
subsystem: database
tags: [zod, assumptions, versioning, discriminated-union, town-scoring, migrate]

# Dependency graph
requires:
  - phase: 04-fi-impact
    provides: AssumptionsV3 schema + v2ToV3 migrate chain + golden-master harness (the V→V+1 additive precedent reused verbatim)
provides:
  - AssumptionsV4 schema (verbatim V3 clone + townScoring group) as the current versioned AssumptionSet
  - DEFAULT_ASSUMPTIONS.townScoring seed block ([ASSUMED] weights, amenityWeights, fixed ranges, bucket.stretchFactor)
  - v3ToV4 migrate arm + V3Set type so every prior-version snapshot lifts to a complete V4
  - Phase-5 scoring tunables as first-class, versioned, snapshot-stable stored data (never hardcoded)
affects: [05-03 scoring composite, 05-04 heatmap/bucket overlay, town-table schema extension]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Strictly-additive version bump: append one group({}) slice, copy all prior leaves verbatim, prove zero coupling by running result goldens WITHOUT regeneration"
    - "Migrate chain composes through typed intermediates (V2Set→V3Set→CurrentAssumptionSet) so every case lands a COMPLETE current set"

key-files:
  created: []
  modified:
    - packages/core/src/assumptions/schema.ts
    - packages/core/src/assumptions/defaults.ts
    - packages/core/src/assumptions/migrate.ts
    - packages/core/src/assumptions/migrate.test.ts
    - packages/core/src/assumptions/schema.test.ts
    - packages/core/src/assumptions/assumption-set.test.ts
    - packages/core/src/engine/engine-input.test.ts
    - packages/core/src/index.ts

key-decisions:
  - "AssumptionsV4 is current (CURRENT_VERSION=4): a verbatim V3 clone + a townScoring group (weights/amenityWeights/fixed ranges/bucket.stretchFactor), every leaf a decStr — Phase-5 tunables as versioned stored data (ASMP-01/D-06/D-08/D-09)"
  - "townScoring [ASSUMED] defaults seeded from RESEARCH proposals: weights 0.30/0.25/0.20/0.15/0.10, amenityWeights 0.30/0.25/0.25/0.20, ranges (medianPrice 400k-2.5M, commute 10-75, school 1-10, millRate 4-16, amenity 0-100), stretchFactor 1.25"
  - "v3ToV4 seeds townScoring from DEFAULT_ASSUMPTIONS.townScoring (not inline literals); v2ToV3 now returns a V3Set intermediate so the 1→2→3→4 chain composes"
  - "The bump is provably non-coupling: the four existing result goldens stayed BYTE-IDENTICAL with no UPDATE_GOLDEN regeneration (verified by running the suite + git status)"

patterns-established:
  - "Pattern: additive schema version bump — new group is required on the current version + absent from all prior versions, seeded into older snapshots by the migrate arm from defaults"

requirements-completed: [TOWN-01, TOWN-02]

# Metrics
duration: ~10min
completed: 2026-06-27
---

# Phase 05 Plan 02: AssumptionsV4 — townScoring Block Summary

**Bumped the versioned AssumptionSet V3→V4 with a strictly-additive `townScoring` group (composite weights, amenity sub-weights, fixed normalization ranges, bucket stretchFactor) — every leaf a canonical decimal string — proving zero coupling by keeping all four result goldens byte-identical without regeneration.**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-06-27T16:29Z (approx)
- **Completed:** 2026-06-27T16:34Z (approx)
- **Tasks:** 3
- **Files modified:** 8

## Accomplishments
- `AssumptionsV4` added to `schema.ts`: a verbatim V3 clone plus a `townScoring` group with `weights`, `amenityWeights`, `ranges` (5 metrics × min/max), and `bucket.stretchFactor` — admitted by the discriminated union, consumed as `CurrentAssumptionSet`, exported from the `@house/core` barrel.
- `DEFAULT_ASSUMPTIONS` bumped to `schemaVersion: 4` with the `[ASSUMED]`-tagged townScoring seed values from the RESEARCH discretion proposals.
- `v3ToV4` migrate arm + `V3Set` type added; the switch extended so V1/V2/V3 each chain through to a COMPLETE V4 with townScoring seeded from defaults.
- Full test coverage: V3→V4 verbatim-copy migrate test, V1/V2 chained-completion tests, V4 schema parse/float-reject/strict-key/missing-slice tests, townScoring decimal-string leaf coverage.
- **The four result goldens (canary, tco, affordability, fi) stayed byte-identical** — confirmed by running the suite WITHOUT UPDATE_GOLDEN and by `git status` showing no `*-golden-snapshot.json` modification.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add AssumptionsV4 + townScoring group, bump union** - `d511c02` (feat)
2. **Task 2: Seed townScoring defaults + v3ToV4 migrate arm** - `7bd2d9a` (feat)
3. **Task 3: V3→V4 migrate test + V4 schema coverage; goldens byte-identical** - `0e31178` (test)

_Note: Tasks 1 and 2 are coupled for compilation (see Deviations) — `tsc -b` is green only once both are in place; both were verified together before committing._

## Files Created/Modified
- `packages/core/src/assumptions/schema.ts` - Added `AssumptionsV4` (V3 clone + townScoring group); extended union to `[V1,V2,V3,V4]`; `CURRENT_VERSION=4`; `AnyAssumptionSet`/`CurrentAssumptionSet` bumped.
- `packages/core/src/assumptions/defaults.ts` - `schemaVersion: 4` + `[ASSUMED]` townScoring seed block (canonical decimal strings).
- `packages/core/src/assumptions/migrate.ts` - `V3Set` type, `v3ToV4` (seeds townScoring from defaults), extended switch (1→2→3→4 chain), `v2ToV3` returns `V3Set`.
- `packages/core/src/index.ts` - Export `AssumptionsV4` from the barrel.
- `packages/core/src/assumptions/migrate.test.ts` - `V3_FIXTURE`→V4 test + V1/V2 chained-completion assertions.
- `packages/core/src/assumptions/schema.test.ts` - `CURRENT_VERSION===4`, townScoring parse/float-reject/strict/missing tests, millRateOverride narrowing → V4.
- `packages/core/src/assumptions/assumption-set.test.ts` - townScoring group + decimal-string leaf coverage; version expectations → 4.
- `packages/core/src/engine/engine-input.test.ts` - `schemaVersion` expectation bumped to 4 (in-scope side effect of the DEFAULT_ASSUMPTIONS bump).

## Decisions Made
- **townScoring seeded from defaults in v3ToV4 (not inline literals)** — keeps one source of truth for the [ASSUMED] tunables, matching the v2ToV3 precedent.
- **v2ToV3 return type changed to `V3Set`** — V3 is no longer current, so the chain composes through a typed intermediate before `v3ToV4` lands the current shape.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Task 1 and Task 2 are coupled for compilation**
- **Found during:** Task 1 (schema bump)
- **Issue:** The plan verifies Task 1 with `tsc -b`, but once `CurrentAssumptionSet` becomes V4 (requiring `townScoring`), `defaults.ts` (`DEFAULT_ASSUMPTIONS: CurrentAssumptionSet`) and `migrate.ts` (`v2ToV3` returning `CurrentAssumptionSet`) no longer type-check until their Task 2 edits are applied. Task 1 cannot compile in isolation.
- **Fix:** Implemented both Task 1 and Task 2 source edits, ran `tsc -b` once (green) to verify the coupled change, then committed each task's files as separate atomic commits (`d511c02`, `7bd2d9a`). No source content changed relative to the plan — only the verification ordering.
- **Files modified:** (no extra files; same files the plan specifies)
- **Verification:** `tsc -b` exit 0; full suite 360 green.
- **Committed in:** `d511c02` / `7bd2d9a`

**2. [Rule 1 - Bug] engine-input.test.ts asserted schemaVersion 3**
- **Found during:** Task 3 (test extensions)
- **Issue:** `engine-input.test.ts:67` asserts `input.assumptions.schemaVersion).toBe(3)` against `DEFAULT_ASSUMPTIONS`, which is now V4 — a direct consequence of the additive bump. The file is outside the plan's listed files but the failure is directly caused by this plan's change.
- **Fix:** Bumped the assertion to `toBe(4)`.
- **Files modified:** `packages/core/src/engine/engine-input.test.ts`
- **Verification:** Full suite 360 green.
- **Committed in:** `0e31178` (Task 3 commit)

---

**Total deviations:** 2 (1 blocking-ordering, 1 directly-caused test fix)
**Impact on plan:** No scope creep. The version bump is strictly additive exactly as specified; both deviations are mechanical consequences of the coupled type graph. All four result goldens remained byte-identical.

## Issues Encountered
None — the additive bump followed the V2→V3 precedent cleanly.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Plan 05-03 (scoring composite) can read `input.assumptions.townScoring.weights`/`amenityWeights`/`ranges` as stored data (the `sensitivity` precedent).
- Plan 05-04 (bucket overlay) can read `input.assumptions.townScoring.bucket.stretchFactor`.
- The [ASSUMED] townScoring values are pending user confirmation (tagged in defaults.ts), consistent with the project's "assumptions as first-class data" posture.

---
*Phase: 05-town-scoring-heatmap*
*Completed: 2026-06-27*
