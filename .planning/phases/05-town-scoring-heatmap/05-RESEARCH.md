# Phase 5: Town Scoring & Heatmap (engine-only) - Research

**Researched:** 2026-06-27
**Domain:** Pure-TypeScript weighted-composite scoring engine over MA towns (greater Boston), inside the existing `@house/core` calculation core
**Confidence:** HIGH (every recommendation is validated against existing in-repo code patterns cited by file:line; the only MEDIUM/`[ASSUMED]` items are the discretion-gap numeric proposals — reference ranges and default weights — which are explicitly user-tunable data, not math)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions (D-01..D-12 — do NOT relitigate)

- **D-01:** Reuse the existing **24 curated greater-Boston towns** already in `town-table.ts`. Extend that one canonical list with the new scoring metrics — do **not** create a second town registry. (Wider coverage = out of scope.)
- **D-02:** Seed all new metrics (median price, school rating, commute, amenity sub-scores) as **static hand-seeded literal values, per-metric vintage/source-stamped** — mirroring the existing FY-stamped mill-rate row pattern. No live API for any metric.
- **D-03:** Missing metric values are **flagged explicitly** (`missing: true`) and **never imputed, zero-filled, or hidden** — enforces the UI-SPEC "no silent 0/NaN" rule at the data layer.
- **D-04:** **Commute** is seeded as estimated peak **drive-time (minutes) to a small fixed set of canonical anchors** (e.g. downtown Boston, Kendall/Cambridge, +1). The configurable commute-anchor input **selects among the seeded anchor set** — no live traffic API.
- **D-05:** **MA flags** are **hand-curated per town** as a static set. The 4 flag types + copy are locked by `05-UI-SPEC.md` (Prop 2½, Betterment, Title 5 septic, 40B). **Prop 2½ is universal**; Betterment / Title 5 / 40B are per-town curated tags. Flags are qualitative disclosures — never computed, never alter a town's bucket or color.
- **D-06:** Scoring weights (per-metric + amenity sub-weights), the bucket **stretchFactor**, and the **fixed normalization reference ranges** (D-10/D-09) all live in a **new versioned AssumptionsV4 town-scoring block**. Bump V3→V4 with a `v3ToV4` migrate, following the established assumptions-versioning pattern. (Satisfies ASMP-01.)
- **D-07:** **Amenities** = **several named sub-metrics** (e.g. walkability, dining/nightlife, parks/recreation), each independently weighted. Amenity sub-weights normalize among themselves.
- **D-08:** Default bucket **stretchFactor = 1.25**. Realistic = median ≤ budget; Stretch = budget < median ≤ budget × 1.25; Fantasy = beyond. User-editable data, not a constant.
- **D-09:** Normalize each metric against **fixed reference ranges stored in AssumptionsV4** (per-metric min/max constants), **not** min-max over the seeded town set. Direction-correction (lower mill rate / price / commute = better; higher school / amenity = better) folds into the normalized value so higher always = better.
- **D-10:** Missing-metric composite handling: **drop the missing metric and renormalize the remaining weights to sum to 1**, with the missing metric flagged in its per-metric breakdown. (Not: knock the whole town to "no data.")
- **D-11:** The scoring function takes a **`budget: Money` parameter**; it buckets a town's median price against that budget. The **caller decides the source** (raw budget or the Phase 3/4 true-affordability ceiling, wired in Phase 7).
- **D-12:** The **composite score is budget-independent**; the **bucket is a separate pure overlay** of (median price, budget, stretchFactor). Changing the budget re-buckets without re-scoring.

### Claude's Discretion (research fills these — see body)
- The exact **default weight vector** across the five metrics (price & commute weighted higher).
- The exact **fixed reference-range values** per metric (D-09).
- Whether to apply a **display-only rescale of the composite** for heatmap lightness spread (the underlying per-metric normalization stays fixed-range/reproducible regardless).
- The exact **amenity sub-metric list** (lean toward the beach-app architecture; keep the schema clean).
- **Output type / barrel shape** and the **test-oracle strategy** (worked-example tests + reproducibility golden).

### Deferred Ideas (OUT OF SCOPE — ignore completely)
- Wider town coverage (beyond the curated 24).
- **Heatmap rendering** (visx/CSS-grid pixels, legend UI, tooltips, app chrome) — Phase 7.
- Live commute/traffic API and live median-price/school feeds.
- Wiring the budget to the live Phase 3/4 true-affordability output — Phase 7 concern.
- Multi-anchor commute beyond the seeded canonical set (arbitrary lat/lng + computed distance).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TOWN-01 | Score MA towns via a weighted, normalized composite (mill rate, median price, commute to configurable anchor, school rating, custom amenity weights), each scaled + direction-corrected, missing data explicit | Composite algorithm (§Architecture Pattern 2), fixed-range normalization with direction folding (§Pattern 1), missing-metric weight renormalization (§Pattern 3), default weights + ranges (§Discretion Proposals) |
| TOWN-02 | Given a budget, bucket towns into realistic / stretch / fantasy | Budget-independent composite + separate bucket overlay (§Pattern 4); `Money.toCents()` bigint comparison; stretchFactor from AssumptionsV4 |
| TOWN-03 | Display an affordability heatmap across towns, each town's per-metric contribution explainable | Output type satisfies the UI-SPEC towns×metrics matrix + per-metric `{rawValue,normalizedValue,direction,weight,weightedContribution,missing}` breakdown (§Output Type) — engine emits data; Phase 7 renders |
| TOWN-04 | Flag MA-specific realities qualitatively (Prop 2½, betterment, Title 5, 40B) | Static per-town flag enums on the extended town row, Prop 2½ injected universally; engine emits enum identifiers only, UI copy lives in Phase 7 (§Pattern 5) |
</phase_requirements>

## Summary

Phase 5 adds a **fully self-contained, pure scoring engine** to `packages/core/src/towns/`. It is the most architecturally independent module in the build: it depends only on Phase-1 primitives (`Money`, the `Dec` decimal clone, the assumptions versioning machinery, the canonical-JSON serializer) and the existing seeded town table — and on **none** of the TCO/Affordability/FI engines. The locked decisions (D-01..D-12) and the `05-UI-SPEC.md` data contract fully pin the behavior; this research fills the discretion gaps (reference ranges, default weights, amenity sub-metric list, output type, test strategy) and surfaces the concrete in-repo patterns the plan must follow.

The work decomposes into five mechanical extensions of patterns that already exist verbatim in the codebase: (1) extend `townRowSchema` with the new per-metric fields behind the same `.strict()` + `decStr` boundary; (2) bump `AssumptionsV3`→`AssumptionsV4` adding a `townScoring` block, following the V1→V2→V3 precedent exactly (per-step migrate + defaults + barrel export); (3) write the pure normalize→weight→renormalize composite over the frozen `Dec` clone, emitting dimensionless **decimal strings** (never bare `number`, never `Money` — the composite is not dollars); (4) write the budget bucket overlay as a separate pure function comparing `Money.toCents()` bigints; (5) attach static MA flag enums to the town rows. Verification mirrors prior phases: worked-example tests, a no-bare-number type-test, and a reproducibility golden added to `golden.test.ts`.

