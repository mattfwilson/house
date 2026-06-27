---
phase: 05-town-scoring-heatmap
reviewed: 2026-06-27T00:00:00Z
depth: standard
files_reviewed: 18
files_reviewed_list:
  - packages/core/src/towns/town-table.schema.ts
  - packages/core/src/towns/town-table.ts
  - packages/core/src/towns/normalize.ts
  - packages/core/src/towns/composite.ts
  - packages/core/src/towns/bucket.ts
  - packages/core/src/towns/score-towns.ts
  - packages/core/src/towns/towns.type-test.ts
  - packages/core/src/assumptions/schema.ts
  - packages/core/src/assumptions/defaults.ts
  - packages/core/src/assumptions/migrate.ts
  - packages/core/src/index.ts
  - packages/core/src/towns/normalize.test.ts
  - packages/core/src/towns/composite.test.ts
  - packages/core/src/towns/bucket.test.ts
  - packages/core/src/towns/score-towns.test.ts
  - packages/core/src/towns/town-table.test.ts
  - packages/core/src/assumptions/migrate.test.ts
  - packages/core/src/assumptions/schema.test.ts
findings:
  critical: 0
  warning: 1
  info: 3
  total: 4
status: issues_found
---

# Phase 5: Code Review Report

**Reviewed:** 2026-06-27T00:00:00Z
**Depth:** standard
**Files Reviewed:** 18
**Status:** issues_found

## Summary

This phase adds the Town-Scoring engine (normalize → composite → bucket → `scoreTowns`), the
seeded 24-town mill-rate/metric table, and the strictly-additive `AssumptionsV4.townScoring`
slice plus its V3→V4 migration. I reviewed the scoring math, the missing-data / renormalization
contract, the decimal-string boundaries, and the migration chain against the project's core
correctness invariants (all money/score math on the `Dec` clone, purity/determinism, honest
missing data, additive migration).

The scoring core is genuinely careful and holds up under adversarial tracing:

- **`normalize`** guards the degenerate-range divide-by-zero (`hi.lessThanOrEqualTo(lo)` throws),
  clamps to [0,1], folds direction correctly, and returns a decimal STRING — no bare-`number`
  arithmetic, no float re-entry.
- **`computeComposite`** drops missing metrics rather than imputing 0, renormalizes present
  weights, returns `null` (never 0) for both data-less edges (nothing present, and Σ present
  weight == 0), accumulates the *rounded* contribution strings so the breakdown sums exactly to
  the composite, and recurses cleanly for the amenities sub-composite. A present-but-zero-weighted
  metric correctly yields `'0'` (not `null`), preserving the missing-vs-zero distinction.
- **`bucketOf`** compares EXACT integer cents via `Money.toCents()` bigint and `Money.mul`, with
  inclusive lower boundaries — no float epsilon at the budget/stretch boundary.
- **`scoreTowns`** reads all weights/ranges/stretchFactor off stored config (nothing hardcoded),
  keeps the composite and bucket channels independent, injects `prop25` universally without it
  touching the score, and surfaces `bucket: null` for the missing-median-price town.
- The **AssumptionsV4** slice is strictly additive (no V3 leaf touched), and the migrate tests
  prove V1/V2/V3 goldens flow through verbatim.

The findings below are one robustness gap in the migration boundary and three quality/consistency
items. No correctness defect was found in the Phase-5 scoring math itself.

## Warnings

### WR-01: `migrate()` does not re-validate its output, so a legacy non-positive `swr.rate` bypasses the CR-01 positivity guard

**File:** `packages/core/src/assumptions/migrate.ts:33-60`
**Issue:** `migrate` validates only the *input* — `parseAssumptionSet(input)` checks the snapshot
against *its own version's* schema — and then returns the constructed `CurrentAssumptionSet`
directly, never re-validating it against `AssumptionsV4`.

The V3/V4 schemas tightened `swr.rate` with `.refine((s) => Number(s) > 0)` precisely to stop the
documented CR-01 crash (the FI number is `annualNeed / swr.rate`; `0` → `Money.of('Infinity')`
crash, negative → an FI target "reached at month 0"). But **`AssumptionsV1.swr` and
`AssumptionsV2.swr` are bare `group({ rate: decStr })` with no refine** (schema.ts:71-75 and
115-123). The migration steps (`v1ToV2` / `v2ToV3` / `v3ToV4`) copy `swr` through verbatim and
never touch it.

