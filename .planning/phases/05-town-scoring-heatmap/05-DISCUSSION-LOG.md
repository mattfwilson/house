# Phase 5: Town Scoring & Heatmap - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-27
**Phase:** 05-town-scoring-heatmap
**Areas discussed:** Seed town data, Weights & bucket config home, Normalization method, Bucketing basis & budget input

---

## Seed town data

### Town set scope
| Option | Description | Selected |
|--------|-------------|----------|
| Reuse the 24 | Extend existing greater-Boston towns with new metrics; one canonical list | ✓ |
| Expand to ~40-50 | Add outer ring (MetroWest, North/South Shore, 495) | |
| Broad MA (100+) | Toward full ~351 municipalities | |

### Metric sourcing
| Option | Description | Selected |
|--------|-------------|----------|
| Static hand-seed, stamped | Literal values, per-metric vintage/source-stamped; missing flagged, never imputed | ✓ |
| Static, single vintage | One shared as-of date for the whole table | |

### Commute representation
| Option | Description | Selected |
|--------|-------------|----------|
| Seeded drive-time to anchor | Estimated peak drive-time minutes to a configurable anchor; no live traffic API | ✓ |
| Seeded coords + distance | Lat/lng + computed straight-line/road-factor distance | |

### MA flags assignment
| Option | Description | Selected |
|--------|-------------|----------|
| Hand-curated per town | Static per-town applicable-flag set | ✓ |
| Prop 2½ on all, rest curated | Same; Prop 2½ universal, others per-town | (folded into choice) |

**User's choice:** Reuse the 24 / Static hand-seed stamped / Seeded drive-time to anchor / Hand-curated per town.
**Notes:** Commute-anchor configurability tension (single seeded number vs configurable anchor) flagged here and resolved in Bucketing basis area. Prop 2½ treated as universal across MA towns; Betterment/Title 5/40B per-town.

---

## Weights & bucket config home

### Config home
| Option | Description | Selected |
|--------|-------------|----------|
| New AssumptionsV4 block | Versioned town-scoring section; v3→v4 migrate; snapshot-stable, ASMP-01 | ✓ |
| Separate TownScoringConfig | Standalone config outside the versioned AssumptionSet | |

### Default weighting
| Option | Description | Selected |
|--------|-------------|----------|
| You decide a sensible default | Opinionated vector (price/commute heavier), documented, user-editable | ✓ |
| Equal weights | All five metrics equal to start | |

### Amenity shape
| Option | Description | Selected |
|--------|-------------|----------|
| Several named sub-metrics | Multiple amenity dimensions each independently weighted (matches plural "custom amenity weights") | ✓ |
| Single amenity score | One composite amenity score + one weight | |
| You decide | Whichever keeps schema cleanest | |

### Stretch ceiling
| Option | Description | Selected |
|--------|-------------|----------|
| 1.25 (≈25% over) | Town up to 25% over budget = stretch | ✓ |
| 1.15 (≈15% over) | Tighter stretch band | |
| You decide | Defensible documented default | |

**User's choice:** New AssumptionsV4 block / You decide default weights / Several named amenity sub-metrics / stretchFactor 1.25.
**Notes:** Fixed normalization reference ranges (from the Normalization area) also live in the V4 block.

---

## Normalization method

### Scaling strategy
| Option | Description | Selected |
|--------|-------------|----------|
| Fixed reference ranges in assumptions | Per-metric min/max constants in V4; snapshot-stable; town set can change without reshuffling | ✓ |
| Min-max over the seeded set | Best→1, worst→0 per metric; full [0,1] spread but set-dependent/reproducibility wrinkle | |
| You decide | Balance reproducibility vs heatmap spread; hybrid allowed | |

### Missing-data composite handling
| Option | Description | Selected |
|--------|-------------|----------|
| Renormalize remaining weights | Drop missing metric, rescale remaining weights to sum to 1, flag missing | ✓ |
| Mark whole town 'no data' | Any missing metric → withhold composite, render whole town hatched | |
| You decide | Honor no-silent-0 while keeping heatmap useful | |

**User's choice:** Fixed reference ranges / Renormalize remaining weights.
**Notes:** Display-only rescale of the composite (min-max the composite across towns for heatmap lightness spread) left as Claude's discretion; underlying per-metric normalization stays fixed-range/reproducible.

---

## Bucketing basis & budget input

### Budget input
| Option | Description | Selected |
|--------|-------------|----------|
| Budget param, caller picks source | Engine takes budget: Money; caller passes raw budget OR true-affordability ceiling; keeps module decoupled | ✓ |
| Engine derives true-affordability | Town module calls affordability engine itself; couples modules | |

### Score vs bucket
| Option | Description | Selected |
|--------|-------------|----------|
| Independent score, bucket overlay | Composite budget-independent; bucket separate fn of (median price, budget, stretchFactor) | ✓ |
| Budget folds into the score | Affordability-vs-budget as a weighted metric | |

### Commute anchor reconciliation
| Option | Description | Selected |
|--------|-------------|----------|
| Seed drive-times to a few canonical anchors | Fixed set (downtown Boston, Kendall/Cambridge, +1); anchor input selects among them | ✓ |
| Single anchor v1, field plumbed | One seeded drive-time; multi-anchor a future extension | |
| You decide | Keep seed honest, contract clean | |

**User's choice:** Budget param caller-sourced / Independent score + bucket overlay / Seed drive-times to a few canonical anchors.
**Notes:** Reconciles UI-SPEC ("entered budget") with FEATURES.md ("against true-affordability") by making budget an input the Phase 7 caller wires. Reconciles the commute-anchor tension from the Seed-data area.

---

## Claude's Discretion

- Exact default weight vector (price/commute heavier proposed) — documented, user-editable.
- Exact fixed reference-range values per metric.
- Optional display-only composite rescale for heatmap lightness spread.
- Exact amenity sub-metric list (lean on beach-app architecture).
- Output type / barrel shape + composite test-oracle strategy (worked-example + reproducibility golden).

## Deferred Ideas

- Wider town coverage (outer ring / broad-MA / full ~351).
- Heatmap rendering (visx/CSS-grid, legend, tooltips, app chrome) — Phase 7.
- Live commute/traffic API and live median-price/school feeds — out of scope.
- Wiring budget to live Phase 3/4 true-affordability output — Phase 7.
- Arbitrary lat/lng + computed-distance multi-anchor commute — future extension.
</content>