**Primary recommendation:** Build it as a direct clone of the established patterns. Treat the composite/normalized/weight values as **canonical decimal strings computed in `Dec`** (the same float-free discipline `fiDeltaYears` and `FiOutcome.years` already use — see `index.ts:110`), keep **dollars (`rawValue` of price, `budget`) crossing as decimal strings / `Money`**, and bucket via `Money.toCents()` bigint comparison so no float ever enters. Nothing here requires a new dependency, a new architectural pattern, or any rendering.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Weighted composite scoring | Core (`packages/core/src/towns/`) | — | Pure deterministic math; the product's correctness lives in `core` (CORE-01/02/03). No framework, no I/O. |
| Fixed-range normalization + direction correction | Core | — | Pure function of (rawValue, refRange, direction); reads ranges from AssumptionsV4. |
| Missing-metric weight renormalization | Core | — | Pure; operates on the present-metric set per town. |
| Budget bucketing (realistic/stretch/fantasy) | Core | — | Pure overlay of (medianPrice, budget, stretchFactor); `Money` comparison. |
| Reference ranges / weights / stretchFactor (tunables) | Core (AssumptionsV4 data) | — | Assumptions-as-data (ASMP-01); versioned, snapshot-stable, never hardcoded. |
| Seed town metrics + MA flags (data) | Core (extended `town-table.ts`) | — | Static literal data behind the Zod boundary; no live source (anti-feature). |
| Heatmap pixels / legend / tooltips / chip copy | **Phase 7 (Web Shell)** | — | Explicitly deferred. Phase 5 emits the data+encoding contract only. |

**Every Phase-5 capability is Core-tier.** There is no `apps/web`, no rendering, no persistence in scope. This map exists to make the boundary unambiguous for the plan-checker: any task that proposes a component, a color value, a DOM concern, or a copy string is misassigned to Phase 5 and belongs in Phase 7.

## Project Constraints (from CLAUDE.md)

The plan MUST comply with these directives (same authority as locked decisions):

- **Pure calculation core, ZERO framework deps.** `packages/core` may import only `decimal.js` (via the `Dec` clone) and `zod`. No React/Next/DOM. Enforced by the ESLint boundary rule + `boundary.test.ts`.
- **No bare `number` for money/rate math.** Dollars cross as `Money` (from `Money.of(string)`); all arithmetic runs in the `Dec` clone (34-digit, `ROUND_HALF_EVEN`). A `*.type-test.ts` must assert no bare-number dollar field leaks (precedent: `fi/fi.type-test.ts`).
- **No `Date.now()` / `Math.random()` / env reads / module-level mutable state** inside core (the determinism guard throws; lint fixtures enforce it). Scoring is a pure function of explicit inputs.
- **Vitest 4** (`projects` config), not Jest. Reproducibility goldens via the gated `UPDATE_GOLDEN=1` mechanism — never `toMatchSnapshot` (auto-bless is the documented tampering threat, `golden.test.ts:18-20`).
- **Assumptions as first-class versioned data** — every tunable stored in the versioned `AssumptionSet`, never hardcoded (ASMP-01).
- **Trust-boundary validation** — untrusted/seed data crosses through a Zod `.strict()` schema reusing the canonical `decStr` validator; callers parse THROUGH the schema, never spread raw JSON.
- **GSD workflow** — implementation happens via the GSD execute flow, not ad-hoc edits.

## Standard Stack

### Core — no new packages

This phase introduces **zero new dependencies**. It composes primitives that already exist in `@house/core`:

| Asset | Location (file) | Purpose in Phase 5 | Why reuse |
|-------|-----------------|--------------------|-----------|
| `Dec` (configured Decimal clone) | `packages/core/src/money/decimal-config.ts:20` | All normalization, weighting, renormalization math (34-digit, HALF_EVEN) | The single sanctioned decimal constructor; never bare `number`, never the global `Decimal`. |
| `Money` (branded, closed API) | `packages/core/src/money/money.ts:34` | Median-price `rawValue`, `budget` param, bucket comparison via `toCents()` | Dollars cross only as `Money` (CORE-02); `toCents()` gives exact `bigint` comparison. |
| `decStr` + `CANONICAL_DECIMAL_RE` | `packages/core/src/assumptions/schema.ts:24,32` | Validator for every seeded metric + every AssumptionsV4 tunable | One definition of "canonical decimal string" across all boundaries. |
| `townRowSchema` (`.strict()`) | `packages/core/src/towns/town-table.schema.ts:20` | Extend with the new per-metric fields + flags | Established `.strict()`+`decStr` row boundary; rejects floats + unknown keys. |
| `TOWN_RATE_TABLE` (24 towns) + `resolveMillRate` | `packages/core/src/towns/town-table.ts:24,69` | The canonical list to EXTEND in place (D-01); throw-on-unknown resolver idiom | One canonical registry; mill rate already seeded and is metric #1 (tax). |
| AssumptionsV3 + `migrate` + `defaults` | `packages/core/src/assumptions/{schema,migrate,defaults}.ts` | Bump to V4, add `townScoring` block, add `v3ToV4` arm | Exact versioning precedent (V1→V2→V3) to copy. |
| `canonicalJson` | `packages/core/src/serialize/canonical-json.ts` | Reproducibility golden for the scoreboard | Float-free, key-sorted; already the golden substrate. |

**Version verification (existing, already in lockfile — confirmed via CLAUDE.md authoritative table, 2026-06-22):** `decimal.js@10.6.x`, `zod@4.4.x`, `vitest@4.1.x`, `typescript@6.0.x`. No install step is required for Phase 5.

### Alternatives Considered
| Instead of | Could Use | Tradeoff / Verdict |
|------------|-----------|--------------------|
| `Dec` decimal strings for composite | `Money` for the composite | **Rejected.** The composite is a dimensionless [0,1] score, not dollars. Forcing it through `Money` would misuse the dollar type and break the type-test's intent. Use decimal strings (the `fiDeltaYears` precedent). |
| `Money.toCents()` bigint compare for bucketing | Add a `compareTo`/`lte` method to `Money` | Either works. `toCents()` bigint compare needs **no change to the money primitive** (smaller blast radius, golden-safe) and is exact. A `Money.lte()` is cleaner long-term but touches the closed primitive. **Recommend `toCents()` compare**; note the option for the planner. |
| Fixed reference ranges (D-09, locked) | Min-max over the seeded set | **Locked out by D-09.** Min-max-over-set silently reshuffles every town when the list is edited and is non-reproducible. Fixed ranges in AssumptionsV4. |

