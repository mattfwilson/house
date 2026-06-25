---
phase: 02-tco-engine
plan: 07
subsystem: calc-core / engine
tags: [trust-boundary, zod, validation, scenario-inputs, CR-03, STRIDE-tampering]
requires:
  - "engineInput / ScenarioInputs (02-01)"
  - "decStr + AssumptionSetSchema boundary pattern (01-03)"
  - "golden round-trip harness (01-04 / 02-05)"
provides:
  - "ScenarioInputsSchema (Zod .strict()) — runtime mirror of the ScenarioInputs interface"
  - "parseScenarioInputs(input: unknown): ScenarioInputs — sanctioned snapshot-loader boundary helper"
  - "engineInput() validates the scenario at assembly (forged scenarios rejected)"
affects:
  - "any future snapshot/persistence loader (02-* / Phase 6) — must parse scenarios through parseScenarioInputs"
tech-stack:
  added: []
  patterns:
    - "decStr-mirrored Zod .strict() boundary schema for the scenario half of the snapshot trust boundary"
    - "downPaymentPct half-open [0,1) guard via a decStr.refine boundary range-check (not money math)"
key-files:
  created:
    - "(none — engine-input.test.ts already existed; extended)"
  modified:
    - "packages/core/src/engine/engine-input.ts (ScenarioInputsSchema + parseScenarioInputs + validating engineInput)"
    - "packages/core/src/engine/engine-input.test.ts (accept-valid + reject-forged boundary tests)"
    - "packages/core/src/golden.test.ts (round-trip rebuilds through parseScenarioInputs, not a bare cast)"
    - "packages/core/src/index.ts (export ScenarioInputsSchema + parseScenarioInputs)"
    - "packages/core/src/engine/canary.test.ts (stub scenario -> valid full ScenarioInputs; Rule 1 deviation)"
decisions:
  - "[TCO]: ScenarioInputs is validated at the snapshot trust boundary by ScenarioInputsSchema (Zod .strict(), decStr leaves, positive-int counts, downPaymentPct in [0,1)), mirroring AssumptionSetSchema — CR-03 closed (T-07-01..04)"
  - "[TCO]: downPaymentPct's [0,1) range is enforced via decStr.refine(Number(s) >= 0 && < 1) — a pure boundary guard on the already-canonical string, documented as NOT money math"
  - "[TCO]: engineInput() parses the scenario through parseScenarioInputs at assembly; the golden round-trip rebuilds through it too (double-validated by design, loader-facing parse is the documented entry point)"
metrics:
  duration_min: 3
  completed: "2026-06-25"
  tasks: 2
  files: 5
---

# Phase 2 Plan 07: ScenarioInputs Trust-Boundary Validation (CR-03) Summary

Closed the CR-03 BLOCKER from 02-VERIFICATION.md: `ScenarioInputs` now crosses the snapshot trust boundary through a Zod `.strict()` schema (`ScenarioInputsSchema`) that mirrors the `assumptions/schema.ts` `decStr` discipline, with `parseScenarioInputs` as the sanctioned loader helper, `engineInput()` validating at assembly, and the golden round-trip rebuilding through a real parse instead of a bare `as ScenarioInputs` cast.

## What Was Built

- **`ScenarioInputsSchema`** (`engine-input.ts`): a `z.object({...}).strict()` mirroring the `ScenarioInputs` interface field-for-field. Dollar/rate fields (`price`, `annualRate`, `insuranceAnnual`, `hoaMonthly`, `monthlyRent`, optional `closingCostsOverride`/`otherOneTimeCosts`) are `decStr` — the SAME canonical-decimal-string validator `Money.of` and the AssumptionSet boundary use. `label`/`town` are `z.string().min(1)`. `termMonths`/`holdingYears` are `z.number().int().positive()`. `downPaymentPct` is `decStr` refined to the half-open interval `[0,1)`.
- **`parseScenarioInputs(input: unknown): ScenarioInputs`**: the boundary helper mirroring `parseAssumptionSet` — throws a Zod error on any forged/corrupt scenario.
- **Validating `engineInput()`**: replaced `Object.freeze({ ...parts.scenario })` with `Object.freeze(parseScenarioInputs(parts.scenario))` so a forged snapshot is rejected at assembly, not silently computed.
- **Golden round-trip closure**: `golden.test.ts` `roundTrip()` now rebuilds the scenario through `parseScenarioInputs(snapshot.scenario)` (the snapshot half goes through Zod exactly as the assumptions half goes through `parseAssumptionSet`), replacing the bare `as ScenarioInputs` cast.
- **Barrel exports**: `index.ts` now exports `ScenarioInputsSchema` and `parseScenarioInputs`.

## Forged Cases the Schema Rejects (reject-forged tests)

