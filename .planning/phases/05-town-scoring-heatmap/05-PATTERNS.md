# Phase 5: Town Scoring & Heatmap - Pattern Map

**Mapped:** 2026-06-27
**Files analyzed:** 18 (10 new, 8 modified/extended)
**Analogs found:** 18 / 18 (every file has an in-repo analog — Phase 5 is pattern-reuse, no greenfield abstraction)

> Scope: engine-only, `packages/core/src/towns/` + `packages/core/src/assumptions/`. Zero framework deps. All numeric math in the `Dec` clone, dollars as `Money`, boundaries via Zod `.strict()` + `decStr`, reproducibility via gated `canonicalJson` golden. Every analog below is a direct, file:line-cited precedent the planner should instruct tasks to clone — not approximate.

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `towns/normalize.ts` (NEW) | utility (pure math) | transform | `fi/sensitivity.ts` (`absolute`/`relative` Dec helpers, L97-107) | role+flow match |
| `towns/normalize.test.ts` (NEW) | test | transform | `towns/town-table.test.ts` (exact-string asserts) | role match |
| `towns/composite.ts` (NEW) | service (pure aggregator) | transform/batch | `tco/property-tax.ts` (Dec→Money, breakdown record build) + `fi/sensitivity.ts` (spec-table iteration) | role+flow match |
| `towns/composite.test.ts` (NEW) | test | transform | `assumptions/migrate.test.ts` (worked-example exact asserts) | role match |
| `towns/bucket.ts` (NEW) | utility (pure overlay) | transform | `money/money.ts` (`toCents()` bigint boundary, L77-79) | flow match |
| `towns/bucket.test.ts` (NEW) | test | transform | `towns/town-table.test.ts` (boundary/throw asserts) | role match |
| `towns/score-towns.ts` (NEW) | service (top-level engine entry) | batch/request-response | `fi/sensitivity.ts` (`tornado(input)` top-level: map over set → closed result) | role+flow match |
| `towns/score-towns.test.ts` (NEW) | test | batch | `towns/town-table.test.ts` + `assumptions/migrate.test.ts` | role match |
| `towns/towns.type-test.ts` (NEW) | test (type-level) | — | `fi/fi.type-test.ts` (`@ts-expect-error` no-bare-number guard) | exact |
| Town-scoring output types (in `score-towns.ts`) | model (result/input interfaces) | — | `fi/sensitivity.ts` (`TornadoRow`/`TornadoResult` closed `readonly` interfaces) + research §Output Type | exact |
| `assumptions/schema.ts` (MODIFY) | config/model (Zod boundary) | — | Same file, `AssumptionsV2`→`AssumptionsV3` precedent (L143-257) | exact (self-precedent) |
| `assumptions/defaults.ts` (MODIFY) | config (seed data) | — | Same file, V3 default block (L70-90) | exact (self-precedent) |
| `assumptions/migrate.ts` (MODIFY) | service (version step-up) | transform | Same file, `v2ToV3` arm + switch (L30-87) | exact (self-precedent) |
| `assumptions/migrate.test.ts` (MODIFY) | test | transform | Same file, `V2_FIXTURE`→V3 test (L35-93) | exact (self-precedent) |
| `towns/town-table.ts` (MODIFY) | model (seed data) | — | Same file, the 24 mill-rate rows (L24-49) | exact (self-precedent) |
| `towns/town-table.schema.ts` (MODIFY) | config/model (Zod row) | — | Same file, `townRowSchema` (L20-26) | exact (self-precedent) |
| `towns/town-table.test.ts` (MODIFY) | test | — | Same file, parse-through-schema asserts (L17-28) | exact (self-precedent) |
| `golden.test.ts` (MODIFY) | test (reproducibility) | — | Same file, the four existing golden blocks (L148-214) | exact (self-precedent) |
| `index.ts` (MODIFY) | config (barrel) | — | Same file, the FI export block (L106-133) | exact (self-precedent) |

---

## Shared Patterns

These cross-cut every new Phase-5 file. The planner should reference them in every relevant task rather than re-describe them per file.

