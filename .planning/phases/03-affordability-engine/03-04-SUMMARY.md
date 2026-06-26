---
phase: 03-affordability-engine
plan: 04
subsystem: affordability-engine
tags: [gap, anti-funnel, verdict, evaluate-scenario, type-test, golden, barrel, AFF-03, CORE-02]

requires:
  - phase: 03-01
    provides: "Household block on EngineInput (parseHousehold loader) carried through the lossless golden round-trip"
  - phase: 03-02
    provides: "bankAffordability(input): BankAffordabilityResult {bankMaxPrice, bindingRatio} — the bank ceiling the gap composes"
  - phase: 03-03
    provides: "trueAffordability(input): TrueAffordabilityResult {trueMaxPrice, bindingConstraint} + cashSavingsDrain — the true ceiling the gap composes; reused for evaluate's savings impact"
  - phase: 02-tco-engine
    provides: "computeTco / TcoBreakdown, dti.ts (frontEndRatio/backEndRatio), Money.toCents() bigint-cent comparison, canonicalJson serializer, the UPDATE_GOLDEN-gated golden harness shape"
provides:
  - "affordabilityGap(input): AffordabilityGapResult — composes both ceilings; {bankMaxPrice, trueMaxPrice, signedGap, bankBindingRatio, trueBindingConstraint, verdict} (D-12)"
  - "AffordabilityVerdict = 'bankExceedsTrue' | 'trueExceedsBank' | 'aligned' (D-13) + ALIGNED_TOLERANCE_CENTS ($1,000, A2)"
  - "evaluateScenario(input): EvaluateScenarioResult — per-scenario DTI ratios + pass flags + savingsRateImpact + headroom (D-06)"
  - "affordability.type-test.ts — no-bare-number guard across all four affordability result shapes (CORE-02)"
  - "Public @house/core barrel for the whole affordability + household surface"
  - "affordability-golden-snapshot.json — the gap result reproducibility golden (anti-funnel direction pinned)"
affects: [04-fi-engine (consumes the gap + true ceiling), 06-persistence (Household/parseHousehold), 07-ui (verdict enum → copy)]

tech-stack:
  added: []
  patterns:
    - "Directional verdict on max PRICE via Money.toCents() bigint cents against a documented absolute tolerance (mirrors rentVsBuy's winner) — float dollars never decide the direction"
    - "The aligned tolerance is an EXPORTED constant (ALIGNED_TOLERANCE_CENTS), pinned by a test and reviewable — not a buried magic number"
    - "evaluateScenario REPORTS at a fixed price (computeTco once, no solving) reusing dti.ts + cashSavingsDrain — no re-derived ratio math (D-06)"
    - "affordability.type-test.ts: property-level @ts-expect-error (one per diagnostic site) when an object literal has multiple bad fields — single-suppression-per-literal would leave one TS2578 unused"
    - "Golden round-trip carries household through parseHousehold (Pitfall 5); TCO/canary goldens stay byte-identical because they never read household and serialize the RESULT, not the input"

key-files:
  created:
    - "packages/core/src/affordability/gap.ts"
    - "packages/core/src/affordability/gap.test.ts"
    - "packages/core/src/affordability/evaluate-scenario.ts"
    - "packages/core/src/affordability/evaluate-scenario.test.ts"
    - "packages/core/src/affordability/affordability.type-test.ts"
    - "packages/core/src/__fixtures__/affordability-golden-snapshot.json"
  modified:
    - "packages/core/src/index.ts"
    - "packages/core/src/golden.test.ts"

key-decisions:
  - "signedGap = bankMaxPrice − trueMaxPrice (Money); verdict decided on toCents() bigints vs ALIGNED_TOLERANCE_CENTS ($1,000, A2): |diff| ≤ tol → aligned, bank beyond → bankExceedsTrue (anti-funnel), else trueExceedsBank. Verdict is a STRUCTURED enum, never UI copy (Phase 7 owns wording, D-13)"
  - "affordabilityGap composes the two SOLVERS verbatim (one bankAffordability + one trueAffordability call) — it carries bank.bindingRatio AND true.bindingConstraint through unchanged (D-12), no re-derivation"
  - "evaluateScenario REPORTS at a fixed price (D-06): computeTco ONCE, ratios via dti.ts, pass flags vs assumptions.dti.* thresholds (Shared P4), savingsRateImpact via cashSavingsDrain (same D-03/D-04/D-17 derivation as the true floor), headroom = the Dec margin below the BINDING ceiling (front-end wins ties); ≥0 ⇔ passes, <0 ⇔ fails"
  - "frontEndRatio/backEndRatio are NOT re-exported from index.ts — they return the internal Dec (DecimalInstance); exposing them would leak raw decimal.js across the boundary that keeps Dec internal. Ratios reach downstream as decimal STRINGS through evaluateScenario's result. lenderDtiCarryingCost/cashSavingsDrain (both return Money) ARE exported"
  - "The affordability golden FIXTURE itself exhibits the anti-funnel verdict (bank $672,721.29 vs true $475,515.21, signedGap +$197,206.08, verdict bankExceedsTrue) — the headline product value is reproducibility-pinned, not just asserted in a unit test"
  - "Golden regeneration stays UPDATE_GOLDEN-gated (never toMatchSnapshot, T-03-07); a no-diff UPDATE_GOLDEN run confirmed tco-golden-snapshot.json + golden-snapshot.json are byte-identical (md5 unchanged)"

