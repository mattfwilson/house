---
phase: 02-tco-engine
plan: 06
subsystem: tco-engine
tags: [amortization, pmi, rent-vs-buy, decimal, golden-master, vitest, gap-closure]

# Dependency graph
requires:
  - phase: 02-05
    provides: rentVsBuy two-portfolio net-worth model + computeTco aggregator + tco golden fixture
provides:
  - "Crash-proof amortization at annualRate=0 (straight-line, no divide-by-zero)"
  - "Crash-proof rentVsBuy when the hold runs past the loan term (clamped schedule index)"
  - "Drop-off-aware PMI: charged only through dropOffMonth in both computeTco and rentVsBuy"
  - "Appreciating buy-path monthly outflow (property tax + maintenance grow with the home value)"
  - "Regenerated tco-golden-snapshot.json reflecting the four semantic fixes (rent still wins)"
  - "pmiDropOffMonth surfaced on the TcoBreakdown for month-gated downstream charging"

affects: [phase-04-fi-impact, rent-vs-buy, affordability]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Zero-rate guard via r.isZero() returning loan/termMonths straight-line (closed-form 0/0 avoided)"
    - "Schedule-index clamp: out-of-range months read as $0.00 remaining balance (full equity)"
    - "Time-varying buy outflow: flat P+I/ins/HOA + per-year appreciating tax/maintenance + month-gated PMI"
    - "Hold-average PMI annualization (monthlyPremium x chargedMonths / holdingYears), not flat x 12"

key-files:
  created: []
  modified:
    - packages/core/src/tco/amortization.ts
    - packages/core/src/tco/amortization.test.ts
    - packages/core/src/tco/tco.ts
    - packages/core/src/tco/tco.test.ts
    - packages/core/src/tco/rent-vs-buy.ts
    - packages/core/src/tco/rent-vs-buy.test.ts
    - packages/core/src/__fixtures__/tco-golden-snapshot.json

key-decisions:
  - "PMI annualization in computeTco is the HOLD AVERAGE (drop-off-aware), not flat monthlyPremium x 12"
  - "pmiDropOffMonth exposed on TcoBreakdown so rentVsBuy charges PMI month-by-month rather than re-deriving"
  - "buyMonthlyOutflowAt(input, month) exported as an internal-but-testable helper (like toReal)"
  - "Out-of-range amortization months (loan paid off before horizon) treated as $0.00 balance = full equity"

patterns-established:
  - "Crash guards are RED-locked first: the test reproduces the throw/TypeError before the guard lands"
  - "Golden fixture regenerated ONLY via gated UPDATE_GOLDEN=1 (npm run update-golden), never toMatchSnapshot/-u"

# Metrics
duration: 8min
completed: 2026-06-25
---

# Phase 02 Plan 06: TCO Correctness Gap Closure Summary

**Closed the four 02-VERIFICATION gaps — two BLOCKER crashes (zero-rate divide-by-zero, hold-past-payoff out-of-bounds) and two correctness biases (PMI charged flat past drop-off, buy outflow held flat while rent compounds) — each RED-locked then fixed, with the golden fixture regenerated cent-identically and the anti-funnel rent verdict held.**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-06-25T17:07:00Z
- **Completed:** 2026-06-25T17:15:00Z
- **Tasks:** 3 completed
- **Files modified:** 7

## Accomplishments

- **CR-02 (BLOCKER) — zero-rate divide-by-zero fixed.** `scheduledPayment`/`amortizationSchedule` now guard `r.isZero()` and amortize straight-line (`loan/termMonths`), with the reconciled final period still forcing a `$0.00` final balance and the principal sum equal to the loan exactly.
- **CR-01 (BLOCKER) — out-of-bounds crash fixed.** `rentVsBuy` clamps the schedule index; when `holdingYears*12 > termMonths` the loan-paid-off months read as a `$0.00` remaining balance (full equity), no more `TypeError`.
- **WR-02 — PMI stops at its drop-off month.** `computeTco` annualizes PMI as the hold average (drop-off-aware) and surfaces `pmiDropOffMonth`; `rentVsBuy` charges the PMI premium in the buy outflow only while `month <= dropOffMonth`.
- **WR-03 — buy outflow grows with appreciation.** The property-tax + maintenance components of the buy monthly outflow are recomputed per hold year on the appreciating assessed/home value (P+I, insurance, HOA stay flat); flat when appreciation is 0.
- **Golden fixture regenerated** via the gated `UPDATE_GOLDEN=1` path with a clean reviewable value diff; full suite recomputes cent-identically.

## Task Commits

Each task was committed atomically (TDD: test → fix):

1. **Task 1 RED: CR-01 + CR-02 crash locks** - `b86caf4` (test)
2. **Task 1 GREEN: zero-rate + out-of-bounds guards** - `f611d00` (fix)
3. **Task 2 RED: WR-02 + WR-03 locks** - `31c042e` (test)
4. **Task 2 GREEN: PMI-stops-at-dropoff + appreciating outflow** - `a2dbc4e` (fix)
5. **Task 3: regenerate golden fixture (gated)** - `462f77a` (chore)

_Plan metadata commit follows this summary._

## Files Created/Modified

