---
phase: 05-town-scoring-heatmap
verified: 2026-06-27T17:10:00Z
status: passed
score: 9/9 must-haves verified
overrides_applied: 0
re_verification: false
---

# Phase 5: Town Scoring & Heatmap Verification Report

**Phase Goal:** Score MA towns into a budget-aware affordability picture using a weighted normalized composite (reusing the prior beach-app scoring architecture), bucket towns realistic/stretch/fantasy for a given budget, render a heatmap [Phase 5 emits the heatmap DATA + ENCODING CONTRACT only — actual pixels are Phase 7], and qualitatively flag MA-specific realities. Engine-only, pure, in packages/core/src/towns/. Largely independent of the Affordability/FI chain.
**Verified:** 2026-06-27T17:10:00Z
**Status:** passed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Towns scored via a weighted, normalized composite (mill rate, median price, commute to configurable anchor, school rating, custom amenity weights) — each metric scaled + direction-corrected, missing data handled explicitly (no silent 0/NaN) | VERIFIED | `normalize.ts` implements `(raw-min)/(max-min)` (higherBetter) / `(max-raw)/(max-min)` (lowerBetter), clamped to [0,1]; `composite.ts` drops missing metrics and renormalizes present weights. 9 normalize tests + 8 composite tests pass, including exact decimal assertions. |
| 2 | Given a budget, towns bucket into realistic / stretch / fantasy | VERIFIED | `bucket.ts` compares integer cents via `Money.toCents()` bigint, with inclusive boundaries. 7 bucket tests cover exact boundary cents. Golden confirms all three bucket values appear across the 24 towns. |
| 3 | Affordability heatmap DATA CONTRACT across towns for a budget, with each town's per-metric contribution explainable (per-metric breakdown). Phase 5 = data contract; Phase 7 = pixels. | VERIFIED | `TownScoreboard` carries 24 `TownScore` entries, each with `composite`, `metrics` (5-element breakdown with `rawValue`, `normalizedValue`, `direction`, `weight`, `weightedContribution`, `missing`), `bucket`, `flags`. `town-scoring-golden-snapshot.json` confirms the full data contract for all 24 towns. |
| 4 | MA-specific realities (Prop 2½, betterment, Title 5 septic, 40B) flagged qualitatively per relevant town | VERIFIED | `prop25` prepended universally in `score-towns.ts` (`['prop25', ...(row.flags ?? [])]`). Curated flags (betterment, title5, 40b) stored per row. Golden confirms Quincy (40b), Lexington (betterment), Needham/Weymouth/Natick (title5), etc. carry their tags. Flags are enum identifiers only — no UI copy. |
| 5 | Composite is a dimensionless decimal string (not Money/number) | VERIFIED | `composite.ts` returns `compositeAcc.toFixed()`. `TownScore.composite` typed `string | null`. `towns.type-test.ts` compile-time guard rejects `number` assignment with `@ts-expect-error`. `tsc -b` passes. |
| 6 | Bucketing via Money.toCents() bigint comparison, budget-independent of the composite | VERIFIED | `bucket.ts` uses only `medianPrice.toCents()`, `budget.toCents()`, `budget.mul(stretchFactor).toCents()`. No reference to composite or score. `bucketOf` never reads the MetricContribution array. |
| 7 | Fixed-range normalization stored in AssumptionsV4 (not min-max over the live set) | VERIFIED | `defaults.ts` stores `townScoring.ranges.{medianPrice,commute,school,millRate,amenity}` as fixed `{min,max}` pairs. `score-towns.ts` reads them from `input.assumptions.townScoring.ranges`. `normalize.ts` uses the passed bounds — never derives them from the town set. |
| 8 | Missing-metric drop+renormalize (never imputed); all-metrics-missing or zero-present-weight yields composite null (never 0/NaN) | VERIFIED | `composite.ts`: missing inputs return `{missing:true, rawValue:null, normalizedValue:null, weightedContribution:null}`. Sigma accumulates only non-missing weights. Guard: `anyPresent && sigma.greaterThan(0)` required for a non-null composite. Golden confirms Winchester (`medianPrice` missing → `bucket:null`) and Weymouth (transit sub-metric `missing:true` with renormalized sub-weights). |
| 9 | Public barrel exports `scoreTowns` + output types; four prior goldens byte-identical; new town-scoring golden committed | VERIFIED | `index.ts` exports `scoreTowns`, `TownScore`, `TownScoreboard`, `TownScoringInput`, `MetricContribution`, `MetricDirection`, `Bucket`, `CommuteAnchor`, `MaFlag`. `Dec` remains unexported. `git status` is clean — no changes to prior 4 golden fixtures. `town-scoring-golden-snapshot.json` is newly committed as a 5th fixture. Full suite: 399 tests, 35 files, all passing. |