patterns-established:
  - "Composing solvers into a directional verdict: run each ceiling once, compare maxima on bigint cents against a documented tolerance, report both binding fields — the gap/winner idiom is now reusable across the engine"

requirements-completed: [AFF-01, AFF-02, AFF-03]

metrics:
  duration: ~10min
  tasks: 3
  files: 8
  completed: 2026-06-26
---

# Phase 03 Plan 04: Affordability GAP + Verdict + Public Barrel Summary

**The product's headline instrument (AFF-03): `affordabilityGap` composes the bank ceiling (AFF-01) and the true ceiling (AFF-02) into a signed gap and a cent-exact directional verdict (`bankExceedsTrue | trueExceedsBank | aligned`, D-13) — proving the anti-funnel direction "the bank will lend $X beyond your FI tolerance" is reachable (Pitfall 6). It also lands the per-scenario `evaluateScenario` report (D-06), a CORE-02 type-test guarding every affordability result field as Money-only, the public `@house/core` barrel for the whole affordability + household surface, and a reproducibility golden whose fixture itself exhibits the anti-funnel verdict. Phase 3 is closed.**

## What Was Built

### Task 1 — `affordabilityGap` composer + `AffordabilityVerdict` enum (AFF-03)
- `affordabilityGap(input)` runs `bankAffordability` + `trueAffordability` once each, computes `signedGap = bankMaxPrice.sub(trueMaxPrice)` (Money), and picks the verdict on `Money.toCents()` bigints — the exact cent-comparison idiom `rentVsBuy`'s `winner` uses.
- `AffordabilityVerdict = 'bankExceedsTrue' | 'trueExceedsBank' | 'aligned'` (D-13); `ALIGNED_TOLERANCE_CENTS = 100000n` ($1,000, A2) is an exported, test-pinned constant.
- Result carries both the bank `bindingRatio` and the true `bindingConstraint` (D-12).
- **Anti-funnel proven (Pitfall 6):** a realistic conservative-saver fixture (35%-of-gross target) yields `verdict === 'bankExceedsTrue'`, `signedGap > 0`; a cash-rich/low-income fixture yields `trueExceedsBank`. Both directions reachable.

### Task 2 — `evaluateScenario` report (D-06) + no-bare-number type-test (CORE-02)
- `evaluateScenario(input)` runs `computeTco` ONCE on the already-priced scenario (no solving) and reports `{frontEndRatio, backEndRatio, frontEndPass, backEndPass, savingsRateImpact, headroom}`, reusing `dti.ts` + `cashSavingsDrain` (no re-derived ratio math). Headroom is the Dec margin below the binding DTI ceiling: ≥0 ⇔ passes, <0 ⇔ fails.
- `affordability.type-test.ts` (in the `tsc -b` graph, not a `*.test.ts`) asserts every dollar field on `BankAffordabilityResult`, `TrueAffordabilityResult`, `AffordabilityGapResult` is Money-only and not bare-number assignable, and that `EvaluateScenarioResult`'s ratios/headroom are decimal strings (not numbers).

### Task 3 — Public barrel + reproducibility golden harness
- `index.ts` now exports the four affordability entry points + result types + `AffordabilityVerdict` + `BindingRatio`/`BindingConstraint` + `lenderDtiCarryingCost`/`cashSavingsDrain` + `Household`/`HouseholdSchema`/`parseHousehold`. `Dec`/`Decimal` (and the Dec-returning `frontEndRatio`/`backEndRatio`) remain unexported.
- `golden.test.ts` gained a fixed deterministic `household`, an `UPDATE_GOLDEN`-gated affordability golden block (never `toMatchSnapshot`), and a `roundTrip` that serializes + re-parses `household` through `parseHousehold` (Pitfall 5 / T-03-08).
- `affordability-golden-snapshot.json` was generated once under `UPDATE_GOLDEN=1` and committed; the existing TCO + canary goldens are byte-identical (md5 unchanged — confirmed).

## Verification

