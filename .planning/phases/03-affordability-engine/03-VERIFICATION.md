---
phase: 03-affordability-engine
verified: 2026-06-26T15:15:00Z
status: passed
score: 3/3 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 3/3
  gaps_closed:
    - "Binary-search solvers never verify passes(low): an unfundable household yields a garbage ceiling instead of $0/error (CR-01 + CR-02)"
  gaps_remaining: []
  regressions: []
---

# Phase 3: Affordability Engine Verification Report

**Phase Goal:** Answer "can the bank?" versus "what does our retirement allow?" — compute bank affordability from configurable DTI ratios and true affordability from the savings-rate/FI-threshold constraint, and surface the gap between them as a first-class output.
**Verified:** 2026-06-26T15:15:00Z
**Status:** passed
**Re-verification:** Yes — after gap closure (plan 03-05)

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Bank affordability computes the max approvable loan from configurable front-end (~28%) and back-end (~36%) DTI ratios using gross income and the full PITI+HOA+PMI carrying cost (reusing TCO components), factoring existing debts (worked-example tests) | ✓ VERIFIED | `bankAffordability` in `bank-affordability.ts` reads thresholds from `input.assumptions.dti.frontEnd`/`.backEnd`. `lenderDtiCarryingCost` = P+I + propertyTax + insurance + pmi + hoa (D-14). `existingMonthlyDebt` fed into back-end ratio. Two worked-example households tested: low-debt (frontEnd binds, solved price $635,347.53) and debt-heavy (backEnd binds, $477,861.63). +$0.01 fails for both. All 287 tests pass. |
| 2 | True affordability computes the price that fits the household's target savings rate without pushing the FI date past its threshold | ✓ VERIFIED | `trueAffordability` in `true-affordability.ts` solves two ceilings: (A) savings-rate floor using `currentAnnualSavings` baseline, incremental premium over `currentRent`, gross denominator; (B) cash-on-hand gate `downPaymentCash + closingCosts ≤ availableNetWorth − reserve`. `trueMaxPrice = min(A, B)` with `bindingConstraint` reported. Roomy-cash fixture: savings floor binds at $482,309.67; tight-cash fixture: cash gate binds at $400,000. +$0.01 fails for both. |
| 3 | The tool surfaces the numeric gap between bank affordability and true affordability as an explicit output | ✓ VERIFIED | `affordabilityGap` in `gap.ts` composes both solvers, returns `signedGap = bankMaxPrice − trueMaxPrice` as `Money`, plus `bankBindingRatio`, `trueBindingConstraint`, and `verdict ∈ {bankExceedsTrue, trueExceedsBank, aligned}`. Golden snapshot confirms anti-funnel direction: bank $672,721.29, true $475,515.21, signedGap +$197,206.08, verdict `bankExceedsTrue`. All three verdict directions tested. |

**Score:** 3/3 truths verified

---

## Gap Closure Verification (CR-01 + CR-02 from plan 03-05)

### CR-01: passes(low0) precondition guard — CLOSED

**bank-affordability.ts** (`packages/core/src/affordability/bank-affordability.ts`):

Lines 125–145 show the guard added verbatim as specified:

```
const low0 = cash.plus(1);

// CR-01 GUARD: ...
if (!passes(low0)) {
  const { front, back } = ratiosAt(low0);
  ...
  return {
    bankMaxPrice: Money.zero(),
    bankMaxLoan: Money.zero().sub(Money.of(cash.toFixed())),
    frontEndRatio: front.toFixed(),
    backEndRatio: back.toFixed(),
    bindingRatio,
  };
}
```

The guard fires before any bracket loop. An infeasible bank household receives `bankMaxPrice = Money.zero()`, not ≈`downPaymentCash+1`. The result shape is unchanged — `frontEndRatio`, `backEndRatio`, and `bindingRatio` are still populated from `ratiosAt(low0)`.

**true-affordability.ts** (`packages/core/src/affordability/true-affordability.ts`):

Lines 111–120 of `solveMaxPrice` show the guard:

```
function solveMaxPrice(cash: DecimalInstance, passes: (price: DecimalInstance) => boolean): Money {
  const low0 = cash.plus(1);

  // CR-01 GUARD: ...
  if (!passes(low0)) {
    return Money.zero();
  }
  ...
```

One guard fixes both the savings-floor and cash-on-hand ceilings because `passesFloor` and `passesCash` share this function.

### CR-02: bracket-cap exhaustion assertion — CLOSED

**bank-affordability.ts** (lines 156–166): After the bracket `while` loop and before the bisection loop:

