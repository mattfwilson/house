---
phase: quick-260625-k0h
plan: 01
subsystem: testing
tags: [tco, pmi, rent-vs-buy, decimal, vitest, golden-master]

# Dependency graph
requires:
  - phase: 02-tco-engine
    provides: TcoBreakdown / computeTco / buyMonthlyOutflowAt / rentVsBuy + the gated golden snapshot
provides:
  - "Explicit TcoBreakdown.pmiApplies:boolean disambiguating 'no PMI' from 'PMI that never terminates'"
  - "Exported pure predicate shouldChargePmi(pmiApplies, pmiDropOffMonth, month)"
  - "buyMonthlyOutflowAt PMI gating that agrees with tco.pmi.annualized (CR-01 closed)"
affects: [affordability, fi-impact, rent-vs-buy]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Seam-level RED test for an end-to-end-unreachable latent defect (predicate extracted + tested at its seam)"

key-files:
  created: []
  modified:
    - packages/core/src/tco/tco.ts
    - packages/core/src/tco/rent-vs-buy.ts
    - packages/core/src/tco/rent-vs-buy.test.ts
    - packages/core/src/__fixtures__/tco-golden-snapshot.json

key-decisions:
  - "pmiApplies is an explicit flag on TcoBreakdown rather than overloading a null pmiDropOffMonth — a null drop-off now means 'PMI applies but never terminates within the term' (charged whole hold)"
  - "CR-01 is reproduced at the shouldChargePmi seam (the applies=true/dropOff=null state is unreachable through computeTco because amortization always reconciles to a $0.00 final balance, yielding a finite drop-off)"
  - "Golden snapshot change is a single additive key (pmiApplies:false for the 20%-down fixture) — zero change to any cents/winner/dropOff/net-worth field"

patterns-established:
  - "Predicate-at-the-seam testing: when a defect is unreachable end-to-end, extract the decision into a pure exported predicate and lock it with exact-equality unit tests"

requirements-completed: [CR-01]

# Metrics
duration: 8min
completed: 2026-06-25
---

# Phase quick-260625-k0h Plan 01: Fix pmiApplies Flag Summary

**Closed the `pmiDropOffMonth = null` ambiguity by adding an explicit `TcoBreakdown.pmiApplies` flag and a pure `shouldChargePmi` predicate, so the rent-vs-buy buy outflow now charges PMI for the entire hold when PMI applies but never drops off — matching `tco.pmi.annualized` and removing a latent BUY bias (CR-01).**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-06-25T14:29:00Z
- **Completed:** 2026-06-25T14:32:00Z
- **Tasks:** 3 completed
- **Files modified:** 4

## Accomplishments

- **RED (Task 1):** Added a `describe('PMI charge gating distinguishes the two null states (CR-01)')` block to `rent-vs-buy.test.ts` with six exact-equality (`.toBe`) cases. The three `shouldChargePmi(true, null, ...)` cases were the RED ones — they failed with `shouldChargePmi is not a function` before the fix. The 17 pre-existing rent-vs-buy tests stayed green throughout.
- **GREEN (Task 2):** Added `readonly pmiApplies: boolean` to `TcoBreakdown` (documented as true exactly when origination LTV > 80% / down payment < 20%, independent of drop-off), populated it from `pmiResult.applies` in `computeTco`, added the exported pure predicate `shouldChargePmi(pmiApplies, pmiDropOffMonth, month) => pmiApplies && (pmiDropOffMonth === null || month <= pmiDropOffMonth)`, and replaced the inline guard in `buyMonthlyOutflowAt` with a call to it. All money stayed `Money`; all rate math stayed `Dec` — no computation changed.
- **Golden (Task 3):** Regenerated `tco-golden-snapshot.json` via the gated `npm run update-golden` (UPDATE_GOLDEN=1). The diff is exactly one additive key `"pmiApplies":false` inserted in sorted position between `pmi` and `pmiDropOffMonth` (the committed Newton $450k @ 20%-down fixture has no PMI). The canary `golden-snapshot.json` was untouched.

## PMI surface agreement (CR-01 closed)

Both PMI surfaces now agree that PMI which applies but never terminates within the term is charged for the whole hold:

- `tco.pmi.annualized` already used `Math.min(dropOffMonth ?? totalMonthsHeld, totalMonthsHeld)` — i.e. a null drop-off meant "charge the whole hold".
- `buyMonthlyOutflowAt` previously gated on `pmiDropOffMonth !== null && month <= pmiDropOffMonth`, which returned `false` for a null drop-off and silently charged $0 PMI for the entire hold — biasing the rent-vs-buy verdict toward BUY. It now gates on `shouldChargePmi(tco.pmiApplies, tco.pmiDropOffMonth, month)`, matching the annualized semantics.

## Deviations from Plan

None — plan executed exactly as written. The plan's pre-work finding (that the `applies=true / dropOff=null` state is unreachable through `computeTco`, so the RED test must target the `shouldChargePmi` seam rather than a full `rentVsBuy` run, and that the golden fixture diff is an additive key) was accurate and confirmed against the committed fixture.

## Verification

- `cd packages/core && npx vitest run src/tco/rent-vs-buy.test.ts` → RED confirmed before fix (6 failed: `shouldChargePmi is not a function`), GREEN after (all pass).
- `npx vitest run src/tco/rent-vs-buy.test.ts src/tco/tco.test.ts src/tco/pmi.test.ts` → 40 passed (no regressions).
- `git diff --word-diff` on the golden fixture → single inserted token `"pmiApplies":false,`; all cents/winner/dropOff/net-worth fields byte-identical.
- Final gates: `npm test` → 227 passed (20 files); `npm run typecheck` (`tsc -b`) → clean.

## Commits

- `d4d0ac2` test(quick-260625-k0h): add failing pmiApplies gating-predicate test (CR-01 RED)
- `670c74a` fix(quick-260625-k0h): add pmiApplies to TcoBreakdown, re-gate buy PMI (CR-01 GREEN)
- `836775e` test(quick-260625-k0h): regenerate golden snapshot (additive pmiApplies key)

## Self-Check: PASSED

- FOUND: packages/core/src/tco/tco.ts (pmiApplies field + population)
- FOUND: packages/core/src/tco/rent-vs-buy.ts (shouldChargePmi export + gating)
- FOUND: packages/core/src/tco/rent-vs-buy.test.ts (CR-01 describe block)
- FOUND: packages/core/src/__fixtures__/tco-golden-snapshot.json (additive pmiApplies:false)
- FOUND commit: d4d0ac2 (RED)
- FOUND commit: 670c74a (GREEN)
- FOUND commit: 836775e (golden)
