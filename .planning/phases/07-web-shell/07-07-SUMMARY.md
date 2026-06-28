---
phase: 07-web-shell
plan: 07
subsystem: web-ui
tags: [assumptions-rail, docked-sidebar, live-recompute, debounce, decimal-string, zustand, shadcn, slate-theme, anti-funnel, D-10, D-08, D-16]

# Dependency graph
requires:
  - phase: 07-05
    provides: "apps/web/src/app/layout.tsx (Header + dark-slate base extended here) + shadcn Input/Label (Base UI) + the locked slate/teal token contract in globals.css + the .num-readout Geist-Mono utility"
  - phase: 07-06
    provides: "working-set.updateKnob (shared AssumptionSet DTO) + the useRecompute ~300ms-debounced latest-wins coordinator (requestRecompute/pending/settle)"
  - phase: 07-03
    provides: "recompareAction — the thin validate-through-Zod → compareScenarios → CompareDTO Server Action the debounced thunk calls"
provides:
  - "apps/web/src/components/rail/KnobRow.tsx — a single tunable row (Label + decimal-string Input) emitting raw canonical decimal strings; no validation, no money math"
  - "apps/web/src/components/rail/AssumptionsRail.tsx — the persistent docked assumptions rail (D-10) reading the shared working set, wired to the debounced live recompute (D-08), with a teal budget-stretch control"
  - "apps/web/src/store/comparison-input.ts — the ephemeral bridge store holding the non-knob recompare context (asOf/household/baseline/scenarios) the rail's payload needs (the cockpit populates it)"
  - "apps/web/src/app/layout.tsx — the rail docked beside <main> so it is echoed on every route (D-10)"
affects: [07-08, 07-09]

# Tech tracking
tech-stack:
  added: []
  patterns: [docked-aside-rail-in-shared-layout, text-inputmode-decimal-passthrough-no-number-cast, knob-edit-updateKnob-then-debounced-requestRecompute, catch-without-reject-thunk-keeps-last-good-result, comparison-context-bridge-store, teal-reserved-for-budget-control]

key-files:
  created:
    - apps/web/src/components/rail/KnobRow.tsx
    - apps/web/src/components/rail/AssumptionsRail.tsx
    - apps/web/src/store/comparison-input.ts
  modified:
    - apps/web/src/app/layout.tsx

key-decisions:
  - "KnobRow uses type=text inputMode=decimal (NOT type=number) so the raw decimal string passes through unmodified — a native number input silently rewrites/clears a partial '-' or trailing '.', which would mangle the decimal string before it reaches the core Zod boundary (D-16). Number() is never called in rail/* (the money→float edge stays confined to lib/format.ts + charts/**)."
  - "Validation lives ONLY at the recompareAction Zod boundary (D-16); the rail emits opaque decimal strings and holds zero validation and zero money math (T-7-04, grep-confirmed: no Money import, no Number( token)."
  - "A knob edit re-flies the instruments with NO Apply button (D-08): updateKnob then requestRecompute on the 07-06 ~300ms-debounced latest-wins coordinator; a burst coalesces to one issued recompute and a stale out-of-order result is dropped (T-7-09) by the existing coordinator — the rail adds no race logic."
  - "The debounced thunk catches a failed recompute WITHOUT rejecting (the coordinator does void fn().then with no .catch) — it surfaces the UI-SPEC error copy and returns the last good result so a transient failure clears `pending` and never blanks the instruments."
  - "Added store/comparison-input.ts (a 4th file beyond the plan's 3) as the honest bridge for the non-knob recompare context the rail needs; the cockpit (07-08) calls setComparisonInput and the rail skips recompute while it is null — an integration seam, not a stub."

requirements-completed: [SC-1, SC-3]

# Metrics
duration: ~20min
completed: 2026-06-28
---

# Phase 7 Plan 07: Persistent Assumptions Rail + Live Debounced Recompute Summary

**The flight-simulator loop is real: a persistent slate-800 docked assumptions rail (D-10), mounted once in the shared layout and echoed on every route, where editing any FI/projection knob (or the teal budget-stretch control) writes a raw decimal string to the shared working set and re-flies the instruments live through the 07-06 ~300ms-debounced, latest-wins recompute (D-08) — no Apply button, no validation or money math in the rail (D-16/T-7-04, grep-clean).**

## Performance
- **Duration:** ~20 min
- **Completed:** 2026-06-28
- **Tasks:** 2 (both `type=auto`)
- **Files:** 3 created + 1 modified

