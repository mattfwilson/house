---
phase: 03-affordability-engine
verified: 2026-06-26T13:05:00Z
status: gaps_found
score: 3/3 must-haves verified
overrides_applied: 0
gaps:
  - truth: "Binary-search solvers never verify passes(low): an unfundable household yields a garbage ceiling instead of $0/error"
    status: failed
    reason: "Both bankAffordability (bank-affordability.ts:129) and solveMaxPrice (true-affordability.ts:115) assume passes(low) is true and proceed to bisect even when it is false. For a household where availableNetWorth − reserve < downPaymentCash + closingCosts(low), or where the savings target is unachievable at any price, the solver silently returns ≈downPaymentCash+1 rather than signalling infeasibility. This is CR-01 from the code review. The bracket-cap exhaustion (CR-02) is a related secondary gap: if the cap is hit while passes(high) is still true, the bisection returns a non-maximal ceiling silently."
    artifacts:
      - path: "packages/core/src/affordability/bank-affordability.ts"
        issue: "Lines 129-132: bracket loop exits on MAX_BRACKET_DOUBLINGS without checking passes(low). No guard at line 125 to detect passes(low)===false before bisecting."
      - path: "packages/core/src/affordability/true-affordability.ts"
        issue: "Lines 115-118 (solveMaxPrice): same bracket defect. Lines 163-170 (passesFloor) and 179-183 (passesCash) are the two pass functions that can be false at low for infeasible inputs."
    missing:
      - "Guard at entry of solveMaxPrice (and bankAffordability's inline solver): if !passes(low0) return Money.zero() (or surface a feasible:false signal on the result type)."
      - "Guard after the bracket loop: if passes(high) is still true after MAX_BRACKET_DOUBLINGS, throw rather than silently bisecting (CR-02 fix)."
      - "Test cases with an infeasible household (availableNetWorth − reserve < downPaymentCash; unachievable targetSavingsRate) asserting the solver returns $0 or a clear error."
---

# Phase 3: Affordability Engine Verification Report

**Phase Goal:** Answer "can the bank?" versus "what does our retirement allow?" — compute bank affordability from configurable DTI ratios and true affordability from the savings-rate/FI-threshold constraint, and surface the gap between them as a first-class output.
**Verified:** 2026-06-26T13:05:00Z
**Status:** gaps_found
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Bank affordability computes the max approvable loan from configurable front-end (~28%) and back-end (~36%) DTI ratios using gross income and the full PITI+HOA+PMI carrying cost (reusing TCO components), factoring existing debts (worked-example tests) | ✓ VERIFIED | `bankAffordability` in `bank-affordability.ts` reads thresholds from `input.assumptions.dti.frontEnd`/`.backEnd`. `lenderDtiCarryingCost` = P+I + propertyTax + insurance + pmi + hoa (excludes maintenance + amortizedClosing, D-14). `existingMonthlyDebt` fed into back-end ratio. Two worked-example households tested: low-debt (frontEnd binds, solved price $635,347.53) and debt-heavy (backEnd binds, $477,861.63). +$0.01 fails for both. All 282 tests pass. |
| 2 | True affordability computes the price that fits the household's target savings rate without pushing the FI date past its threshold | ✓ VERIFIED | `trueAffordability` in `true-affordability.ts` solves two ceilings: (A) savings-rate floor using `currentAnnualSavings` baseline, incremental premium over `currentRent`, gross denominator; (B) cash-on-hand gate `downPaymentCash + closingCosts ≤ availableNetWorth − reserve`. `trueMaxPrice = min(A, B)` with `bindingConstraint` reported. Roomy-cash fixture: savings floor binds at $482,309.67; tight-cash fixture: cash gate binds at $400,000. +$0.01 fails for both. |
| 3 | The tool surfaces the numeric gap between bank affordability and true affordability as an explicit output | ✓ VERIFIED | `affordabilityGap` in `gap.ts` composes both solvers, returns `signedGap = bankMaxPrice − trueMaxPrice` as `Money`, plus `bankBindingRatio`, `trueBindingConstraint`, and `verdict ∈ {bankExceedsTrue, trueExceedsBank, aligned}`. Golden snapshot confirms anti-funnel direction: bank $672,721.29, true $475,515.21, signedGap +$197,206.08, verdict `bankExceedsTrue`. All three verdict directions tested. |

