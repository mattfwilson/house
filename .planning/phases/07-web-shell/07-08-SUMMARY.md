---
phase: 07-web-shell
plan: 08
subsystem: web-ui
tags: [cockpit, comparison-table, ranked-fi-delta, rent-baseline, anti-funnel, bank-gap, trajectory-chart, recharts, inline-editor, live-recompute, D-03, D-04, D-05, D-06, D-07, D-14, D-15, D-16]

# Dependency graph
requires:
  - phase: 07-03
    provides: "recompareAction/evaluateAction/gapAction + toCompareDTO/toEvaluateDTO/toGapDTO + computeAndSaveScenarioAction/loadScenarioAction/listScenariosAction/deleteScenarioAction"
  - phase: 07-04
    provides: "fiTrajectoryAction + toTrajectoryDTO (decimal-string net-worth series for the D-07 chart)"
  - phase: 07-05
    provides: "dark-slate shadcn chrome (Table/Select/Button/AlertDialog/Card Base-UI blocks) + format helpers formatUSD/fiDeltaLabel + persistent Header selection wiring"
  - phase: 07-06
    provides: "selection store (expandedScenarioId/toggle) + working-set store (loadFrozenSet/updateKnob) + recompute coordinator (useRecompute.result)"
  - phase: 07-07
    provides: "comparison-input bridge store (the cockpit POPULATES it so the rail's live recompute fires) + the assumptions rail's recompareAction live loop"
provides:
  - "apps/web/src/app/page.tsx — the cockpit: ranked comparison landing that assembles the recompare payload, populates comparison-input, and reads useRecompute.result for the live loop"
  - "apps/web/src/components/cockpit/ComparisonTable.tsx — core-ranked table (no client sort) + pinned baseline + amber bank-gap caution"
  - "apps/web/src/components/cockpit/ScenarioRow.tsx — color-honest FI-date delta hero (amber delay / neutral earlier, never green)"
  - "apps/web/src/components/cockpit/ExpandedScenario.tsx — Display-role hero delta + FI instruments + the trajectory hero chart on expand"
  - "apps/web/src/components/charts/TrajectoryChart.tsx — Recharts buy-vs-rent + FI-threshold + crossover dots (the single money->float Number() site)"
  - "apps/web/src/components/cockpit/InlineScenarioEditor.tsx — inline add/edit row (no modal/route), optional listing prefill, destructive-red delete, core-surfaced field errors"
  - "apps/web/src/app/actions/cockpit.ts — listTowns/defaultAssumptions/browseListings + saveScenarioForm (translates the core ZodError into a serializable field-error map)"
  - "@house/core TOWN_NAMES — the curated town names for the editor selector (names only; rate data stays internal)"
affects: [07-09, 07-10, 07-11]

# Tech tracking
tech-stack:
  added: []
  patterns: [core-ranked-rows-rendered-in-dto-order-no-client-sort, color-honest-tone-to-class-map-never-green, single-chart-edge-Number-conversion, cockpit-populates-comparison-input-bridge, live-override-prefers-rail-result-until-cockpit-recomputes, zod-error-to-serializable-field-map-wrapper, inline-expanding-editor-row-no-modal, parseInt-for-counts-not-the-banned-Number-cast]

key-files:
  created:
    - apps/web/src/components/cockpit/ComparisonTable.tsx
    - apps/web/src/components/cockpit/ScenarioRow.tsx
    - apps/web/src/components/cockpit/ExpandedScenario.tsx
    - apps/web/src/components/cockpit/InlineScenarioEditor.tsx
    - apps/web/src/components/charts/TrajectoryChart.tsx
    - apps/web/src/app/actions/cockpit.ts
  modified:
    - apps/web/src/app/page.tsx
    - packages/core/src/towns/town-table.ts
    - packages/core/src/index.ts

