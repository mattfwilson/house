---
phase: 07-web-shell
plan: 02
subsystem: api
tags: [fi, trajectory, decimal, money, core-engine, recharts-data]

# Dependency graph
requires:
  - phase: 04-fi-impact
    provides: projectFiDate month-by-month loop, fiImpact buy/renter path bundles, fiTargets, buyEquityAt equity-year convention
  - phase: 01-foundation
    provides: Money closed API, Dec frozen clone, canonicalJson finiteness serializer, EngineInput trust boundary
provides:
  - "fiTrajectory(input): FiTrajectoryResult — pure month-by-month net-worth series for the buy path AND the keep-renting baseline"
  - "FiTrajectoryResult closed type (points[] with Money NW, fiThreshold Money, buyFiMonth/rentFiMonth number|null)"
  - "Shared buildFiPaths builder (fi/fi-paths.ts) — the single source of the two PathBundles, consumed by both fiImpact and fiTrajectory"
affects: [07-web-shell cockpit D-07 trajectory chart, charts/TrajectoryChart, lib/dto trajectory mapper, app/page.tsx]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Series-emitting sibling of a scalar engine entry: reuse the same path bundles + locked loop + comparisonNw so the series and the crossing agree by construction"
    - "Shared path-bundle builder (buildFiPaths) extracted so two callers cannot drift the seed/premium/equity math"

key-files:
  created:
    - packages/core/src/fi/fi-trajectory.ts
    - packages/core/src/fi/fi-trajectory.test.ts
    - packages/core/src/fi/fi-paths.ts
  modified:
    - packages/core/src/fi/fi-impact.ts
    - packages/core/src/fi/projection.ts
    - packages/core/src/index.ts

key-decisions:
  - "Extracted buyPath/renterBaselinePath into a shared buildFiPaths (fi/fi-paths.ts) so fiImpact and fiTrajectory build the EXACT same PathBundles — reconciliation by construction, not by parallel re-derivation"
  - "Year-sampled the emitted series (month 0 + every 12th month through the cap) for chart weight, while computing buyFiMonth/rentFiMonth in the FULL monthly loop so the crossover markers stay exact regardless of stride"
  - "Plotted the buy path's COMPARISON NW (liquid + liquidated equity, via the shared comparisonNw) so the series value and the owner-target crossing align; rent plots liquid-only"
  - "Exported comparisonNw from projection.ts (module-level, NOT barrel) so the trajectory crosses against the identical comparison logic projectFiDate uses"
  - "fiThreshold = the owner FI target (the D-07 threshold line); buildFiPaths/PathBundle stay unexported (internal Dec) — only the closed FiTrajectoryResult crosses the barrel"

patterns-established:
  - "Agree-by-construction: a new series entry reuses the existing scalar entry's bundles + loop + comparison, never re-derives trajectory math (CORE-01/02; no financial logic in the web shell)"
  - "Pure code-move extraction validated byte-identical against committed goldens (no UPDATE_GOLDEN regen)"

requirements-completed: [SC-2]

# Metrics
duration: 6min
completed: 2026-06-28
---

# Phase 7 Plan 02: fiTrajectory Net-Worth Series Summary

**Surfaced the month-by-month net-worth series the FI engine already computed but discarded — a pure `fiTrajectory` core entry that emits the buy-path and keep-renting-baseline trajectories for the D-07 hero chart, reconciling with `projectFiDate` by construction via a shared path-bundle builder.**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-06-28T14:47:00Z
- **Completed:** 2026-06-28T14:53:00Z
- **Tasks:** 3 completed
- **Files modified:** 6 (3 created, 3 modified)

## Accomplishments
- Added `fiTrajectory(input): FiTrajectoryResult` to `@house/core` — a pure, deterministic month-by-month net-worth series for BOTH paths plus the owner-target threshold line and the two exact FI-crossover markers.
- Extracted the buy/renter `PathBundle` construction into a shared `buildFiPaths` (fi/fi-paths.ts) consumed by BOTH `fiImpact` and `fiTrajectory`, so the series and the scalar FI date cannot drift — reconciliation is by construction, not by parallel re-derivation.
- Reused the locked contribute-then-compound loop and the exported `comparisonNw` so every emitted point and crossing matches `projectFiDate` exactly; full suite 479 green, four goldens byte-identical (no `UPDATE_GOLDEN` regen).

