---
phase: 04-fi-impact-engine-sensitivity-flagship
plan: 05
subsystem: testing
tags: [fi, sensitivity, tornado, tco, mill-rate, swr, zod, decimal.js, gap-closure]

# Dependency graph
requires:
  - phase: 04-fi-impact-engine-sensitivity-flagship (04-04)
    provides: the tornado (DRIVER_SPECS cheap-re-run), fiImpact, fiTargets, divideBySwr, fi-golden-snapshot
  - phase: 02-tco-engine
    provides: computeTco + resolveMillRate (the single property-tax chokepoint tco.resolvedMillRate)
provides:
  - An OPTIONAL tax.millRateOverride leaf on the V3 schema, honored by computeTco (town-table fallback intact)
  - A tornado tax driver that BITES — perturbs the live mill rate relatively (×(1±taxBandRelative)) for a real, ranked FI-date swing (SC5 / ASMP-02)
  - A positivity refine on swr.rate at the Zod boundary + a divideBySwr defense-in-depth guard + a tornado swr low-band positive-floor clamp (CR-01)
affects: [05-town-scoring, phase-07-ui]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Optional assumption-boundary override (decStr.optional()) that wins over a resolved default at the single chokepoint, leaving goldens byte-identical because it is absent from defaults"
    - "Tornado driver threads a per-driver SEED (the live mill rate) through perturb→apply without any switch(driver) projection math (Pitfall 10 preserved)"
    - "Boundary positivity .refine + in-depth runtime guard + a perturbation-time clamp — three layers closing one non-positive-rate hole (CR-01)"

key-files:
  created: []
  modified:
    - packages/core/src/assumptions/schema.ts
    - packages/core/src/assumptions/schema.test.ts
    - packages/core/src/tco/tco.ts
    - packages/core/src/tco/tco.test.ts
    - packages/core/src/fi/fi-target.ts
    - packages/core/src/fi/fi-target.test.ts
    - packages/core/src/fi/sensitivity.ts
    - packages/core/src/fi/sensitivity.test.ts

key-decisions:
  - "tax.millRateOverride is the published per-$1,000 mill rate (same units as the town table), OPTIONAL on V3 only, absent from defaults — keeps all four goldens byte-identical (no regen)"
  - "millRateFy stays the town's published FY even under an override (the override changes the rate, not the provenance) for traceability"
  - "The tax driver seeds its base rate inside perturb (the town lives on the scenario, not on assumptions); DriverSpec.apply gained a baseRate param threaded for tax only — no switch(driver) math"
  - "swr.rate positivity enforced in THREE layers: V3 Zod .refine (load-bearing), divideBySwr lessThanOrEqualTo(0) throw (defense in depth), and a tornado swr low-band clamp to SWR_FLOOR='0.0001'"
  - "swr low-band clamp floors to a tiny positive rate (a band >= swr.rate is degenerate input the model floors, not a reason to reject the whole tornado)"

patterns-established:
  - "Pattern: an absent-by-default optional override at a boundary is the zero-golden-churn way to make a resolved value perturbable"
  - "Pattern: a sensitivity driver may seed from a scenario-resolved value via perturb without breaking the cheap-re-run contract"

requirements-completed: [ASMP-02, FI-05]

# Metrics
duration: ~12min
completed: 2026-06-26
---

# Phase 04 Plan 05: Tornado Tax-Driver + SWR-Guard Gap Closure Summary

**The tornado tax driver now bites — it perturbs the LIVE town mill rate via an optional assumption-boundary override (computeTco honors it, town-table fallback intact) for a real, ranked FI-date swing; and a non-positive swr.rate can no longer crash the engine or fake a month-0 FI date, guarded at the Zod boundary, in divideBySwr, and in the tornado's swr low band — all four goldens byte-identical.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-06-26T18:36:00Z
- **Completed:** 2026-06-26T18:43:00Z
- **Tasks:** 3 (all TDD: RED → GREEN)
- **Files modified:** 8

## Accomplishments

- **GAP 1 closed (BLOCKER / SC5 / ASMP-02):** added an OPTIONAL `tax.millRateOverride` decStr leaf to the V3 schema that `computeTco` honors (falling back to `resolveMillRate(town)`), then rewired the tornado tax driver to perturb THAT live rate relatively (×(1±taxBandRelative)). Because the override flows through the single chokepoint `tco.resolvedMillRate`, it reaches BOTH `ownerHousingAt` (the owner perpetual-tax target) AND `buyMonthlyOutflowAt` (the monthly premium) with no further wiring — the tax row now shows `swingMonths > 0` for a reached scenario, and a `taxBandRelative` of `'0'` collapses it to zero (stored-band sourcing proven).
- **GAP 2 closed (CRITICAL / CR-01):** `swr.rate` is now positive-by-construction at the V3 Zod boundary (a `.refine` rejecting `0`/negative, mirroring the `targetSavingsRate`/`downPaymentPct` precedent), guarded in depth in `divideBySwr` (a `lessThanOrEqualTo(0)` throw replacing the silent `Money.of('Infinity')`/negative-target), and clamped in the tornado's swr low band (`SWR_FLOOR='0.0001'`) so a band ≥ rate can never crash `tornado`.
- **Contract + reproducibility preserved:** no `switch(driver)` projection math introduced (Pitfall 10 cheap-re-run intact); the relative tax band stays the only relative band (L6); all four committed goldens (canary, tco, affordability, fi) recompute byte-identically with NO regeneration; full core suite 352 green (was 337; +15 new tests); `tsc -b` (incl. fi.type-test.ts) + eslint clean on all touched files.