Result: a V1 or V2 snapshot with `swr: { rate: '0' }` (or a negative rate) parses successfully at
its own version, migrates to a V4-shaped object carrying `swr.rate: '0'`, and is returned as a
"trusted" `CurrentAssumptionSet` that would be rejected if it were parsed as V4. Downstream FI
calc then divides by zero into the exact `Infinity` crash the refine exists to prevent. This is a
hole in the stated trust-boundary defense (the module header claims "defense against a
corrupt/forged snapshot"), reachable from any legacy or hand-edited saved scenario.
**Fix:** Re-validate the migrated result against the current-version schema before returning, so
the output is held to the *same* invariants as a freshly-parsed V4 set:
```typescript
import { AssumptionsV4 } from './schema.js';
// ...at each return that produces the current shape:
return AssumptionsV4.parse(v3ToV4(v2ToV3(v1ToV2(set))));
// (or wrap the whole switch result in a single AssumptionsV4.parse(...) before returning)
```
This keeps the goldens byte-identical (default `swr.rate` is `0.033`, which passes) while closing
the bypass.

## Info

### IN-01: Stale "identity for V1" header comments contradict the real 4-version transform

**File:** `packages/core/src/assumptions/migrate.ts:1-7` (and `migrate.test.ts:1-4`)
**Issue:** The migrate.ts header still says *"Today there is only V1, so this is the identity — but
it is STRUCTURED as a version-gated step-up so a future V1->V2 transform slots in as one case."*
The implementation now handles V1→V2→V3→V4 with real transforms, and the body comments (lines
39-54) correctly describe that chain — so the file's own header contradicts its code. The test
header (`migrate.test.ts:3-4`, *"Currently identity for V1…"*) is stale in the same way. Misleading
docs on a trust-boundary file invite a future reader to assume the migration is a no-op.
**Fix:** Update both headers to describe the current behavior (a real V1→V4 step-up chain seeding
new slices from `DEFAULT_ASSUMPTIONS`, version-gated with an exhaustiveness guard).

### IN-02: `townScoring` ranges/weights/stretchFactor have no boundary sanity validation; bad config fails deep in calc instead of at the trust boundary

**File:** `packages/core/src/assumptions/schema.ts:315-343`
**Issue:** Every `townScoring` leaf is a bare `decStr`. `decStr`'s regex (`/^-?\d+(\.\d+)?$/`)
admits negatives and zero, and the schema does not enforce `range.min < range.max`, positive
weights, or `stretchFactor > 0`. A stored range with `min >= max` parses cleanly at the boundary
and then makes `normalize` *throw* at `scoreTowns` runtime (`normalize.ts:37-39`) — i.e., a config
error surfaces as a deep runtime exception rather than a boundary rejection. A `stretchFactor < 1`
silently produces an always-empty "stretch" bucket. This is inconsistent with the precedent set in
the same file, where `swr.rate` *does* carry a positivity `.refine`.
**Fix:** Add `.refine`s mirroring the `swr.rate` precedent — e.g. `stretchFactor` and weights
`> 0`, and a per-range refine that `Number(min) < Number(max)` — so malformed scoring config is
rejected at the serialization boundary, not inside the scoring loop.

### IN-03: A seeded commute value falls outside its configured normalization band and is silently clamped

**File:** `packages/core/src/towns/town-table.ts:75-79` (Cambridge `kendallCambridge: stamp('8')`) vs `packages/core/src/assumptions/defaults.ts:117` (`commute: { min: '10', max: '75' }`)
**Issue:** Cambridge's `kendallCambridge` commute is seeded at `8` minutes, but the fixed commute
normalization range has `min: '10'`. `normalize('8','10','75','lowerBetter')` computes
`(75-8)/(75-10) = 67/65 > 1`, which the [0,1] clamp folds to `1`. The clamp is working as designed
(it prevents a poisoned weighted sum), but it means an 8-minute commute and a 10-minute commute
score identically, masking a real difference. Since these are `[ASSUMED]` hand-seeded values this
is low-severity data hygiene, not a math bug.
**Fix:** Either widen `ranges.commute.min` to `<=` the smallest seeded anchor value, or adjust the
seed so no seeded metric lands outside its own normalization band. (A test asserting every seeded
metric lies within its configured range would catch future drift.)

---

_Reviewed: 2026-06-27T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
