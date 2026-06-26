---
phase: 03-affordability-engine
plan: 02
subsystem: affordability-engine
tags: [dti, bank-affordability, binary-search, decimal, tco, AFF-01, solver]

requires:
  - phase: 03-01
    provides: "household block on EngineInput (downPaymentCash, grossAnnualIncome, existingMonthlyDebt) consumed by the solver"
  - phase: 02-tco-engine
    provides: "computeTco / TcoBreakdown (the DTI numerator source), engineInput() factory, Money + Dec discipline"
provides:
  - "lenderDtiCarryingCost(tco): Money — the D-14 numerator (P+I + propertyTax + insurance + pmi + hoa; EXCLUDES maintenance + amortizedClosing)"
  - "frontEndRatio / backEndRatio — GROSS-monthly-denominator DTI ratios returned as Dec"
  - "bankAffordability(input): BankAffordabilityResult — monotonic binary-search max-price solver {bankMaxPrice, bankMaxLoan, frontEndRatio, backEndRatio, bindingRatio}"
affects: [03-03, 03-04, affordability barrel exports, FI-impact ranking]

tech-stack:
  added: []
  patterns:
    - "Per-trial-price EngineInput rebuild (Shared P2): the solver loops computeTco(engineInput(... trial price ...)) and never re-derives amortization"
    - "Monotonic bisection to the cent: low strictly above downPaymentCash (Pitfall 3), exponential high bracket (no hard ceiling), $0.01 tolerance, iteration caps (T-03-04)"
    - "DTI numerator assembled with the closed Money API; ratios computed/compared in the frozen Dec clone; dollars cross to Money only at the cent-pinned result boundary"

key-files:
  created:
    - "packages/core/src/affordability/dti.ts"
    - "packages/core/src/affordability/dti.test.ts"
    - "packages/core/src/affordability/bank-affordability.ts"
    - "packages/core/src/affordability/bank-affordability.test.ts"
  modified: []

key-decisions:
  - "lenderDtiCarryingCost sums P+I + propertyTax + insurance + pmi + hoa from the TcoBreakdown line monthlies and NEVER reads tco.total (Pitfall 1) — excludes maintenance + amortizedClosing (D-14)"
  - "Both DTI ratios divide by GROSS-monthly income (grossAnnual/12) with NO tax haircut anywhere near the denominator (Pitfall 2, D-04); ratios returned as Dec so the solver compares them against assumptions.dti.* without re-parsing"
  - "Solver bisects in Dec between low = downPaymentCash + 1 (so trial pct = cash/price < 1, Pitfall 3) and an exponentially-bracketed high; thresholds read from input.assumptions.dti.frontEnd/.backEnd (Shared P4); price crosses to Money via toDecimalPlaces(2, ROUND_HALF_EVEN)"
  - "bindingRatio = the ceiling with the smaller remaining headroom at the solved price (front-end wins ties as the tighter ceiling)"

patterns-established:
  - "Affordability modules import Dec/Money internally (like tco.ts) and return Money + decimal-string ratios; the public affordability barrel is deferred to Plan 04"
  - "Hand-verified worked-example fixtures pin exact cents/decimals reconciled against computeTco's own breakdown (not a re-derived payment formula)"

requirements-completed: [AFF-01]

duration: ~12min
completed: 2026-06-26
---

# Phase 03 Plan 02: Bank Affordability (DTI + Max-Price Solver) Summary

**The D-14 lender-DTI numerator split (PITI + HOA + PMI, excluding maintenance + amortized closing) plus a monotonic binary-search solver for the max approvable PRICE under the lower of the front-end (0.28) and back-end (0.36) DTI ceilings, reusing `computeTco` per trial price.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-06-26T12:26:00Z (approx)
- **Completed:** 2026-06-26T12:32:00Z (approx)
- **Tasks:** 2 (both TDD)
- **Files modified:** 4 created

## Accomplishments