### S1. `Dec` decimal math (never bare `number`)
**Source:** `packages/core/src/money/decimal-config.ts:20-23` (the single sanctioned constructor)
**Apply to:** `normalize.ts`, `composite.ts`, anywhere a ratio/sum is computed.
The one configured clone — 34-digit, `ROUND_HALF_EVEN`. Import `{ Dec }`, construct with `new Dec(str)`, emit results with `.toFixed()` as a canonical decimal string. Never the global `Decimal`, never `Decimal.set(...)`.
```typescript
import { Dec } from '../money/decimal-config.js';
// perturbation precedent — sensitivity.ts:98-101
function absolute(rate: string, band: string, dir: Direction): string {
  const b = new Dec(band);
  return (dir === '+' ? new Dec(rate).plus(b) : new Dec(rate).minus(b)).toFixed();
}
```
Composite/normalized/weight values cross as **decimal strings**, exactly like `fiDeltaYears` / `FiOutcome.years` (see `index.ts:110-115`). `Dec` is NEVER re-exported from the barrel.

### S2. `Money.toCents()` bigint comparison for bucketing
**Source:** `packages/core/src/money/money.ts:62-79` (`mul(rateStr)` + `toCents(): bigint`)
**Apply to:** `bucket.ts` only.
Dollars enter as `Money`; compare via exact integer cents — no `Number()`, no epsilon. `budget × stretchFactor` uses `Money.mul(decimalString)` (the rate is a canonical decimal string, e.g. `'1.25'`). No change to the closed `Money` primitive is required (golden-safe).
```typescript
// money.ts:77-79
toCents(): bigint {
  return BigInt(this.v.times(100).toDecimalPlaces(0).toFixed(0));
}
```

### S3. Zod `.strict()` + `decStr` boundary
**Source:** `packages/core/src/assumptions/schema.ts:24-37` (`CANONICAL_DECIMAL_RE`, `decStr`, `group`)
**Apply to:** `town-table.schema.ts` extension, `AssumptionsV4.townScoring` block.
Reuse the SAME `decStr` — one definition of "canonical decimal string" across every door. `.strict()` rejects unknown keys; floats are rejected at parse. Namespaced sub-objects use the `group<Shape>()` helper (`schema.ts:37`).

### S4. Enum identifiers only — no UI copy in the engine
**Source:** `packages/core/src/fi/sensitivity.ts:35-36` (`TornadoDriver` is "a plain string literal — NO UI copy; Phase 7 owns wording")
**Apply to:** `MaFlag`, `Bucket`, `CommuteAnchor`, `MetricDirection` unions.
The engine emits enum string literals; chip labels, palette, and copy live in Phase 7 (locked by `05-UI-SPEC.md`). Note `PROP_2_5_FLAG` prose already exists at `tco/property-tax.ts:27` — do NOT re-embed that string in the Phase-5 town-scoring output; emit `'prop25'`.

### S5. Closed `readonly` result interfaces
**Source:** `packages/core/src/fi/sensitivity.ts:46-68` (`TornadoRow`/`TornadoResult` — every field `readonly`, JSDoc per field)
**Apply to:** `TownScore`, `TownScoreboard`, `MetricContribution`, `TownScoringInput`.
All fields `readonly`; result types fully closed; documented field-by-field. Exact target shape is pinned in RESEARCH §"Output Type" (L405-431).