key-decisions:
  - "The table renders toCompareDTO rows IN DTO ORDER — there is NO client `.sort(` on the rows (grep-confirmed). The ranking (baseline row 0, beats-renting above delays, unreached last) is core logic, FI-06; the cockpit is a faithful view of it."
  - "Color honesty is a tone->class map (TONE_CLASS): a delay reads amber #B45309, earlier reads neutral text-foreground, never a success-green token. The baseline row is pinned/distinct (teal left-border + slate emphasis) with NO success styling — when no buy beats renting the locked wins-#1 copy renders inline (D-05, no separate verdict chip)."
  - "Bank affordability appears ONLY as the amber gap caution and ONLY when gap.verdict === 'bankExceedsTrue' — the locked copy 'A bank would approve ~{amount} more than your FI plan can absorb.', never the word 'headroom' (D-06). The evaluate report's DTI field is relabelled 'DTI margin' to keep 'headroom' off the screen entirely."
  - "TrajectoryChart is the SINGLE money->float site (Pitfall 5): the trajectory DTO's decimal strings become chart numbers via Number() ONCE at the chart-data build step; the eslint guard confines Number( to components/charts/** + lib/format.ts. Buy line amber, rent neutral slate, FI threshold muted dashed — the divergence IS the cost, color-honest."
  - "CROSS-PLAN WIRING (07-07): the cockpit calls setComparisonInput({asOf,household,baseline,scenarios}) so the rail's live debounced recompute fires; it reads useRecompute.result via a live-override that is preferred until the cockpit itself recomputes (a profile/scenario reload clears the override so the table is fresh)."
  - "The editor holds NO validation schema (D-16): money/rate fields cross verbatim as decimal strings; the two bare COUNTS use parseInt (NOT the banned Number( money-cast). saveScenarioFormAction wraps computeAndSaveScenarioAction and translates the thrown core ZodError into a serializable {fieldErrors} map (a thrown ZodError does not cross the Server Action boundary with .issues intact) — field errors are surfaced inline without duplicating a rule."
  - "Added @house/core TOWN_NAMES (Rule 3): the editor's town selector needs the curated 24-town set, but the barrel kept the rate-data array internal. Exposed NAMES ONLY (rates still resolve through resolveMillRate), fed to the client via listTownsAction (no core VALUE import in the client tier)."

requirements-completed: [SC-2, SC-4]

# Metrics
duration: ~55min
completed: 2026-06-28
---

# Phase 7 Plan 08: Cockpit — Ranked FI-Impact Comparison Summary

**The flagship screen is standing: the home route IS the ranked-by-FI-date comparison (D-03) — the pinned rent-and-invest baseline competes in the core's ranking and, when no buy beats it, renders the locked don't-buy copy (D-05); the FI-date delta hero is color-honest (amber delay, never green); bank affordability appears only as the amber gap caution (D-06); selecting a row expands its FI instruments + the Recharts trajectory-vs-baseline hero chart with FI-threshold + crossover markers (D-07); and Add/Edit is an inline expanding editor row whose field errors come from the core Zod parse (D-15/D-16). The cockpit also POPULATES the 07-07 comparison-input bridge so the assumptions rail's live recompute re-flies the table.**

## Performance
- **Duration:** ~55 min
- **Completed:** 2026-06-28
- **Tasks:** 3 (all `type=auto`)
- **Files:** 6 created + 3 modified

