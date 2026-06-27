# Phase 5: Town Scoring & Heatmap - Context

**Gathered:** 2026-06-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Build the **pure Town Scoring engine** in `packages/core/src/towns/` — a weighted, normalized composite score over MA towns; realistic/stretch/fantasy bucketing against a budget; an explainable heatmap-ready data output; and qualitative MA-specific flags.

**This phase is engine-only.** There is no `apps/web`, no Next.js, no rendering. Per `05-UI-SPEC.md`, the actual heatmap *pixels* are delivered in Phase 7 (Web Shell). Phase 5 emits the **data + encoding contract** the renderer consumes; it does not draw anything.

Largely independent of the Affordability/FI chain (depends only on Phase 1 types/money/assumptions + seed data).

</domain>

<decisions>
## Implementation Decisions

### Seed town data
- **D-01:** Reuse the existing **24 curated greater-Boston towns** already in `town-table.ts`. Extend that one canonical list with the new scoring metrics — do **not** create a second town registry. (Wider coverage = out of scope this phase.)
- **D-02:** Seed all new metrics (median price, school rating, commute, amenity sub-scores) as **static hand-seeded literal values, per-metric vintage/source-stamped** — mirroring the existing FY-stamped mill-rate row pattern. No live API for any metric (commute API is an explicit anti-feature per FEATURES.md).
- **D-03:** Missing metric values are **flagged explicitly** (`missing: true`) and **never imputed, zero-filled, or hidden** — enforces the UI-SPEC "no silent 0/NaN" rule at the data layer.
- **D-04:** **Commute** is seeded as estimated peak **drive-time (minutes) to a small fixed set of canonical anchors** (e.g. downtown Boston, Kendall/Cambridge, +1). The configurable commute-anchor input **selects among the seeded anchor set** — genuinely configurable within honest seeded data, no live traffic API.
- **D-05:** **MA flags** are **hand-curated per town** as a static set of applicable flags. The 4 flag types + copy are locked by `05-UI-SPEC.md` (Prop 2½, Betterment, Title 5 septic, 40B). **Prop 2½ is universal** (every MA town); Betterment / Title 5 / 40B are per-town curated tags. Flags are qualitative disclosures — never computed, never alter a town's bucket or color.

### Weights & bucket config (where tunables live)
- **D-06:** Scoring weights (per-metric + amenity sub-weights), the bucket **stretchFactor**, and the **fixed normalization reference ranges** (see D-10) all live in a **new versioned AssumptionsV4 town-scoring block**. Bump V3→V4 with a `v3ToV4` migrate, following the established assumptions-versioning pattern. Satisfies ASMP-01 (never hardcoded) and keeps scoring snapshot-reproducible.
- **D-07:** **Amenities** = **several named sub-metrics** (e.g. walkability, dining/nightlife, parks/recreation), each independently weighted — matches the plural "custom amenity weights" requirement and the prior beach-app multi-amenity scoring architecture.
- **D-08:** Default bucket **stretchFactor = 1.25**. Realistic = median ≤ budget; Stretch = budget < median ≤ budget × 1.25; Fantasy = beyond. User-editable data, not a constant.

### Normalization & composite
- **D-09:** Normalize each metric against **fixed reference ranges stored in AssumptionsV4** (per-metric min/max constants), **not** min-max over the seeded town set. Rationale: snapshot-stable and reproducible — editing the town list does **not** silently reshuffle every town's normalized values; ranges are auditable + tunable. Direction-correction (lower mill rate / price / commute = better; higher school / amenity = better) folds into the normalized value so higher always = better (per UI-SPEC).
- **D-10:** Missing-metric composite handling: **drop the missing metric and renormalize the remaining weights to sum to 1**, so a town still gets a comparable composite scalar from the metrics it *does* have, with the missing metric flagged in its per-metric breakdown. (Not: knock the whole town to "no data.")

### Budget input & bucketing
- **D-11:** The scoring function takes a **`budget: Money` parameter**; it buckets a town's **median price** against that budget. The **caller decides the source** — a raw budget, or the Phase 3/4 true-affordability ceiling (wired in Phase 7). This keeps Town Scoring decoupled from the Affordability/FI chain while satisfying the "bucket against your real budget" differentiator. Matches UI-SPEC's generic "entered budget."
- **D-12:** The **composite score is budget-independent** (town quality from weighted metrics); the **bucket is a separate pure overlay** of (median price, budget, stretchFactor). Changing the budget re-buckets without re-scoring. Matches the UI-SPEC's two-channel encoding (hue = bucket, lightness = composite).

