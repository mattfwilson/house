---
phase: 02-tco-engine
plan: 02
subsystem: core
tags: [amortization, pmi, decimal, money, tco, mortgage, tdd, invariant-tests]

# Dependency graph
requires:
  - phase: 02-tco-engine
    plan: 01
    provides: "AssumptionsV2 (pmi.annualRateOfLoan / pmi.dropOffLtv slices), widened ScenarioInputs, Money/Dec primitives"
  - phase: 01-foundations
    provides: "frozen Dec clone (34-digit HALF_EVEN), closed Money API, CANONICAL_DECIMAL_RE, canary Dec->Money precedent"
provides:
  - "scheduledPayment(loan, annualRate, termMonths): Money — closed-form level payment computed entirely in Dec"
  - "amortizationSchedule(loan, annualRate, termMonths): AmortizationSchedule — full schedule with a reconciled final payment forcing exact $0.00 final balance"
  - "AmortizationRow / AmortizationSchedule types (Money-valued rows)"
  - "computePmi(opts): PmiResult — PMI vs original value + scheduled balance with the 78/80 toggle"
  - "PmiResult / PmiBasis types"
affects: [02-03-property-tax, 02-04-tco-aggregator, 02-05-rent-vs-buy, 04-fi-impact]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Reconciled-final-payment amortization: final period principal IS the remaining balance, absorbing accumulated per-period rounding drift so finalBalance === $0.00 exactly"
    - "Per-period rounding cadence: monthlyRate kept full-precision in Dec (never rounded); each period's interest/principal/balance rounded to cents (HALF_EVEN) via toDecimalPlaces(2) then Money.of(d.toFixed())"
    - "LTV comparison in Dec (.gt/.lte) — Money has no comparison API; dollars never compared as numbers"
    - "Dec /12 fed to Money.mul as a rate string — no bare-number division crossing into Money"

key-files:
  created:
    - packages/core/src/tco/amortization.ts
    - packages/core/src/tco/amortization.test.ts
    - packages/core/src/tco/pmi.ts
    - packages/core/src/tco/pmi.test.ts
  modified: []

key-decisions:
  - "monthlyRate = annualRate / 12 (US-standard nominal-annual/12 convention, documented in-source), kept at FULL Dec precision — rounding the rate is the classic source of cent drift over 360 periods"
  - "Reconciled final payment forces exact $0.00 final balance (Pitfall 2); the scheduled level payment is pinned to cents once so the per-period split matches what the borrower pays and the reconciled tail is the only deviation"
  - "PMI applies iff origination LTV (loan/originalValue) STRICTLY > 0.80 — so exactly 20% down (LTV == 0.80) does NOT trigger PMI"
  - "computePmi exposes no appreciated-value input by design — appreciation-based PMI removal is out of scope (Pitfall 3); drop-off is measured only against the constant original value + scheduled balance"
  - "Barrel exports for tco/ are deferred to Plan 04 (per the plan's artifacts note), alongside computeTco"

requirements-completed: [TCO-01, TCO-04]

# Metrics
duration: ~10min
completed: 2026-06-25
---

# Phase 2 Plan 02: Amortization + PMI Correctness Cores Summary

**Built the two existential-correctness cores of the TCO engine — a fixed-rate amortization schedule with a reconciled final payment that lands on EXACTLY $0.00 and sums principal to the loan exactly, and PMI measured against the constant original value + scheduled balance with a proven-different 78/80 drop-off toggle — all rate/power/division math in the frozen `Dec` clone, every dollar a `Money`, proven by exact-equality (`toCents` bigint) tests with zero `toBeCloseTo`.**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-06-25T10:37Z (approx)
- **Completed:** 2026-06-25T10:40Z (approx)
- **Tasks:** 2 (both TDD: RED test → GREEN implementation)
- **Files modified:** 4 (all created)

## Accomplishments

- **Amortization (TCO-01 / SC1).** `scheduledPayment` computes the closed form `M = P·r·(1+r)^n / ((1+r)^n − 1)` entirely in `Dec` and surfaces a `Money` via `Money.of(m.toFixed())` (the canary precedent — `.toFixed()`, never `.toString()`). `amortizationSchedule` iterates 1..n with the per-period cadence (full-precision rate, cents-rounded split) and FORCES the final period to be reconciled (final principal IS the remaining balance), so the final balance is exactly `$0.00` and the principal sum is exactly the loan.
- **PMI (TCO-04 / SC3).** `computePmi` derives applicability from origination LTV (`loan/originalValue > 0.80`, compared in `Dec`), charges `(loan · annualRateOfLoan)/12` as `Money` (the `/12` done in `Dec`, fed to `Money.mul` — no bare-number division), and scans the scheduled balance for the first month at/under the basis threshold of the CONSTANT original value. The `auto-78` and `requested-80` bases produce different, pinned drop-off months.
- **Exact-equality discipline throughout.** Every dollar assertion goes through `Money.toCents()` (bigint) or `toDecimalString()`; no `toBeCloseTo` anywhere. The closed `Money` API was not widened (no `div`/`pow`/comparison added).

## Pinned Oracle Figures (HALF_EVEN, derived against the project's frozen `Dec`)

**Amortization — $400,000 / 6.375% / 360mo:**