## Task Commits

Each task was committed atomically (TDD RED+GREEN folded per task):

1. **Task 1: Make the mill rate overridable at the assumption boundary (GAP 1, half 1)** — `2724585` (feat)
2. **Task 2: Rewire the tornado tax driver onto the live mill rate (GAP 1, half 2)** — `118e424` (feat)
3. **Task 3: Guard swr.rate at the boundary, in the divide, and in the tornado (GAP 2 / CR-01)** — `b52ee2f` (fix)

**Plan metadata:** _(this docs commit)_

## Files Created/Modified

- `packages/core/src/assumptions/schema.ts` — added optional `tax.millRateOverride` (V3) + a positivity `.refine` on `swr.rate` (V3)
- `packages/core/src/assumptions/schema.test.ts` — optional-leaf parse, override round-trip, non-canonical rejection, strict-group guard; swr zero/negative rejection + positive acceptance
- `packages/core/src/tco/tco.ts` — `computeTco` derives `effectiveMillRate = millRateOverride ?? resolved.residentialMillRate`, flowing through propertyTax + captured `resolvedMillRate`
- `packages/core/src/tco/tco.test.ts` — no-override = town rate (byte-identical), override = captured rate, doubled override doubles the tax bill
- `packages/core/src/fi/fi-target.ts` — `divideBySwr` defense-in-depth guard (throws on non-positive swr.rate)
- `packages/core/src/fi/fi-target.test.ts` — forged-input depth tests (zero/negative throw a clear error; happy path unchanged)
- `packages/core/src/fi/sensitivity.ts` — tax driver perturbs `tax.millRateOverride` (seeded from the live rate via `perturb`); `DriverSpec.apply` gained a `baseRate` param; swr low-band clamps to `SWR_FLOOR`
- `packages/core/src/fi/sensitivity.test.ts` — reversed the weakened 04-04 tax assertion (real `swingMonths > 0` + direction); `taxBandRelative '0'` zero-collapse; swr low-band edge stays well-formed

## Decisions Made

- **Override units + placement:** `tax.millRateOverride` is the published per-$1,000 mill rate (identical units to the town table), OPTIONAL on V3 only, and deliberately absent from `DEFAULT_ASSUMPTIONS` — this is what keeps every assumption-serializing golden byte-identical (no regen).
- **FY provenance under override:** `millRateFy` stays the town's published FY even when an override is present — the override changes the rate, not the provenance (traceability), documented inline.
- **Threading the town into the tax driver (the plan-checker's noted choice):** seeded the base rate inside `perturb` (the town lives on `input.scenario`, not on `assumptions`) and threaded it via a new `baseRate` param on `DriverSpec.apply`. The five absolute drivers ignore the extra arg (each reads its own assumption rate). This keeps the change self-contained in `sensitivity.ts` and introduces NO `switch(driver)` projection math.
- **Three-layer swr guard:** the boundary `.refine` is the load-bearing fix; the `divideBySwr` throw is defense-in-depth for a forged input bypassing the boundary; the tornado clamp (`SWR_FLOOR='0.0001'`) keeps a degenerate band ≥ rate from crashing the tornado — the model floors degenerate input rather than rejecting the whole row.

## Deviations from Plan

None - plan executed exactly as written. All three tasks followed the specified TDD RED→GREEN flow with the exact fix shapes described; no auto-fixes (Rules 1-3) or architectural decisions (Rule 4) were needed.

## Issues Encountered

None. The RED phases failed exactly as predicted (tax swing 0 with the inert driver; swr zero/negative not yet rejected), and the GREEN implementations passed on the first run for each task.

## Known Stubs

None — no placeholder data, empty returns, or unwired sources introduced. `tax.propertyRateAnnual` remains intentionally inert (kept for migrate stability / zero golden churn per the plan); it is documented in-code and superseded by the live-mill-rate path the tax driver now uses.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 04 (FI-Impact Engine & Sensitivity) gap-closure complete: the tornado is honest end-to-end (tax row swings; no driver can crash the engine or fake a month-0 FI date).
- The four goldens remain the reproducibility anchor (byte-identical), so downstream Phase 05 (Town Scoring & Heatmap) and Phase 07 (UI) inherit a stable, fully-guarded core.
- Note: gap-closure plan 04-06 (if any) is unaffected by this work; this plan touched only the schema/tco/fi-target/sensitivity surface.

## Self-Check: PASSED

All four modified source files + the SUMMARY exist on disk; all three task commits (`2724585`, `118e424`, `b52ee2f`) are present in git history.

---
*Phase: 04-fi-impact-engine-sensitivity-flagship*
*Completed: 2026-06-26*
