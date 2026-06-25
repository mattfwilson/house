---
phase: 02-tco-engine
plan: 03
subsystem: core
tags: [property-tax, mill-rate, prop-2.5, carrying-costs, maintenance, closing-costs, decimal, money, tdd]

# Dependency graph
requires:
  - phase: 02-tco-engine
    plan: 01
    provides: "AssumptionsV2 slices (appreciation.realAnnual, maintenance.annualPctOfValue, closing.rateOfPrice, tax.assessmentRatio), widened ScenarioInputs, FY-stamped town mill-rate table + resolveMillRate"
provides:
  - "tco/property-tax.ts — annualPropertyTax (assessed × mill-rate/$1,000), assessedValueAt (price × ratio grown at appreciation), propertyTaxSchedule (constant mill rate, growing assessed), PROP_2_5_FLAG"
  - "tco/carrying-costs.ts — maintenanceAnnual (on appreciating value), homeValueAt, insuranceAnnual (flat), hoaAnnual (×12 flat), carryingCostsForYear bundle"
  - "tco/closing-costs.ts — closingCosts (%-of-price or dollar override), amortizeOverHold ({ annual, monthly }), otherOneTimeCosts"
affects: [02-04-aggregator, 02-05-rent-vs-buy]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Reuse assessedValueAt as the single appreciation idiom (homeValueAt = assessedValueAt with ratio '1.0') — no duplicated (1+r)^year power"
    - "Division/power exclusively in Dec; dollars cross only as Money via .toFixed() into Money.of / Money.mul(rateStr)"
    - "Per-$1,000 mill rate divided by 1000 INSIDE the tax function (A3 — stored as published)"

key-files:
  created:
    - packages/core/src/tco/property-tax.ts
    - packages/core/src/tco/property-tax.test.ts
    - packages/core/src/tco/carrying-costs.ts
    - packages/core/src/tco/carrying-costs.test.ts
    - packages/core/src/tco/closing-costs.ts
    - packages/core/src/tco/closing-costs.test.ts
  modified: []

key-decisions:
  - "PROP_2_5_FLAG string is exactly 'Prop 2½ caps the town levy, not your individual bill' (note the ½ glyph), exported as a const and echoed on every PropertyTaxSchedule.prop25Flag"
  - "homeValueAt is implemented as a thin re-use of property-tax's assessedValueAt with assessmentRatio '1.0' — the appreciation (1+r)^year power lives in exactly one place; carrying-costs imports it from property-tax.ts"
  - "amortizeOverHold is a display-only smoothing; t=0-lump semantics for the net-worth model (Plan 05) documented in the module, not enforced here"
  - "otherOneTimeCosts exposed now (a thin Money lift) so Plan 04 can fold it into the breakdown without a closing-costs change"

patterns-established:
  - "Per-line TCO calc module shape: Money-valued readonly result object + per-year helper, all rate/power/div in Dec, exact-equality .toCents() tests"

requirements-completed: [TCO-03, TCO-05]

# Metrics
duration: 4min
completed: 2026-06-25
---

# Phase 2 Plan 03: Per-Line TCO Cost Calculators Summary

**Built the three independent per-line TCO cost cores — property tax (assessed × mill-rate per $1,000 with appreciating assessed value at a constant mill rate and the qualitative Prop 2½ levy-not-bill flag), carrying costs (maintenance on the appreciating home value, flat insurance, flat HOA), and closing costs (%-of-price or dollar override, amortizable over the hold) — all doing rate math in `Dec` and surfacing dollars as `Money`, proven by 26 exact-equality TDD tests.**

## Performance

- **Duration:** ~4 min
- **Tasks:** 3 (all TDD: RED → GREEN)
- **Files created:** 6 (3 modules + 3 test suites)

## Accomplishments

- **Property tax avoids the gating Pitfall 9.** `annualPropertyTax(assessedValue, millRatePerThousand)` is `assessedValue.mul(new Dec(millRatePerThousand).div(1000).toFixed())` — the mill rate is divided by 1000 *inside* the function (it is stored as published, $/$1,000, A3). There is NO flat-% path and NO 2.5% bill clamp: tests prove doubling the mill rate doubles the bill, and a higher-mill-rate town yields a proportionally higher bill. `assessedValueAt` grows `price × assessmentRatio` by `(1 + appreciation)^year` in `Dec`; `propertyTaxSchedule` holds the mill rate CONSTANT while only the assessed value grows (D-10), so year-1 tax > year-0 tax. The result object carries `PROP_2_5_FLAG`.
- **Carrying costs track the right bases (D-15).** `maintenanceAnnual(homeValue, annualPctOfValue)` is a percent-of-value multiply; the schedule applies it to the APPRECIATING home value (year-5 maintenance > year-0). `insuranceAnnual` holds flat in today's dollars; `hoaAnnual = monthly.mul('12')` holds flat. `homeValueAt` re-uses `assessedValueAt` (ratio "1.0") so the appreciation power is not duplicated.
- **Closing costs are flexible and amortizable (TCO-05).** `closingCosts(price, rateOfPrice, override?)` returns the override verbatim when supplied, else `price × rateOfPrice`. `amortizeOverHold(amount, holdingYears)` divides the lump in `Dec` into `{ annual, monthly }` Money, rounding each at its Money boundary; a reconciliation test confirms `monthly × holdingYears × 12 ≈ lump` within cent rounding. `otherOneTimeCosts` is exposed for Plan 04. The t=0-lump semantics for the Plan-05 net-worth model are documented in the module.

