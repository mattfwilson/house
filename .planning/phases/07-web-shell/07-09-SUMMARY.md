---
phase: 07-web-shell
plan: 09
subsystem: web-ui
tags: [heatmap, css-grid-table-heatmap, bucket-palette, composite-intensity, no-data-hatch, ma-flags, sensitivity, tornado, recharts, fi-05, anti-funnel, live-recompute, D-02, D-08, D-10, D-13]

# Dependency graph
requires:
  - phase: 07-04
    provides: "scoreTownsAction + toScoreboardDTO (Bucket/composite/MaFlag/MetricContribution, explicit no-data markers) + tornadoAction + toTornadoDTO (finite swingMonths, discriminated FiOutcomes, top-3 drivers)"
  - phase: 07-05
    provides: "dark-slate shadcn chrome (Tooltip/Badge/Button/Input/Label Base-UI blocks) + the shared layout that docks the assumptions rail beside every route"
  - phase: 07-06
    provides: "working-set store (the shared AssumptionSet whose townScoring.bucket.stretchFactor drives bucketing) + comparison-input bridge (household/scenario/as-of for the tornado)"
  - phase: 07-08
    provides: "the cockpit populates the comparison-input bridge + working set so heatmap/sensitivity inherit the active context; chart-edge Number() confinement pattern"
provides:
  - "apps/web/src/components/heatmap/HeatmapCell.tsx — one towns×metrics cell: locked bucket-palette hue + composite-scalar lightness via a CSS custom property (no Number()), explicit hatched no-data, per-metric explainable tooltip"
  - "apps/web/src/components/heatmap/HeatmapGrid.tsx — CSS-grid towns(rows)×metrics(cols) matrix + affordability summary column, neutral MA-flag chips, bucket-grouped stable sort, zero bucketing math"
  - "apps/web/src/app/heatmap/page.tsx — town heatmap route (D-13): budget (teal affordance) + commute-anchor inputs, four-state legend, verbatim 05-UI-SPEC empty/error copy, assumptions inherited from the working set with engine-default fallback"
  - "apps/web/src/components/charts/TornadoChart.tsx — Recharts horizontal BarChart over finite swingMonths, core-ranked DESC, top-3 amber-emphasized; the single sanctioned Number() float cast for the bar data"
  - "apps/web/src/app/sensitivity/page.tsx — sensitivity route (FI-05): verbatim 'No headline number without a range.' framing, top-driver readout, per-scenario picker, live debounced recompute on rail edits"
affects: [07-10]

# Tech tracking
tech-stack:
  added: []
  patterns: [css-custom-property-carries-normalized-scalar-no-Number-in-heatmap, locked-bucket-palette-hue-plus-lightness-intensity, explicit-hatched-no-data-never-silent-0, bucket-grouped-stable-sort-no-numeric-composite-compare, single-chart-edge-Number-conversion-in-tornado, debounced-live-recompute-via-effect-no-run-trigger, heatmap-falls-back-to-default-assumptions-standalone, sensitivity-inherits-comparison-input-bridge]

key-files:
  created:
    - apps/web/src/components/heatmap/HeatmapCell.tsx
    - apps/web/src/components/heatmap/HeatmapGrid.tsx
    - apps/web/src/app/heatmap/page.tsx
    - apps/web/src/components/charts/TornadoChart.tsx
    - apps/web/src/app/sensitivity/page.tsx
  modified: []

decisions:
  - "Composite/metric normalized scalar reaches the heatmap cell as a CSS custom property (--cell-intensity) and drives the hue-fill opacity via calc() — CSS consumes the decimal STRING directly, so NO Number()/float cast enters the heatmap (the money→float edge stays confined to components/charts/** + lib/format.ts per the 07-01 eslint guard)"
  - "Towns are grouped by bucket (Realistic→Stretch→Fantasy→no-data) via a STABLE sort on an integer bucket-rank — never a numeric comparison of composite decimal strings (which would require the banned Number()); within-tier order is the core's"
  - "The dollar budget is the teal budget-input affordance entered on the heatmap route; the BUCKETING context (townScoring.bucket.stretchFactor) is inherited from the shared working set (D-02). The route falls back to DEFAULT_ASSUMPTIONS so the heatmap is usable before any scenario is opened (standalone)"
  - "The sensitivity tornado inherits household/scenario/as-of from the comparison-input bridge the cockpit populates; live recompute is a debounced (~300ms) effect keyed on the working-set assumptions + chosen scenario — no separate Run trigger (D-08). When no comparison is assembled the route prompts the user to open the cockpit"

# Metrics
metrics:
  duration: ~25min
  completed: 2026-06-28
---

# Phase 07 Plan 09: Town Heatmap + Sensitivity Tornado Summary

