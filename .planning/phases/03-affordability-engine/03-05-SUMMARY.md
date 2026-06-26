---
phase: 03-affordability-engine
plan: 05
subsystem: affordability-engine
tags: [gap-closure, solver, feasibility, bisection, CR-01, CR-02, AFF-01, AFF-02, AFF-03, CORE-02]

requires:
  - phase: 03-02
    provides: "bankAffordability inline max-price solver (the CR-01/CR-02 site for the bank ceiling)"
  - phase: 03-03
    provides: "trueAffordability shared solveMaxPrice bisection (the CR-01/CR-02 site for both true ceilings)"
  - phase: 03-04
    provides: "affordabilityGap composer + affordability-golden-snapshot.json (the byte-identical reproducibility golden the fix must not disturb)"
  - phase: 01-02
    provides: "Money.zero() additive-identity entry point (the infeasible-ceiling sentinel)"
provides:
  - "bankAffordability passes(low0) feasibility guard → Money.zero() ceiling for infeasible bank households (CR-01); post-bracket passes(high) assertion that throws on cap exhaustion (CR-02)"
  - "solveMaxPrice passes(low0) guard → Money.zero() for BOTH the savings-floor and cash-on-hand ceilings via the one shared solver (CR-01); the same post-bracket throw (CR-02)"
  - "Infeasible-household tests: bank DTI-unmeetable ($0 ceiling), true cash-gate infeasible ($0 cashOnHand), true savings-floor infeasible ($0 savingsFloor)"
affects: [04-fi-engine (consumes a now-honest trueMaxPrice that is $0 for infeasible savers), 07-ui (a $0 ceiling is the honest 'infeasible at this profile' signal)]

tech-stack:
  added: []
  patterns:
    - "Bisection precondition is GUARDED, not assumed: if !passes(low0) the solver returns Money.zero() rather than silently bisecting an unbracketed interval down to ≈downPaymentCash+1 (the 'trustworthiness is the product' failure)"
    - "Bracket-cap exhaustion while passes(high) is still true becomes a loud, diagnosable Error (names the solver + MAX_BRACKET_DOUBLINGS) placed BEFORE the bisection loop — a masked non-bracket can no longer return a non-maximal ceiling"
    - "The $0 sentinel composes through the existing min/signedGap/toCents() verdict logic unchanged — no feasible:false field, so all four result-type SHAPES, the index.ts barrel, gap.ts, and affordability.type-test.ts stay untouched"
    - "The infeasible-bank $0 result still populates frontEndRatio/backEndRatio/bindingRatio from ratiosAt(low0) — the REAL ratios at the minimum trial — so the result shape is identical to a feasible solve"

key-files:
  created: []
  modified:
    - "packages/core/src/affordability/bank-affordability.ts"
    - "packages/core/src/affordability/bank-affordability.test.ts"
    - "packages/core/src/affordability/true-affordability.ts"
    - "packages/core/src/affordability/true-affordability.test.ts"

key-decisions:
  - "Return Money.zero() for infeasible inputs (NOT a feasible:false field) — keeps BankAffordabilityResult/TrueAffordabilityResult/AffordabilityGapResult/EvaluateScenarioResult shapes unchanged, so index.ts exports no new symbol, gap.ts is untouched, and affordability.type-test.ts needs no new guard. A $0 ceiling is the honest 'infeasible at this profile' answer and composes acceptably through min/signedGap/verdict"
  - "CR-02 cap-exhaustion is a thrown Error, not a swallowed value — a loud diagnosable failure consistent with 'trustworthiness is the product'; placed before the bisection loop so a still-passing high never reaches bisection"
  - "The infeasible-bank $0 result reports the bindingRatio via the EXISTING frontGap<=backGap tie convention (whichever ratio is furthest OVER its threshold), so the binding field is meaningful, not arbitrary, at the infeasible floor"

patterns-established:
  - "Guard the bisection invariant at the solver head (passes(low0)) and assert the failing-side invariant after bracketing (passes(high)) — the safe binary-search idiom is now uniform across both affordability solvers and reusable for any future monotonic max-price search"

requirements-completed: [AFF-01, AFF-02, AFF-03]

metrics:
  duration: ~7min
  tasks: 3
  files: 4
  completed: 2026-06-26
---

# Phase 03 Plan 05: Solver Feasibility Guards (CR-01/CR-02) Summary

