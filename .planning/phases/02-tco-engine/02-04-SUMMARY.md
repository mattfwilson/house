---
phase: 02-tco-engine
plan: 04
subsystem: core
tags: [tco, aggregator, money, decimal, mill-rate, snapshot, type-test, barrel, tdd]

# Dependency graph
requires:
  - phase: 02-tco-engine
    plan: 01
    provides: "widened ScenarioInputs, AssumptionsV2 slices (tax.assessmentRatio, appreciation.realAnnual, maintenance.annualPctOfValue, closing.rateOfPrice, pmi.annualRateOfLoan), resolveMillRate -> { residentialMillRate, fy }"
  - phase: 02-tco-engine
    plan: 02
    provides: "scheduledPayment, amortizationSchedule, computePmi (PmiResult)"
  - phase: 02-tco-engine
    plan: 03
    provides: "annualPropertyTax, assessedValueAt, maintenanceAnnual, homeValueAt, insuranceAnnual, hoaAnnual, closingCosts, amortizeOverHold, otherOneTimeCosts, PROP_2_5_FLAG"
provides:
  - "computeTco(input: EngineInput): TcoBreakdown — the single TCO composition point"
  - "TcoBreakdown / TcoLine result types (every dollar field a Money)"
  - "tco.type-test.ts — build-time no-bare-number guard for the result shape (in tsc -b graph)"
  - "Public barrel: computeTco + TcoBreakdown/TcoLine + Phase-3 building blocks (scheduledPayment, amortizationSchedule, AmortizationSchedule/Row, computePmi, PmiResult, annualPropertyTax, closingCosts)"
affects: [02-05-rent-vs-buy, 03-affordability, 04-fi-impact, 06-persistence]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Annualized-is-source-of-truth TcoLine: monthly = annualized x (1/12) in Dec, every line cents-pinned so total is the EXACT sum of per-line cents (no sub-cent drift hidden in the sum)"
    - "Year-0 breakdown-snapshot convention: the monthly/annualized breakdown is the year-0 figure; appreciating multi-year math reads the per-year schedules directly"
    - "Result-shape no-bare-number guard via *.type-test.ts in the tsc -b graph (mirrors money.type-test.ts)"

key-files:
  created:
    - packages/core/src/tco/tco.ts
    - packages/core/src/tco/tco.test.ts
    - packages/core/src/tco/tco.type-test.ts
  modified:
    - packages/core/src/index.ts

key-decisions:
  - "MONEY UNIT CONVENTION: annualized is the source of truth for every line; monthly = annualized / 12 (computed in Dec, rounded at the Money boundary). P+I's natural unit is the monthly scheduled payment, but it is normalized to annualized = scheduledPayment x 12 so the convention is uniform — the round trip back to monthly reproduces the exact scheduled-payment cents for the figures in scope."
  - "CENTS-PINNING CADENCE: each presented line (monthly AND annualized) is pinned to whole cents (HALF_EVEN) so total.monthly/total.annualized is the EXACT sum of the per-line displayed cents. Summing full-precision then rounding once gave a different total ($2,891.72 vs the sum-of-cents $2,891.71) — the acceptance contract is the sum-of-displayed-cents, so lines are pinned first."
  - "BREAKDOWN SNAPSHOT YEAR = year 0. The single-year breakdown uses year-0 assessed/home value; the appreciating-value schedules (rising tax/maintenance over the hold) are exercised by the property-tax/carrying schedules and by rent-vs-buy in Plan 05, not by this breakdown."
  - "PMI basis fixed to 'auto-78' for the aggregator's pmi line (the automatic-termination point); drop-off month is not surfaced on the breakdown (the line carries only the monthly/annualized premium)."

patterns-established:
  - "Top-level engine aggregator: read frozen EngineInput slices (no hardcoding), derive loan = price x (1 - downPaymentPct) in Dec, capture resolveMillRate's { rate, fy } into the result, compose per-line calculators into a closed Money-typed breakdown"

requirements-completed: [TCO-06]

# Metrics
duration: 7min
completed: 2026-06-25
---

# Phase 2 Plan 04: computeTco Aggregator Summary

**Assembled the top-level `computeTco` aggregator — it reads the frozen widened `EngineInput`, derives the loan (`price x (1 - downPaymentPct)` in `Dec`), resolves and CAPTURES the town's FY-stamped mill rate for snapshot self-containment, composes every Plan-02/03 calculator into a closed year-0 monthly + annualized breakdown (P+I, property tax, insurance, maintenance, HOA, PMI, amortized closing + total) with every dollar a `Money` — and locked the no-bare-number result shape with a `tco.type-test.ts` in the `tsc -b` graph while publishing `computeTco` plus the Phase-3 building blocks through the public barrel.**

## Performance