| Quantity | Value |
|----------|-------|
| Scheduled (level) payment | `$2,495.48` (249548 cents) |
| Month-1 interest | `$2,125.00` |
| Month-1 principal | `$370.48` |
| **Reconciled final payment** (month 360) | **`$2,494.85`** (249485 cents — differs from the level payment) |
| Final balance (month 360) | `$0.00` (0 cents, exact) |
| Principal sum over all 360 rows | `$400,000.00` (exact == loan) |
| Interest sum (== sum(payment) − loan) | `$498,372.17` |

**PMI — $360,000 loan (10% down) of a $400,000 value, same rate/term:**

| Quantity | Value |
|----------|-------|
| Monthly premium ((360000 · 0.0075)/12) | `$225.00` (22500 cents) |
| `auto-78` drop-off month | **108** |
| `requested-80` drop-off month | **94** (earlier than auto, as expected) |
| 20%-down case (loan $320,000, LTV == 0.80) | `applies === false`, premium `$0.00`, dropOff `null` |

## Task Commits

1. **Task 1 RED:** failing amortization invariant + oracle tests — `94cd8a5` (test)
2. **Task 1 GREEN:** fixed-rate amortization schedule implementation — `0a9e10e` (feat)
3. **Task 2 RED:** failing PMI 78/80-toggle + premium tests — `558a452` (test)
4. **Task 2 GREEN:** PMI implementation — `4e25071` (feat)

No REFACTOR commits — both implementations were clean as first written (one unused private helper, `moneyCents`, was removed before the Task-1 GREEN commit, so it never entered history).

## Files Created

- `packages/core/src/tco/amortization.ts` — `monthlyRate` (internal, full-precision), `scheduledPayment`, `amortizationSchedule`, `AmortizationRow`, `AmortizationSchedule`.
- `packages/core/src/tco/amortization.test.ts` — 8 exact-equality invariant/oracle tests.
- `packages/core/src/tco/pmi.ts` — `computePmi`, `PmiResult`, `PmiBasis`.
- `packages/core/src/tco/pmi.test.ts` — 6 applicability/premium/toggle tests.

## TDD Gate Compliance

Both tasks followed the RED → GREEN cycle with the gate commits present in history:
- Task 1: `test(...)` `94cd8a5` (committed RED — module-not-found failure) → `feat(...)` `0a9e10e` (GREEN, 8/8 pass).
- Task 2: `test(...)` `558a452` (committed RED) → `feat(...)` `4e25071` (GREEN, 6/6 pass).
No test passed unexpectedly during RED (both failed on missing module, the expected Wave-0-stub-absent state).

## Deviations from Plan

None — plan executed exactly as written. The only intra-task adjustment was removing an unused `moneyCents` helper from `amortization.ts` before its GREEN commit (housekeeping, not a behavior deviation; never committed).

## Verification

- `npx vitest run packages/core/src/tco/amortization.test.ts packages/core/src/tco/pmi.test.ts` — 14 passed.
- `npx vitest run packages/core` — 139 passed (full core suite; +14 over the prior 125, no regressions).
- `npm run typecheck` (`tsc -b`) — clean.
- `npx eslint` on the four new files — clean (only the pre-existing `boundaries/external` deprecation warnings noted in prior summaries).
- Acceptance greps: amortization.ts has no `.toString()` feeding `Money.of` (the only `toString` token is a comment warning against it); pmi.ts performs LTV comparisons in `Dec` (`.gt`/`.lte`) with no Money-vs-Money comparison; both files do `.div`/`.pow`/`.times` in `Dec`.

## Threat Surface

All `mitigate` dispositions in the plan's threat register are satisfied:
- **T-02-05** (float reintroduction in the `(1+r)^n` → dollar chain): all rate/power/div math is in `Dec`; every dollar is `Money`; `.toFixed()` (never `.toString()`) crosses into `Money.of`; exact-equality `toCents` tests catch any cent drift. (The Plan-04 `tco.type-test.ts` will further assert result fields are `Money` not `number`.)
- **T-02-06** (amortization final-balance drift): reconciled final payment forces `finalBalance === Money.zero()`; the `sum(principal) === loan` invariant test and the interest cross-check both assert exact bigint-cents equality; no `toBeCloseTo`.
- **T-02-07** (determinism of new tco/ files): pure functions, no `Date`/`process`/`Math.random` (inherited ESLint + runtime determinism guards cover the new files; full suite green under those guards).
- **T-02-SC** (package installs): none — no dependencies added.

No new security surface beyond the planned `rate string → Dec math → Money` trust boundary.

## Known Stubs

None. Both modules are fully implemented and consumed by Plans 02-03/04/05 (property tax, TCO aggregator, rent-vs-buy). Barrel exports are intentionally deferred to Plan 04 per the plan's own artifacts note.

## Self-Check: PASSED

- `packages/core/src/tco/amortization.ts` — FOUND
- `packages/core/src/tco/amortization.test.ts` — FOUND
- `packages/core/src/tco/pmi.ts` — FOUND
- `packages/core/src/tco/pmi.test.ts` — FOUND
- Commit `94cd8a5` (Task 1 RED) — FOUND
- Commit `0a9e10e` (Task 1 GREEN) — FOUND
- Commit `558a452` (Task 2 RED) — FOUND
- Commit `4e25071` (Task 2 GREEN) — FOUND
