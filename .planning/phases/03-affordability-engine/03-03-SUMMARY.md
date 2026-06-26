---
phase: 03-affordability-engine
plan: 03
subsystem: affordability-engine
tags: [true-affordability, savings-floor, cash-on-hand, binary-search, decimal, tco, AFF-02, solver]

requires:
  - phase: 03-01
    provides: "household block on EngineInput (currentAnnualSavings D-17, currentRent D-03, targetSavingsRate D-04, availableNetWorth + reserve D-05, downPaymentCash) consumed by both ceilings"
  - phase: 03-02
    provides: "the per-trial inputAtPrice rebuild + monotonic bisection solver shape; the FIRST D-14 numerator (lenderDtiCarryingCost) this plan contrasts against"
  - phase: 02-tco-engine
    provides: "computeTco / TcoBreakdown (total + amortizedClosing + maintenance lines), closingCosts, engineInput() factory, Money + Dec discipline"
provides:
  - "cashSavingsDrain(tco): Money — the SECOND D-14 numerator (tco.total − amortizedClosing; KEEPS maintenance, distinct from the lender numerator by exactly the maintenance line)"
  - "trueAffordability(input): TrueAffordabilityResult — min of the savings-rate floor + cash-on-hand gate {trueMaxPrice, savingsRateCeiling, cashOnHandCeiling, bindingConstraint}"
affects: [03-04, affordability barrel exports, gap/anti-funnel verdict]

tech-stack:
  added: []
  patterns:
    - "Shared generic max-price solver: solveMaxPrice(cash, passes) — both ceilings reuse one monotonic bisection (low strictly above downPaymentCash, exponential high bracket, $0.01 tolerance, iteration caps)"
    - "Savings floor = post-purchase savings rate over GROSS income (D-04); premium incremental over currentRent (D-03); baseline currentAnnualSavings (D-17) — all in Dec, dollars cross to Money only at the cent-pinned ceiling"
    - "Cash-on-hand gate reuses closingCosts verbatim (no re-derived closing math); reserve consumed as-is, no engine default (A1)"
    - "trueMaxPrice = min(A, B) via Money.toCents() bigint-cent comparison (mirroring rent-vs-buy's winner)"

key-files:
  created:
    - "packages/core/src/affordability/true-affordability.ts"
    - "packages/core/src/affordability/true-affordability.test.ts"
  modified: []

key-decisions:
  - "cashSavingsDrain = tco.total.monthly.sub(tco.amortizedClosing.monthly) — the SECOND D-14 numerator: KEEPS maintenance (a real owner cash cost), excludes ONLY the t=0 closing lump, exactly buyMonthlyOutflowAt's convention; differs from the lender DTI numerator by exactly the maintenance line"
  - "Savings-rate ceiling: largest price where (currentAnnualSavings − (cashSavingsDrain − currentRent)×12) / grossAnnualIncome ≥ targetSavingsRate — gross denominator (D-04), incremental premium over currentRent (D-03), currentAnnualSavings baseline (D-17). Savings fall monotonically as price rises"
  - "Cash-on-hand ceiling: largest price where downPaymentCash + closingCosts(price) ≤ availableNetWorth − reserve (D-05); closingCosts reused (no re-derived math), reserve as-is (A1)"
  - "Both ceilings share ONE generic solveMaxPrice(cash, passes) bisection (Pattern 3); trueMaxPrice = min(A, B) cent-exact via toCents(); bindingConstraint = the lower ceiling, savingsFloor wins ties"

patterns-established:
  - "A single parameterized monotonic max-price solver serves BOTH ceilings — the price-search shape is now a reusable in-module primitive rather than copy-pasted per constraint"

requirements-completed: [AFF-02]

duration: ~6min
completed: 2026-06-26
---

# Phase 03 Plan 03: True Affordability (Savings Floor + Cash-on-Hand Gate) Summary

**The honest ceiling the product LEADS with (AFF-02): the SECOND D-14 numerator (`cashSavingsDrain` = `tco.total − amortizedClosing`, which KEEPS maintenance) drives a savings-rate floor over GROSS income, gated by a cash-on-hand constraint (`downPaymentCash + closingCosts ≤ availableNetWorth − reserve`); `trueMaxPrice` is the cent-exact `min` of the two, with the binding ceiling reported.**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-06-26T12:36:00Z (approx)
- **Completed:** 2026-06-26T12:40:00Z (approx)
- **Tasks:** 2 (both TDD)
- **Files created:** 2

## Accomplishments