## Package Legitimacy Audit

**Not applicable — Phase 5 installs no external packages.** All functionality is built from existing in-repo primitives (`Dec`, `Money`, `decStr`, `zod`, `vitest`). The Package Legitimacy Gate is satisfied vacuously: there are no new registry artifacts to slopcheck. (If the planner later discovers a need for a package, the gate must run before that install — but the research finds no such need.)

## Architecture Patterns

### System Architecture Diagram

```
                    AssumptionsV4.townScoring                 budget: Money        anchor: CommuteAnchor
                    (weights, sub-weights,                    (caller-supplied,    (selects a seeded
                     refRanges, stretchFactor)                 D-11)                anchor, D-04)
                              │                                   │                     │
                              ▼                                   │                     │
   TOWN_RATE_TABLE  ───►  ┌──────────────────────────────────────┼─────────────────────┼───────────┐
   (24 rows, extended     │  scoreTowns(input)   — PURE, deterministic, Dec-precise     │           │
    with metrics+flags)   │                                                              ▼           ▼
                          │  for each town:                                                          │
                          │   1. read raw metric values (medianPrice, school, commute[anchor],       │
                          │      millRate, amenity sub-metrics)  ── missing? flag, don't impute (D-03)│
                          │   2. normalize each present metric vs FIXED refRange (D-09),              │
                          │      folding direction so HIGHER = BETTER  →  norm ∈ [0,1]                │
                          │   3. drop missing metrics; renormalize present weights to sum 1 (D-10)    │
                          │   4. composite = Σ norm_m · (weight_m / ΣpresentWeight)   ∈ [0,1]         │
                          │   5. bucket overlay (SEPARATE, budget-dependent, D-12):                   │
                          │        medianPrice ≤ budget → realistic                                   │
                          │        ≤ budget×stretchFactor → stretch ; else fantasy                    │
                          │        (Money.toCents() bigint compare; missing price → bucket null)      │
                          │   6. flags = ['prop25', ...curatedPerTownFlags]  (qualitative, D-05)      │
                          └──────────────────────────────────────────────────────────────────────────┘
                                                       │
                                                       ▼
                          TownScoreboard { anchor, budget, stretchFactor, towns: TownScore[] }
                          ── decimal-string composite + per-metric breakdown + bucket + flags ──
                                                       │
                                                       ▼
                          (Phase 7 renderer: hue=bucket, lightness=composite, chips=flags)
```

The composite (steps 1–4) is **budget-independent**; the bucket (step 5) is a separate overlay. Re-bucketing on a new budget re-runs step 5 only (D-12). The whole function reads `Date.now()`/`Math.random()`/env **never** — all inputs are explicit (the established core determinism rule).

### Recommended Module Structure

```
packages/core/src/towns/
├── town-table.ts              # EXTEND in place: add metrics + flags to the 24 rows (D-01/D-02)
├── town-table.schema.ts       # EXTEND townRowSchema: new decStr fields + flag enum (.strict())
├── town-table.test.ts         # EXTEND: assert new rows parse, metrics present/missing as seeded
├── normalize.ts               # NEW: fixed-range normalize + direction fold → [0,1] decimal string
├── normalize.test.ts          # NEW: worked-example + clamp + division-guard tests
├── composite.ts               # NEW: per-metric breakdown + missing renormalization + composite
├── composite.test.ts          # NEW: worked-example + missing-metric renormalization tests
├── bucket.ts                  # NEW: pure budget overlay (Money.toCents bigint compare)
├── bucket.test.ts             # NEW: boundary tests (== budget, == budget×1.25, just above)
├── score-towns.ts             # NEW: top-level scoreTowns(input) → TownScoreboard (the barrel entry)
├── score-towns.test.ts        # NEW: end-to-end over the seeded table; flag attachment; anchor echo
└── towns.type-test.ts         # NEW: no bare-number dollar/score leak (mirror fi.type-test.ts)
```
(AssumptionsV4 changes live in `assumptions/{schema,defaults,migrate,*.test}.ts`; the golden addition lives in the existing root `golden.test.ts`.)

### Pattern 1: Fixed-range normalization with direction folding (D-09, TOWN-01)

**What:** Each metric's raw value is scaled to [0,1] against a **fixed** `{min, max}` stored in AssumptionsV4 (NOT min-max over the set). Direction correction folds in so **higher = better** universally.

```typescript
// normalize.ts — PURE, runs in Dec. Source pattern: property-tax.ts:53 (Dec div), sensitivity.ts:98 (Dec absolute)
import { Dec } from '../money/decimal-config.js';

export type MetricDirection = 'higherBetter' | 'lowerBetter';

/**
 * Scale `raw` to [0,1] against a FIXED reference range, folding direction so higher=better.
 *  - higherBetter: (raw - min) / (max - min)
 *  - lowerBetter:  (max - raw) / (max - min)   ( == 1 - higherBetter )
 * CLAMPED to [0,1] so a value beyond the seeded range can never blow up or go negative (Pitfall 14).
 * Returns a canonical decimal STRING (never a bare number).
 * @throws if max <= min (a degenerate/zero-width range is invalid config — guard, never /0).
 */
export function normalize(raw: string, min: string, max: string, dir: MetricDirection): string {
  const lo = new Dec(min), hi = new Dec(max), r = new Dec(raw);
  if (hi.lessThanOrEqualTo(lo)) {
    throw new Error(`Invalid reference range: max (${max}) must exceed min (${min}).`);
  }
  const span = hi.minus(lo);
  const t = dir === 'higherBetter' ? r.minus(lo).div(span) : hi.minus(r).div(span);
  const clamped = Dec.max(new Dec(0), Dec.min(new Dec(1), t)); // clamp to [0,1]
  return clamped.toFixed();
}
```

**Direction map (locked by UI-SPEC):** `medianPrice` lowerBetter, `commute` lowerBetter, `millRate` lowerBetter, `school` higherBetter, `amenities` higherBetter (and each amenity sub-metric higherBetter).

### Pattern 2: Composite with explainable per-metric breakdown (TOWN-01, TOWN-03)

**What:** Per town, build the itemized breakdown the UI-SPEC matrix requires, then sum.

```typescript
// composite.ts (sketch) — PURE, Dec math. Decimal-string outputs (NOT Money — the score isn't dollars).
export interface MetricContribution {
  readonly metric: string;                         // 'millRate'|'medianPrice'|'commute'|'school'|'amenities'
  readonly rawValue: string | null;                // canonical decimal string; null when missing
  readonly normalizedValue: string | null;         // [0,1] decimal string; null when missing
  readonly direction: MetricDirection;             // echoed for the tooltip
  readonly weight: string;                          // the CONFIGURED weight (from AssumptionsV4)
  readonly weightedContribution: string | null;     // normalized · (weight / ΣpresentWeight); null when missing
  readonly missing: boolean;
  readonly subMetrics?: readonly MetricContribution[]; // amenity sub-breakdown (optional, for the tooltip)
}
// composite = Σ over present metrics of weightedContribution  ∈ [0,1], decimal string.
```