- `packages/core/src/tco/amortization.ts` - zero-rate `r.isZero()` guard in `scheduledPayment` + `amortizationSchedule` (straight-line `loan/termMonths`, interest `$0.00`, reconciled final `$0.00` balance).
- `packages/core/src/tco/amortization.test.ts` - CR-02 zero-rate exact-cent locks (`$1,111.11` payment; `$360,000/0%/360` final balance `$0.00`, principal sum exact, `$0` interest, `$1,000.00` straight-line split).
- `packages/core/src/tco/tco.ts` - drop-off-aware PMI annualization (hold average) + new `pmiDropOffMonth: number | null` field; documented as convention #3 in the header.
- `packages/core/src/tco/tco.test.ts` - WR-02 lock: 10%-down PMI annualized `$2,430.00` (NOT flat `$2,700.00`), monthly `$202.50`, `pmiDropOffMonth === 108`; 20%-down `pmiDropOffMonth === null`.
- `packages/core/src/tco/rent-vs-buy.ts` - CR-01 clamp; new exported `buyMonthlyOutflowAt(input, month)` (flat P+I/ins/HOA + per-year appreciating tax/maintenance via `assessedValueAt`/`homeValueAt` + month-gated PMI using `tco.resolvedMillRate` and `tco.pmiDropOffMonth`); loop now calls it per month.
- `packages/core/src/tco/rent-vs-buy.test.ts` - CR-01 no-crash lock (termMonths 180 / holdingYears 20); WR-02 (post-drop-off outflow lower by exactly the PMI premium; no PMI in year 20); WR-03 (later-year outflow > year-0 when appreciation > 0; flat when appreciation = 0).
- `packages/core/src/__fixtures__/tco-golden-snapshot.json` - regenerated: `rentEndingNetWorth` `224885.81` -> `228503.08`, new `pmiDropOffMonth:null`; P+I `2275.44` + total `3280.61` unchanged.

## Exact Figures Asserted (for the human sanity check)

| Lock | Input | Expected |
|------|-------|----------|
| CR-02 scheduledPayment | `$400,000 / 0% / 360mo` | `$1,111.11` (`111111` cents = `loan/termMonths`) |
| CR-02 amortizationSchedule | `$360,000 / 0% / 360mo` | final balance `$0.00`, principal sum `$360,000.00`, interest `$0`, per-period principal `$1,000.00` |
| CR-01 no-crash | `termMonths 180, holdingYears 20` | returns `holdingYears === 20`, `buyEndingNetWorth > $0`, no throw |
| WR-02 computeTco PMI | `$400k / 10% down / 6.375% / 360mo / 10yr hold` | annualized `$2,430.00` (NOT `$2,700.00`), monthly `$202.50`, `pmiDropOffMonth = 108` |
| WR-02 rentVsBuy | `$500k / 10% down`, appreciation 0 | outflow drops by exactly the PMI premium the month after drop-off; no PMI in year 20 |
| WR-03 rentVsBuy | `$700k / 20% down`, appreciation 0.03 | later-year outflow > year-0 outflow; flat when appreciation 0 |

## WR-02 PMI-Annualization Representation (chosen)

`computeTco`'s `pmi` line is the **hold average**: total PMI actually paid over the hold = `monthlyPremium x min(dropOffMonth, totalMonths)`, divided by `holdingYears` (and `/12` for the monthly). This differs from the old flat `monthlyPremium x 12` whenever drop-off falls inside the hold. The raw `pmiDropOffMonth` is surfaced on the breakdown so `rentVsBuy` charges PMI month-by-month. Documented as convention #3 in the `tco.ts` header. (For an amortizing loan the balance cannot fall 2+ LTV points inside the first 12 months, so drop-off never lands in year 0 — the hold AVERAGE is what differs from flat, not the year-0 charge.)

## FIXED_SCENARIO rentVsBuy Winner After Regeneration

**Winner: RENT (unchanged — did NOT flip).** `rentEndingNetWorth` rose `$224,885.81 -> $228,503.08` because WR-03's growing buy outflow makes ownership more expensive in later years, so the renter invests a larger monthly difference. `buyEndingNetWorth` is unchanged at `$168,035.61` (the equity/appreciation math was untouched). The anti-funnel `rent-wins` and `buy-wins` cases in `rent-vs-buy.test.ts` both still hold their original winners.

## Deviations from Plan

None - plan executed exactly as written. The two-task TDD cycle (RED commit then GREEN commit) and the gated golden regeneration followed the plan's actions verbatim. No auto-fixes (Rules 1-3) or architectural escalations (Rule 4) were triggered; no authentication gates occurred.

## Phase Gate

- `npm test` (full core suite): **197 passed (20 files)**.
- Coverage gate: **Stmts 98.87% / Branch 91.13% / Funcs 98.14% / Lines 98.83%** — all above the 95/95/90/95 thresholds; suite exited green.
- `npm run typecheck` (`tsc -b`, all `*.type-test.ts` in graph): **passes**.
- Plan verification command (`amortization + pmi + tco + rent-vs-buy + golden`): **48 passed**.
- SC1 exact-equality discipline: **zero `toBeCloseTo` calls** anywhere in `tco/` (only comment mentions of "never `toBeCloseTo`").
- The four CR/WR locking tests are present and green.

## Known Stubs

None.

## Self-Check: PASSED

All 7 modified files exist on disk and all 5 task commits (`b86caf4`, `f611d00`, `31c042e`, `a2dbc4e`, `462f77a`) are present in git history.