## Accomplishments
- `KnobRow.tsx`: a thin presentational row — a Label (12px/600, UI-SPEC Label role) over a `type="text" inputMode="decimal"` Input that holds and emits the raw canonical decimal STRING via `onChange(path, value)`. Text-not-number on purpose so a partial `-`/trailing `.` is never rewritten before the engine boundary; figures render in `.num-readout` (Geist Mono + tabular-nums) so the rail aligns with the comparison table. Optional teal `accent` reserved for the budget control; optional unit `hint`.
- `AssumptionsRail.tsx`: a slate-800 docked `<aside aria-label="Assumptions">` listing the FI/projection knobs (`returns.realAnnual`, `swr.rate`, `inflation.annual`, `appreciation.realAnnual`, `maintenance.annualPctOfValue`, `tax.effectiveIncomeRate`), each reading its leaf out of the shared working set by dot-path (`getKnobValue`, returns `''` when absent so the controlled input never goes uncontrolled), plus the teal-accented `townScoring.bucket.stretchFactor` budget-stretch control. A muted empty state ("Open a scenario to edit assumptions.") before a working set is loaded.
- Live recompute wiring (D-08): a knob edit calls `working-set.updateKnob(path, value)`, re-reads the FRESH `getState()` (the selector value is stale within the same handler tick), then schedules `recompute.requestRecompute(thunk)`. The debounced thunk calls `recompareAction({ asOf, household, assumptions, baseline, scenarios })` with the fresh working-set assumptions + the comparison context, and lands the result via the coordinator's latest-wins `settle`. A subtle `pending` "recomputing…" affordance (no blocking spinner — the synchronous core is cheap). On error it surfaces the UI-SPEC "Couldn't run the numbers…" copy (role="alert") and returns the last good result without rejecting (the coordinator has no `.catch`).
- `comparison-input.ts`: the ephemeral bridge store (`useComparisonInput`) holding `{ asOf, household, baseline, scenarios }` — the non-knob recompare context the rail's payload needs. The cockpit (07-08) populates it via `setComparisonInput`; the rail reads it and skips recompute while it is `null`. Pure transient UI state, no persistence, no Money.
- `layout.tsx`: `<AssumptionsRail/>` docked in a flex row beside `<main>` under the persistent `<Header/>` so it is present on every route (cockpit, heatmap, sensitivity — D-10). The Header/Geist/dark-slate setup from 07-05 was extended, not overwritten.

## Task Commits
1. **Task 1: docked assumptions rail + decimal-string KnobRow (D-10)** — `adff16c` (feat)
2. **Task 2: live debounced recompute wiring + mount rail in layout (D-08/D-10)** — `3d24a36` (feat)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking wiring] Added `store/comparison-input.ts` (a 4th file beyond the plan's 3)**
- **Found during:** Task 2
- **Issue:** `recompareAction` needs household + baseline + N scenarios + asOf alongside the working-set assumptions, but the rail is mounted in the shared layout with NO props and the working-set store holds only the AssumptionSet. With no source for the comparison context, the debounced thunk could not assemble a real payload — and hardcoding/stubbing one is explicitly forbidden.
- **Fix:** Added a minimal ephemeral Zustand bridge store (`useComparisonInput`) holding `{ asOf, household, baseline, scenarios }`, set by the cockpit (07-08) and read by the rail. The rail skips recompute while it is `null` — an honest integration seam, not a stub (no fake data is ever presented as real).
- **Files modified:** apps/web/src/store/comparison-input.ts
- **Verification:** eslint apps/web exit 0 (store client-tier import guards satisfied — only `zustand`); tsc clean for the file; the rail's `requestRecompute` thunk type-checks against the `recompareAction` payload.
- **Committed in:** 3d24a36

No other deviations. No architectural (Rule 4) changes; no auth gates.

## Threat Model Coverage
- **T-7-01 (Tampering — knob values reaching the engine):** the rail emits opaque decimal strings only; validation happens at the `recompareAction` core Zod boundary (D-16), never duplicated in the rail.
- **T-7-09 (Tampering/correctness — rapid knob edits racing):** delegated to the 07-06 coordinator's monotonic latest-wins `settle` (a burst coalesces to one issued recompute via the ~300ms debounce; a stale out-of-order result is discarded) — the rail adds no race logic.
- **T-7-04 (Tampering/correctness — bare-number money in the rail):** KnobRow keeps values as raw decimal strings (`type="text"`); grep gate confirms NO `Money` import and NO `Number(` token anywhere in `apps/web/src/components/rail/*` (the only textual matches are explanatory comments).

## Known Stubs
None. The rail is fully wired to the real `working-set`, `recompute`, and `recompareAction`. The `comparison-input` bridge store starts `null` by design and is populated by the cockpit (07-08); the rail honestly skips recompute until a comparison is assembled — an integration seam, not hardcoded/empty data presented as real.

## Verification Evidence
- `npx tsc -p apps/web/tsconfig.json --noEmit` → only the 2 pre-existing deferred 07-03 test errors (`scenarios.test.ts:80`, `dto/scenario.test.ts:109`); ZERO new errors from the four plan files.
- `npx eslint apps/web` → exit 0 (client-tier import guards + the Number() money→float confinement satisfied).
- `npx vitest run apps/web` → 6 files, 24 tests passed.
- Grep gates: no `Money`/`Number(` in `components/rail/*` (comments only); `requestRecompute` wired in `AssumptionsRail.tsx`; `AssumptionsRail` referenced in `layout.tsx`; no "Apply" button element.
- Build note: the full `next build` remains the 07-10 phase gate (known-blocked by the @house/app drizzle-migrations packaging issue per deferred-items.md) — NOT touched here.

---
*Phase: 07-web-shell*
*Completed: 2026-06-28*

## Self-Check: PASSED
- All four plan files verified present on disk (`KnobRow.tsx`, `AssumptionsRail.tsx`, `comparison-input.ts`, `layout.tsx`).
- Both task commits verified in git log (`adff16c`, `3d24a36`).
- tsc clean for plan files (only the 2 deferred 07-03 errors); eslint apps/web exit 0; vitest apps/web 24 green; grep gates clean.