The breakdown matches the UI-SPEC contract field-for-field: `{ rawValue, normalizedValue, direction, weight, weightedContribution, missing }`. `weight` is the **configured** weight (so the UI can show "you weighted price 30%"); `weightedContribution` already bakes in the missing-metric renormalization (so contributions of present metrics sum to the composite).

### Pattern 3: Missing-metric weight renormalization (D-10, TOWN-01)

**What:** Drop missing metrics, renormalize the *present* metrics' weights to sum to 1, weighted-sum the normalized values. This is also the natural mechanism for "weights need not sum to 1" — they are **relative**; the engine always divides by the present-weight total.

```
present      = metrics where !missing
Σpresent     = Σ weight_m  for m in present          (Dec)
composite    = Σ ( norm_m · weight_m / Σpresent )    for m in present     ∈ [0,1]
```

Edge cases the plan MUST handle: (a) **all metrics missing** → composite is `null` and every row `missing:true` (a genuinely data-less town; do not emit 0); (b) **`Σpresent == 0`** (all present metrics weighted 0) → guard (treat as composite `null` or throw — recommend `null` with a documented note). The **amenities** metric is itself a sub-composite: if a sub-metric is missing, renormalize among present *sub*-metrics; if **all** amenity sub-metrics are missing, the amenities metric is `missing:true` and drops out of the top-level renormalization.

### Pattern 4: Budget bucket overlay (D-08/D-11/D-12, TOWN-02)

**What:** A **separate** pure function of (medianPrice, budget, stretchFactor) — independent of the composite.

```typescript
// bucket.ts — PURE. Compare via Money.toCents() bigint (exact; no float). budget×stretchFactor in Money.mul.
import { Money } from '../money/money.js';
export type Bucket = 'realistic' | 'stretch' | 'fantasy';

export function bucketOf(medianPrice: Money, budget: Money, stretchFactor: string): Bucket {
  const price = medianPrice.toCents();
  const ceil  = budget.toCents();                         // realistic ceiling
  const stretchCeil = budget.mul(stretchFactor).toCents(); // budget × 1.25
  if (price <= ceil) return 'realistic';
  if (price <= stretchCeil) return 'stretch';
  return 'fantasy';
}
```

**Missing median price → cannot bucket.** Recommend the `TownScore.bucket` field be `Bucket | null`, where `null` signals "median price missing" and the renderer draws the UI-SPEC hatched-gray "No data" state. This keeps the bucket enum exactly the three locked values while honoring D-03/UI-SPEC's distinct no-data treatment. (Alternative: a discriminated `{kind:'bucketed',bucket} | {kind:'noPriceData'}`, mirroring `FiOutcome`. The nullable field is simpler and sufficient — flag as a minor design choice for the planner.)

### Pattern 5: Static MA flags (D-05, TOWN-04)

**What:** Curated enum identifiers attached to each town. **Prop 2½ is universal** — store only the per-town `betterment`/`title5`/`40b` tags on the row; the engine **prepends `prop25` to every town's flag list** (DRY; no repeating `prop25` across 24 rows). The engine emits **enum identifiers only** — chip labels and copy belong to Phase 7 (the exact precedent: `TornadoDriver` is "a plain string literal — NO UI copy; Phase 7 owns wording", `sensitivity.ts:35`).

```typescript
export type MaFlag = 'prop25' | 'betterment' | 'title5' | '40b';
// town row: flags?: readonly MaFlag[]   (curated betterment/title5/40b only)
// engine output per town: ['prop25', ...(row.flags ?? [])]   — always includes prop25
```

Flags are pure metadata: they **never** enter the composite or the bucket (qualitative disclosures, UI-SPEC). The existing `PROP_2_5_FLAG` copy constant lives in `property-tax.ts:27` — Phase 7's chip copy can reference the UI-SPEC table; the Phase-5 engine must NOT embed that prose (keep the enum clean).

### Pattern 6: AssumptionsV4 versioning (D-06) — copy the V3 precedent exactly

The V1→V2→V3 machinery is the template. The plan performs these mechanical steps (each has a verbatim precedent):

1. **`schema.ts`** — add `AssumptionsV4 = z.object({ schemaVersion: z.literal(4), ...all V3 slices copied verbatim..., townScoring: group({...}) }).strict()`. Append it to `AssumptionSetSchema = z.discriminatedUnion('schemaVersion', [V1,V2,V3,V4])`. Bump `CURRENT_VERSION = 4`. Add `z.infer<typeof AssumptionsV4>` to `AnyAssumptionSet`. Set `CurrentAssumptionSet = z.infer<typeof AssumptionsV4>`. (Precedent: `schema.ts:158-257`.)
2. **`defaults.ts`** — bump `schemaVersion: 4`, add the `townScoring` block with the proposed weights/ranges/stretchFactor (each value a `decStr`). (Precedent: `defaults.ts:14-91`.)
3. **`migrate.ts`** — add `function v3ToV4(set: V3Set): CurrentAssumptionSet` seeding `townScoring` from defaults; extend the switch: `case 1: v3ToV4(v2ToV3(v1ToV2(set)))`, `case 2: v3ToV4(v2ToV3(set))`, `case 3: v3ToV4(set)`, `case 4: set`. (Precedent: `migrate.ts:25-87`.)
4. **`migrate.test.ts`** — add a `V3_FIXTURE` → V4 test asserting V3 leaves copied verbatim + new `townScoring` from defaults; update the V1/V2 chained-completion expectations to assert the V4 block is present. (Precedent: `migrate.test.ts:35-118`.)
5. **`index.ts`** — add `AssumptionsV4` to the schema export block. (Precedent: `index.ts:14-23`.)
6. **`schema.test.ts` / `assumption-set.test.ts`** — extend for the V4 shape.

**Proposed `townScoring` block shape (decStr leaves):**
```
townScoring: {
  weights:    { medianPrice, commute, school, millRate, amenities },        // 5 decStr
  amenityWeights: { walkability, transit, dining, parks },                  // sub-weights, decStr
  ranges: {                                                                  // fixed refRanges (D-09)
    medianPrice: { min, max }, commute: { min, max }, school: { min, max },
    millRate: { min, max }, amenity: { min, max }                           // each {min,max} decStr
  },
  bucket: { stretchFactor }                                                  // decStr, default '1.25'
}
```
(`amenity.range` is shared across the 0–100 sub-metrics. Weights are relative — the engine renormalizes — so they need not sum to exactly 1, but propose them summing to 1 for legibility.)