**Score:** 9/9 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/core/src/towns/town-table.schema.ts` | Extended townRowSchema with stampedMetric, commute anchor map, MaStoredFlag enum, CommuteAnchor + MetricStamp types | VERIFIED | `stampedMetric` defined with `.strict()`, `value: decStr`, `asOf: z.number().int()`, `source: z.string()`. Flags enum: `'betterment' \| 'title5' \| '40b'` — `prop25` absent. `CommuteAnchor` exports all three anchors. `townRowSchema` still ends in `.strict()`. |
| `packages/core/src/towns/town-table.ts` | 24 rows extended with stamped metrics + curated flags; Winchester medianPrice absent; Weymouth amenities.transit absent | VERIFIED | All 24 rows present with `medianPrice`, `school`, `commute` (3 anchors), `amenities` (4 sub-metrics). Winchester omits `medianPrice` key entirely. Weymouth omits `amenities.transit` key. Flags include betterment, title5, 40b where applicable. No `prop25` stored. |
| `packages/core/src/assumptions/schema.ts` | AssumptionsV4 with townScoring group; CURRENT_VERSION=4; union includes V4 | VERIFIED | `AssumptionsV4` defined with `schemaVersion: z.literal(4)`. `townScoring` group contains `weights`, `amenityWeights`, `ranges`, `bucket.stretchFactor`, all `decStr`. `AssumptionSetSchema = z.discriminatedUnion('schemaVersion', [V1, V2, V3, V4])`. `CURRENT_VERSION = 4 as const`. |
| `packages/core/src/assumptions/defaults.ts` | schemaVersion 4 + townScoring defaults with [ASSUMED] comments | VERIFIED | `schemaVersion: 4`. `townScoring.weights`: medianPrice `'0.30'`, commute `'0.25'`, school `'0.20'`, millRate `'0.15'`, amenities `'0.10'`. Ranges seeded. `stretchFactor: '1.25'`. All decimal strings with `[ASSUMED]` comments. |
| `packages/core/src/assumptions/migrate.ts` | v3ToV4 step-up + V3Set type + chained switch cases | VERIFIED | `V3Set` type defined. `v3ToV4` function seeds `townScoring` from `DEFAULT_ASSUMPTIONS.townScoring` (not inline literals). Switch handles cases 1→v3ToV4(v2ToV3(v1ToV2)), 2→v3ToV4(v2ToV3), 3→v3ToV4, 4→identity. `assertNever` exhaustiveness guard present. |
| `packages/core/src/towns/normalize.ts` | `normalize(raw,min,max,dir)` → [0,1] decimal string; MetricDirection type; throws on degenerate range | VERIFIED | Exports `MetricDirection = 'higherBetter' \| 'lowerBetter'` and `normalize`. Throws on `hi.lessThanOrEqualTo(lo)`. Clamps via `Dec.max(new Dec(0), Dec.min(new Dec(1), t))`. Returns `clamped.toFixed()`. Imports `Dec` from `../money/decimal-config.js`. |
| `packages/core/src/towns/composite.ts` | `computeComposite` + per-metric breakdown + renormalized weighted-sum; MetricContribution type | VERIFIED | Exports `MetricContribution`, `MetricInput`, `MetricRange`, `CompositeResult`, `computeComposite`. Drops missing metrics, renormalizes present weights, returns `null` for data-less edges. Recurses for amenities sub-composite. No `Money` used. |
| `packages/core/src/towns/bucket.ts` | `bucketOf(medianPrice, budget, stretchFactor)` → Bucket; Bucket type; integer-cent compare | VERIFIED | Exports `Bucket = 'realistic' \| 'stretch' \| 'fantasy'` and `bucketOf`. Uses `.toCents()` bigint comparison exclusively. `budget.mul(stretchFactor)` for stretch ceiling. No `Number()` on dollar values. No composite reference. |
| `packages/core/src/towns/score-towns.ts` | `scoreTowns` entry + TownScore/TownScoreboard/TownScoringInput/MaFlag; reads assumptions; prop25 universal; missing price → null bucket | VERIFIED | All types exported. Reads weights/ranges/stretchFactor from `input.assumptions.townScoring` only — no hardcoded literals confirmed by grep. `flags = ['prop25', ...(row.flags ?? [])]`. Missing medianPrice → `bucket: null`. Missing anchor value → `missing:true` commute contribution. |
| `packages/core/src/towns/towns.type-test.ts` | Compile-time no-bare-number guard for composite/normalizedValue/weightedContribution/weight/bucket | VERIFIED | 6 `@ts-expect-error` guards with `void _x` discharges for composite, normalizedValue, weightedContribution, weight, and bucket (both assignment directions). Not a `*.test.ts` — in `tsc -b` graph only. `tsc -b` passes with no TS2578 unused-suppression errors. |
| `packages/core/src/__fixtures__/town-scoring-golden-snapshot.json` | Committed reproducibility golden for budget=$750k, anchor=downtownBoston | VERIFIED | File exists with full 24-town scoreboard. Winchester has `"bucket":null` and `"medianPrice":{"missing":true,...}`. Weymouth has transit sub-metric `"missing":true` with renormalized sub-weights. All composites are decimal strings. Golden test uses gated `UPDATE_GOLDEN=1` write, not `toMatchSnapshot`. |
| `packages/core/src/index.ts` | Town scoring export block; Dec unexported | VERIFIED | Export block at bottom of file: `scoreTowns`, `TownScore`, `TownScoreboard`, `TownScoringInput`, `MetricContribution`, `MetricDirection`, `Bucket`, `CommuteAnchor`, `MaFlag`. `Dec` not in any export line. |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `score-towns.ts` | `composite.ts` | `computeComposite(metricInputs)` per town | WIRED | Import confirmed at line 28; called at line 175 in the per-town map body. |
| `score-towns.ts` | `bucket.ts` | `bucketOf(Money.of(row.medianPrice.value), input.budget, stretchFactor)` | WIRED | Import at line 29; called at lines 180-182 with null guard for missing price. |
| `composite.ts` | `normalize.ts` | `import { normalize, type MetricDirection } from './normalize.js'` | WIRED | Line 21; called at line 106 in the `resolve` function for present leaf metrics. |
| `bucket.ts` | `money/money.js` | `Money.toCents()` bigint comparison + `Money.mul(stretchFactor)` | WIRED | `medianPrice.toCents()`, `budget.toCents()`, `budget.mul(stretchFactor).toCents()` at lines 25-27. |
| `golden.test.ts` | `score-towns.ts` | `canonicalJson(scoreTowns({...}))` compared to committed fixture | WIRED | `scoreTowns` imported at line 42; called in `canonicalTownScoreboard()` at line 164. Golden block at lines 236-250. |
| `index.ts` | `score-towns.ts` | Barrel export of `scoreTowns` + types | WIRED | Export block at lines 143-153 of `index.ts`. |
| `migrate.ts` | `defaults.ts` | `v3ToV4` seeds `townScoring: { ...DEFAULT_ASSUMPTIONS.townScoring }` | WIRED | `DEFAULT_ASSUMPTIONS` imported at line 16; used in `v3ToV4` at line 113. No inline literals. |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|-------------------|--------|
| `score-towns.ts` | `composite` | `computeComposite(metricInputs)` calling `normalize` on row metric values from `TOWN_RATE_TABLE` | Yes — reads 24 seeded rows, each with actual stamped metric values | FLOWING |
| `score-towns.ts` | `bucket` | `bucketOf(Money.of(row.medianPrice.value), input.budget, stretchFactor)` | Yes — real budget comparison; null for Winchester (missing medianPrice) | FLOWING |
| `score-towns.ts` | `flags` | `['prop25', ...(row.flags ?? [])]` from row curated flags | Yes — curated per-row flag arrays from `TOWN_RATE_TABLE` | FLOWING |
| `score-towns.ts` | `weights`, `ranges`, `stretchFactor` | `input.assumptions.townScoring` (AssumptionsV4 stored data) | Yes — reads from validated V4 assumptions block, never hardcoded | FLOWING |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| All 44 towns tests pass (normalize, composite, bucket, table, score-towns) | `npx vitest run src/towns` | 44 tests pass, 5 files | PASS |
| Full core suite including 4 prior goldens + new town-scoring golden | `npx vitest run` | 399 tests pass, 35 files | PASS |
| TypeScript compiles without errors (including type-test guard) | `npx tsc -b` | Exit 0, no output | PASS |
| Winchester has `bucket:null` in golden (missing medianPrice) | Read `town-scoring-golden-snapshot.json` | `"bucket":null` confirmed for Winchester entry | PASS |
| Weymouth transit sub-metric `missing:true` in golden (missing amenities.transit) | Read `town-scoring-golden-snapshot.json` | `"transit":{"missing":true,"normalizedValue":null,...}` confirmed | PASS |
| No hardcoded weight/range literals in `score-towns.ts` | Grep `0\.(30\|25\|20\|15\|10)\|400000\|2500000` in score-towns.ts | No matches | PASS |

---

### Probe Execution

No conventional probe scripts found. Phase is a pure calculation engine — test suite is the verification mechanism.

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| TOWN-01 | 05-01, 05-02, 05-03, 05-04 | Tool scores MA towns via weighted, normalized composite (mill rate, median price, commute, school, amenity weights) | SATISFIED | `normalize.ts` + `composite.ts` + `score-towns.ts`; 9 normalize tests, 8 composite tests, 7 score-towns tests; golden confirms full matrix. |
| TOWN-02 | 05-03, 05-04 | Given a budget, tool buckets towns into realistic / stretch / fantasy | SATISFIED | `bucket.ts` with integer-cent bigint comparison; 7 bucket tests including exact boundary cents; golden confirms all three buckets across 24 towns. |
| TOWN-03 | 05-03, 05-04 | Tool displays an affordability heatmap across towns for a given budget | SATISFIED (data contract) | `TownScoreboard` is the heatmap data contract with per-metric breakdown for each town. Phase 5 explicitly scoped to data contract; Phase 7 delivers rendering. |
| TOWN-04 | 05-01, 05-04 | Tool flags MA-specific realities qualitatively (Prop 2½, betterment, Title 5 septic, 40B) | SATISFIED | `prop25` universal injection; betterment/title5/40b curated per row; flags are enum identifiers only (no UI copy); never alter composite or bucket. |

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None found | — | — | — | No TBD/FIXME/XXX markers, no placeholder returns, no hardcoded weights/ranges, no bare-number score/dollar values in modified files. |

---

### Human Verification Required

None. Phase 5 is a pure calculation engine (zero framework deps, zero UI, zero network). All structural and behavioral invariants have automated coverage. The only manual judgment item identified in the VALIDATION.md — "numeric defensibility of [ASSUMED] reference ranges / weights" — is explicitly documented as a user-tunable concern, not a structural correctness invariant, and is tracked in RESEARCH.md Assumptions Log A1-A9.

---

## Gaps Summary

No gaps. All 9 must-haves verified, all 4 requirements satisfied, TypeScript clean, 399 tests passing, five golden fixtures present with prior 4 byte-identical.

---

_Verified: 2026-06-27T17:10:00Z_
_Verifier: Claude (gsd-verifier)_
