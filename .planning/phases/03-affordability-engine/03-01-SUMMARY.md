---
phase: 03-affordability-engine
plan: 01
subsystem: affordability-engine
tags: [household, trust-boundary, zod, engine-input, contract]
requires:
  - "EngineInput / ScenarioInputs contract (Phase 02-07)"
  - "decStr canonical-decimal-string validator (Phase 01-03)"
provides:
  - "Household interface (8 canonical-decimal-string fields incl. currentAnnualSavings D-17, reserve D-05)"
  - "HouseholdSchema (.strict(), decStr leaves, targetSavingsRate [0,1) .refine)"
  - "parseHousehold(input: unknown): Household loader"
  - "optional household? on EngineInput / engineInput() (validate-when-present, A3)"
affects:
  - "Waves 2-3 affordability solvers (consume input.household)"
  - "Phase 6 persistence (persists household)"
tech-stack:
  added: []
  patterns:
    - "household trust boundary mirrors the scenario boundary (parse-at-assembly, .strict(), decStr, range .refine)"
    - "optional key OMITTED entirely (spread-when-present) rather than set to undefined — required by exactOptionalPropertyTypes and keeps TCO golden byte-identical"
key-files:
  created: []
  modified:
    - "packages/core/src/engine/engine-input.ts"
    - "packages/core/src/engine/engine-input.test.ts"
    - "packages/core/src/engine/engine-input.type-test.ts"
decisions:
  - "household is OPTIONAL on EngineInput (A3): TCO-only callers untouched, golden byte-identical; affordability solvers require it at their own entry points"
  - "engineInput() OMITS the household key entirely when absent (conditional spread) — not set to undefined — to satisfy exactOptionalPropertyTypes and preserve the byte-identical TCO snapshot"
  - "targetSavingsRate [0,1) enforced via the decStr.refine boundary idiom copied from downPaymentPct (Number(s) range check, not money math)"
metrics:
  duration: ~5min
  tasks: 4
  files: 3
  completed: 2026-06-26
---

# Phase 03 Plan 01: Household Input Contract Summary

Introduced the durable `household` (profile) input contract on `EngineInput` — a Zod-validated trust boundary mirroring `ScenarioInputs` (`.strict()`, `decStr` leaves, a `[0,1)` `.refine` on `targetSavingsRate`, and a `parseHousehold` loader) — made OPTIONAL so existing TCO-only call sites and the byte-identical `tco-golden-snapshot.json` need no change.

## What Was Built

- **`Household` interface** (`engine-input.ts`) — 8 `readonly` canonical-decimal-string fields: `grossAnnualIncome` (gross, not net — Pitfall 2), `existingMonthlyDebt` (monthly minimums, not balances — D-10), `targetSavingsRate` (fraction of gross, D-02/D-04), `availableNetWorth` (D-05), `currentRent` (distinct from `scenario.monthlyRent` — D-11), `downPaymentCash` (D-07), `reserve` (D-05), and `currentAnnualSavings` (D-17, the savings-rate floor's denominator-baseline).
- **`HouseholdSchema`** — `z.object({...}).strict()` with every dollar field `decStr` and `targetSavingsRate` carrying the `[0,1)` `.refine` boundary guard copied from `downPaymentPct`.
- **`parseHousehold(input: unknown): Household`** — the single loader/trust-boundary entry, mirroring `parseScenarioInputs`.
- **`household?: Household`** wired OPTIONALLY into both the `EngineInput` interface and the `engineInput()` factory parts; validated-when-present via `Object.freeze(parseHousehold(...))`, the key omitted entirely when absent.
- **Boundary tests** (`engine-input.test.ts`) — `VALID_HOUSEHOLD` const + a `parseHousehold` accept/reject describe-block (non-canonical decStr, `.strict()` extra key, missing `currentAnnualSavings`, `targetSavingsRate` `[0,1)` range cases) and extended factory tests (round-trip + frozen when present; `household === undefined` and key-omitted when absent).
- **Type-test** (`engine-input.type-test.ts`) — `@ts-expect-error` guards proving household dollar leaves are decimal STRINGS not bare numbers (CORE-02) and that `EngineInput.household` is optional, in the `tsc -b` graph.

## Tasks Completed

| Task | Name | Commit | Files |
| ---- | ---- | ------ | ----- |
| 1+2 | Household interface/schema/loader + optional wiring into EngineInput/engineInput() | 7aec870 | engine-input.ts |
| 3 | Wave 0 household boundary validation tests (TDD) | b34c299 | engine-input.test.ts |
| 4 | Wave 0 household type-test (no bare-number dollars) | 56a2d5d | engine-input.type-test.ts |

Tasks 1 and 2 both modify only `engine-input.ts` in one continuous source-contract change (Task 2 builds directly on Task 1's types, and the runtime proof for both arrives in Task 3); they were committed together as one atomic source commit.

## Verification

- `npx vitest run packages/core/src/engine/engine-input.test.ts` — 47 passed (household accept + reject boundary cases, V5).
- `npm run -w @house/core typecheck` (`tsc -b`) — passes; all household `@ts-expect-error` guards honored.
- `npx vitest run packages/core/src/golden.test.ts` — 4 passed; `UPDATE_GOLDEN=1` regen produced NO diff to `tco-golden-snapshot.json` (byte-identical — A3 confirmed).
- `npm run -w @house/core test` — full core suite 245 passed (20 files).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `exactOptionalPropertyTypes` rejected `household: ... | undefined` in the frozen factory object**
- **Found during:** Task 2
- **Issue:** The plan's literal wiring `household: parts.household ? Object.freeze(parseHousehold(parts.household)) : undefined` failed `tsc -b` (TS2375): with `exactOptionalPropertyTypes: true`, an optional `household?: Household` field does not admit an explicit `undefined` value.
- **Fix:** Used a conditional spread so the `household` KEY is omitted entirely when absent: `...(parts.household ? { household: Object.freeze(parseHousehold(parts.household)) } : {})`. This also strengthens the A3 guarantee — a TCO-only input serializes with no `household` key at all, keeping the existing golden snapshot byte-identical (verified by an `UPDATE_GOLDEN` no-diff and a new `hasOwnProperty('household') === false` test).
- **Files modified:** packages/core/src/engine/engine-input.ts
- **Commit:** 7aec870

## TDD Gate Compliance

Task 3 carried `tdd="true"`. Because Tasks 1-2 (the source contract) necessarily precede the runtime boundary tests in this Wave-0 scaffold — the tests assert against an already-built parser — the household tests passed on first run rather than going through a failing-RED phase. This is the intended sequencing for a boundary-test scaffold layered onto a just-built schema (the schema is the unit under proof, not a behavior to be driven into existence). No separate RED commit was created for the household tests; the `feat` source commit (7aec870) and the `test` commit (b34c299) are both present in the log.

## Self-Check: PASSED

- packages/core/src/engine/engine-input.ts — FOUND (Household, HouseholdSchema, parseHousehold present; compiles)
- packages/core/src/engine/engine-input.test.ts — FOUND (parseHousehold describe-block present; 47 tests pass)
- packages/core/src/engine/engine-input.type-test.ts — FOUND (Household guards present; tsc -b clean)
- Commit 7aec870 — FOUND
- Commit b34c299 — FOUND
- Commit 56a2d5d — FOUND