- **Duration:** ~7 min
- **Tasks:** 2 (Task 1 TDD: RED -> GREEN; Task 2 type-test + barrel)
- **Files:** 4 (3 created, 1 modified)

## Accomplishments

- **`computeTco` is the single TCO composition point (TCO-06 / SC4).** It reads `scenario` (price, downPaymentPct, annualRate, termMonths, holdingYears, town, insuranceAnnual, hoaMonthly, optional closingCostsOverride / otherOneTimeCosts) and `assumptions` (V2 slices: `tax.assessmentRatio`, `appreciation.realAnnual`, `maintenance.annualPctOfValue`, `closing.rateOfPrice`, `pmi.annualRateOfLoan`) — nothing hardcoded. It derives `loan = price x (1 - downPaymentPct)` in `Dec`, resolves the town mill rate, and composes `scheduledPayment` / `annualPropertyTax(assessedValueAt(...,0))` / `insuranceAnnual` / `maintenanceAnnual(homeValueAt(...,0))` / `hoaAnnual` / `computePmi` / `amortizeOverHold(closingCosts + otherOneTimeCosts)` into the breakdown.
- **Closed monthly + annualized breakdown, every dollar a `Money`.** All seven lines plus `total` are a `TcoLine { monthly, annualized }`. Annualized is the source of truth; monthly = annualized / 12 (in `Dec`). Each line is cents-pinned so `total` is the EXACT bigint-cents sum of the per-line displayed cents.
- **Snapshot self-containment (Pitfall 11 / D-08).** The result captures `resolvedMillRate` + `millRateFy` from `resolveMillRate(town)` (not a live re-read), and carries `propTwoAndHalfFlag` (the Prop 2.5 levy-not-bill string).
- **Build-time no-bare-number guarantee (T-04-11).** `tco.type-test.ts` (named `*.type-test.ts`, in the `tsc -b` graph, excluded from Vitest) asserts via `@ts-expect-error` that a `TcoLine` money is a `Money` not a `number`, that no bare-number dollar entry point exists, that the `Money` brand blocks structural typing, and that `resolvedMillRate` is a string — each suppression guards a REAL compile error (an unused one would fail with TS2578).
- **Public barrel published.** `computeTco`, `TcoBreakdown`, `TcoLine`, plus the Phase-3 building blocks `scheduledPayment`, `amortizationSchedule`, `AmortizationSchedule`, `AmortizationRow`, `computePmi`, `PmiResult`, `annualPropertyTax`, `closingCosts`. `Dec`/`Decimal` remain unexported.

## Documented Conventions (for downstream phases)

- **Monthly <-> annual:** annualized is the source of truth; `monthly = annualized x (1/12)` in `Dec`, each line pinned to whole cents (HALF_EVEN). `total` = exact sum of the seven line cents.
- **Breakdown snapshot year:** **year 0**. Rising-over-the-hold tax/maintenance lives in the per-year schedules (Plan 03) and the rent-vs-buy model (Plan 05), not in this single-year breakdown.

## TcoBreakdown Field Names (downstream import contract)

`principalAndInterest`, `propertyTax`, `insurance`, `maintenance`, `hoa`, `pmi`, `amortizedClosing`, `total` (each a `TcoLine { monthly: Money; annualized: Money }`), plus `resolvedMillRate: string`, `millRateFy: number`, `propTwoAndHalfFlag: string`.

## Pinned Oracle Figures ($400k / 6.375% / 360mo / 10yr hold / Newton FY2024 mill 9.86 / $1,800 ins / no HOA, DEFAULT_ASSUMPTIONS)

| Line | Annualized | Monthly |
|------|-----------|---------|
| P+I (loan $320,000, 20% down) | `$23,956.60` (2395660c) | `$1,996.38` (199638c) |
| Property tax (year 0) | `$3,944.00` (394400c) | `$328.67` (32867c) |
| Insurance (flat) | `$1,800.00` (180000c) | `$150.00` (15000c) |
| Maintenance (1% of $400k, year 0) | `$4,000.00` (400000c) | `$333.33` (33333c) |
| HOA | `$0.00` | `$0.00` |
| PMI (20% down -> none) | `$0.00` | `$0.00` |
| Amortized closing ($10,000 / 10yr) | `$1,000.00` (100000c) | `$83.33` (8333c) |
| **Total** | **`$34,700.60`** (3470060c) | **`$2,891.71`** (289171c) |

PMI when applicable (same house, 10% down -> loan $360,000, LTV 90%): monthly `$225.00` (22500c), annualized `$2,700.00` (270000c).

> Note: `total.monthly` (289171c) is the sum of the per-line PINNED cents; summing full-precision monthlies and rounding once would give 289172c. The acceptance contract is the sum-of-displayed-cents, so lines are pinned before summing.

## Task Commits