### Anti-Patterns to Avoid
- **Min-max normalization over the seeded set** — locked out by D-09; reshuffles on edit, non-reproducible.
- **Composite as `Money`** — it is dimensionless; misusing the dollar type. Use decimal strings.
- **Bucketing via `Number(price) <= Number(budget)`** — reintroduces float. Use `Money.toCents()` bigint.
- **Imputing missing metrics as 0** — D-03/UI-SPEC violation; biases the town to worst. Drop + renormalize.
- **Embedding chip copy / colors in the engine** — Phase 7 owns wording + palette. Engine emits enums + scalars.
- **A second town registry** — D-01; extend the one canonical `TOWN_RATE_TABLE`.
- **`Decimal.set(...)` or the global `Decimal`** — use the `Dec` clone only (`decimal-config.ts:6-23`).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Decimal arithmetic for normalize/weight | A new math helper or bare-`number` ratios | The `Dec` clone (`decimal-config.ts`) | 34-digit HALF_EVEN, float-free; the one sanctioned constructor. |
| Money comparison for bucketing | `Number()` compare or a custom epsilon | `Money.toCents()` → `bigint` `<=` | Exact integer compare; no float, no epsilon. |
| Versioned config migration | An ad-hoc `if (version === ...)` switch in scoring | The `discriminatedUnion` + `migrate` step-up | Established pattern; adding V4 is one append + one `case`. |
| Seed-data validation | Hand-parsing the town rows | Extended `townRowSchema.strict()` + `decStr` | Rejects floats + unknown keys at the boundary; one canonical-decimal definition. |
| Canonical serialization for the golden | Custom JSON stringify / sort | `canonicalJson` (`serialize/canonical-json.ts`) | Float-free, recursive key-sort; already the golden substrate. |
| Reproducibility snapshotting | `toMatchSnapshot` | The gated `UPDATE_GOLDEN=1` write + committed fixture | `toMatchSnapshot -u` auto-blesses drift — the documented tampering threat (`golden.test.ts:18`). |

**Key insight:** Phase 5 is almost entirely *pattern reuse*. The only genuinely new code is the normalize→weight→renormalize→bucket math — and even that mirrors the `Dec`-based perturbation arithmetic in `sensitivity.ts`. Build nothing that an existing primitive already provides.

## Common Pitfalls

### Pitfall 1: One metric dominates the ranking (scale mismatch)
**What goes wrong:** Mill rate (~5–13) and median price (~$500k–$2.5M) live on wildly different scales; summing raw values lets price swamp everything. (PITFALLS.md Pitfall 14.)
**How to avoid:** Normalize every metric to [0,1] against its fixed range *before* weighting (Pattern 1). Never weight raw values.
**Warning signs:** Rankings track price alone; tiny weight tweaks reorder nothing.

### Pitfall 2: Mixed "higher/lower is better" direction
**What goes wrong:** Low mill rate/price/commute is *good*; high school/amenity is *good*. Summing without inverting the "lower-better" metrics produces backwards scores.
**How to avoid:** Fold direction into `normalize` (Pattern 1) so the output is always "higher = better." Echo `direction` in the breakdown for the tooltip.
**Warning signs:** Cheap, short-commute towns score *low*.

### Pitfall 3: Silent 0/NaN for missing data
**What goes wrong:** A missing metric defaults to 0 (worst) or NaN (drops the town or poisons the sum). (D-03 / UI-SPEC / PITFALLS 14.)
**How to avoid:** Flag `missing:true`, exclude from the composite, renormalize present weights (Pattern 3). Never impute.
**Warning signs:** A town with one missing metric sits at the bottom; `NaN` appears in any output string.

### Pitfall 4: Normalizing over the seeded set instead of fixed ranges
**What goes wrong:** Min-max over the current 24 towns means adding/removing a town silently re-scores every other town — non-reproducible. (D-09.)
**How to avoid:** Read `{min,max}` from `AssumptionsV4.townScoring.ranges` (fixed, versioned, snapshot-stable). Clamp out-of-range values to [0,1].
**Warning signs:** Editing the town list changes unrelated towns' composites; goldens drift on a data-only edit.

### Pitfall 5: Division by zero in normalization
**What goes wrong:** A misconfigured range where `max == min` yields `/0` → `Infinity`/`NaN`, which `canonicalJson` will (correctly) throw on later, or which poisons the score.
**How to avoid:** Guard `max > min` in `normalize` and throw a meaningful config error (Pattern 1) — the validate-and-throw idiom (`town-table.ts:71`).

### Pitfall 6: Float re-entry via `Number()`
**What goes wrong:** Comparing prices or computing ratios via `Number(...)` reintroduces IEEE-754 drift the whole core exists to prevent. (PITFALLS 1.)
**How to avoid:** All math in `Dec`; all dollar compares via `Money.toCents()` bigint. The only sanctioned `Number()` use in this codebase is a pure boundary range-check on an already-canonical string (e.g. `downPaymentPct` refine) — not money math.

### Pitfall 7: AssumptionsV4 bump accidentally drifts existing goldens
**What goes wrong:** Bumping `schemaVersion`/`DEFAULT_ASSUMPTIONS` is feared to change the TCO/affordability/FI goldens.
**Reality (verified against `golden.test.ts:108-150`):** The four result goldens serialize engine **outputs** (`runCanary`, `computeTco`+`rentVsBuy`, `affordabilityGap`, `fiImpact`) — **none serializes `schemaVersion` or the assumptions object**. A *purely additive* V3→V4 bump (new `townScoring` block, no existing leaf changed) leaves all four golden files byte-identical, because the TCO/affordability/FI math never reads `townScoring`.
**How to avoid / verify:** Make the V4 change strictly additive (touch no existing default leaf). Then **run the goldens** — they must stay green with no regeneration. If any drifts, that signals an unintended coupling to fix, *not* a fixture to re-bless. Add a **new** `town-scoring-golden-snapshot.json` for the new engine.

### Pitfall 8: Treating MA flags as computed or score-altering
**What goes wrong:** Flags get derived from metrics or nudged into the bucket/color.
**How to avoid:** Flags are static curated enums (D-05), `prop25` universal; they are pure metadata appended to the output and never touch composite/bucket. Engine emits enums only (no copy).

## Code Examples

### Worked-example composite test (the test-oracle strategy)
```typescript
// composite.test.ts — hand-compute the expected decimal string, assert EXACT equality (never toBeCloseTo).
// Pattern source: town-table.test.ts (exact string equality), property-tax precision discipline.
test('composite is the present-weight-renormalized weighted sum (worked example)', () => {
  // town: school=8/10 (range 1..10), millRate=6 (range 4..16, lowerBetter), price MISSING.
  // normalize(school)   = (8-1)/(10-1)            = 0.7777...   higherBetter
  // normalize(millRate) = (16-6)/(16-4)           = 0.8333...   lowerBetter
  // weights: school 0.20, millRate 0.15, price 0.30(dropped, missing) → present Σ = 0.35
  // composite = 0.7777*(0.20/0.35) + 0.8333*(0.15/0.35)  → assert the exact Dec.toFixed() string
  // and assert price contribution: { missing:true, normalizedValue:null, weightedContribution:null }
});
```

