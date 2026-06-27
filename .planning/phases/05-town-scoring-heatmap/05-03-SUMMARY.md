---
phase: 05-town-scoring-heatmap
plan: 03
subsystem: core-engine
tags: [decimal-string, town-scoring, normalize, composite, bucket, tdd, vitest]

# Dependency graph
requires:
  - phase: 05-01 (town table)
    provides: townRowSchema stamped scoring metrics (medianPrice/school/commute/amenities) — the raw metric field shapes normalize/composite consume
  - phase: 05-02 (AssumptionsV4)
    provides: townScoring.weights / amenityWeights / ranges {min,max} / bucket.stretchFactor — the stored range/weight strings the scoring math reads
  - phase: prior (money)
    provides: Dec clone (money/decimal-config), Money.toCents()/mul() — the float-free arithmetic + dollar-compare primitives
provides:
  - normalize(raw,min,max,dir) + MetricDirection — fixed-range, direction-folded, clamped [0,1] decimal-string scaling
  - computeComposite(inputs) + MetricContribution / MetricInput / MetricRange / CompositeResult — explainable per-metric breakdown + missing-weight renormalization (recursive amenities sub-composite)
  - bucketOf(medianPrice,budget,stretchFactor) + Bucket — realistic/stretch/fantasy budget overlay via integer-cent compare