| Forged input | Why rejected |
|---|---|
| `holdingYears: -1`, `0`, `10.5` | counts must be positive integers (`z.number().int().positive()`) |
| `termMonths: 0`, `-360`, `360.5` | counts must be positive integers |
| `downPaymentPct: '1'` | `>= 1` would zero the loan (rejected by [0,1) refine) |
| `downPaymentPct: '1.5'` | `>= 1` would produce a NEGATIVE loan (T-07-02) |
| `downPaymentPct: '-0.1'` | `< 0` negative down payment |
| `price: '1,000'` | thousands separator — not a canonical decimal string (decStr) |
| `price: '1e6'` | exponent form — not canonical (decStr) |
| `annualRate: '0.06.5'` | double-dot — not canonical (decStr) |
| `insuranceAnnual: 'NaN'` | not canonical (decStr) |
| `closingCostsOverride: '1,000'` | optional field is still decStr-validated when present |
| `{ ...valid, smuggledField: 'evil' }` | unknown extra key — `.strict()` (T-07-03) |
| `label: ''` / `town: ''` | empty string — `.min(1)` |
| missing `price` | required field absent |

Accept-valid: the FIXED_SCENARIO-shaped object (and the same plus both optional one-time-cost fields) parses and deep-equals its input.

## downPaymentPct boundary representation

`downPaymentPct` is `decStr.refine((s) => { const n = Number(s); return n >= 0 && n < 1; }, 'downPaymentPct must be in [0,1)')`. The canonical-string contract is already enforced by `decStr` (regex), so the `.refine` is a pure BOUNDARY range-check on the already-canonical value — explicitly documented as NOT money math (no Dec/Money arithmetic at the schema layer). `'0'` and `'0.99'` accepted; `'1'`, `'1.5'`, `'-0.1'` rejected (T-07-02 negative-loan guard).

## Golden round-trip confirmation

The golden suite (canary + full TCO `computeTco` + `rentVsBuy`) recomputes **cent-identically WITHOUT `UPDATE_GOLDEN`** after switching the round-trip to `parseScenarioInputs`. Parsing a valid scenario is identity on the values, so no fixture changed — both the 02-06-regenerated `tco-golden-snapshot.json` and the canary `golden-snapshot.json` still match byte-for-byte.

## Phase Gate (VALIDATION.md)

- `npm test` (full core suite): **221 passed / 221**, green.
- `npx vitest run --coverage`: statements 98.88%, functions 98.21%, branches 91.35%, lines 98.85% — all above the gate (lines 95 / functions 95 / branches 90 / statements 95).
- `npm run typecheck` (`tsc -b`, all `*.type-test.ts` in the graph): passes.
- CR-03 boundary tests (accept-valid + reject-forged) present and green; golden round-trip parses through `parseScenarioInputs`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] canary.test.ts stub scenario broke under the new boundary validation**
- **Found during:** Task 2 (full `npm test` phase gate)
- **Issue:** `engine/canary.test.ts` constructed `engineInput({ ..., scenario: { label: 'canary' } })` — a partial scenario missing every required field. Once `engineInput()` validates the scenario through `ScenarioInputsSchema` (Task 1), those 6 canary tests threw `ZodError` (missing `price`, `annualRate`, `termMonths`, `holdingYears`, `town`, `insuranceAnnual`, `hoaMonthly`, `monthlyRent`). This was directly caused by this plan's change (Rule 1 scope).
- **Fix:** Introduced a `CANARY_SCENARIO` valid full `ScenarioInputs` constant and used it in both `fixedInput()` and the altered-assumptions case. `runCanary` reads only the `returns.realAnnual` assumption slice (scenario values are inert to the canary), so the canary results are unchanged and the golden canary fixture still matches.
- **Files modified:** `packages/core/src/engine/canary.test.ts`
- **Commit:** 3070ef8

Note: the same stub-scenario pattern in the pre-existing `engine-input.test.ts` was replaced as part of the Task 1 RED test rewrite (the file already existed; it was extended with the boundary tests and its `baseParts()` now uses a valid `VALID_SCENARIO`).

## TDD Gate Compliance

Task 1 (`tdd="true"`) followed RED -> GREEN:
- RED commit `a2e36a5` (`test(02-07): ...`) — boundary tests fail because `parseScenarioInputs`/`ScenarioInputsSchema` don't exist (`TypeError: parseScenarioInputs is not a function`).
- GREEN commit `355a4e2` (`feat(02-07): ...`) — schema + parse fn + validating `engineInput`; 29/29 pass.
- No REFACTOR needed.

## Known Stubs

None. (The `CANARY_SCENARIO` constant is a valid full scenario, not a stub — it feeds a determinism test whose result depends only on the assumption slice.)

## Self-Check: PASSED

- packages/core/src/engine/engine-input.ts — FOUND (ScenarioInputsSchema + parseScenarioInputs)
- packages/core/src/engine/engine-input.test.ts — FOUND (accept-valid + reject-forged)
- Commit a2e36a5 (RED) — FOUND
- Commit 355a4e2 (GREEN) — FOUND
- Commit 3070ef8 (round-trip + barrel + canary fix) — FOUND
- index.ts exports ScenarioInputsSchema + parseScenarioInputs — FOUND
- golden round-trip uses parseScenarioInputs (no bare cast) — FOUND