```
if (passes(high)) {
  throw new Error(
    `bankAffordability: exhausted MAX_BRACKET_DOUBLINGS (${MAX_BRACKET_DOUBLINGS}) without ` +
      'bracketing a failing price — ...',
  );
}
```

**true-affordability.ts** (lines 130–138): Same pattern in `solveMaxPrice`:

```
if (passes(high)) {
  throw new Error(
    `solveMaxPrice (true-affordability): exhausted MAX_BRACKET_DOUBLINGS (${MAX_BRACKET_DOUBLINGS}) ` +
      '...',
  );
}
```

Both throws are positioned before the bisection loop. Cap exhaustion while still passing is a loud, diagnosable Error — not a silent non-maximal ceiling.

### New tests asserting infeasible households yield $0 — PRESENT AND PASSING

**bank-affordability.test.ts** — `describe('CR-01 — infeasible household yields a $0 ceiling...')`:

- `HOUSEHOLD_INFEASIBLE` defined as `{ ...HOUSEHOLD_LOW_DEBT, grossAnnualIncome: '15000' }` — back-end DTI `0.505744 > 0.36` at the minimum trial price.
- Test "the back-end ratio already EXCEEDS 0.36 at the low-bound trial price (the infeasibility premise)": verifies the precondition using the same trial rebuild the solver uses.
- Test "bankMaxPrice === $0 and bankMaxLoan === 0 − downPaymentCash for an infeasible household": asserts `result.bankMaxPrice.toDecimalString() === '0'` and `result.bankMaxLoan.toDecimalString() === '-100000'`.
- Test "the $0 result still populates ratios + bindingRatio (from the infeasible floor), shape unchanged": pins exact ratio strings and confirms `bindingRatio === 'backEnd'`.

**true-affordability.test.ts** — `describe('CR-01 — infeasible inputs yield a $0 ceiling via the shared solveMaxPrice guard')`:

- `HOUSEHOLD_INFEASIBLE_CASH`: `availableNetWorth: '110000'` → budget `$90,000 < downPaymentCash $100,000`; cash gate infeasible at every price.
- `HOUSEHOLD_INFEASIBLE_SAVINGS`: `currentAnnualSavings: '1000'` → savings rate `0.1845 < 0.2` target at the minimum trial; savings floor infeasible at every price.
- Test "infeasible cash gate ... cashOnHandCeiling === $0, binds the result": verifies the premise in-test (`needAtLow0 > budget`), asserts `cashOnHandCeiling === '0'`, `trueMaxPrice === '0'`, `bindingConstraint === 'cashOnHand'`.
- Test "infeasible savings floor ... savingsRateCeiling === $0, binds the result": verifies premise in-test (rate at low0 below target), asserts `savingsRateCeiling === '0'`, `trueMaxPrice === '0'`, `bindingConstraint === 'savingsFloor'`.

### Feasible-household behavior and golden snapshot — UNCHANGED

Full suite: **287 passed, 25 files** (up from prior 282; the +5 are the new infeasible-household tests; zero broken).

Golden snapshot: `git diff --quiet -- packages/core/src/__fixtures__/affordability-golden-snapshot.json` exits 0 — **GOLDEN_UNCHANGED**. The golden test recomputes cent-identically (`bankMaxPrice: 672721.29`, `trueMaxPrice: 475515.21`, `signedGap: 197206.08`, `verdict: bankExceedsTrue`) without `UPDATE_GOLDEN`. The golden household is feasible, so the new guards never fire on it.

### Money.zero() composition through gap.ts — UNCHANGED

`gap.ts` was not modified. A `$0` ceiling from either solver composes correctly through the existing `min`/`signedGap`/`toCents()` verdict logic — `$0` is a valid `Money` value, bigint cents arithmetic handles it without code changes, and `bindingConstraint`/`bindingRatio` remain populated. No result type, public export, type-test, or `index.ts` barrel changed. `tsc -b` exits 0 with no output — `affordability.type-test.ts`'s `@ts-expect-error` suppressions remain used (no TS2578).

---

## Required Artifacts (regression check)

| Artifact | Status | Notes |
|----------|--------|-------|
| `packages/core/src/affordability/bank-affordability.ts` | ✓ VERIFIED | CR-01 + CR-02 guards added; result shape unchanged |
| `packages/core/src/affordability/bank-affordability.test.ts` | ✓ VERIFIED | 3 new infeasible-bank tests; 11 total in that file |
| `packages/core/src/affordability/true-affordability.ts` | ✓ VERIFIED | CR-01 + CR-02 guards added to shared `solveMaxPrice`; result shape unchanged |
| `packages/core/src/affordability/true-affordability.test.ts` | ✓ VERIFIED | 2 new infeasible-true tests (cash gate + savings floor); 13 total in that file |
| `packages/core/src/affordability/gap.ts` | ✓ VERIFIED (unmodified) | Gap composition confirmed unmodified; gap.test.ts still green |
| `packages/core/src/index.ts` | ✓ VERIFIED (unmodified) | No new exports; barrel unchanged |
| `packages/core/src/__fixtures__/affordability-golden-snapshot.json` | ✓ VERIFIED (unmodified) | byte-identical, git diff clean |

