---
phase: 05-town-scoring-heatmap
plan: 01
subsystem: database
tags: [zod, decimal-string, town-scoring, seed-data, vitest]

# Dependency graph
requires:
  - phase: 02-tco-engine (data half)
    provides: townRowSchema + TOWN_RATE_TABLE (the canonical 24-town registry and its .strict()+decStr boundary)
  - phase: 01-foundations
    provides: decStr / CANONICAL_DECIMAL_RE canonical-decimal validator (assumptions/schema.ts)
provides:
  - Extended townRowSchema with optional stamped scoring metrics (medianPrice, school, commute, amenities) + curated MA-flag array
  - stampedMetric Zod schema and MetricStamp type (per-metric { value, asOf, source } stamp — D-02)
  - CommuteAnchor type (downtownBoston | kendallCambridge | route128Burlington — A8/D-04)
  - MaStoredFlag type (betterment | title5 | 40b — D-05; prop25 deliberately excluded)
  - 24 seeded rows carrying stamped metric values + curated flags, with two deliberate D-03 missing-data gaps
affects: [05-02 (heatmap UI consumes town metrics), 05-03 (scoring math reads these metrics), 05-04 (end-to-end engine)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Per-metric vintage/source stamping (stampedMetric = { value: decStr, asOf, source }.strict()) — D-02"
    - "Missing = absent key, never imputed (no default, no .nullable() on optional metrics) — D-03"
    - "stamp() literal-constructor helper keeps seed rows terse while forcing canonical-string values"

key-files:
  created: []
  modified:
    - packages/core/src/towns/town-table.schema.ts
    - packages/core/src/towns/town-table.ts
    - packages/core/src/towns/town-table.test.ts

key-decisions:
  - "Per-metric { value, asOf, source } stamp (RESEARCH Q1 recommendation), not a parallel per-row provenance block — each metric independently auditable; missing = absent key"
  - "prop25 is NOT a stored flag enum member — engine injects Prop 2½ universally (D-05)"
  - "Deliberate D-03 gaps placed at Winchester (omits medianPrice) and Weymouth (omits amenities.transit) to regression-pin no-impute behavior"

patterns-established:
  - "stampedMetric: reusable .strict() per-metric stamp reusing decStr — one definition of canonical-decimal across the row boundary"
  - "Optional scoring metrics with no default/nullable so an absent key is the only representation of missing (D-03)"

requirements-completed: [TOWN-01, TOWN-04]

# Metrics
duration: ~15min
completed: 2026-06-27
---

# Phase 5 Plan 01: Town-Scoring Seed Data + Schema Summary

**Extended the canonical 24-town greater-Boston table in place with per-metric vintage/source-stamped scoring data (median price, school, commute-by-anchor, amenity sub-metrics) and curated MA flags, all behind the existing `.strict()` + `decStr` Zod boundary, with two deliberate missing-data gaps proving D-03 (missing = absent, never imputed).**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-06-27T16:25Z (approx)
- **Completed:** 2026-06-27T16:31Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments
- Added a reusable `stampedMetric` Zod schema (`{ value: decStr, asOf, source }.strict()`) and exported `MetricStamp`, `CommuteAnchor`, and `MaStoredFlag` types — D-02 per-metric stamping is now enforced at the boundary.
- Extended `townRowSchema` with optional `medianPrice`/`school`/`commute`/`amenities`/`flags`; `prop25` is deliberately absent from the flag enum (engine-injected per D-05). `TOWN_RATE_TABLE` stays the single canonical registry (`readonly TownRateRow[]`).
- Seeded all 24 rows with plausible greater-Boston hand-seeded estimates (A9) and curated betterment/title5/40b flags, with `Winchester` omitting `medianPrice` and `Weymouth` omitting `amenities.transit` as deliberate D-03 gaps.
- Pinned the extension with new tests: canonical-string/int stamp asserts, `undefined` missing-data proofs, flag-enum membership (no prop25), and `.strict()`/`decStr` rejection cases (T-05-01/02/03). Full core suite green: 362/362.

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend townRowSchema with stamped metrics, commute-anchor map, MA-flag enum** - `01e5b1a` (feat)
2. **Task 2: Seed the 24 rows with stamped metric values + curated flags** - `1b5526c` (feat)
3. **Task 3: Extend town-table.test.ts for new metrics, missing-data, and flags** - `381570f` (test)

## Files Created/Modified
- `packages/core/src/towns/town-table.schema.ts` - Added `stampedMetric` + `MetricStamp`/`CommuteAnchor`/`MaStoredFlag` exports; extended `townRowSchema` with optional `medianPrice`/`school`/`commute`/`amenities`/`flags`.
- `packages/core/src/towns/town-table.ts` - Added `stamp()` helper; extended all 24 rows in place with stamped metrics + curated flags; documented `[ASSUMED]` A9 seeds and the two deliberate D-03 gaps in the header.
- `packages/core/src/towns/town-table.test.ts` - Added stamp-string/int asserts, missing-data `undefined` proofs, flag-enum (no prop25) asserts, and `.strict()`/`decStr`/bare-number rejection tests.

## Decisions Made
- Used a small local `stamp(value, asOf=2025, source='hand-seeded estimate')` constructor in the data file to keep 24 verbose rows readable while guaranteeing every `value` is a canonical decimal **string** (never a bare JS number). Pure, no ambient state — determinism guard unaffected.
- Placed the deliberate D-03 medianPrice gap at `Winchester` (not `Woburn` as the plan illustratively suggested) — the plan left town choice to discretion ("pick one town"); header comment and tests both reference Winchester consistently.
- School stamps carry `asOf: 2024` while price/commute/amenity stamps carry `asOf: 2025`, exercising per-metric independent vintage (D-02) rather than a single row-level stamp.

## Deviations from Plan

None - plan executed exactly as written. (The Winchester-vs-Woburn gap placement is a discretion choice the plan explicitly delegated, not a deviation.)

## Issues Encountered
None.

## Known Stubs
None - all seeded values are intentional hand-seeded estimates (A9), explicitly labeled in the file header and threat-accepted (T-05-04). The two missing-data gaps (Winchester medianPrice, Weymouth amenities.transit) are deliberate D-03 demonstrations, not unwired stubs.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- The 24-town canonical table now exposes the raw scoring metrics (median price, school, commute-by-anchor, amenity sub-metrics) and curated MA flags that Plan 05-03 (scoring math) and Plan 05-04 (end-to-end engine) consume.
- Missing-data handling is provably honest (absent, never zero) at the data layer — downstream scoring must continue to treat absent metrics as missing, not as 0.
- `prop25` is intentionally not stored; the scoring/flag engine must inject Prop 2½ universally (D-05).

---
*Phase: 05-town-scoring-heatmap*
*Completed: 2026-06-27*