The two data-dense routes — a CSS-grid town affordability heatmap (D-13) and a Recharts FI-date sensitivity tornado (FI-05) — both inheriting the active profile/scenario context and sitting beside the persistent assumptions rail, honoring the locked 05-UI-SPEC bucket/composite encoding and the anti-funnel "no headline number without a range" framing.

## What was built

**Task 1 — CSS-grid town heatmap (commit 28e71cf):**
- `HeatmapCell.tsx` renders one towns×metrics cell colored by the LOCKED 05-UI-SPEC bucket palette (Realistic teal `#0F766E` / Stretch amber `#B45309` / Fantasy slate `#64748B`) with lightness intensity scaled by the normalized `[0,1]` composite/metric scalar. The scalar crosses to CSS as a custom property (`--cell-intensity`) and drives the hue-fill opacity through `calc()` — so the decimal string is consumed by CSS and **no `Number()`** enters the heatmap. A data-less cell (missing metric or null scalar) draws the explicit hatched-gray `#94A3B8` marker — never a silent 0/blank. Each cell carries a shadcn Tooltip with the per-metric explainable `MetricContribution` breakdown (raw/normalized/direction/weight/contribution, or the verbatim missing-metric copy).
- `HeatmapGrid.tsx` is a pure CSS grid (no Recharts/visx — D-13) of towns(rows)×metrics(cols) at the dense 2.75rem cell on a 4px gap, plus a leading town-name column (carrying neutral MA-flag chips with their verbatim 05-UI-SPEC bodies) and a trailing affordability (bucket/composite) summary column. Towns are grouped by bucket via a stable integer-rank sort (no numeric composite comparison). Zero bucketing/composite math — every encoding value is a DTO output.
- `heatmap/page.tsx` calls `scoreTownsAction` with the working-set assumptions (inherited cockpit context, with a `defaultAssumptionsAction` fallback so it works standalone), the entered budget (teal affordance, crosses as a decimal string — `Money.of` validates at the action boundary), and a commute anchor. Four-state legend, verbatim 05-UI-SPEC empty/error copy, debounced (~300ms) live re-score.

**Task 2 — Sensitivity tornado (commit 1570deb):**
- `TornadoChart.tsx` is a Recharts horizontal `BarChart` over finite `swingMonths`, rows in the core's ranked DESC order, top-3 drivers amber-emphasized (remaining drivers muted slate — never success-green). The single sanctioned `Number()` float cast for the bar data lives here (charts edge).
- `sensitivity/page.tsx` leads with the verbatim "No headline number without a range." framing (FI-05), labels the top drivers, offers a per-scenario picker, and calls `tornadoAction` for the active scenario inherited from the comparison-input bridge + working-set assumptions, recomputing live (debounced ~300ms) on rail edits with no Run trigger. An empty state prompts opening the cockpit when no comparison is assembled.

## Verification

- `npx tsc -p apps/web/tsconfig.json --noEmit` → only the 2 pre-existing deferred 07-03 test-file errors (scenarios.test.ts:80, scenario.test.ts:109); this plan's files add zero new errors.
- `npx eslint apps/web` → exit 0. `Number(` confined to `components/charts/**` (TornadoChart) — the heatmap uses a CSS custom property instead.
- `npx vitest run apps/web` → 24 passed (6 files).
- Heatmap is CSS-grid (no chart dep), uses the exact locked palette hex, hatched no-data (not blank/0), explainable tooltips, no budget-vs-price logic.
- Tornado ranked DESC, ≤3 labeled top drivers, "No headline number without a range." present, no success-green.

## Deviations from Plan

None — plan executed as written. Two design clarifications worth noting (not plan deviations):
- The heatmap's "inherited budget context" is realized as: the **bucketing assumptions** (incl. the rail's `townScoring.bucket.stretchFactor`) come from the shared working set (D-02), while the **dollar budget** is the teal budget-input affordance entered on the route (the 05-UI-SPEC "Score towns for this budget" control). The route falls back to `DEFAULT_ASSUMPTIONS` so it is usable before any scenario is opened.
- The normalized scalar drives cell lightness via a CSS custom property specifically to keep the heatmap free of `Number()` (the eslint money→float guard bans it outside charts/format).

## Known Stubs

None. Every value on both routes is a live core output through `scoreTownsAction` / `tornadoAction`; no hardcoded/empty data feeds either render. The heatmap's default-assumptions fallback is real engine data, not a placeholder.

## Self-Check: PASSED
- apps/web/src/components/heatmap/HeatmapCell.tsx — FOUND
- apps/web/src/components/heatmap/HeatmapGrid.tsx — FOUND
- apps/web/src/app/heatmap/page.tsx — FOUND
- apps/web/src/components/charts/TornadoChart.tsx — FOUND
- apps/web/src/app/sensitivity/page.tsx — FOUND
- commit 28e71cf (Task 1) — FOUND
- commit 1570deb (Task 2) — FOUND