---

## Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full suite — 287 tests pass | `npm run -w @house/core test` | 287 passed, 25 files | ✓ PASS |
| Infeasible bank household → $0 ceiling | bank-affordability.test.ts CR-01 describe block | bankMaxPrice '0', bankMaxLoan '-100000' | ✓ PASS |
| Infeasible cash gate → $0 ceiling | true-affordability.test.ts CR-01 cash infeasible test | cashOnHandCeiling '0', trueMaxPrice '0', bindingConstraint 'cashOnHand' | ✓ PASS |
| Infeasible savings floor → $0 ceiling | true-affordability.test.ts CR-01 savings infeasible test | savingsRateCeiling '0', trueMaxPrice '0', bindingConstraint 'savingsFloor' | ✓ PASS |
| Feasible prices byte-identical | bank-affordability.test.ts existing tests | 635347.53 / 477861.63 unchanged | ✓ PASS |
| Feasible true ceilings byte-identical | true-affordability.test.ts existing tests | 482309.67 / 400000 unchanged | ✓ PASS |
| Golden snapshot recomputes cent-identically | `git diff --quiet` + golden test | GOLDEN_UNCHANGED; 672721.29 / 475515.21 / 197206.08 / bankExceedsTrue | ✓ PASS |
| `tsc -b` clean | `npm run -w @house/core typecheck` | exit 0, no output | ✓ PASS |

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| AFF-01 | 03-02, 03-05 | Tool computes bank affordability from configurable DTI ratios, factoring existing debts | ✓ SATISFIED | `bankAffordability` correct for feasible AND infeasible households. CR-01 guard returns $0 for infeasible; CR-02 throws on bracket exhaustion. Worked-example tests + infeasible-household tests pass. |
| AFF-02 | 03-01, 03-03, 03-05 | Tool computes true affordability — price that fits the savings-rate target | ✓ SATISFIED | `trueAffordability`/`solveMaxPrice` correct for feasible AND infeasible (both cash-gate and savings-floor variants). $0 ceiling signals infeasibility honestly. |
| AFF-03 | 03-04 | Tool surfaces the gap between bank affordability and true affordability | ✓ SATISFIED | `affordabilityGap` unchanged. $0 ceilings compose through `signedGap`/verdict correctly. Golden snapshot recomputes cent-identically. |

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| (none) | — | — | — | No TBD/FIXME/XXX markers, no stubs, no placeholder returns. The prior BLOCKER anti-patterns in `bank-affordability.ts:125-132` and `true-affordability.ts:111-118` are resolved by the CR-01/CR-02 guards. |

---

## Human Verification Required

None — all phase-3 behaviors are programmatically verifiable. The CR-01 and CR-02 fixes are logic-level guards with deterministic, exact-equality-tested outcomes.

---

## Gaps Summary

No gaps remain. The single gap identified in the initial verification (CR-01: silent wrong ceiling for infeasible households; CR-02: silent non-maximal ceiling on bracket-cap exhaustion) is closed:

- `bankAffordability` now guards `!passes(low0)` and returns `Money.zero()` with real ratios from the infeasible floor.
- `solveMaxPrice` (shared by both `trueAffordability` ceilings) now guards `!passes(low0)` and returns `Money.zero()`.
- Both solvers throw a diagnosable `Error` naming the solver and `MAX_BRACKET_DOUBLINGS` when bracket-cap exhaustion occurs while `passes(high)` is still true.
- New tests exercise all three infeasible paths (bank DTI-unmeetable, true cash-gate, true savings-floor), asserting `$0` ceilings with correct `bindingConstraint`/`bindingRatio`.
- All prior feasible-household tests are byte-identical. The golden snapshot is unmodified on disk.
- `gap.ts`, `index.ts`, and `affordability.type-test.ts` are untouched; `tsc -b` is clean.

The three original success criteria hold for feasible AND infeasible households. Phase 3 goal fully achieved.

---

_Verified: 2026-06-26T15:15:00Z_
_Verifier: Claude (gsd-verifier)_
_Re-verification: Yes — gap closure plan 03-05_
