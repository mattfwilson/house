---
phase: 05-town-scoring-heatmap
plan: 04
subsystem: core-engine
tags: [town-scoring, scoreboard, composite, bucket, ma-flags, golden, type-test, decimal-string]

# Dependency graph
requires:
  - phase: 05-01 (town table)
    provides: TOWN_RATE_TABLE 24-row registry + stamped scoring metrics (medianPrice/school/commute-by-anchor/amenities) + curated MaStoredFlag array + CommuteAnchor type
  - phase: 05-02 (AssumptionsV4)
    provides: townScoring.{weights, amenityWeights, ranges{min,max}, bucket.stretchFactor} stored config + DEFAULT_ASSUMPTIONS.townScoring
  - phase: 05-03 (scoring math)
    provides: computeComposite + MetricContribution/MetricInput, bucketOf + Bucket, normalize + MetricDirection
  - phase: prior (money)
    provides: Money.of/toDecimalString — the budget param + median-price rawValue
provides:
  - scoreTowns(input) — the integrated Phase-5 engine entry: stored-config-driven per-town composite + breakdown + bucket(|null) + universal-plus-curated flags
  - TownScore / TownScoreboard / TownScoringInput interfaces + MaFlag output type
  - town-scoring-golden-snapshot.json reproducibility fixture (gated UPDATE_GOLDEN regen)
  - towns.type-test.ts compile-time no-bare-number score/dollar + no-sentinel-bucket guard
  - the public // Town scoring engine barrel block in index.ts