## Task Commits

Each task was committed atomically:

1. **Task 1: RED — reconciliation + finiteness tests** - `6a6f945` (test)
2. **Task 2: GREEN — implement fiTrajectory via shared buildFiPaths** - `637cc88` (feat)
3. **Task 3: Barrel export + full-suite regression** - `cac8f2f` (feat)

_TDD plan: Task 1 RED → Task 2 GREEN. No refactor commit needed (the extraction landed inside the GREEN step, validated byte-identical against goldens)._

## Files Created/Modified
- `packages/core/src/fi/fi-trajectory.ts` (created) - `fiTrajectory` + closed `FiTrajectoryResult`; year-samples points, keeps crossings exact, dollars cross as `Money`.
- `packages/core/src/fi/fi-trajectory.test.ts` (created) - reconciliation (vs `fiImpact`/`projectFiDate`), finiteness/`canonicalJson`-safe + Money-only, threshold + anti-funnel unreachable series.
- `packages/core/src/fi/fi-paths.ts` (created) - shared `buildFiPaths` returning both `PathBundle`s + targets + horizon cap; houses the extracted `buyUpfront`/`grownRentAt`/`buyEquityAt`/`buyPath`/`renterBaselinePath`.
- `packages/core/src/fi/fi-impact.ts` (modified) - now consumes `buildFiPaths` (pure extraction); re-exports `buyEquityAt` for the existing convention pin.
- `packages/core/src/fi/projection.ts` (modified) - exported `comparisonNw` (module-level, not barrel) so the series crosses against identical logic.
- `packages/core/src/index.ts` (modified) - barrel-exports `fiTrajectory` + `FiTrajectoryResult` in the FI engine block.

## Decisions Made
- **Shared `buildFiPaths` over duplicated wiring:** rather than re-export `buyPath`/`renterBaselinePath` and re-wire `computeTco`/`fiTargets`/`factor`/`monthlySavings`/`maxHorizonMonths` in two places, a single builder returns both bundles. This makes "reconcile by construction" structural — the two callers literally share the seed/premium/equity math.
- **Year-sampled series, exact crossings:** the chart needs ~30–60 points, not 720; crossover months are still computed in the full monthly loop so markers are exact even between sampled points.
- **Plot comparison NW (liquid + liquidated equity) for buy:** matches the value that crosses the owner target, so the line and the marker visually agree.

## Deviations from Plan

None - plan executed exactly as written. The plan explicitly anticipated promoting the path builders into a shared helper ("factor the shared builders into a helper imported by both") and that the helper not be re-exported from the barrel — both honored.

---

**Total deviations:** 0
**Impact on plan:** Plan executed as written; the shared-helper extraction was a sanctioned option in the plan, not unplanned scope.

## Issues Encountered
None. The `fi-impact.ts` refactor was a pure code move; the four committed goldens stayed byte-identical (verified via `npm test` with no `UPDATE_GOLDEN`), confirming zero computed-result change.

## Verification

- `npx vitest run packages/core -t "fiTrajectory"` — 4 tests green (reconciliation, finiteness, threshold + anti-funnel).
- `npm test` — full monorepo 479 passed (was 475; +4 new), four goldens byte-identical.
- `npm run typecheck` (`tsc -b`) — clean (type-test graph honored).
- `eslint` on all changed core files — clean (only pre-existing `boundaries/external` deprecation warnings).
- Reconciliation proven: `buyFiMonth`/`rentFiMonth` equal `projectFiDate` (via `fiImpact`) on the same input; `fiThreshold` equals `fiTargets(...).ownerTarget`; unreachable strained buy yields `buyFiMonth === null` with the series still emitting to the cap.

## Self-Check: PASSED