### Bucket boundary test
```typescript
// bucket.test.ts — boundaries are inclusive on the lower side (≤). stretchFactor '1.25'.
test('price exactly at budget is realistic; exactly at budget×1.25 is stretch; one cent above is fantasy', () => {
  expect(bucketOf(Money.of('500000'), Money.of('500000'), '1.25')).toBe('realistic');
  expect(bucketOf(Money.of('625000'), Money.of('500000'), '1.25')).toBe('stretch');     // 500k×1.25
  expect(bucketOf(Money.of('625000.01'), Money.of('500000'), '1.25')).toBe('fantasy');
});
```

### Reproducibility golden (add to root `golden.test.ts`)
```typescript
// Mirror the existing four golden blocks (golden.test.ts:152-214): compute scoreTowns over the FULL
// seeded table at a fixed budget+anchor from DEFAULT_ASSUMPTIONS, serialize via canonicalJson, and
// compare to a committed town-scoring-golden-snapshot.json. Regenerate ONLY via UPDATE_GOLDEN=1.
const TOWN_BUDGET = Money.of('750000');
const TOWN_ANCHOR = 'downtownBoston';
function canonicalTownScoreboard(): string {
  return canonicalJson(scoreTowns({ assumptions: DEFAULT_ASSUMPTIONS, budget: TOWN_BUDGET, anchor: TOWN_ANCHOR }));
}
```

### Type-test (no bare-number leak — mirror `fi/fi.type-test.ts`)
```typescript
// towns.type-test.ts — assert the score fields are decimal STRINGS, dollar rawValue not a bare number,
// and the bucket is the enum (|null), never a numeric sentinel.
declare const score: TownScore;
// @ts-expect-error -- composite is a decimal STRING ([0,1]), not a number.
const _c: number = score.composite; void _c;
// @ts-expect-error -- a MetricContribution.weightedContribution is a decimal string|null, not a number.
const _w: number = score.metrics[0].weightedContribution!; void _w;
```

## Output Type (the public barrel surface — Discretion gap #6)

```typescript
// score-towns.ts — exported from packages/core/src/index.ts under a new "Town scoring engine (Phase 5)" block.
export type Bucket = 'realistic' | 'stretch' | 'fantasy';
export type CommuteAnchor = 'downtownBoston' | 'kendallCambridge' | 'route128Burlington';
export type MaFlag = 'prop25' | 'betterment' | 'title5' | '40b';

export interface TownScore {
  readonly town: string;
  readonly composite: string | null;             // [0,1] decimal string; null only if ALL metrics missing
  readonly metrics: readonly MetricContribution[]; // the towns×metrics row (UI-SPEC matrix)
  readonly bucket: Bucket | null;                 // null = median price missing (renderer draws "No data")
  readonly flags: readonly MaFlag[];              // ['prop25', ...curated]; enums only, no copy
}
export interface TownScoreboard {
  readonly anchor: CommuteAnchor;                 // echoed back for the legend (UI-SPEC "commute to anchor")
  readonly budget: string;                        // echoed budget (decimal string)
  readonly stretchFactor: string;                 // echoed (decimal string)
  readonly towns: readonly TownScore[];           // renderer sorts by bucket then composite
}
export interface TownScoringInput {
  readonly assumptions: CurrentAssumptionSet;     // V4 — supplies townScoring weights/ranges/stretchFactor
  readonly budget: Money;                         // D-11 — caller decides the source
  readonly anchor: CommuteAnchor;                 // D-04 — selects a seeded anchor
  // towns subset is OUT OF SCOPE (D-01: score the full canonical 24)
}
export function scoreTowns(input: TownScoringInput): TownScoreboard;
```

Barrel placement: add a `// Town scoring engine (Phase 5: TOWN-01..04)` export block to `index.ts` after the FI block (`index.ts:116-133`), exporting `scoreTowns`, the result/input types, and the `Bucket`/`CommuteAnchor`/`MaFlag`/`MetricContribution`/`MetricDirection` types. Keep `Dec` unexported (the established boundary rule). The composite and contributions cross as **decimal strings** (the `fiDeltaYears` precedent), so no raw `Dec` leaks.

## Discretion Proposals (the numeric gaps — all `[ASSUMED]`, user-tunable data)

> These are proposed defaults for `AssumptionsV4.townScoring`. They are **stored, versioned, editable data** (D-06), not hardcoded math. Every value is `[ASSUMED]` and listed in the Assumptions Log for user confirmation in discuss/plan. Direction is locked by UI-SPEC; only the magnitudes are proposals.

### Default weight vector (Discretion #2) — lean price & commute heavier
| Metric | Weight | Rationale |
|--------|--------|-----------|
| medianPrice | `0.30` | Dominates a Boston buy decision; the single biggest affordability lever. |
| commute | `0.25` | Greater-Boston commutes vary enormously (10–75 min); a daily-life driver. |
| school | `0.20` | High-salience for the buyer profile; strong MA inter-town variance. |
| millRate (tax) | `0.15` | Real recurring cost (already a TCO driver); secondary to price/commute. |
| amenities | `0.10` | Quality-of-life modifier; least decision-critical of the five. |
| **Σ** | **1.00** | (Weights are relative — the engine renormalizes — but a clean sum aids legibility.) |

### Amenity sub-metrics + sub-weights (Discretion #4) — beach-app multi-amenity shape
| Sub-metric | Scale | Sub-weight | Rationale |
|-----------|-------|-----------|-----------|
| walkability | Walk Score 0–100 `[CITED: walkscore.com/methodology]` | `0.30` | Strongest day-to-day livability signal. |
| transit | Transit Score 0–100 `[CITED: walkscore.com/transit-score-methodology]` | `0.25` | T/commuter-rail access is a real greater-Boston differentiator. |
| dining | dining/nightlife index 0–100 | `0.25` | Beach-app "dining/nightlife" sub-metric analog. |
| parks | parks/recreation index 0–100 | `0.20` | Beach-app "parks/recreation" sub-metric analog. |
| **Σ** | | **1.00** | Sub-weights normalize among themselves (D-07). |