1. **Task 1 RED:** failing computeTco breakdown + snapshot-capture tests — `ee197be` (test)
2. **Task 1 GREEN:** computeTco year-0 monthly+annualized breakdown — `9f293ba` (feat)
3. **Task 2:** tco.type-test.ts no-bare-number guard + public barrel — `a610c35` (feat)

No REFACTOR commit — the implementation was clean as first written.

## TDD Gate Compliance

Task 1 followed RED -> GREEN with both gate commits in history:
- RED `ee197be` (committed failing — module-not-found, the expected stub-absent state; no test passed unexpectedly).
- GREEN `9f293ba` (10/10 pass).

The GREEN commit also corrected one test oracle (`total.monthly` 289172 -> 289171): the RED test was written against a full-precision-sum oracle, but the cents-pinning cadence the implementation adopted (required to satisfy the "total === exact sum of per-line cents" acceptance criterion) makes the sum-of-displayed-cents the correct value. The correction is part of landing GREEN, not a behavior change after the fact.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Cents-pinning cadence required so `total` equals the sum of per-line cents**
- **Found during:** Task 1 (GREEN — first run of the total-sum tests)
- **Issue:** Building `total` by `Money.add`-ing the full-precision (sub-cent) line monthlies and rounding only at `toCents()` gave `$2,891.72`, but the sum of the per-line displayed cents is `$2,891.71`. The plan's acceptance criterion requires `total.monthly.toCents() === sum of the seven lines' monthly .toCents()` (exact), which is the sum-of-displayed-cents.
- **Fix:** Added a `pinToCents` helper (`Dec.toDecimalPlaces(2, HALF_EVEN)` back into the closed `Money` API) and pinned BOTH `monthly` and `annualized` on every `TcoLine` at the line boundary, so the breakdown is presented in exact cents and `total` sums those cents exactly. Corrected the RED test's `total.monthly` oracle from 289172 to 289171 accordingly.
- **Files modified:** `packages/core/src/tco/tco.ts`, `packages/core/src/tco/tco.test.ts`
- **Commit:** `9f293ba`

## Verification

- `npx vitest run packages/core/src/tco/tco.test.ts` — **10 passed** (breakdown shape, per-line oracle, monthly/annual convention, exact total sums, PMI gating, mill-rate+FY capture, Prop 2.5 flag, determinism).
- `npx vitest run packages/core` — **175 passed (19 files)** (was 165; +10 from the new tco suite, no regressions; the `tco.type-test.ts` is correctly NOT picked up by Vitest).
- `npm run typecheck` (`tsc -b`) — clean WITH the `tco.type-test.ts` suppressions present (proving each guards a real compile error; an unused one would fail TS2578). The new barrel exports resolve.
- Barrel runtime check: `computeTco`/`scheduledPayment`/`amortizationSchedule`/`computePmi`/`annualPropertyTax`/`closingCosts` all resolve from `@house/core`; `Dec`/`Decimal` absent (grep + runtime `'Dec' in m === false`).
- `npx eslint` on the three changed source files — clean (only the pre-existing `boundaries/external` deprecation warnings noted in prior summaries).

## Threat Surface

All `mitigate` dispositions in the plan's threat register are satisfied:

- **T-04-11 (bare-number dollar leak on the TCO result):** `tco.type-test.ts` (in the `tsc -b` graph) asserts every `TcoLine` money is a `Money` not a `number`, no bare-number dollar entry point exists, and the brand blocks structural typing; an unused suppression fails the build. Every result dollar field is a `Money`.
- **T-04-12 (non-reproducible mill-rate resolution):** `computeTco` captures `resolvedMillRate` + `millRateFy` into the result — a replay reads the captured pair, not a live table re-read (Pitfall 11 / D-08).
- **T-04-13 (determinism):** `computeTco` is a pure function over a frozen `EngineInput`; no `Date`/`process`/`Math.random` (inherited core determinism guard + ESLint boundaries cover it; the determinism test asserts two runs are cent-identical).
- **T-02-SC (package installs):** none performed.

No new security surface beyond the planned `EngineInput -> TcoBreakdown` trust boundary.

## Known Stubs

None. `computeTco` is fully wired over the real Plan-02/03 calculators and the seeded town table; every line is a real composed figure. PMI drop-off month is intentionally not surfaced on the breakdown (the line carries the premium only) — not a stub.

## Self-Check: PASSED

- `packages/core/src/tco/tco.ts` — FOUND
- `packages/core/src/tco/tco.test.ts` — FOUND
- `packages/core/src/tco/tco.type-test.ts` — FOUND
- `packages/core/src/index.ts` (modified) — FOUND
- Commit `ee197be` (Task 1 RED) — FOUND
- Commit `9f293ba` (Task 1 GREEN) — FOUND
- Commit `a610c35` (Task 2) — FOUND