affects: [05-04 (end-to-end scoreTowns engine wires these three into the seeded table + AssumptionsV4)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Dimensionless score as a canonical decimal STRING (never Money, never bare number) — Money reserved for dollars only"
    - "Missing-metric drop + present-weight renormalization (Σ weight_m / Σpresent), composite null (never 0) for data-less edges — D-03/D-10"
    - "Two-channel separation: bucket is budget-only and never reads the composite (D-12)"
    - "Recursive sub-composite (amenities) reuses the exact top-level renormalization rule"

key-files:
  created:
    - packages/core/src/towns/normalize.ts
    - packages/core/src/towns/normalize.test.ts
    - packages/core/src/towns/composite.ts
    - packages/core/src/towns/composite.test.ts
    - packages/core/src/towns/bucket.ts
    - packages/core/src/towns/bucket.test.ts
  modified: []

key-decisions:
  - "computeComposite takes a recursive MetricInput[] (each: metric/rawValue|null/direction/range/weight + optional subMetrics); amenities is modeled as a composite metric whose normalizedValue IS the renormalized sub-composite"
  - "Composite accumulates the ROUNDED weightedContribution strings, so present weightedContributions sum EXACTLY (Dec equality) to the composite — a regression-pinned invariant"
  - "Both data-less edges (all metrics missing AND Σpresent==0) return composite null with the breakdown still fully itemized — never 0, never NaN (T-05-10/T-05-12)"
  - "bucket lower boundaries inclusive (≤); missing-price handling deferred to the 05-04 caller (bucketOf always takes a present Money)"

patterns-established:
  - "normalize direction map documented in-source for 05-04's caller: medianPrice/commute/millRate = lowerBetter; school/amenities(+sub-metrics) = higherBetter"

requirements-completed: [TOWN-01, TOWN-02, TOWN-03]

# Metrics
duration: ~12min
completed: 2026-06-27
---

# Phase 5 Plan 03: Town-Scoring Math Core (normalize / composite / bucket) Summary

**Built the three pure, test-first scoring-math modules — `normalize` (fixed-range, direction-folded, clamped [0,1] scaling), `composite` (explainable per-metric breakdown + missing-metric weight renormalization with recursive amenities sub-composite), and `bucket` (the separate budget overlay) — all in the frozen `Dec` clone, emitting dimensionless decimal STRINGS and comparing dollars via `Money.toCents()` bigints, never a bare `number`.**

## Performance

- **Duration:** ~12 min
- **Completed:** 2026-06-27
- **Tasks:** 3 (all TDD: RED test → GREEN implementation)
- **Files created:** 6

## Accomplishments
- `normalize.ts` — scales a metric to a `[0,1]` decimal string against a FIXED reference range (D-09, not min-max over the live set), folds direction so higher=better universally, clamps to `[0,1]` (Pitfall 14), and THROWS on a degenerate `max<=min` range (T-05-09 — no `/0` Infinity/NaN). Exact-string asserts pin the 34-sig-digit HALF_EVEN output.
- `composite.ts` — `computeComposite` builds the itemized breakdown `{ rawValue, normalizedValue, direction, weight, weightedContribution, missing }`, drops missing metrics WITHOUT imputing (D-03), renormalizes present weights (`weight_m / Σpresent`), and sums to a dimensionless composite STRING. Amenities is a recursive sub-composite. Both data-less edges (all-missing, Σpresent==0) yield composite `null` (never 0 — T-05-10/T-05-12).
- `bucket.ts` — `bucketOf` buckets a town's median price against budget + `budget×stretchFactor` into the three locked enum values via EXACT `Money.toCents()` bigint comparison (Pitfall 6), inclusive `≤` boundaries, independent of the composite (D-12).
- Worked-example composite asserts the EXACT decimal string `0.8015873015873015873015873015873016`; a separate test proves present `weightedContribution`s sum exactly (Dec equality) to the composite.
- Full core suite green: **391/391**; `tsc -b` clean; the four existing result goldens untouched.

## Task Commits

Each task committed atomically (test-first RED→GREEN within a single commit per module):

1. **Task 1: normalize — fixed-range, direction-folded, clamped [0,1] scaling** — `b1f3f5a` (feat)
2. **Task 2: composite — explainable breakdown + missing-weight renormalization** — `a59a41c` (feat)
3. **Task 3: bucket — realistic/stretch/fantasy budget overlay via integer-cent compare** — `cff2fa2` (feat)

## Files Created
- `packages/core/src/towns/normalize.ts` — `normalize(raw,min,max,dir)` + `MetricDirection`; imports `Dec` from `../money/decimal-config.js`. In-source direction map for 05-04's caller.
- `packages/core/src/towns/normalize.test.ts` — exact-string ratio asserts, min/max-end folds, clamp-below/above, degenerate + inverted range throws, typeof-string guard (9 tests).
- `packages/core/src/towns/composite.ts` — `computeComposite` + `MetricContribution`/`MetricInput`/`MetricRange`/`CompositeResult`; imports `normalize` from `./normalize.js` (no `Money`).
- `packages/core/src/towns/composite.test.ts` — worked example (exact composite), missing-drop, configured-weight echo, exact-sum invariant, all-missing→null, Σpresent==0→null, amenities sub-composite renormalization + all-sub-missing drop (8 tests).
- `packages/core/src/towns/bucket.ts` — `bucketOf` + `Bucket`; imports `Money` from `../money/money.js`.
- `packages/core/src/towns/bucket.test.ts` — at-budget/at-stretch/one-cent-above boundaries, below/between, fractional-ceiling integer-cent exactness (7 tests).

## Decisions Made
- **Recursive `MetricInput` for amenities** — a composite metric carries `subMetrics`; `resolve()` recurses through `computeComposite` so the amenities normalized value IS the renormalized sub-composite, and an all-sub-missing amenities metric is itself `missing:true` and drops from the top-level renormalization. One renormalization rule, applied at both levels.
- **Composite accumulates the rounded `weightedContribution` strings** (not the unrounded Dec products), guaranteeing present contributions sum EXACTLY to the composite — asserted as a regression-pinned invariant.
- **`range` kept required on `MetricInput`** even for composite metrics (ignored there) to keep leaf discipline type-enforced; documented in-source.

## Deviations from Plan

None — plan executed exactly as written. (One test-internal correction during authoring: an initially mis-reasoned fractional-stretch boundary assertion was replaced with a correct integer-cent exactness case before the bucket implementation was written; no plan scope change.)

## Issues Encountered
None.

## Known Stubs
None — all three modules are fully wired pure functions. Missing-price bucket handling (`Bucket | null`) is deliberately deferred to the 05-04 caller per the plan (`bucketOf` always takes a present `Money`); this is a documented interface boundary, not an unwired stub.

## Threat Surface
No new surface beyond the plan's `<threat_model>`. All four mitigations are implemented and test-pinned:
- **T-05-09** (DoS /0 on degenerate range) — `normalize` throws on `max<=min`; asserted.
- **T-05-10** (NaN/Infinity poisoning) — all math in `Dec`, clamped `[0,1]`, missing→null; asserted.
- **T-05-11** (float re-entry via `Number()`) — composite stays a decimal string; bucket compares `toCents()` bigints; no `Number(` on money/score (source-verified).
- **T-05-12** (missing imputed as 0) — drop + renormalize; composite null when nothing present; asserted never `'0'`.

## User Setup Required
None — no external service configuration required.

## Next Phase Readiness
- Plan 05-04 can wire these three into a top-level `scoreTowns(input)`: read each town's stamped metrics (05-01) and `AssumptionsV4.townScoring` ranges/weights (05-02), call `normalize`→`computeComposite` for the score breakdown and `bucketOf` for the separate budget overlay, surfacing `bucket: Bucket | null` for missing-price towns.
- The direction map is documented in `normalize.ts`; the renormalization + null-edge contract is locked and test-pinned.

## Self-Check: PASSED

- All 6 created files exist on disk (verified below).
- All three task commits (`b1f3f5a`, `a59a41c`, `cff2fa2`) present in git history.
- `tsc -b` clean; full core suite 391/391 green; towns suite 37/37.

---
*Phase: 05-town-scoring-heatmap*
*Completed: 2026-06-27*