## Accomplishments
- **Ranked comparison table (Task 1):** `ComparisonTable` renders the `recompareAction`/`toCompareDTO` rows in the EXACT core order (no client `.sort(` — grep-confirmed); `ScenarioRow` shows the FI-date delta hero via `fiDeltaLabel` mapped through `TONE_CLASS` (amber delay / neutral earlier / muted — never success-green). The rent baseline is a pinned, teal-left-bordered, slate-emphasised row with NO success token; when no buy row has a negative (earlier) delta the locked copy "Renting and investing the difference reaches FI soonest — buying any of these delays it." renders inline (D-05). The bank-vs-true gap shows ONLY as the amber caution "A bank would approve ~{amount} more than your FI plan can absorb." when `verdict === 'bankExceedsTrue'` (D-06) — never "headroom".
- **Trajectory hero chart + expanded panel (Task 2):** `TrajectoryChart` is a Recharts `LineChart` (rent neutral slate, buy amber — the divergence IS the cost) with a `ReferenceLine` at the FI threshold and `ReferenceDot`s at `buyFiMonth`/`rentFiMonth`; it is the SINGLE money->float site (decimal strings -> chart numbers via `Number()` once, at the chart-data build step — Pitfall 5). `ExpandedScenario` shows the Display-role (28px) color-honest hero delta + an FI-instruments grid (FI date, FI target net worth, both paths' net-worth-at-horizon, DTI ratios, DTI margin) fed by `fiTrajectoryAction`/`evaluateAction`, then the chart.
- **Inline add/edit editor (Task 3):** `InlineScenarioEditor` is an inline expanding row (no Dialog/modal, no `/new` route — D-15). Manual entry is the default (D-14): plain decimal-string fields + a town `Select` sourced from `listTownsAction` (the curated 24-town `TOWN_NAMES`); the OPTIONAL "prefill from a sample listing" (`browseListingsAction` over `MockListingsProvider`) is a convenience only. Save calls `saveScenarioFormAction` (freezes the working set via `computeAndSaveScenarioAction`) then re-lists + re-ranks; field errors come from the core Zod parse (D-16). Delete uses the shadcn alert-dialog with the verbatim destructive-red copy.
- **Cockpit page wiring:** `page.tsx` assembles the active profile's household + saved buy scenarios + the shared working set into the `recompareAction` payload, renders the table/expanded/editor, computes the gap, and POPULATES `comparison-input` so the rail's live recompute (D-08) fires; it reads `useRecompute.result` (live override) so a rail knob edit re-flies the table. Empty states for no-profiles and no-scenarios use the locked copy.

## Task Commits
1. **Task 1: ranked comparison table + pinned rent-baseline + bank-gap caution** — `77572a8` (feat)
2. **Task 2: expanded scenario panel + Recharts trajectory chart (D-07)** — `c9ab1db` (feat)
3. **Task 3: inline add/edit editor + cockpit page wiring (D-14/D-15)** — `916e9ba` (feat)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Exposed `TOWN_NAMES` from @house/core for the editor's town selector**
- **Found during:** Task 3
- **Issue:** The editor's town `Select` needs the curated 24-town set (the plan names `packages/core/src/towns/town-table.ts`), but the core barrel deliberately keeps the rate-data array internal ("resolve by name through this boundary") — there was no exported town-name list to drive a UI selector.
- **Fix:** Added `export const TOWN_NAMES` (derived from `TOWN_RATE_TABLE.map(r => r.town)`) to `town-table.ts` and the barrel — NAMES ONLY, so the mill-rate rows stay internal (a rate still resolves through `resolveMillRate`). The client never imports the core value; `listTownsAction` surfaces the names as plain data.
- **Files modified:** packages/core/src/towns/town-table.ts, packages/core/src/index.ts, apps/web/src/app/actions/cockpit.ts
- **Verification:** full suite 502 green; tsc -b core+app exit 0; the new export is names-only.
- **Committed in:** 916e9ba

**2. [Rule 2 - Missing critical functionality] `saveScenarioFormAction` to surface field-level Zod errors**
- **Found during:** Task 3
- **Issue:** D-16 requires field errors "surfaced from the core parse result", but `computeAndSaveScenarioAction` THROWS a `ZodError`, and a thrown error does NOT cross the Server Action boundary with its `.issues` intact (only the message/digest survive) — the client editor could never read per-field messages.
- **Fix:** Added a thin wrapper `saveScenarioFormAction` (in the new `cockpit.ts`) that calls `computeAndSaveScenarioAction` and, on a Zod-like error (duck-typed `.issues`, so `zod` need not be imported), returns a serializable `{ fieldErrors }` map keyed by the failing leaf — WITHOUT duplicating any validation (the schema still lives in core). Non-validation failures surface the generic UI-SPEC error copy.
- **Files modified:** apps/web/src/app/actions/cockpit.ts
- **Committed in:** 916e9ba

**3. [Rule 1 - Honest data] Secondary row readout is the absolute FI date, not net-worth-at-horizon**
- **Found during:** Task 1
- **Issue:** The plan asks for "net-worth-at-horizon + monthly housing delta" as the row's secondary readouts, but `CompareRowDTO` carries only the FI outcome + deltas — those dollar figures are NOT in the ranked DTO. Fabricating them in the row would mean N extra trajectory/evaluate round-trips per render or inventing numbers.
- **Fix:** The dense ranked row shows the ABSOLUTE FI date (which IS in the DTO — "FI in {Y} yr {M} mo" / "FI not reached within horizon") as its secondary readout; net-worth-at-horizon + the DTI detail are surfaced in `ExpandedScenario`, where `fiTrajectoryAction`/`evaluateAction` are already fetched. No data is fabricated and no extra per-row round-trips are added.
- **Files modified:** apps/web/src/components/cockpit/ScenarioRow.tsx, apps/web/src/components/cockpit/ExpandedScenario.tsx

**4. [Rule 3 - Blocking] Base-UI API shape (render-prop trigger, nullable Select, exactOptionalPropertyTypes)**
- **Found during:** Task 3 typecheck
- **Issue:** The shadcn blocks here are Base-UI (07-05 accepted): `AlertDialogTrigger` takes a `render` prop (not `asChild`), `Select.onValueChange` is `(value: string | null) => void`, and `exactOptionalPropertyTypes` rejects passing `undefined` to an optional prop.
- **Fix:** Used `<AlertDialogTrigger render={<Button .../>}>`, guarded the nullable Select callbacks, and widened the optional `onEdit`/`onDelete` props to `(() => void) | undefined`.
- **Files modified:** apps/web/src/components/cockpit/InlineScenarioEditor.tsx, apps/web/src/components/cockpit/ExpandedScenario.tsx, apps/web/src/app/page.tsx
- **Committed in:** 916e9ba

No architectural (Rule 4) changes; no auth gates.

## Threat Model Coverage
- **T-7-01 (Tampering — editor inputs):** the editor holds NO schema; every leaf is validated at the `computeAndSaveScenarioAction`/`recompareAction` core Zod boundary (D-16). `saveScenarioFormAction` only translates the core's parse failure into a serializable field map — it adds no rule.
- **T-7-04 (Tampering/correctness — float re-entry at the chart):** `Number(` appears in the cockpit display path ONLY under `components/charts/TrajectoryChart.tsx` (grep-confirmed clean in `components/cockpit/*`); cockpit dollars format through `lib/format.ts` over the decimal strings.
- **T-7-10 (Product integrity — buy-funnel nudge):** the ranking is the core's (no client `.sort(` on the rows); the rent baseline is pinned and can win (rendering the don't-buy copy); the bank shows only as the amber gap; no success-green token exists anywhere in the cockpit/chart (grep finds only comments/labels asserting its absence).