**Score:** 3/3 truths verified

### Gap: Solver precondition not guarded (CR-01 / CR-02 from code review)

All three success criteria are **met for feasible households** — the engine correctly computes the ceilings, the gap, and the verdict for every household in the test suite. However the binary-search solvers contain a latent correctness defect that produces a silent wrong answer for infeasible inputs, which is not covered by tests and which the code review identified as a BLOCKER-level finding. See the Gaps Summary section.

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/core/src/affordability/dti.ts` | `lenderDtiCarryingCost` + `frontEndRatio` + `backEndRatio` from TcoBreakdown (D-14) | ✓ VERIFIED | Present, substantive, wired. Exact-equality tested with hand-verified worked examples. D-14 exclusion asserted (numerator < tco.total by exactly maintenance + amortizedClosing). PMI-ON fixture included. |
| `packages/core/src/affordability/bank-affordability.ts` | `bankAffordability` max-price solver | ✓ VERIFIED (with CR-01 gap) | Present, substantive, wired. Solver correct for feasible households. CR-01: no `passes(low)` guard; infeasible households get garbage result. See Gaps. |
| `packages/core/src/affordability/dti.test.ts` | Hand-verified worked-example DTI fixtures + exclusion assertions | ✓ VERIFIED | 8 tests pass. Exact-equality against documented cents. Gross-only denominator guard present. |
| `packages/core/src/affordability/bank-affordability.test.ts` | Solver-at-threshold + PMI-kink monotonicity tests | ✓ VERIFIED | 7 tests pass. Binding ratio AT threshold, +$0.01 fails, loan = price − cash, monotonicity across PMI kink, no Zod throw. |
| `packages/core/src/affordability/true-affordability.ts` | `cashSavingsDrain` + `trueAffordability` solver | ✓ VERIFIED (with CR-01 gap) | Present, substantive, wired. Solver correct for feasible households. CR-01: `solveMaxPrice` shared by both ceilings lacks `passes(low)` guard. |
| `packages/core/src/affordability/true-affordability.test.ts` | Savings-floor-at-target + cash-gate-binds + min-selection tests | ✓ VERIFIED | 8 tests pass. cashSavingsDrain keeps maintenance, +$0.01 floor/gate tests pass, min-selection in both regimes. |
| `packages/core/src/affordability/gap.ts` | `affordabilityGap` composer + `AffordabilityVerdict` enum | ✓ VERIFIED | Present, substantive, wired. `signedGap`, both binding fields, cent-exact verdict. ALIGNED_TOLERANCE_CENTS exported and test-pinned. |
| `packages/core/src/affordability/gap.test.ts` | All three verdicts + anti-funnel acceptance fixture | ✓ VERIFIED | 5 tests pass. All three verdict directions exercised. Anti-funnel conservative-saver fixture reaches `bankExceedsTrue`. |
| `packages/core/src/affordability/evaluate-scenario.ts` | `evaluateScenario` per-scenario DTI + savings-impact report | ✓ VERIFIED | Present, substantive, wired. Reports at fixed price (no solving), reuses `dti.ts` + `cashSavingsDrain`, headroom sign correct. |
| `packages/core/src/affordability/evaluate-scenario.test.ts` | Pass/fail flags + ratio cross-check + headroom sign | ✓ VERIFIED | 5 tests pass. Ratios match standalone `dti.ts` derivations. headroom ≥ 0 when passing, < 0 when failing. |
| `packages/core/src/affordability/affordability.type-test.ts` | No-bare-number guard on every dollar field | ✓ VERIFIED | In tsc -b graph (not .test.ts). Covers bankMaxPrice, bankMaxLoan, trueMaxPrice, savingsRateCeiling, cashOnHandCeiling, signedGap. Property-level `@ts-expect-error` guards. `tsc -b` clean. |
| `packages/core/src/index.ts` | Public exports of affordability surface + Household symbols | ✓ VERIFIED | Exports `bankAffordability`, `trueAffordability`, `affordabilityGap`, `evaluateScenario`, result types, `AffordabilityVerdict`, `lenderDtiCarryingCost`, `cashSavingsDrain`, `Household`, `HouseholdSchema`, `parseHousehold`. `Dec`/`Decimal` and the Dec-returning `frontEndRatio`/`backEndRatio` deliberately not exported (noted in source). |
| `packages/core/src/__fixtures__/affordability-golden-snapshot.json` | Reproducibility golden for the gap result | ✓ VERIFIED | Present. Content: `bankMaxPrice: 672721.29`, `trueMaxPrice: 475515.21`, `signedGap: 197206.08`, `verdict: bankExceedsTrue`. Golden test passes; recomputes cent-identically. UPDATE_GOLDEN-gated (not toMatchSnapshot). |
| `packages/core/src/engine/engine-input.ts` | `Household` interface + `HouseholdSchema` + `parseHousehold` + optional `household` on `EngineInput` | ✓ VERIFIED | All four exported. 8 canonical-string fields including `currentAnnualSavings`. `.strict()`, `targetSavingsRate [0,1)` refine. `household` optional; omitted (not `undefined`) when absent via conditional spread. |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `bank-affordability.ts` | `computeTco` | per-trial-price EngineInput rebuild | ✓ WIRED | Line 111: `computeTco(inputAtPrice(input, household, priceDec))`. Never re-derives amortization. |
| `bank-affordability.ts` | `assumptions.dti.frontEnd / .backEnd` | threshold read (Shared P4) | ✓ WIRED | Lines 103-104: `new Dec(input.assumptions.dti.frontEnd)` / `.backEnd`. Configurable, not hardcoded. |
| `true-affordability.ts` | `computeTco` | per-trial-price EngineInput rebuild | ✓ WIRED | Line 164: `computeTco(inputAtPrice(input, household, priceDec))` inside `passesFloor`. |
| `true-affordability.ts` | `closingCosts` | cash-on-hand gate (D-05) | ✓ WIRED | Line 181: `closingCosts(price, rateOfPrice, override)`. No re-derived closing math. |
| `gap.ts` | `bankAffordability` + `trueAffordability` | compose both ceilings, signedGap, verdict on toCents() bigints | ✓ WIRED | Lines 88-89. `signedGap = bank.bankMaxPrice.sub(tru.trueMaxPrice)`. Verdict on bigint cents vs `ALIGNED_TOLERANCE_CENTS`. |
| `golden.test.ts` roundTrip() | `parseHousehold` | carry household through lossless round-trip (Pitfall 5) | ✓ WIRED | Lines 245-247: `parseHousehold(snapshot.household)` re-parses the serialized household. Affordability round-trip test passes. |

---

## Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `bankAffordability` | `bankMaxPrice` | Binary search over `computeTco` results using `input.household` + `input.assumptions.dti.*` | Yes — real DB-equivalent: uses engine-computed TCO per trial price | ✓ FLOWING |
| `trueAffordability` | `trueMaxPrice` | Binary search over `computeTco` + `closingCosts` using household savings/cash fields | Yes | ✓ FLOWING |
| `affordabilityGap` | `signedGap`, `verdict` | Composes `bankAffordability` + `trueAffordability` | Yes | ✓ FLOWING |
| `affordability-golden-snapshot.json` | static fixture | `UPDATE_GOLDEN=1` computed from `affordabilityGap(fixedInput())` | Yes — reproduced cent-identically in every test run | ✓ FLOWING |

---

## Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| All 282 tests pass (full suite) | `npx vitest run` | 282 passed (25 files) | ✓ PASS |
| Affordability module tests pass (35 tests) | `npx vitest run packages/core/src/affordability/` | 35 passed (5 files) | ✓ PASS |
| `tsc -b` clean (type-test and all source) | `npm run -w @house/core typecheck` | exit 0, no output | ✓ PASS |
| Golden snapshot recomputes cent-identically | `npx vitest run packages/core/src/golden.test.ts` | 6 passed; affordability golden matches snapshot | ✓ PASS |
| Anti-funnel direction reachable | `gap.test.ts > ANTI-FUNNEL (Pitfall 6)` | `verdict === 'bankExceedsTrue'`, signedGap > ALIGNED_TOLERANCE_CENTS | ✓ PASS |

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| AFF-01 | 03-02 | Tool computes bank affordability (max approvable loan) from configurable front-end (~28%) and back-end (~36%) DTI ratios, factoring existing debts | ✓ SATISFIED | `bankAffordability` verified above. Thresholds configurable in `AssumptionSet.dti.*`. Existing debt (`existingMonthlyDebt`) factors into back-end. Worked-example tests with hand-verified values. |
| AFF-02 | 03-01, 03-03 | Tool computes true affordability — the price that fits the household's target savings rate without pushing the FI date past its threshold | ✓ SATISFIED | `trueAffordability` verified above. Note: Phase 3 delivers the AFF-02 proxy (savings-rate floor); the real FI-date projection is Phase 4 per D-01. This is documented in the plan and phase context. |
| AFF-03 | 03-04 | Tool surfaces the gap between bank affordability and true affordability | ✓ SATISFIED | `affordabilityGap` returns `signedGap` (Money), both binding fields, and `verdict` enum. Gap is a first-class output, not a derived display value. |

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `bank-affordability.ts` | 125-132 | Solver proceeds to bisect without checking `passes(low)` precondition | BLOCKER | For infeasible households (cashBudget < downPaymentCash, or savings target unachievable at any price), solver silently returns ≈`downPaymentCash + 1` instead of `$0`/`infeasible`. See CR-01 in code review. |
| `true-affordability.ts` | 111-132 | `solveMaxPrice` shares the same unchecked-precondition defect | BLOCKER | Same as above. Both the savings-floor ceiling and cash-on-hand ceiling solvers are affected. |
| `bank-affordability.ts` | 129 | Bracket-cap loop condition conflates "found failing side" with "hit cap" | WARNING | If `MAX_BRACKET_DOUBLINGS` exhausted while `passes(high)` still true, bisection returns a non-maximal (wrong) ceiling silently. See CR-02 in code review. Realistically unreachable for cash-gate (closing grows unboundedly), but structurally unsound. |

No `TBD`/`FIXME`/`XXX` debt markers found in affordability source files. No placeholder implementations. No stub return values.

---

## Human Verification Required

None — all phase-3 behaviors are programmatically verifiable.

---

## Gaps Summary

### The solver precondition gap (CR-01 + CR-02)

The three success criteria are **met for all feasible households** — the engine correctly computes the bank ceiling, the true ceiling, the signed gap, and the directional verdict for any household that can fund the down payment and meet the savings target at some price. Every test fixture is such a household, and all 282 tests pass.

The gap is: the binary-search solvers (`bankAffordability`'s inline search, and `solveMaxPrice` shared by both `trueAffordability` ceilings) never verify that `passes(low)` is true before bisecting. For an infeasible household — one where `availableNetWorth − reserve < downPaymentCash` (cannot fund even the minimum trial), or one whose `targetSavingsRate` exceeds the post-purchase rate at every price — the solver silently returns a plausible-looking but incorrect ceiling (≈`downPaymentCash + 1`, typically a small dollar amount like $100,001) rather than `$0` or an explicit infeasibility signal. Because the test fixtures all use feasible households, this path is not exercised and the wrong-answer is never observed in the test suite.

**CR-01 does not undermine success criteria 1–2 for the tested households**: the solver's precondition holds for every fixture. The computed ceilings are correct. The gap verdict is correct. The golden snapshot is a correct and reproducible result.

**CR-01 is a genuine correctness gap for untested infeasible inputs**: a UI or downstream consumer that passes a household with insufficient net worth would receive a plausible-looking small price ceiling rather than an infeasibility signal. This is the "trustworthiness is the product" failure the project warns against.

**Recommendation:** Fix `solveMaxPrice` and the inline bank solver to check `passes(low0)` at entry and return `Money.zero()` (or surface `feasible: false` on the result type) when the precondition fails. Add tests with infeasible households. This is a targeted addition to `bank-affordability.ts` and `true-affordability.ts` — no success-criteria logic changes needed.

---

_Verified: 2026-06-26T13:05:00Z_
_Verifier: Claude (gsd-verifier)_