- **`lenderDtiCarryingCost(tco): Money`** — the D-14 numerator: `principalAndInterest + propertyTax + insurance + pmi + hoa` (PITI + HOA + PMI), assembled from the already-cent-pinned `TcoBreakdown` line monthlies. EXCLUDES `maintenance` (an owner reality, not a lender input) and `amortizedClosing` (a t=0 lump); deliberately never reads `tco.total` (Pitfall 1).
- **`frontEndRatio` / `backEndRatio`** — DTI ratios over the GROSS-monthly denominator (`grossAnnual/12`), with the back-end adding the single monthly minimum-obligations total (D-10). Returned as `Dec` for direct threshold comparison.
- **`bankAffordability(input): BankAffordabilityResult`** — requires `input.household` (throws clearly if absent), then solves the largest approvable price to the cent via monotonic bisection: low strictly above `downPaymentCash`, exponential high-bracketing, `$0.01` tolerance, with iteration caps as DoS defense-in-depth (T-03-04). Returns `bankMaxPrice`, `bankMaxLoan = price − downPaymentCash`, both ratios at the solved price, and the `bindingRatio` enum.
- **Hand-verified fixtures** pin the lender numerator and both ratios in exact cents/decimals reconciled against the engine's own `computeTco` breakdown (20%-down no-PMI and 10%-down PMI-ON), and the solver tests assert solver-at-threshold (+$0.01 fails), front-end vs back-end binding, `bankMaxLoan` identity, PMI-kink monotonicity, and the absence of a Zod `[0,1)` throw.

## Task Commits

Each task was committed atomically through the TDD RED → GREEN cycle:

1. **Task 1 (test): hand-verified DTI numerator + ratio tests** — `9c2dc73` (test)
2. **Task 1 (impl): lenderDtiCarryingCost + front/back ratios** — `2cb1e51` (feat)
3. **Task 2 (test): bank max-price solver tests** — `9d0811e` (test)
4. **Task 2 (impl): bankAffordability solver** — `33b9f8d` (feat)

**Plan metadata:** committed with this SUMMARY + STATE/ROADMAP updates.

## Files Created/Modified

- `packages/core/src/affordability/dti.ts` — `lenderDtiCarryingCost` (D-14 numerator) + `frontEndRatio` / `backEndRatio` (GROSS-monthly denominator).
- `packages/core/src/affordability/dti.test.ts` — worked-example numerator/ratio oracles + the D-14 exclusion assertion + a PMI-ON fixture.
- `packages/core/src/affordability/bank-affordability.ts` — the monotonic max-price binary-search solver, per-trial `inputAtPrice` rebuild, `BankAffordabilityResult` shape.
- `packages/core/src/affordability/bank-affordability.test.ts` — solver-at-threshold, front/back binding, loan identity, PMI-kink monotonicity, no-Zod-throw.

## Decisions Made

None beyond the plan's pinned decisions (see frontmatter `key-decisions`). The plan specified the numerator split, the GROSS denominator, the solver bracketing, and the result shape; all were implemented exactly as written.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. The hand-verified oracle figures were established up front with a throwaway probe script (run inside `packages/core/src`, deleted before any commit — never staged) so the RED tests asserted the engine's true outputs from the start; both tasks went RED → GREEN cleanly on the first implementation.

## TDD Gate Compliance

Both tasks carried `tdd="true"` and followed RED → GREEN:
- Task 1: failing test `9c2dc73` (module-not-found RED) → implementation `2cb1e51`.
- Task 2: failing test `9d0811e` (module-not-found RED) → implementation `33b9f8d`.
No REFACTOR commits were needed (both implementations were clean on first pass). The required `test(...)` and `feat(...)` gate commits are present for each task.

## Verification

- `npx vitest run packages/core/src/affordability/dti.test.ts` — 8 passed (numerator oracle, D-14 exclusion, PMI-ON, front/back ratios).
- `npx vitest run packages/core/src/affordability/bank-affordability.test.ts` — 8 passed (solver-at-threshold, binding ceilings, loan identity, PMI-kink monotonicity, no Zod throw).
- `npm run -w @house/core typecheck` (`tsc -b`) — passes.
- `npm run -w @house/core test` — full core suite 261 passed (22 files), up from 245/20 (no regressions).

## Next Phase Readiness

- AFF-01 (bank affordability) is delivered and consumes the Plan 01 household contract. The `bankAffordability` result is ready for the Wave-3 affordability solvers and the affordability barrel (`index.ts` exports land in Plan 04, per the plan's artifacts note).
- No new packages, no new threat surface beyond the plan's threat register (T-03-03 / T-03-04 are mitigated in-code as specified).

## Self-Check: PASSED

- packages/core/src/affordability/dti.ts — FOUND
- packages/core/src/affordability/dti.test.ts — FOUND (8 tests pass)
- packages/core/src/affordability/bank-affordability.ts — FOUND
- packages/core/src/affordability/bank-affordability.test.ts — FOUND (8 tests pass)
- .planning/phases/03-affordability-engine/03-02-SUMMARY.md — FOUND
- Commit 9c2dc73 (test) — FOUND
- Commit 2cb1e51 (feat) — FOUND
- Commit 9d0811e (test) — FOUND
- Commit 33b9f8d (feat) — FOUND

---
*Phase: 03-affordability-engine*
*Completed: 2026-06-26*