- **`cashSavingsDrain(tco): Money`** — the SECOND of the two D-14 numerators: `tco.total.monthly.sub(tco.amortizedClosing.monthly)`. It KEEPS `maintenance` (a real owner cash cost — unlike the lender's underwriting view) and excludes ONLY the t=0 closing lump, exactly `buyMonthlyOutflowAt`'s convention. Principal counts as cash out (D-03 — the equity offset is Phase 4). It differs from `lenderDtiCarryingCost` by exactly the maintenance line (hand-verified: drain $3472.98 = lender $3056.31 + maintenance $416.67) and from `tco.total` by exactly `amortizedClosing` ($104.17).
- **Savings-rate ceiling (Ceiling A)** — the largest price (to the cent) where `(currentAnnualSavings − annualOwnershipPremium) / grossAnnualIncome ≥ targetSavingsRate`, with `annualOwnershipPremium = (cashSavingsDrain − currentRent) × 12` (incremental over rent, D-03), baseline `currentAnnualSavings` (D-17), and a GROSS denominator (D-04 — no tax haircut). Savings fall monotonically as price rises, so the floor is crossed once; solved at the cent ($482,309.67 for the roomy-cash fixture).
- **Cash-on-hand ceiling (Ceiling B)** — the largest price where `downPaymentCash + closingCosts(price) ≤ availableNetWorth − reserve` (D-05), reusing `closingCosts` verbatim (honoring any per-scenario dollar override) and consuming `reserve` as-is with no engine default (A1). For the tight-cash fixture (budget $110,000): `100000 + 0.025·price ≤ 110000 ⇒ price ≤ $400,000` exactly.
- **`trueAffordability(input): TrueAffordabilityResult`** — requires `input.household` (throws clearly if absent), computes both ceilings via ONE shared `solveMaxPrice(cash, passes)` monotonic bisection (low strictly above `downPaymentCash` per Pitfall 3 / T-03-05, exponential high bracket, `$0.01` tolerance, iteration caps per T-03-06), and returns `trueMaxPrice = min(A, B)` via cent-exact `Money.toCents()` comparison plus the `bindingConstraint` enum (the lower ceiling; `savingsFloor` wins ties).
- **Hand-verified fixtures** pin the drain split (vs `tco.total`, vs the lender numerator, KEEPS maintenance), the savings ceiling at the cent (+$0.01 drops below the target), the cash ceiling at the cent (+$0.01 over budget), and the `min` + binding constraint in BOTH regimes (roomy cash → `savingsFloor` binds at $482,309.67; tight cash → `cashOnHand` binds at $400,000).

## Task Commits

Each task was committed atomically through the TDD RED → GREEN cycle:

1. **Tasks 1+2 (test): failing TRUE-affordability tests** — `0937410` (test)
2. **Tasks 1+2 (impl): trueAffordability (savings floor + cash gate)** — `2d711d1` (feat)

Both tasks modify the same single source file (`true-affordability.ts`) with Task 2 composing directly on Task 1's `cashSavingsDrain` + savings ceiling, and the test file covers both behaviors. They were committed as one atomic RED → GREEN pair (one failing-test commit, one implementation commit), as the module is a single cohesive unit (the savings ceiling alone has no public entry point — `trueAffordability` is the only export consuming it).

## Files Created/Modified

- `packages/core/src/affordability/true-affordability.ts` — `cashSavingsDrain` (the 2nd D-14 numerator), the shared `solveMaxPrice` monotonic bisection, both ceilings, and `trueAffordability` composing the `min` + binding constraint.
- `packages/core/src/affordability/true-affordability.test.ts` — the drain-split oracle (vs total, vs lender numerator, keeps maintenance), the savings ceiling at-the-cent (+$0.01 fails), the cash gate at-the-cent (+$0.01 over budget), the `min`/binding in both regimes, and the no-household throw.

## Decisions Made

None beyond the plan's pinned decisions (see frontmatter `key-decisions`). The plan specified the drain definition, the floor formula (gross denominator, `currentAnnualSavings` baseline, incremental premium), the cash gate, the shared solver, and the `min`/binding result shape; all were implemented exactly as written.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

One test-side oracle literal was wrong (asserting `'400000.00'` where the canonical `Money.toDecimalString()` strips trailing zeros to `'400000'`). The implementation was correct on the first GREEN run (8/9 tests passed); the literal was corrected in the same GREEN landing. The exact solved-price/ceiling oracles were established up front with a throwaway probe script (run via `tsx` inside `packages/core/src/affordability`, deleted before any commit — never staged), so the RED tests asserted the engine's true outputs from the start.

## TDD Gate Compliance

Both tasks carried `tdd="true"` and followed RED → GREEN:
- Failing test commit `0937410` (module-not-found RED) → implementation commit `2d711d1` (GREEN).
No REFACTOR commit was needed (the implementation was clean on first pass; the only post-GREEN edit was a test-oracle literal correction, folded into the GREEN commit). The required `test(...)` and `feat(...)` gate commits are both present in the log.

## Verification

- `npx vitest run packages/core/src/affordability/true-affordability.test.ts` — 9 passed (drain split, savings ceiling at-the-cent, cash gate at-the-cent, min/binding in both regimes, no-household throw).
- `npm run -w @house/core typecheck` (`tsc -b`) — passes.
- `npm run -w @house/core test` — full core suite 270 passed (23 files), up from 261/22 (no regressions).

## Next Phase Readiness

- AFF-02 (true affordability) is delivered and consumes the Plan 01 household contract. The `trueAffordability` result is ready for Plan 04's gap/anti-funnel verdict (`bankExceedsTrue`, the explicit gap between `bankMaxPrice` and `trueMaxPrice`) and the public affordability barrel (`index.ts` exports land in Plan 04, per the plan's artifacts note).
- No new packages, no new threat surface beyond the plan's threat register (T-03-05 / T-03-06 are mitigated in-code: the per-trial `engineInput()` re-validates the trust boundary and the low bound keeps every trial `pct < 1`; both ceilings are monotonic with iteration caps).

## Self-Check: PASSED

- packages/core/src/affordability/true-affordability.ts — FOUND (cashSavingsDrain, trueAffordability, solveMaxPrice present; compiles)
- packages/core/src/affordability/true-affordability.test.ts — FOUND (9 tests pass)
- .planning/phases/03-affordability-engine/03-03-SUMMARY.md — FOUND
- Commit 0937410 (test) — FOUND
- Commit 2d711d1 (feat) — FOUND

---
*Phase: 03-affordability-engine*
*Completed: 2026-06-26*