- `npx vitest run packages/core/src/affordability/gap.test.ts` — 5 passed (all three verdicts + anti-funnel `bankExceedsTrue`).
- `npx vitest run packages/core/src/affordability/evaluate-scenario.test.ts` — 5 passed (ratios match dti.ts, pass flags, headroom sign, savings impact).
- `npm run -w @house/core typecheck` (`tsc -b`) — clean (affordability type-test honored).
- `npx vitest run packages/core/src/golden.test.ts` — 6 passed (affordability golden + lossless household round-trip; TCO byte-identical).
- **Phase gate:** `npm test` — 282 passed across 25 files; `npm run typecheck` clean. No `UPDATE_GOLDEN` diff on the TCO/canary masters.

## TDD Gate Compliance

Tasks 1 and 2 followed RED → GREEN per the per-task `tdd="true"` flow:
- Gap: `test(03-04)` RED commit `0537c0d` → `feat(03-04)` GREEN commit `7abf68f`.
- Evaluate: `test(03-04)` RED commit `40a0133` → `feat(03-04)` GREEN commit `fd13a89`.
No REFACTOR commits were needed. Task 3 (barrel + golden harness) is non-TDD by design (integration/wiring, no new behavior to drive from a failing test).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Correctness] Did NOT export `frontEndRatio`/`backEndRatio` from `index.ts`**
- **Found during:** Task 3 (barrel wiring).
- **Issue:** The plan's action text listed exporting "the `lenderDtiCarryingCost` / `cashSavingsDrain` derivations if they are part of the intended public surface." `frontEndRatio`/`backEndRatio` (also in `dti.ts`) return the internal `Dec` (`DecimalInstance`). Re-exporting them would leak the raw decimal.js type across the public boundary whose entire purpose (index.ts L6-9, CLAUDE.md) is to keep `Dec` internal so dollars cross only as `Money`.
- **Fix:** Exported only `lenderDtiCarryingCost` (returns `Money`) and `cashSavingsDrain` (returns `Money`). Documented the deliberate omission in `index.ts`; ratios reach downstream as decimal strings via `evaluateScenario`'s result.
- **Files modified:** `packages/core/src/index.ts`
- **Commit:** `5e2da80`

**2. [Rule 1 - Bug] type-test `@ts-expect-error` placement on a multi-field bad object literal**
- **Found during:** Task 2 (first `tsc -b` run).
- **Issue:** A single `@ts-expect-error` above an object literal with TWO bad properties (`{bankMaxPrice: 5, bankMaxLoan: 10}`) suppresses only the first reported diagnostic, leaving a TS2578 "unused directive" + an unsuppressed TS2322.
- **Fix:** Moved the suppressions to be property-level (one `@ts-expect-error` per bad field). `tsc -b` then passes with both misuses asserted.
- **Files modified:** `packages/core/src/affordability/affordability.type-test.ts`
- **Commit:** `fd13a89`

## Deferred Issues

Out-of-scope discovery logged to `.planning/phases/03-affordability-engine/deferred-items.md` (NOT fixed — outside this plan's change surface per the scope-boundary rule):
- Pre-existing ESLint error `'computeTco' is defined but never used` at `packages/core/src/tco/rent-vs-buy.test.ts:23` (from a Phase 2 quick task, commit d4d0ac2, unmodified here). `npm run lint` fails on this single error; everything else lints clean.

## Known Stubs

None. All affordability result fields are wired to real computed values; no placeholder/empty data, no TODO/FIXME stubs introduced.

## Threat Flags

None. Phase 3 installs ZERO new packages (T-03-SC). The golden harness reuses the established `UPDATE_GOLDEN`-gated control (T-03-07) and the household round-trip closes the re-parse boundary (T-03-08); no new network/auth/file/schema surface was introduced.

## For the Next Phase

- **Phase 4 (FI engine)** consumes `trueMaxPrice` (the savings-rate floor is the AFF-02 *proxy*; the real FI-date projection is Phase 4) and the `affordabilityGap` result. The anti-funnel guarantee acceptance check the roadmap pins to Phase 4 is already demonstrably reachable (the gap golden fixture itself is `bankExceedsTrue`).
- **Phase 6 (persistence)** can persist `Household` via the now-public `parseHousehold` loader; the golden round-trip proves serialize → `parseHousehold` → recompute is lossless.
- **Phase 7 (UI)** maps the `AffordabilityVerdict` enum to copy (the enum deliberately carries no wording, D-13).

## Self-Check: PASSED

All six created files verified present on disk; all five plan-phase commits present in `git log`:
- `gap.ts`, `gap.test.ts`, `evaluate-scenario.ts`, `evaluate-scenario.test.ts`, `affordability.type-test.ts`, `affordability-golden-snapshot.json` — FOUND.
- Commits `0537c0d`, `7abf68f`, `40a0133`, `fd13a89`, `5e2da80` — present.