### S6. Validate-and-throw, no silent default
**Source:** `packages/core/src/towns/town-table.ts:69-78` (`resolveMillRate` throws on unknown town)
**Apply to:** any new resolver (e.g. selecting a commute anchor's seeded drive-time); the `normalize` zero-width-range guard.
A missing/unknown key is a hard error, never a quiet fallback. Pair with the missing-metric `missing:true` flagging (never impute 0 — D-03).

### S7. Determinism — pure function of explicit inputs
**Source:** the header contracts in `towns/town-table.ts:1-15`, `defaults.ts:1-11`, `sensitivity.ts:21-24`
**Apply to:** every new file. No `Date.now()`, no `Math.random()`, no env, no module-level mutable state (the determinism guard throws; lint enforces it). `scoreTowns` is a pure function of `(assumptions, budget, anchor)` over the seeded table.

---

## Pattern Assignments

### `towns/normalize.ts` (utility, transform) — NEW

**Analog:** `fi/sensitivity.ts:97-107` (the `absolute`/`relative` Dec string helpers — the exact "take strings, compute in `Dec`, return `.toFixed()`" shape).

**Imports pattern** (clone `sensitivity.ts:25`):
```typescript
import { Dec } from '../money/decimal-config.js';
```

**Core pattern** — fixed-range scale + direction fold + clamp + zero-width guard. RESEARCH §Pattern 1 (L188-197) gives the target verbatim; the `Dec` idioms come from `sensitivity.ts:98-106` and the guard idiom from `town-table.ts:71`:
```typescript
export type MetricDirection = 'higherBetter' | 'lowerBetter';

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
**Direction map (locked by UI-SPEC):** `medianPrice`/`commute`/`millRate` = `lowerBetter`; `school`/`amenities`(+ each sub-metric) = `higherBetter`.

**Error handling:** the zero-width-range throw mirrors `town-table.ts:71-76` (validate-and-throw). Division guard prevents the `Infinity`/`NaN` that `canonicalJson` would later reject (`canonical-json.ts:48-52`).

---

### `towns/composite.ts` (service, transform/batch) — NEW

**Analog:** `tco/property-tax.ts:53-101` (build a per-item record array with `Dec`→`Money` discipline, return a closed result) + `fi/sensitivity.ts:243-254` (`map` over a driver set → accumulate → closed result).

**Core pattern** — per-metric `MetricContribution` breakdown + missing-weight renormalization. Target interface is pinned in RESEARCH §Pattern 2 (L208-219); algorithm in §Pattern 3 (L227-233):
```typescript
export interface MetricContribution {
  readonly metric: string;
  readonly rawValue: string | null;            // canonical decimal string; null when missing
  readonly normalizedValue: string | null;     // [0,1] string; null when missing
  readonly direction: MetricDirection;
  readonly weight: string;                       // CONFIGURED weight (from AssumptionsV4)
  readonly weightedContribution: string | null;  // norm · (weight / ΣpresentWeight); null when missing
  readonly missing: boolean;
  readonly subMetrics?: readonly MetricContribution[]; // amenity sub-breakdown
}
// composite = Σ over present metrics of weightedContribution  ∈ [0,1]   (Dec, .toFixed())
```
Renormalization (all in `Dec`): `Σpresent = Σ weight_m` over present metrics; `composite = Σ ( norm_m · weight_m / Σpresent )`. Amenities is itself a sub-composite over its sub-metrics (renormalize among present sub-weights; if ALL sub-metrics missing → the amenities metric is `missing:true`).

**Edge cases the planner MUST task (RESEARCH §Pattern 3 + Open Q4, L571-573):** (a) all metrics missing → `composite: null`, every contribution `missing:true`/`null` (never 0); (b) `Σpresent == 0` → guard → `composite: null` (documented). Never impute (S6 / D-03).

**`Dec` discipline:** `tco/property-tax.ts:53-54` is the model for "compute a dimensionless rate in `Dec`, never bare number." Composite is a **decimal string, NOT `Money`** (it is dimensionless — RESEARCH Anti-Patterns L295, Alternatives L106).

---

### `towns/bucket.ts` (utility, transform) — NEW

**Analog:** `money/money.ts:62-79` (`mul` + `toCents()` — the only sanctioned dollar-comparison primitives).

**Core pattern** — separate, budget-dependent overlay (RESEARCH §Pattern 4, L244-254):
```typescript
import { Money } from '../money/money.js';
export type Bucket = 'realistic' | 'stretch' | 'fantasy';

export function bucketOf(medianPrice: Money, budget: Money, stretchFactor: string): Bucket {
  const price = medianPrice.toCents();
  const ceil = budget.toCents();
  const stretchCeil = budget.mul(stretchFactor).toCents();
  if (price <= ceil) return 'realistic';
  if (price <= stretchCeil) return 'stretch';
  return 'fantasy';
}
```
**Missing-price handling:** the caller (`score-towns.ts`) surfaces `bucket: Bucket | null` where `null` = median price missing (RESEARCH Open Q2, L564-566; UI-SPEC "No data" / hatched-gray). Boundaries are inclusive on `≤` (RESEARCH bucket boundary test, L373-377). This function NEVER reads the composite (D-12 two-channel separation).

---

### `towns/score-towns.ts` (service entry + output types, batch) — NEW

**Analog:** `fi/sensitivity.ts:239-255` (`tornado(input)` — the top-level: read stored bands from `input.assumptions`, `map` over a fixed set, assemble a closed `readonly` result). This is the structural twin of `scoreTowns`.

**Output types** (exact target — RESEARCH §Output Type, L405-431; closed-interface style from `sensitivity.ts:46-68`):
```typescript
export type Bucket = 'realistic' | 'stretch' | 'fantasy';
export type CommuteAnchor = 'downtownBoston' | 'kendallCambridge' | 'route128Burlington';
export type MaFlag = 'prop25' | 'betterment' | 'title5' | '40b';

export interface TownScore {
  readonly town: string;
  readonly composite: string | null;              // [0,1] decimal string; null iff ALL metrics missing
  readonly metrics: readonly MetricContribution[];
  readonly bucket: Bucket | null;                  // null = median price missing
  readonly flags: readonly MaFlag[];               // ['prop25', ...curated]; enums only
}
export interface TownScoreboard {
  readonly anchor: CommuteAnchor;
  readonly budget: string;                         // echoed (decimal string)
  readonly stretchFactor: string;                  // echoed (decimal string)
  readonly towns: readonly TownScore[];
}
export interface TownScoringInput {
  readonly assumptions: CurrentAssumptionSet;      // V4 — supplies townScoring weights/ranges/stretchFactor
  readonly budget: Money;
  readonly anchor: CommuteAnchor;
}
export function scoreTowns(input: TownScoringInput): TownScoreboard;
```

**Core pattern** — read tunables off `input.assumptions.townScoring` (NEVER hardcoded — the `sensitivity.ts:199` `input.assumptions.sensitivity[...]` precedent), iterate `TOWN_RATE_TABLE`, call `composite` + `bucket` per town, echo `anchor`/`budget`/`stretchFactor`.

**Flags pattern** (RESEARCH §Pattern 5, L256-264): `prop25` is universal → engine prepends it: `['prop25', ...(row.flags ?? [])]`. Flags never touch composite or bucket (S4 / Pitfall 8).

**Commute anchor selection** (D-04): the `anchor` enum selects among the seeded per-town anchor drive-times; missing that anchor's value → the commute metric is `missing:true` (S6 — never impute).

---

### `towns/towns.type-test.ts` (type-test) — NEW

**Analog:** `fi/fi.type-test.ts` (the whole file — `@ts-expect-error` assertions that bare-number misuse is a compile error; NOT a `*.test.ts`, so `tsc -b` picks it up).

**Pattern** (clone `fi.type-test.ts:31-101`):
```typescript
import type { TownScore } from './score-towns.js';
declare const score: TownScore;
// @ts-expect-error -- composite is a decimal STRING ([0,1]|null), not a number.
const _c: number = score.composite!; void _c;
// @ts-expect-error -- weightedContribution is a decimal string|null, not a number.
const _w: number = score.metrics[0].weightedContribution!; void _w;
```
Assert: composite/normalizedValue/weight/weightedContribution are decimal strings (not numbers); the price `rawValue` is not a bare number; `bucket` is the enum|null (no numeric sentinel). Mirror the `void _x` discharge idiom (`fi.type-test.ts:36`) so unused suppressions fail `tsc -b` (TS2578) if the guarantee regresses.

---

### `assumptions/schema.ts` → add `AssumptionsV4` (config/model) — MODIFY

**Analog (self-precedent):** the `AssumptionsV2`→`AssumptionsV3` bump in the SAME file (`schema.ts:143-257`). Copy that mechanic exactly.

**Mechanical steps** (RESEARCH §Pattern 6, L268-291):
1. Add `AssumptionsV4 = z.object({ schemaVersion: z.literal(4), ...all V3 slices copied verbatim..., townScoring: group({...}) }).strict()` — mirror how V3 copies every V2 leaf verbatim then appends new groups (`schema.ts:158-227`).
2. Append `AssumptionsV4` to `AssumptionSetSchema = z.discriminatedUnion('schemaVersion', [V1,V2,V3,V4])` (`schema.ts:233-237`).
3. `CURRENT_VERSION = 4` (`schema.ts:240`).
4. Add `z.infer<typeof AssumptionsV4>` to `AnyAssumptionSet` (`schema.ts:251-254`).
5. `CurrentAssumptionSet = z.infer<typeof AssumptionsV4>` (`schema.ts:257`).

**`townScoring` block shape** (every leaf `decStr` via `group`, RESEARCH L281-290):
```
townScoring: group({
  weights: group({ medianPrice, commute, school, millRate, amenities }),  // 5 decStr
  amenityWeights: group({ walkability, transit, dining, parks }),
  ranges: group({
    medianPrice: group({ min, max }), commute: group({ min, max }), school: group({ min, max }),
    millRate: group({ min, max }), amenity: group({ min, max }),
  }),
  bucket: group({ stretchFactor }),
})
```

---

### `assumptions/defaults.ts` → add `townScoring` defaults (config/seed) — MODIFY

**Analog (self-precedent):** the V3 `sensitivity`/`projection` default blocks in the SAME file (`defaults.ts:70-90`) — `[ASSUMED]`-tagged decimal-string literals with rationale comments.

**Pattern:** bump `schemaVersion: 4`; add the `townScoring` block with RESEARCH's proposed (user-tunable) values, each a `decStr`, each `[ASSUMED]`-tagged like the existing sensitivity comments (`defaults.ts:70-82`):
- weights: medianPrice `'0.30'`, commute `'0.25'`, school `'0.20'`, millRate `'0.15'`, amenities `'0.10'` (RESEARCH L442-447).
- amenityWeights: walkability `'0.30'`, transit `'0.25'`, dining `'0.25'`, parks `'0.20'` (L451-456).
- ranges: medianPrice `{min:'400000',max:'2500000'}`, commute `{min:'10',max:'75'}`, school `{min:'1',max:'10'}`, millRate `{min:'4',max:'16'}`, amenity `{min:'0',max:'100'}` (L460-465).
- bucket.stretchFactor `'1.25'` (D-08, L468).

**Critical (Pitfall 7, L345-348):** the V3→V4 change MUST be strictly ADDITIVE — touch no existing default leaf — so the four existing result goldens stay byte-identical (none serializes `schemaVersion`/assumptions).

---

### `assumptions/migrate.ts` → add `v3ToV4` (service, transform) — MODIFY

**Analog (self-precedent):** `v2ToV3` in the SAME file (`migrate.ts:79-87`) + the switch arms (`migrate.ts:30-47`).

**Pattern** (RESEARCH §Pattern 6.3, L274):
```typescript
// clone of v2ToV3 (migrate.ts:79-87)
function v3ToV4(set: V3Set): CurrentAssumptionSet {
  return { ...set, schemaVersion: 4, townScoring: { ...DEFAULT_ASSUMPTIONS.townScoring } };
}
```
Extend the switch (mirror the chaining at `migrate.ts:30-42`): `case 1: v3ToV4(v2ToV3(v1ToV2(set)))`, `case 2: v3ToV4(v2ToV3(set))`, `case 3: v3ToV4(set)`, `case 4: set`. Add `type V3Set = z.infer<typeof AssumptionsV3>` alongside the existing `V1Set`/`V2Set` (`migrate.ts:13-16`). Keep the `assertNever` exhaustiveness guard (`migrate.ts:89-93`).

---

### `assumptions/migrate.test.ts` → add V3→V4 coverage (test) — MODIFY

**Analog (self-precedent):** the `V2_FIXTURE`→V3 test in the SAME file (`migrate.test.ts:35-93`) — distinct seed values prove verbatim copy + new block from defaults.

**Pattern:** add a `V3_FIXTURE` (distinct decimal-string leaves from defaults), assert V3 leaves copied verbatim + `townScoring` filled from `DEFAULT_ASSUMPTIONS` (mirror `migrate.test.ts:69-92`). Update the V1/V2 chained-completion tests (`migrate.test.ts:95-118`) to also assert the new `townScoring` block is present after the full chain. Bump the `CURRENT_VERSION`/`schemaVersion` expectations to 4.

---

### `towns/town-table.ts` → extend rows with metrics + flags (model/seed) — MODIFY

**Analog (self-precedent):** the existing 24 FY-stamped rows in the SAME file (`town-table.ts:24-49`) — static literal data, no computation, header contract at L1-15.

**Pattern (D-01/D-02/D-05):** extend each of the 24 existing rows in place (do NOT add a second registry) with the new per-metric fields + curated `flags`. Per RESEARCH Open Q1 (L559-562), stamp each new metric per-metric as `{ value: decStr, asOf, source }` (absent = missing — D-03), mirroring the per-row `fy` vintage idiom. Commute is a small map of seeded anchor → drive-time minutes (D-04). `flags` holds only curated `betterment`/`title5`/`40b` (prop25 is injected by the engine, not stored — S4). `millRate` is already metric #1 (reuse the seeded `residentialMillRate`). Keep the `readonly TownR(...)[]` typing so a shape change is a compile error (`town-table.ts:15`).

---

### `towns/town-table.schema.ts` → extend `townRowSchema` (config/Zod) — MODIFY

**Analog (self-precedent):** `townRowSchema` in the SAME file (`town-table.schema.ts:20-26`) — `.strict()` + reused `decStr`.

**Pattern (S3):** add the new metric fields (medianPrice, school, commute-anchor map, amenity sub-metrics) + the `MaFlag` enum array to the `.strict()` object, each numeric leaf a `decStr` (reuse the existing `import { decStr } from '../assumptions/schema.js'`, L13). Optional/absent leaf = "missing" (D-03). The per-metric stamp sub-object uses a `.strict()` group too. `z.infer` keeps `TownRateRow` the single source of truth (`town-table.schema.ts:29`).

---

### `towns/town-table.test.ts` → extend parse/seed asserts (test) — MODIFY

**Analog (self-precedent):** the SAME file (`town-table.test.ts:17-28`) — "every row parses through the schema, no float, no extra keys."

**Pattern:** keep the `for (const row of TABLE) expect(schema.safeParse(row).success).toBe(true)` loop (`town-table.test.ts:17-21`); add asserts that seeded metrics are canonical strings, that a deliberately-missing metric is absent (not 0), and that curated flags parse. Exact-string equality, never `toBeCloseTo` (`town-table.test.ts:32-39`).

---

### `golden.test.ts` → add town-scoring golden block (test) — MODIFY

**Analog (self-precedent):** the four existing golden blocks in the SAME file (`golden.test.ts:148-214`) — compute → `canonicalJson` → compare to a committed fixture, gated `UPDATE_GOLDEN=1` write (NEVER `toMatchSnapshot`).

**Pattern** (RESEARCH §Reproducibility golden, L381-390):
```typescript
const TOWN_BUDGET = Money.of('750000');
const TOWN_ANCHOR = 'downtownBoston';
function canonicalTownScoreboard(): string {
  return canonicalJson(scoreTowns({ assumptions: DEFAULT_ASSUMPTIONS, budget: TOWN_BUDGET, anchor: TOWN_ANCHOR }));
}
```
Add a new `town-scoring-golden-snapshot.json` fixture path (clone the path const at `golden.test.ts:49-52`) and a new `describe` block mirroring `golden.test.ts:200-214` (the FI golden block) including the `UPDATE_GOLDEN` gated write. **Do NOT regenerate the four existing goldens** — they must stay green untouched (Pitfall 7 / A10, L347-348); a drift there signals an unintended coupling to fix, not a fixture to re-bless.

---

### `index.ts` → add Town-scoring export block (barrel) — MODIFY

**Analog (self-precedent):** the FI export block in the SAME file (`index.ts:106-133`) — a commented block exporting the entry function + closed types, with `Dec` kept unexported.

**Pattern:** add a `// Town scoring engine (Phase 5: TOWN-01..04)` block after the FI block (`index.ts:133`) exporting `scoreTowns` + `TownScore`/`TownScoreboard`/`TownScoringInput`/`MetricContribution` and the `Bucket`/`CommuteAnchor`/`MaFlag`/`MetricDirection` types. Also export `AssumptionsV4` in the assumptions block (clone `index.ts:14-23`). Keep `Dec` unexported and composite/contributions crossing as decimal strings (the documented boundary rule, `index.ts:7-9`, L110-115).

---

## No Analog Found

None. Every new and modified file maps to a concrete in-repo precedent (most to a self-precedent in the same file or to `fi/sensitivity.ts` / `tco/property-tax.ts`). The only genuinely new logic is the normalize→weight→renormalize→bucket math, and even that mirrors the `Dec`-string perturbation helpers in `sensitivity.ts:97-107`.

---

## Metadata

**Analog search scope:** `packages/core/src/{towns,assumptions,money,fi,tco,serialize}/` + `packages/core/src/{golden.test.ts,index.ts}`
**Files read (analogs):** town-table.ts, town-table.schema.ts, town-table.test.ts, assumptions/{schema,migrate,defaults,migrate.test,assumption-set}.ts, money/{money,decimal-config}.ts, fi/{sensitivity,fi.type-test}.ts, tco/property-tax.ts, serialize/canonical-json.ts, golden.test.ts, index.ts (14 analog files)
**Pattern extraction date:** 2026-06-27
</content>
</invoke>