affects: [phase-07 (web shell renders the heatmap from this scoreboard without re-deriving financial logic)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Top-level engine entry reads ALL config off input.assumptions.townScoring (never hardcoded) and maps over the fixed 24-town table into a CLOSED readonly result — the fi/sensitivity precedent"
    - "Two-channel separation surfaced at the engine edge: composite (qualitative fit) and bucket (budget overlay) computed independently; flags appended as metadata, never touching either"
    - "Engine-injected universal flag (prop25 prepended) + curated row flags — prop25 never a stored value"

key-files:
  created:
    - packages/core/src/towns/score-towns.ts
    - packages/core/src/towns/score-towns.test.ts
    - packages/core/src/towns/towns.type-test.ts
    - packages/core/src/__fixtures__/town-scoring-golden-snapshot.json
  modified:
    - packages/core/src/golden.test.ts
    - packages/core/src/index.ts

key-decisions:
  - "scoreTowns emits a fixed metric order [millRate, medianPrice, commute, school, amenities] per town; amenities is the recursive sub-composite (walkability/transit/dining/parks) — the order is load-bearing for the golden and self-consistent with the committed fixture"
  - "budget is a caller-supplied Money param on TownScoringInput (D-11) — Town Scoring stays decoupled from the Affordability/FI chain; the scoreboard echoes budget/stretchFactor as decimal strings for display"
  - "missing median price -> bucket null (UI-SPEC hatched No-data); a missing commute anchor -> missing:true commute contribution (D-03/D-04, never imputed)"
  - "the town-scoring golden uses a fixed budget (750000) + anchor (downtownBoston); regenerated ONLY via gated UPDATE_GOLDEN=1, never toMatchSnapshot (T-05-SC)"

patterns-established:
  - "Engine-entry contract test pattern: matrix shape + anchor selectivity + flag rules + two-channel-separation (recompute composite/bucket independently of flags) + missing-data honesty + bucket split"

requirements-completed: [TOWN-01, TOWN-02, TOWN-03, TOWN-04]

# Metrics
duration: ~12min
completed: 2026-06-27
---

# Phase 5 Plan 04: Town-Scoring Engine (scoreTowns) Summary

**Wired the top-level `scoreTowns` engine entry that reads the stored `townScoring` weights/ranges/stretchFactor off AssumptionsV4, iterates the 24-town table, composes `computeComposite` + `bucketOf` per town, injects `prop25` universally plus the curated MA flags, and assembles the closed `TownScoreboard` satisfying the UI-SPEC heatmap contract — then pinned it three ways (end-to-end behavior test, compile-time no-bare-number type-test, gated reproducibility golden) and published the public barrel surface, keeping the four prior result goldens byte-identical.**

## Performance

- **Duration:** ~12 min
- **Completed:** 2026-06-27
- **Tasks:** 3
- **Files created:** 4; **modified:** 2

## Accomplishments
- `score-towns.ts` — `scoreTowns(input)` builds the five metric inputs per row (mill rate from the row; median price/school/commute-by-anchor/amenity sub-metrics from the stamped fields), reads `weights`/`amenityWeights`/`ranges`/`bucket.stretchFactor` off `input.assumptions.townScoring` (NO hardcoded literal), calls `computeComposite` + `bucketOf`, attaches `['prop25', ...curated]` flags, and returns the closed `TownScoreboard` (`anchor`/`budget`/`stretchFactor` + per-town `{ composite, metrics, bucket|null, flags }`). Output types all `readonly`; re-exports `Bucket`/`CommuteAnchor`/`MetricContribution`/`MetricDirection`.
- `score-towns.test.ts` (7 tests) — pins the matrix shape (all 24 towns, the five-metric order per town), anchor echo + anchor-selective commute rawValue (Woburn 32→15), prop25-universal + curated tags (Quincy/Dedham/Boston), two-channel separation (Quincy composite/bucket recomputed independently of flags), the missing-median-price town (Winchester → bucket null + `missing:true` medianPrice contribution), a present-anchor non-missing proof, and the realistic/stretch/fantasy split at $750k.
- `towns.type-test.ts` — compile-time `@ts-expect-error` + `void _x` guard proving `composite`/`normalizedValue`/`weightedContribution`/`weight` are decimal STRINGS (never bare number) and `bucket` is the `Bucket | null` enum (never a numeric sentinel). Not a `*.test.ts`, so it is in the `tsc -b` graph and excluded from Vitest.
- `golden.test.ts` + `town-scoring-golden-snapshot.json` — a gated `UPDATE_GOLDEN=1` golden block (mirroring the FI block) at a fixed budget ($750k) + anchor (downtownBoston); the scoreboard recomputes byte-identical against the committed fixture.
- `index.ts` — the `// Town scoring engine (Phase 5)` barrel block exports `scoreTowns` + the town-scoring types; `Dec` stays unexported (composite/contributions cross as decimal strings).
- Full core suite **399/399** green (incl. the new town-scoring golden block); `tsc -b` clean; **the four prior result goldens are byte-identical** (only `town-scoring-golden-snapshot.json` newly added).

## Task Commits

1. **Task 1: scoreTowns engine entry + end-to-end behavior test** — `232a243` (feat)
2. **Task 2: compile-time no-bare-number score/dollar guard** — `5a5c2e8` (test)
3. **Task 3: town-scoring reproducibility golden + barrel export** — `53542eb` (feat)

## Files Created/Modified
- `packages/core/src/towns/score-towns.ts` — `scoreTowns` + `TownScore`/`TownScoreboard`/`TownScoringInput`/`MaFlag` + re-exports; imports `computeComposite`/`bucketOf`/`Money`/`TOWN_RATE_TABLE`/`CurrentAssumptionSet`.
- `packages/core/src/towns/score-towns.test.ts` — the 7 end-to-end behavior tests.
- `packages/core/src/towns/towns.type-test.ts` — the compile-time result-shape guard.
- `packages/core/src/__fixtures__/town-scoring-golden-snapshot.json` — the committed reproducibility fixture.
- `packages/core/src/golden.test.ts` — `TOWN_SCORING_GOLDEN_PATH` + `canonicalTownScoreboard()` + the gated golden `describe` block.
- `packages/core/src/index.ts` — the Town-Scoring barrel export block.

## Decisions Made
- **Fixed metric order** `[millRate, medianPrice, commute, school, amenities]` per town — load-bearing for the golden's array ordering and self-consistent with the generated fixture. Amenities is the recursive sub-composite.
- **`budget: Money` as a caller-supplied param** on `TownScoringInput` (D-11) — Town Scoring stays decoupled from the Affordability/FI chain; the scoreboard echoes `budget`/`stretchFactor` as decimal strings for display.
- **`MetricDirection` re-exported from `./normalize.js`** (its definition site), not `./composite.js` (which only imports it as a type) — fixed a TS2459 during Task 1 (see Deviations).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `MetricDirection` re-export source**
- **Found during:** Task 1 (`tsc -b`)
- **Issue:** The plan's RESEARCH §Output Type suggested re-exporting `MetricDirection`; an initial `export type { MetricContribution, MetricDirection } from './composite.js'` failed `tsc -b` with TS2459 — `composite.ts` imports `MetricDirection` as a type from `./normalize.js` and does not re-export it.
- **Fix:** Re-export `MetricDirection` from its definition site `./normalize.js`; keep `MetricContribution` from `./composite.js`.
- **Files modified:** `packages/core/src/towns/score-towns.ts`
- **Verification:** `tsc -b` exit 0.
- **Committed in:** `232a243` (Task 1 commit)

**Golden regeneration note (not a deviation):** Running `UPDATE_GOLDEN=1` to generate the NEW fixture also re-wrote the four prior goldens in the working tree, but their content was byte-identical (the working-tree flag was a CRLF/LF artifact of `writeFileSync`). I restored the four prior fixtures via a per-file `git checkout --` so only the new `town-scoring-golden-snapshot.json` is added; a subsequent full suite run WITHOUT `UPDATE_GOLDEN` confirmed all four prior golden blocks green against their unchanged fixtures.

## Issues Encountered
None beyond the TS2459 above.

## Known Stubs
None — `scoreTowns` is fully wired over the seeded 24-town table and the stored AssumptionsV4 config. The two deliberate Plan 05-01 missing-data gaps (Winchester medianPrice, Weymouth amenities.transit) flow through as honest missing data (bucket null / `missing:true` contribution), not stubs.

## Threat Surface
No new surface beyond the plan's `<threat_model>`. All five mitigations are implemented and pinned:
- **T-05-13** (hardcoded weight/range) — `scoreTowns` reads only `input.assumptions.townScoring`; no literal weight/range/stretchFactor in `score-towns.ts` (source-verified).
- **T-05-14** (flags altering composite/bucket) — test (d) recomputes Quincy's composite/bucket independently of flags and asserts equality.
- **T-05-SC** (toMatchSnapshot auto-regen) — gated `UPDATE_GOLDEN=1` write only; four prior goldens confirmed byte-identical.
- **T-05-16** (bare Dec/number across the barrel) — `towns.type-test.ts` compile-time guard + `Dec` kept unexported in `index.ts` (grep-verified).
- **T-05-17** (NaN/Infinity crashing canonicalJson) — the golden serialized cleanly (composite math clamps + nulls; canonicalJson throws on non-finite as a backstop).

## User Setup Required
None — no external service configuration required. The `[ASSUMED]` townScoring tunables (Plan 05-02) and hand-seeded town metrics (Plan 05-01) remain pending user confirmation, consistent with the project's "assumptions as first-class data" posture.

## Next Phase Readiness
- Phase 7 (Web Shell) can render the heatmap directly from `scoreTowns(...)`: the towns×metrics matrix, the per-metric explainable breakdown (tooltip/expander), the `bucket` enum → palette mapping, the universal-plus-curated MA-flag chips, and the echoed `anchor` for the generic "commute to anchor" label — no financial logic re-derived in the UI.
- The scoreboard is reproducible (byte-identical golden, gated regen) and published on the public `@house/core` barrel.

## Self-Check: PASSED

- All 4 created files + 2 modified files exist on disk.
- All three task commits (`232a243`, `5a5c2e8`, `53542eb`) present in git history.
- `tsc -b` clean; full core suite 399/399 green; the four prior result goldens byte-identical (only `town-scoring-golden-snapshot.json` added).

---
*Phase: 05-town-scoring-heatmap*
*Completed: 2026-06-27*
