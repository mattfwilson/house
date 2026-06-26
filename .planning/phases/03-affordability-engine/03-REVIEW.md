---
phase: 03-affordability-engine
reviewed: 2026-06-26T00:00:00Z
depth: standard
files_reviewed: 17
files_reviewed_list:
  - packages/core/src/affordability/dti.ts
  - packages/core/src/affordability/dti.test.ts
  - packages/core/src/affordability/bank-affordability.ts
  - packages/core/src/affordability/bank-affordability.test.ts
  - packages/core/src/affordability/true-affordability.ts
  - packages/core/src/affordability/true-affordability.test.ts
  - packages/core/src/affordability/gap.ts
  - packages/core/src/affordability/gap.test.ts
  - packages/core/src/affordability/evaluate-scenario.ts
  - packages/core/src/affordability/evaluate-scenario.test.ts
  - packages/core/src/affordability/affordability.type-test.ts
  - packages/core/src/engine/engine-input.ts
  - packages/core/src/engine/engine-input.test.ts
  - packages/core/src/engine/engine-input.type-test.ts
  - packages/core/src/index.ts
  - packages/core/src/golden.test.ts
  - packages/core/src/__fixtures__/affordability-golden-snapshot.json
findings:
  critical: 2
  warning: 5
  info: 3
  total: 10
status: issues_found
---

# Phase 3: Code Review Report

**Reviewed:** 2026-06-26
**Depth:** standard
**Files Reviewed:** 17
**Status:** issues_found

## Summary

This is the affordability engine: DTI numerator split (`dti.ts`), the bank max-price solver, the true-affordability solver (savings-floor + cash-on-hand), the gap composer, and the per-scenario evaluator. The Dec/Money discipline is uniformly excellent — every dollar field crosses the public barrel as `Money`, the index.ts barrel deliberately withholds the `Dec` ratio derivations, ratios cross as decimal strings, and the type-test guards pin "no bare-number dollar leak." The D-14 numerator splits (lender PITI+HOA+PMI vs cash drain that keeps maintenance) are correct, well-documented, and exact-equality tested. No float contamination found in the money math itself.

The serious defects are in the **binary-search solvers' bracketing invariant**. Both `bankAffordability` and `solveMaxPrice` (true-affordability) assume `passes(low)` is true and `passes(high)` is false, but neither precondition is verified. There exist realistic, schema-valid households for which `passes(low)` is **false** — most concretely the cash-on-hand gate when `availableNetWorth − reserve < downPaymentCash`, and the savings floor when the target is unmet even at a near-100%-down trial. In those cases the bisection silently returns a garbage ceiling (≈`downPaymentCash + 1`) that the buyer cannot fund or that violates the savings target — exactly the "trustworthiness is the product" failure the project warns against. The defense-in-depth iteration caps also silently mask a non-bracketed search rather than surfacing it. These are not covered by the existing tests, which only exercise households where `passes(low)` happens to hold.

## Critical Issues

### CR-01: Solvers never verify `passes(low)`; an unfundable household yields a garbage ceiling instead of $0/error

**File:** `packages/core/src/true-affordability.ts:111-132` (and the `passesCash` gate at `:179-184`); same defect class in `packages/core/src/bank-affordability.ts:124-144`

**Issue:** `solveMaxPrice` (and the inline bank solver) establish `low = cash + 1`, exponentially raise `high` until `passes(high)` is false, then bisect — relying on the invariant `passes(low) === true && passes(high) === false`. `passes(low)` is **never checked**. Consider the cash-on-hand gate:

```
cashBudget = availableNetWorth − reserve
passesCash(price) ⇔ downPaymentCash + closingCosts(price) ≤ cashBudget
```