### Claude's Discretion
- The exact **default weight vector** across the five metrics — propose an opinionated default (price & commute weighted higher, since they dominate a Boston buy decision), document the rationale; weights are user-editable data.
- The exact **fixed reference-range values** per metric (D-09) — research defensible ranges from the seeded data + public sources; document each.
- Whether to apply a **display-only rescale of the composite** (e.g. min-max the *composite* across towns for heatmap lightness spread) on top of fixed-range per-metric normalization — a rendering-fidelity call; the underlying per-metric normalization stays fixed-range/reproducible regardless.
- The exact **amenity sub-metric list** (D-07) — lean toward what the beach-app architecture used; keep the schema clean.
- **Output type / barrel shape** and the **test-oracle strategy** for the composite (worked-example tests + reproducibility golden, consistent with prior phases).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase-5 design contract (load-bearing)
- `.planning/phases/05-town-scoring-heatmap/05-UI-SPEC.md` — **the heatmap data + encoding contract.** Locks: per-town normalized composite scalar [0,1] + raw composite; itemized per-metric breakdown `{ rawValue, normalizedValue, direction, weight, weightedContribution, missing }`; the `bucket: 'realistic' | 'stretch' | 'fantasy'` enum; explicit missing-data treatment; the 4 MA flag types + chip labels + copy; bucket palette + anti-funnel semantics; towns × metrics matrix shape; legend/sort requirements. The engine output MUST satisfy this so Phase 7 can render without re-deriving financial logic.

### Requirements & roadmap
- `.planning/REQUIREMENTS.md` — TOWN-01 (weighted normalized composite), TOWN-02 (budget bucketing), TOWN-03 (heatmap across towns), TOWN-04 (MA-specific qualitative flags).
- `.planning/ROADMAP.md` §"Phase 5: Town Scoring & Heatmap" — goal + 4 success criteria.

### Research (domain + architecture)
- `.planning/research/ARCHITECTURE.md` §"How the Three Engines Compose" + build steps 8–9 — Town Scoring as the most-independent pure module; weights live in assumptions; bucket via budget; `packages/core/src/towns/` placement.
- `.planning/research/FEATURES.md` §"Town scoring → realistic/stretch/fantasy buckets", §"Affordability heatmap", §"MA-specific realism flags", and the Anti-Features table (no live commute API; table-before-map; bucket against your real budget).

### Existing code (reuse target)
- `packages/core/src/towns/town-table.ts` — the 24-town greater-Boston table to extend (currently mill rate + FY only) + `resolveMillRate`.
- `packages/core/src/towns/town-table.schema.ts` — `townRowSchema` (`.strict()`, reuses `decStr` canonical-decimal validator) — the boundary pattern to extend for the new metrics.
- `packages/core/src/assumptions/schema.ts` — the V3 AssumptionSet + `decStr`; the v3→v4 migration + new town-scoring block hangs here.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`town-table.ts` (24 towns + `resolveMillRate`)** — extend in place with the new metrics; keeps one canonical town list (D-01). The throw-on-unknown-town idiom is the model for any new resolver.
- **`townRowSchema` (`.strict()` + `decStr`)** — extend this Zod row for median price / school / commute / amenity fields; reuse `decStr` so every seeded number is canonical-decimal at the boundary (no floats smuggled in).
- **AssumptionSet versioning machinery (V1→V2→V3 with per-step migrates + regenerated goldens)** — the exact pattern to follow for the V3→V4 town-scoring block (D-06).
- **`Money` + decimal discipline** — composite math and budget comparison run on the decimal-precise primitives; no bare-`number` money (type-test enforced in prior phases).

### Established Patterns
- **Pure, deterministic functions** — no `Date.now()`/`Math.random()`/env; all inputs explicit. Scoring is a pure function of (towns, assumptions/weights, budget, anchor).
- **Assumptions-as-data** — every tunable (weights, stretchFactor, reference ranges) is stored, versioned, snapshot-stable (D-06, D-09).
- **Reproducibility golden + worked-example tests** — the prior phases' gating-test style applies to the composite.
- **Explicit-error / no-silent-default** — missing data flagged, unknown town throws (D-03).

### Integration Points
- New `towns/` scoring module imports `Money`, the assumptions types, and the extended town table — no dependency on the Affordability/FI engines (D-11 keeps budget an input parameter).
- Output is a new public barrel export from `packages/core/src/index.ts`, consumed later by Phase 7's heatmap view.

</code_context>

<specifics>
## Specific Ideas

- "Reuse the prior **beach-app weighted-scoring architecture**" (PROJECT.md / FEATURES.md) — normalize each metric, apply user weights, weighted composite; the multi-amenity sub-score shape (D-07) comes from there.
- Anti-funnel carries into scoring: buckets are **honest disclosures, never a "buy this town" nudge** — palette + tone locked by UI-SPEC (no success-green, no error-red flags).
- The differentiating twist vs Niche/AreaVibes: **bucketing against the user's true budget**, not generic scoring (D-11).

</specifics>

<deferred>
## Deferred Ideas

- **Wider town coverage** (outer ring / broad-MA / full ~351 municipalities) — kept at the curated 24 this phase (D-01); expansion is future seed work.
- **Heatmap rendering** (visx/CSS-grid pixels, legend UI, tooltips, app chrome) — Phase 7 (Web Shell); Phase 5 only emits the data contract.
- **Live commute / traffic API and live median-price/school feeds** — out of scope (anti-features); static seed only.
- **Wiring the budget to the live Phase 3/4 true-affordability output** — the engine takes a budget param (D-11); the caller-side wiring is a Phase 7 concern.
- **Multi-anchor commute beyond the seeded canonical set** (arbitrary lat/lng + computed distance) — future extension; v1 selects among seeded anchors (D-04).

None of the above were scope creep — discussion stayed within the Phase 5 boundary.

</deferred>

---

*Phase: 5-town-scoring-heatmap*
*Context gathered: 2026-06-27*
</content>
</invoke>