### Fixed reference ranges (Discretion #2 / D-09)
| Metric | `min` | `max` | Direction | Rationale / source |
|--------|-------|-------|-----------|--------------------|
| medianPrice | `400000` | `2500000` | lowerBetter | Greater-Boston single-family floor (~$400–500k outer towns) to ceiling (~$2M+ Weston/Wellesley/Newton); regional median ~$1M mid-2025, 35+ towns above $1M. `[CITED: bostonglobe.com / tbf.org Greater Boston Housing Report 2025]` `[ASSUMED magnitude]` |
| commute | `10` | `75` | lowerBetter | Peak drive-time minutes, inner-core (~10) to outer-ring (~75) to the anchor. `[ASSUMED]` |
| school | `1` | `10` | higherBetter | GreatSchools 1–10 rating scale (1–4 below avg, 5–6 avg, 7–10 above). `[CITED: greatschools.org/gk/about/ratings]` |
| millRate | `4` | `16` | lowerBetter | Brackets the seeded table (Cambridge 5.86 low … Lexington 12.86 high) with headroom; published $/$1,000. `[VERIFIED: town-table.ts seeded values]` |
| amenity (shared) | `0` | `100` | higherBetter | Walk/Transit/Bike-Score family scale; all amenity sub-metrics share 0–100. `[CITED: walkscore.com/methodology]` |

### stretchFactor (Discretion / D-08)
`1.25` — locked default per D-08 (realistic ≤ budget; stretch ≤ budget×1.25; fantasy beyond). `[ASSUMED magnitude, per D-08]`

### Display-only composite rescale (Discretion #3)
**Recommendation: do NOT rescale in the engine.** Emit the fixed-range composite as-is. Any min-max rescale of the *composite across towns* for heatmap lightness spread is a **rendering-fidelity** concern — push it to Phase 7 (it can rescale the emitted composites for lightness without touching the reproducible underlying values). Keeping the engine output fixed-range preserves snapshot reproducibility (D-09) and avoids a second normalization the goldens would have to pin. Document the per-metric normalization as the canonical, reproducible layer.

## Validation Architecture

> `workflow.nyquist_validation` is `true` in config — this section applies.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.x (`projects` config; core runs in node env, no JSX) |
| Config file | root `vitest.config.ts` / `vitest.shared.ts` (per CLAUDE.md; `extends` not allowed under `projects`) |
| Quick run command | `npx vitest run packages/core/src/towns` |
| Full suite command | `npm test` (root) / `npx vitest run` |
| Golden regeneration | `UPDATE_GOLDEN=1 npx vitest run packages/core/src/golden.test.ts` (gated, reviewable diff) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TOWN-01 | Fixed-range normalize + direction fold → [0,1] | unit | `npx vitest run packages/core/src/towns/normalize.test.ts` | ❌ Wave 0 |
| TOWN-01 | Composite + per-metric breakdown (worked example, exact string) | unit | `npx vitest run packages/core/src/towns/composite.test.ts` | ❌ Wave 0 |
| TOWN-01 | Missing-metric weight renormalization (drop + renormalize) | unit | `npx vitest run packages/core/src/towns/composite.test.ts` | ❌ Wave 0 |
| TOWN-02 | Bucket boundaries (== budget, == budget×1.25, just above) | unit | `npx vitest run packages/core/src/towns/bucket.test.ts` | ❌ Wave 0 |
| TOWN-03 | scoreTowns over seeded table → matrix shape + anchor echo | unit | `npx vitest run packages/core/src/towns/score-towns.test.ts` | ❌ Wave 0 |
| TOWN-03 | Reproducibility golden (canonical, byte-identical) | golden | `npx vitest run packages/core/src/golden.test.ts` | ⚠️ extend existing |
| TOWN-04 | Flags attached, prop25 universal, never alter score | unit | `npx vitest run packages/core/src/towns/score-towns.test.ts` | ❌ Wave 0 |
| D-06 | AssumptionsV4 migrate V1/V2/V3→V4 (verbatim copy + new block) | unit | `npx vitest run packages/core/src/assumptions/migrate.test.ts` | ⚠️ extend existing |
| CORE-02 | No bare-number dollar/score leak (compile-time) | type-test | `tsc -b` (picks up `towns.type-test.ts`) | ❌ Wave 0 |
| D-02 | Extended town rows parse through `townRowSchema.strict()` | unit | `npx vitest run packages/core/src/towns/town-table.test.ts` | ⚠️ extend existing |

### Sampling Rate
- **Per task commit:** `npx vitest run packages/core/src/towns` + `tsc -b`
- **Per wave merge:** `npm test` (full core suite, incl. goldens)
- **Phase gate:** Full suite green + the four existing goldens byte-identical (no regen) + the new town-scoring golden committed.

### Wave 0 Gaps
- [ ] `packages/core/src/towns/normalize.test.ts` — covers TOWN-01 (normalization + direction + clamp + /0 guard)
- [ ] `packages/core/src/towns/composite.test.ts` — covers TOWN-01 (composite + missing renormalization)
- [ ] `packages/core/src/towns/bucket.test.ts` — covers TOWN-02 (bucket boundaries)
- [ ] `packages/core/src/towns/score-towns.test.ts` — covers TOWN-03/TOWN-04 (end-to-end + flags)
- [ ] `packages/core/src/towns/towns.type-test.ts` — covers CORE-02 (no bare-number leak)
- [ ] Extend `town-table.test.ts`, `migrate.test.ts`, `schema.test.ts`, `golden.test.ts` (new town-scoring golden block + fixture)
- [ ] Framework install: none — Vitest already configured.

## Security Domain

> `security_enforcement: true`, `security_asvs_level: 1`. Phase 5 is a pure offline calc engine over static seed data — most ASVS categories are structurally N/A. The relevant control is input validation at the Zod boundary.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No auth surface (private 2-user local tool; no network in scope). |
| V3 Session Management | no | No sessions. |
| V4 Access Control | no | No multi-tenant / access surface. |
| V5 Input Validation | **yes** | Extended `townRowSchema.strict()` + `AssumptionsV4` Zod schema (reuse `decStr`); `budget` enters only as a `Money` (canonical decimal); `anchor` is a closed enum. Untrusted/seed data parses THROUGH the schema, never spread raw. |
| V6 Cryptography | no | No crypto; no secrets. (And no `Math.random()` — determinism guard forbids it.) |

### Known Threat Patterns for a pure decimal-scoring engine
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Float/`NaN`/`Infinity` poisoning the composite | Tampering | `Dec` clone + canonical-decimal-string boundary (`decStr`/`CANONICAL_DECIMAL_RE`); `canonicalJson` throws on non-finite. |
| Division by zero (degenerate `max==min` range) | DoS | Guard `max > min` in `normalize` (validate-and-throw). |
| Forged/corrupt assumptions (bad `schemaVersion`, float leaf) | Tampering | `discriminatedUnion` rejects unknown versions; `decStr` rejects floats; `parseAssumptionSet` is the only entry. |
| Unknown/malformed town in seed | Tampering | `.strict()` rejects unknown keys; resolver throws on unknown town (no silent default). |
| Untrusted budget input | Tampering | Crosses only as `Money.of(canonicalString)` — bare floats rejected at the Money boundary. |