## Known Stubs
None. The cockpit is fully wired to the real `recompareAction`/`gapAction`/`fiTrajectoryAction`/`evaluateAction`/`computeAndSaveScenarioAction`/`deleteScenarioAction` and the real stores. The "prefill from a sample listing" affordance reads the real `MockListingsProvider` via `browseListingsAction`. Profile CREATION/editing remains 07-11 (the no-profiles empty state shows the locked create-profile copy) — an integration seam, not a stub.

## Verification Evidence
- `npx tsc -p apps/web/tsconfig.json --noEmit` → ONLY the 2 pre-existing deferred 07-03 test errors (`scenarios.test.ts:80`, `scenario.test.ts:109`); ZERO new errors from this plan's files.
- `npx eslint apps/web` → exit 0 (client-tier import guards + the Number() money->float confinement satisfied).
- `npx vitest run apps/web` → 6 files, 24 tests green. Full monorepo suite → 502 green (`tsc -b` core+app exit 0).
- Anti-funnel grep gates: no `.sort(` on rows in `components/cockpit/*` or `page.tsx`; `Number(` confined to `components/charts/**`; no `green`/`success`/`emerald` token (only comments/labels asserting their absence); the word "headroom" never reaches the screen (the bank-gap copy and the relabelled "DTI margin").
- Build note: the full `next build` stays the 07-10 phase gate (known-blocked by the @house/app drizzle-packaging issue, untouched here — apps/web uses webpack; YOUR work verified via tsc/eslint/vitest).

## Self-Check: PASSED
- All 6 created files + the rewritten `page.tsx` verified present on disk.
- All 3 task commits (`77572a8`, `c9ab1db`, `916e9ba`) verified in git log.
- tsc clean for plan files (only the 2 deferred 07-03 errors); eslint apps/web exit 0; vitest apps/web 24 green; full suite 502 green; anti-funnel grep gates clean.

---
*Phase: 07-web-shell*
*Completed: 2026-06-28*