## Task Commits

1. **Task 1 — Property tax (RED `879243f`, GREEN `a619793`)** — `annualPropertyTax`, `assessedValueAt`, `propertyTaxSchedule`, `PROP_2_5_FLAG`.
2. **Task 2 — Carrying costs (RED `a1a1013`, GREEN `b6bedf1`)** — `maintenanceAnnual`, `homeValueAt`, `insuranceAnnual`, `hoaAnnual`, `carryingCostsForYear`.
3. **Task 3 — Closing costs (RED `63d4e80`, GREEN `4ca2a2b`)** — `closingCosts`, `amortizeOverHold`, `otherOneTimeCosts`.

## Exact PROP_2_5_FLAG String

```
Prop 2½ caps the town levy, not your individual bill
```

(Exported as `export const PROP_2_5_FLAG` from `tco/property-tax.ts`, with the ½ glyph; echoed on `PropertyTaxSchedule.prop25Flag`. Plan 04 should re-export it from the barrel alongside `computeTco`.)

## Shared Helper for Plan 02/04

- **`assessedValueAt(price, assessmentRatio, appreciationRealAnnual, year)`** (in `tco/property-tax.ts`) is the single appreciation-compounding helper. `tco/carrying-costs.ts` re-uses it via the exported **`homeValueAt(price, appreciationRealAnnual, year)`** wrapper (ratio "1.0"). Plan 04's `computeTco` should read these per-year (year 0 for the monthly/first-year breakdown) rather than re-deriving appreciation.

## Function Signatures (for Plan 04 wiring)

- `annualPropertyTax(assessedValue: Money, millRatePerThousand: string): Money`
- `assessedValueAt(price: string, assessmentRatio: string, appreciationRealAnnual: string, year: number): Money`
- `propertyTaxSchedule({ price, assessmentRatio, appreciationRealAnnual, millRatePerThousand, holdingYears }): { perYear: PropertyTaxYear[]; millRatePerThousand: string; prop25Flag }`
- `maintenanceAnnual(homeValue: Money, annualPctOfValue: string): Money`
- `homeValueAt(price: string, appreciationRealAnnual: string, year: number): Money`
- `insuranceAnnual(insuranceAnnualInput: string): Money`; `hoaAnnual(hoaMonthly: string): Money`
- `carryingCostsForYear({ price, maintenancePctOfValue, appreciationRealAnnual, insuranceAnnualInput, hoaMonthly, year }): { maintenance, insurance, hoa }`
- `closingCosts(price: string, rateOfPrice: string, override?: string): Money`
- `amortizeOverHold(amount: Money, holdingYears: number): { annual: Money; monthly: Money }`
- `otherOneTimeCosts(amount: string): Money`

## Deviations from Plan

None — plan executed exactly as written. All three modules built TDD (RED committed before GREEN), all acceptance criteria met, no architectural or blocking issues encountered. (Barrel exports remain deferred to Plan 04 per the plan's artifacts note — not a deviation.)

## Verification

- `npx vitest run packages/core/src/tco/property-tax.test.ts packages/core/src/tco/carrying-costs.test.ts packages/core/src/tco/closing-costs.test.ts` — **26 passed (3 files)**.
- `npx vitest run packages/core` — **165 passed (18 files)** (was 125; +40 from these three suites plus Plan 02's amortization/PMI).
- `npm run typecheck` (`tsc -b`) — clean.
- `npx eslint` on the three new modules — clean (only the pre-existing `boundaries/external` deprecation warnings).
- Grep guards: `property-tax.ts` contains `div(1000)` and uses `Dec.pow` for appreciation, with NO `0.025`/`0.78` clamp code path and NO flat-% tax (only comments documenting what is NOT done); `closing-costs.ts` does all division in `Dec` and feeds `.toFixed()` into `Money.of`.
- All dollar assertions are exact-equality `.toCents()` bigint comparisons — no `toBeCloseTo`.

## Threat Surface

All `mitigate` dispositions in the plan's threat register are satisfied:

- **T-03-08 (float reintroduction):** every division/power is in `Dec`; every dollar is `Money` via `.toFixed()` into `Money.of`; exact-equality dollar tests throughout. (Money-not-number result-field type assertions land in Plan 04's `tco.type-test.ts`.)
- **T-03-09 (Prop 2½ as a bill cap):** tax = assessed × mill rate with a constant mill rate + growing assessed; tests assert no 2.5% clamp and mill-rate sensitivity (doubling the rate doubles the bill); the qualitative `PROP_2_5_FLAG` is surfaced.
- **T-03-10 (determinism):** the three new files are pure functions (no `Date`/`process`/`Math.random`); the inherited core determinism guard + ESLint boundaries cover them.
- **T-02-SC (package installs):** none performed.

No new security surface beyond the planned `rate string → Dec math → Money` trust boundary.

## Known Stubs

None. All three modules are fully wired pure calculators consumed by Plan 04's `computeTco`. `otherOneTimeCosts` is a thin (intentional) Money lift, not a stub — its breakdown folding happens in Plan 04 by design.

## Self-Check: PASSED

All six created files verified present on disk; all six task commits (879243f, a619793, a1a1013, b6bedf1, 63d4e80, 4ca2a2b) verified in git history.