No high/critical security findings — the architecture (pure, no I/O, no secrets, Zod boundary, decimal-string discipline) already mitigates the realistic threats. No `security_block_on: high` items.

## Assumptions Log

> All claims tagged `[ASSUMED]` (magnitudes are user-tunable AssumptionsV4 data — confirm in discuss/plan). Scales/directions are `[CITED]` or locked.

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Default weight vector price `.30`/commute `.25`/school `.20`/millRate `.15`/amenities `.10` | Discretion Proposals | LOW — relative weights, user-editable; only shifts default ranking emphasis. |
| A2 | Amenity sub-weights walkability `.30`/transit `.25`/dining `.25`/parks `.20` | Discretion Proposals | LOW — editable; affects only the amenities sub-composite. |
| A3 | medianPrice range `[400000, 2500000]` | Discretion Proposals | MEDIUM — too-narrow range clamps many towns to 0/1, flattening spread. Confirm against the chosen seed vintage. |
| A4 | commute range `[10, 75]` minutes | Discretion Proposals | MEDIUM — seed-dependent; confirm once anchor drive-times are seeded. |
| A5 | millRate range `[4, 16]` | Discretion Proposals | LOW — brackets the seeded table with headroom (verified against `town-table.ts`). |
| A6 | school range `[1,10]`, amenity range `[0,100]` | Discretion Proposals | LOW — established external scales (GreatSchools, Walk Score). |
| A7 | stretchFactor `1.25` | Discretion / D-08 | LOW — locked default by D-08; user-editable. |
| A8 | Three commute anchors: downtownBoston, kendallCambridge, route128Burlington | Pattern 6 / Output Type | LOW — D-04 says "small fixed set (e.g. downtown Boston, Kendall, +1)"; the third anchor is a proposal. |
| A9 | Amenity sub-metric **values** for the 24 towns (walk/transit/dining/parks) are hand-seeded | town-table extension | MEDIUM — these are hand-curated estimates (no live source, D-02); accuracy is the user's call. Honest seeding + `missing:true` where unknown. |
| A10 | The four existing result goldens stay byte-identical after the additive V3→V4 bump | Pitfall 7 | LOW-MEDIUM — verified by inspection of `golden.test.ts` (no golden serializes `schemaVersion`/assumptions); the plan must CONFIRM by running goldens, not regenerating. |

**If a town's real metric value is genuinely unknown, seed it absent (missing), not guessed** — D-03 makes "no data" a first-class, honest output.

## Open Questions

1. **Per-metric vintage/source stamping granularity (D-02).**
   - What we know: D-02 requires per-metric vintage/source stamps mirroring the FY-stamped mill rate. The mill rate stamps the *whole row* with one `fy`.
   - What's unclear: whether each new metric needs its own `{value, asOf, source}` stamp object, or a parallel per-row provenance block suffices.
   - Recommendation: stamp per metric as `{ value: decStr, asOf: <int year or label>, source: string }` (absent field = missing), so each metric is independently auditable and "missing" is just an absent key. Confirm the exact stamp shape with the planner; keep `.strict()`.

2. **Bucket-for-missing-price representation.**
   - What we know: median price can be missing (D-03); the bucket enum is locked to three values; UI-SPEC has a distinct "No data" treatment.
   - Recommendation: `bucket: Bucket | null` (null = price missing). Alternative: a discriminated `{kind}` union (FiOutcome-style). Minor — planner picks one; the nullable field is simpler and sufficient.

3. **Should `Money` gain a comparator, or compare via `toCents()`?**
   - Recommendation: compare via `Money.toCents()` bigint (no change to the closed `Money` primitive — golden-safe, smaller blast radius). Revisit a `Money.lte()` only if bucketing readability demands it.

4. **`ΣpresentWeight == 0` and "all metrics missing" edge handling.**
   - Recommendation: composite `null` + every contribution `missing`/`null` (never 0). The plan must include explicit tests for both edges.

## Sources

### Primary (HIGH confidence — in-repo code, cited file:line)
- `packages/core/src/towns/town-table.ts`, `town-table.schema.ts`, `town-table.test.ts` — the table to extend + `.strict()`+`decStr` row boundary + test style.
- `packages/core/src/assumptions/{schema,migrate,defaults,migrate.test}.ts` — the V1→V2→V3 versioning precedent to copy for V4.
- `packages/core/src/money/{money,decimal-config}.ts` — `Money` closed API + `Dec` clone (the math + comparison primitives).
- `packages/core/src/fi/{sensitivity,fi.type-test}.ts` — `Dec`-based perturbation math, decimal-string outputs, "enums not copy" precedent, no-bare-number type-test.
- `packages/core/src/golden.test.ts` + `serialize/canonical-json.ts` — gated-golden reproducibility harness; proof the four result goldens don't serialize assumptions.
- `packages/core/src/index.ts` — the barrel-export convention (Money-only boundary, Dec unexported).
- `.planning/phases/05-town-scoring-heatmap/05-UI-SPEC.md` + `05-CONTEXT.md` — the locked data/encoding contract + decisions.
- `.planning/research/PITFALLS.md` Pitfall 14 (+1,9) — normalization/weighting/missing-data pitfalls.

### Secondary (MEDIUM — external scales, verified via official docs)
- GreatSchools 1–10 rating scale — `[CITED: greatschools.org/gk/about/ratings]`
- Walk/Transit/Bike Score 0–100 — `[CITED: walkscore.com/methodology, /transit-score-methodology]`
- Greater-Boston single-family median ~$1M mid-2025, 35+ towns >$1M, Weston/Wellesley/Newton ~$2M+ — `[CITED: bostonglobe.com 2026-04-21, tbf.org Greater Boston Housing Report Card 2025]`

### Tertiary (LOW — `[ASSUMED]` magnitudes for user confirmation)
- Default weight vector, amenity sub-weights, commute range, the third commute anchor — proposals in the Assumptions Log; user-tunable AssumptionsV4 data.

## Metadata

**Confidence breakdown:**
- Standard stack / patterns: HIGH — every pattern is an in-repo precedent cited by file:line; no new deps.
- Architecture (composite/normalize/bucket/migrate/output): HIGH — direct clones of existing code; algorithm fully pinned by D-01..D-12 + UI-SPEC.
- Numeric proposals (ranges/weights): MEDIUM (`[ASSUMED]`) — defensible + scale-grounded, but user-tunable data, not math; flagged for confirmation.
- Goldens-stay-green claim (A10): HIGH by inspection, but the plan must VERIFY by running goldens.

**Research date:** 2026-06-27
**Valid until:** ~2026-07-27 (stable — depends on in-repo patterns + slow-moving external scales; the `[ASSUMED]` price range should be re-grounded to the chosen seed vintage at plan time).