**Closes the single Phase-3 verification gap: both binary-search max-price solvers (`bankAffordability`'s inline solver and the shared `solveMaxPrice` in `true-affordability.ts`) assumed the bisection precondition `passes(low)` held and bisected anyway. For an infeasible household they silently returned a plausible-but-wrong ≈`downPaymentCash+1` ceiling. Now each solver guards `passes(low0)` and returns `Money.zero()` (CR-01), and throws a diagnosable Error if the bracket-doubling cap is exhausted while `passes(high)` is still true (CR-02). No result type, public export, or type-test changed; every feasible household and the committed golden snapshot recompute byte-identically. This was the exact "trustworthiness is the product" failure (D-15 / CORE-02) the project warns against — now fixed.**

## What Was Built

### Task 1 — Bank solver guards (CR-01 / CR-02), RED → GREEN
- **RED:** Added `HOUSEHOLD_INFEASIBLE` (`HOUSEHOLD_LOW_DEBT` with `grossAnnualIncome: '15000'`), a household whose back-end DTI ratio is `0.505744 > 0.36` already at the minimum trial price `$100,001`, so `passes(low0)` is false. A new test asserting `bankMaxPrice.toDecimalString() === '0'` FAILED against the pre-guard solver (returned `100001`).
- **GREEN:** In `bank-affordability.ts`, named the low bound `low0 = cash.plus(1)` once and added the **CR-01 guard** before bracketing: `if (!passes(low0))` returns a result with `bankMaxPrice = Money.zero()`, `bankMaxLoan = Money.zero().sub(Money.of(cash))` (`-100000`), and `frontEndRatio`/`backEndRatio`/`bindingRatio` populated from `ratiosAt(low0)` (binding via the existing `frontGap<=backGap` tie convention → `backEnd` here, the ratio furthest over). Added the **CR-02 assertion** after the bracket loop and before bisection: `if (passes(high)) throw` naming `bankAffordability` + `MAX_BRACKET_DOUBLINGS`.
- Feasible regression pinned: `635347.53` (low-debt, front-end binding) and `477861.63` (debt-heavy, back-end binding) unchanged.

### Task 2 — Shared `solveMaxPrice` guards for BOTH true ceilings (CR-01 / CR-02), RED → GREEN
- **RED:** Added two infeasible fixtures off `HOUSEHOLD_ROOMY_CASH`:
  - `HOUSEHOLD_INFEASIBLE_CASH` (`availableNetWorth: '110000'` → budget `$90,000 < downPaymentCash $100,000`; need at `low0` is `$102,500.025`, so `passesCash(low0)` is false).
  - `HOUSEHOLD_INFEASIBLE_SAVINGS` (`currentAnnualSavings: '1000'`, roomy cash → post-purchase savings rate `0.1845 < 0.2` target at `low0`, i.e. below target at every price).
  Tests asserting the respective ceiling and `trueMaxPrice` are `'0'` FAILED pre-guard (returned `100001`).
- **GREEN:** In `solveMaxPrice`, named `const low0 = cash.plus(1)`, added the **CR-01 guard** `if (!passes(low0)) return Money.zero();` before bracketing — one guard fixes BOTH ceilings since `passesFloor` and `passesCash` share the solver. Added the **CR-02 assertion** after the bracket loop and before bisection (throws naming `solveMaxPrice (true-affordability)` + `MAX_BRACKET_DOUBLINGS`).
- The $0 ceiling composes through the existing `min`/`toCents()` binding logic: infeasible cash → `cashOnHandCeiling $0`, `trueMaxPrice $0`, `bindingConstraint 'cashOnHand'`; infeasible savings → `savingsRateCeiling $0`, `trueMaxPrice $0`, `bindingConstraint 'savingsFloor'`.
- Feasible regression pinned: `482309.67` (savings binding) and `400000` (cash binding) and both `bindingConstraint` outcomes unchanged; `gap.test.ts` (which composes both ceilings) still green.

### Task 3 — Full-suite + golden regression (verification only, no commit)
- `npx vitest run packages/core` — **287 passed across 25 files** (prior baseline 282 + the 5 new infeasible tests; count up, zero broken — the only acceptable delta).
- `npm run -w @house/core typecheck` (`tsc -b`) — exit 0, no output. No result type grew a field, so `affordability.type-test.ts`'s `@ts-expect-error` suppressions stay used (no TS2578).
- `git diff --quiet -- packages/core/src/__fixtures__/affordability-golden-snapshot.json` → **GOLDEN_UNCHANGED** (exit 0). The golden test passed WITHOUT `UPDATE_GOLDEN`; the fixed household is feasible so the new guards never fire on it. Golden values reproduced exactly: bankMaxPrice `672721.29`, trueMaxPrice `475515.21`, signedGap `197206.08`, verdict `bankExceedsTrue`.

## Verification

- `npx vitest run packages/core/src/affordability/bank-affordability.test.ts` — 11 passed (infeasible bank `$0`; feasible `635347.53` / `477861.63` unchanged).
- `npx vitest run packages/core/src/affordability/true-affordability.test.ts packages/core/src/affordability/gap.test.ts` — 16 passed (infeasible cash gate `$0`/`cashOnHand`; infeasible savings floor `$0`/`savingsFloor`; feasible `482309.67` / `400000` + gap composition unchanged).
- `npx vitest run packages/core` — 287 passed, 25 files.
- `npm run -w @house/core typecheck` — clean (`tsc -b` exit 0).
- `npx vitest run packages/core/src/golden.test.ts` — 6 passed; golden byte-identical on disk, no `UPDATE_GOLDEN`.

## TDD Gate Compliance

Tasks 1 and 2 followed RED → GREEN per the per-task `tdd="true"` flow:
- Bank: RED (new infeasible test failing `expected '100001' to be '0'`) → GREEN guards → `c9217a4`.
- True: RED (two infeasible tests failing `expected '100001' to be '0'`) → GREEN guards → `59e2e73`.
No REFACTOR commits were needed. Per the sequential-executor protocol the RED and GREEN steps for each task were captured in a single `fix(03-05)` commit (the gap-closure fix is the unit of work); the failing-then-passing transition is documented above and reproducible by reverting the source hunk.

## Deviations from Plan

None — plan executed exactly as written. The decision pre-made in the plan (`Money.zero()` over a `feasible:false` field) was honored; `index.ts`, `gap.ts`, and `affordability.type-test.ts` were never touched (`git diff --name-only HEAD~2 HEAD` lists only the four planned files); the golden snapshot was not regenerated.

## Known Stubs

None. Both guards return real computed values (`Money.zero()` is the genuine infeasible ceiling; ratios at the infeasible bank floor are the real `ratiosAt(low0)` values). No placeholder/empty data, no TODO/FIXME introduced.

## Threat Flags

None. This gap-closure plan installs ZERO new packages (T-03-SC: uses only `Money.zero()` and existing imports). The two new guards are the planned mitigations: T-03-09 (silent wrong answer) closed by the CR-01 `!passes(low0)` guard; T-03-10 (masked non-bracket) closed by the CR-02 `passes(high)` throw. No new network/auth/file/schema surface.

## For the Next Phase

- **Phase 4 (FI engine)** now consumes a `trueMaxPrice` that is honestly `$0` for an infeasible saver, rather than a fundable-looking ≈`downPaymentCash+1`. The anti-funnel guarantee remains reachable and golden-pinned (`bankExceedsTrue`).
- **Phase 7 (UI)** should treat a `$0` ceiling (or `$0` `trueMaxPrice`) as the "infeasible at this profile" signal; the `bindingConstraint`/`bindingRatio` still identify which constraint is responsible.
- The deferred WR-01 (propagate an explicit feasibility flag into the result) and the WR-04/WR-05 boundary refines (positive-income, cross-field `downPaymentCash + reserve <= availableNetWorth`) remain separate, larger concerns beyond this single verification gap — not in scope here.

## Self-Check: PASSED

- Modified files present and changed (exactly four, no others): `bank-affordability.ts`, `bank-affordability.test.ts`, `true-affordability.ts`, `true-affordability.test.ts` — confirmed via `git diff --name-only HEAD~2 HEAD`.
- Commits present in `git log`: `c9217a4` (bank guards), `59e2e73` (true-affordability guards) — FOUND.
- Golden snapshot byte-identical on disk (`git diff --quiet` exit 0); golden values reproduced (672721.29 / 475515.21 / 197206.08 / bankExceedsTrue).
- Full suite 287 passed; `tsc -b` clean.