If `cashBudget < downPaymentCash` (the reserve plus the intended down payment already exceed net worth — a perfectly valid, schema-passing household), then `passesCash` is **false at every price**, including `low`. The bracket loop exits immediately (high never passes). Bisection then treats `low` as the passing side and converges `low`/`high` toward `cash + 1`, so `cashOnHandCeiling` returns ≈`downPaymentCash + 1` — a price the household provably **cannot fund** (they don't even have the down payment after reserving). `trueMaxPrice = min(...)` then reports this fundable-looking nonsense, and the headline gap verdict is computed from it. If `cashBudget` is negative the same path produces an even more absurd positive ceiling. This is a silent wrong answer in the product's core "what can we truly afford" calculation.

The savings floor (`passesFloor`, `:163-169`) has the identical exposure: a household whose post-purchase savings rate is already below `targetSavingsRate` at the minimum trial price (low `currentAnnualSavings`, low `currentRent`, high target) makes `passesFloor(low)` false, and the solver returns ≈`cash + 1` as the savings ceiling rather than concluding "no price clears your target."

**Fix:** Guard the precondition explicitly and return a well-defined floor (e.g. `Money.zero()` or the down-payment cash) plus a surfaced "infeasible" signal, instead of silently bisecting an unbracketed interval:

```ts
function solveMaxPrice(cash: DecimalInstance, passes: (price: DecimalInstance) => boolean): Money {
  const low0 = cash.plus(1);
  // The bisection invariant REQUIRES passes(low). If even the minimum trial fails, there is no
  // passing price — report the floor, do not bisect a broken bracket.
  if (!passes(low0)) {
    return Money.zero(); // or surface an explicit `feasible: false` on the result type
  }
  let low = low0;
  // ... unchanged
}
```

Apply the same `passes(low)` guard at the head of `bankAffordability` (line 125). Add tests with `availableNetWorth − reserve < downPaymentCash` and with an unachievable `targetSavingsRate` to pin the behavior.

### CR-02: Bracket-cap exhaustion while `passes(high)` is still true returns a non-maximal (wrong) ceiling silently

**File:** `packages/core/src/bank-affordability.ts:129-132`; `packages/core/src/true-affordability.ts:115-118`

**Issue:** The bracket loop is `while (passes(high) && doublings < MAX_BRACKET_DOUBLINGS)`. If the cap (`200` doublings) is reached while `passes(high)` is **still true**, the loop exits with the failing-side invariant violated: `high` passes. Bisection then never moves `high` down to a failing price, so the loop just narrows `[low, high]` around still-passing prices and returns a `low` that is **not** the largest passing price — a silently under-reported ceiling. The comment frames the cap as pure DoS defense-in-depth ("astronomical margin"), but because the loop condition conflates "found the failing side" with "hit the cap," cap-exhaustion is indistinguishable from a real bracket and produces a wrong-but-plausible number rather than an error. For the cash-on-hand gate this is not reachable (closing ∝ price grows unboundedly), but for any future `passes` that is only *eventually* false (or never false), this fails closed-looking but open-wrong.

**Fix:** After the bracket loop, assert the failing-side invariant before bisecting; throw (or surface infeasible) if the cap was hit while still passing:

```ts
if (passes(high)) {
  throw new Error(
    'bankAffordability: exhausted MAX_BRACKET_DOUBLINGS without bracketing a failing price — ' +
    'the constraint did not become false within the search range (check passes() monotonicity).',
  );
}
```

This converts a silent wrong answer into a loud, diagnosable failure, consistent with the engine's "trustworthiness is the product" stance.

## Warnings

### WR-01: `bindingRatio` / `headroom` are reported even when the solver failed to bracket (no "did it actually pass?" gate)

**File:** `packages/core/src/bank-affordability.ts:151-156`; `packages/core/src/evaluate-scenario.ts:89-94`

**Issue:** `bindingRatio` is chosen as the ceiling with the smaller gap (`frontGap.lessThanOrEqualTo(backGap)`). When CR-01/CR-02 fire, `front`/`back` at the returned (garbage) price may both be far under threshold, so `bindingRatio` reports `frontEnd` with large positive headroom — affirmatively signaling "this passed with room to spare" for a result that is actually infeasible. The binding/headroom fields therefore can lie in exactly the failure cases. (In `evaluateScenario` the headroom sign is correct because it reports at a fixed user price, not a solved one — that path is fine; the concern is the solver-derived report.)

**Fix:** Once CR-01/CR-02 add a feasibility signal, propagate it into the result so consumers (and Phase 7 UI) can distinguish "passed with headroom X" from "no passing price exists." Do not report a positive headroom for an infeasible solve.

### WR-02: Down-payment fraction can round to a non-strictly-`<1` value at extreme low bounds, re-exposing the Pitfall 3 guard

**File:** `packages/core/src/bank-affordability.ts:76-77`; `packages/core/src/true-affordability.ts:93-94`

**Issue:** `downPaymentPct = downPaymentCash / price` is computed in `Dec` then `.toFixed()`'d to full precision, and `price` itself is first pinned to cents via `toDecimalPlaces(2)`. The low bound is `cash + 1`, so `cash/(cash+1) < 1` mathematically. But `price` is re-pinned to cents independently of `cash`, so for a `cash` with sub-cent structure the pinned price could in principle round to `cash` exactly (making the ratio exactly `1`), and the `[0,1)` Zod refine would throw mid-solve. The current tests use whole-dollar `downPaymentCash`, so this never triggers, but the guard's correctness depends on an unstated invariant (cash is whole cents) that the schema does not enforce — `downPaymentCash` is `decStr`, which admits sub-cent precision. A `downPaymentCash` like `"100000.001"` is schema-valid and could drive the pinned low-bound price to equal cash.

**Fix:** Either pin the low bound *after* cent-rounding `cash` and add `+0.01` (one cent, the search resolution) rather than `+1` whole dollar relative to an unpinned cash, or clamp the derived `downPaymentPct` to be strictly `< 1` before rebuilding (e.g. `Dec.min(pct, '0.999999...')`), and add a test with sub-cent `downPaymentCash`.

### WR-03: Per-trial `engineInput()` re-validation runs full Zod parse on every bisection step (correctness-via-cost coupling)

**File:** `packages/core/src/bank-affordability.ts:75-84`, `:111`; `packages/core/src/true-affordability.ts:92-101`, `:164`

**Issue:** Each `passes()` call rebuilds the trial input through `engineInput()`, which `parseScenarioInputs` (full Zod `.strict()` parse + refine) **and** `parseHousehold` on every single bisection/bracket iteration (~60+ per ceiling, ×2 ceilings, plus the bracket sweep). The household is identical across all trials yet is re-parsed each time. This is documented as a "re-validation at the trust boundary" feature, but the *household* never changes within a solve — only `price`/`downPaymentPct` do. Re-parsing the unchanged household per iteration is wasted boundary work, and more importantly couples solver correctness to repeated validation of data that was already trusted at entry. (Out-of-scope perf is not the flag here; the flag is that the trust-boundary story conflates one-time household validation with per-trial scenario validation.)

**Fix:** Validate the household once at the solver entry (it already is, implicitly, via the entry `engineInput`), and rebuild only the scenario portion per trial — or parse the scenario once and mutate just `price`/`downPaymentPct` on a pre-frozen clone. Keeps the boundary guarantee without re-validating immutable inputs in the hot loop.

### WR-04: `grossMonthly` and the savings-rate denominator divide by income with no zero/negative guard

**File:** `packages/core/src/dti.ts:46-48`; `packages/core/src/true-affordability.ts:168`; `packages/core/src/evaluate-scenario.ts:59`

**Issue:** `grossMonthly = new Dec(grossAnnualIncome).div(12)` and the savings-rate `post.div(grossAnnualIncome)` divide by household income. `grossAnnualIncome` is `decStr` — `"0"` is a canonical, schema-valid string. A household with `grossAnnualIncome: "0"` makes every DTI ratio a division by zero: decimal.js returns `Infinity`/throws depending on config, and `frontEndRatio`/`backEndRatio` either throw an opaque `RangeError` deep in the solver or produce `Infinity` that compares falsely against thresholds. There is no validation that income is positive at the `Household` boundary. Same for the savings-rate denominator.

**Fix:** Add a positivity refine to `HouseholdSchema.grossAnnualIncome` (`Number(s) > 0`, a boundary range check consistent with the existing `targetSavingsRate`/`downPaymentPct` refines), with a clear message, so a zero-income profile is rejected at the trust boundary rather than producing `Infinity` mid-calc.

### WR-05: `downPaymentCash` has no boundary constraint relative to `availableNetWorth`/`reserve`; feeds CR-01

**File:** `packages/core/src/engine/engine-input.ts:162-179`

**Issue:** `HouseholdSchema` validates each dollar field as a canonical string in isolation but enforces no cross-field invariants. Nothing prevents `downPaymentCash > availableNetWorth`, or `reserve > availableNetWorth`, or `downPaymentCash + reserve > availableNetWorth` — all of which produce the infeasible cash-on-hand bracket in CR-01. A negative `downPaymentCash` is also not blocked (`decStr` admits a leading `-`), which would make `cash.plus(1)` a low bound at/below zero and `downPaymentPct` negative — though the `[0,1)` refine on the *scenario* `downPaymentPct` would catch the derived value, the error would surface as an opaque mid-solve Zod throw rather than a clear household-level rejection.

**Fix:** Add boundary refines to `HouseholdSchema`: non-negative dollar fields (`Number(s) >= 0`) for `downPaymentCash`/`reserve`/`availableNetWorth`/etc., and ideally a cross-field refine that `downPaymentCash + reserve <= availableNetWorth` (or at minimum document and test the infeasible case once CR-01 is fixed). These are boundary range checks, not money math, so `Number(s)` comparison is acceptable per the existing convention.

## Info

### IN-01: `percentOf` is an unused alias of `mul` reachable from the affordability path

**File:** `packages/core/src/money/money.ts:69-71` (consumed indirectly; not in the changed set but on the call graph)

**Issue:** `percentOf` is a thin re-call of `mul` with no added semantics. Not a defect, but it duplicates the boundary-validated multiply under a second name; a reviewer must confirm both go through `assertCanonicalDecimal` (they do). Noting for surface-area minimization. No action required for this phase.

### IN-02: Magic divisor `12` and `× 12` annualization repeated across four modules

**File:** `packages/core/src/dti.ts:47`; `packages/core/src/true-affordability.ts:167`; `packages/core/src/evaluate-scenario.ts:57`; (cf. `tco.ts:96` `ONE_TWELFTH`)

**Issue:** The months-per-year `12` is hardcoded inline in the DTI denominator and the annual-premium derivations, while `tco.ts` factors it into a named `ONE_TWELFTH` constant. The inconsistency is harmless (12 is unambiguous) but the affordability modules would read more uniformly reusing a shared named constant, matching the TCO precedent.

**Fix:** Optional — extract a shared `MONTHS_PER_YEAR`/`ONE_TWELFTH` constant for the affordability derivations to mirror `tco.ts`.

### IN-03: Duplicated `inputAtPrice` helper across both solvers

**File:** `packages/core/src/bank-affordability.ts:75-84`; `packages/core/src/true-affordability.ts:92-101`

**Issue:** The two `inputAtPrice` helpers are byte-for-byte identical (same price pin, same `downPaymentPct` derivation, same `engineInput` rebuild). Duplicated logic means a fix to the WR-02 rounding concern (or the WR-03 re-validation concern) must be applied in two places and can drift. The test files duplicate it a third time.

**Fix:** Extract a single shared `trialInputAtPrice(base, household, priceDec)` helper (e.g. in a small `solver-shared.ts` or alongside `engine-input`) and import it into both solvers so the trust-boundary rebuild has one definition.

---

_Reviewed: 2026-06-26_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
