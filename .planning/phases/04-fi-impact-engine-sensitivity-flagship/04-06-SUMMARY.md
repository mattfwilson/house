---
phase: 04-fi-impact-engine-sensitivity-flagship
plan: 06
subsystem: fi
gap_closure: true
tags: [fi, equity, reconciliation, golden, correctness]
requires:
  - rentVsBuy equity-snapshot convention (rent-vs-buy.ts:242-253)
  - homeValueAt / amortizationSchedule primitives (tco)
provides:
  - buyEquityAt — a pure, exported, convention-pinned buy-path liquidated-equity helper
  - reconciled FI buy-path equity-year basis (agrees with rentVsBuy at year boundaries)
affects:
  - packages/core/src/fi/fi-impact.ts
tech-stack:
  added: []
  patterns:
    - "Extract the diverging closure to a module-level PURE exported helper so the convention is unit-pinned (a future blind re-sync fails CI)"
key-files:
  created: []
  modified:
    - packages/core/src/fi/fi-impact.ts
    - packages/core/src/fi/fi-impact.test.ts
decisions:
  - "Reconciliation option (a): align equityFor's home-value year with rentVsBuy (month 12 -> year 1) so the two instruments genuinely AGREE at boundaries — the stronger fix vs documenting a deliberate divergence"
  - "year = Math.max(0, Math.floor(month/12)): agrees with rentVsBuy's month/12 at every boundary, clamps month 0 to year 0 (closes IN-02), values months 1-11 at the just-passed year"
  - "FI golden left BYTE-IDENTICAL — the reconciliation did not move the fixed golden's buy-reached month (175), so no UPDATE_GOLDEN regen was performed"
metrics:
  duration: ~3min
  completed: 2026-06-26
  tasks: 1
  files: 2
  tests_added: 3
  suite: 355 green
---

# Phase 4 Plan 06: Reconcile equityFor Year Index (WR-01 / IN-02 / IN-04) Summary

Reconciled the FI buy-path liquidated-equity year convention with `rentVsBuy`'s year-boundary equity snapshot so the two money instruments genuinely agree at year boundaries, corrected the false "verbatim" in-file comments, and pinned the month-12 convention with a test — closing the last open gap (code-review WARNING WR-01, plus IN-02 and IN-04) in the shipped FI engine.

## What Changed

GAP 3 / WR-01 was a real correctness/maintenance trap in a money engine: `fi-impact.ts` `equityFor` valued the buy-path home at `year = Math.floor((month - 1) / 12)` (month 12 -> year 0, **no** appreciation), while `rentVsBuy`'s equity snapshot used `year = month / 12` (month 12 -> year 1, **one** year of appreciation). The in-file comments falsely claimed the logic was "verbatim from rent-vs-buy.ts 246-253," so a future maintainer "reconciling" them per the false comment could silently shift FI dates.

- **`buyEquityAt` extracted** (module-level, pure, exported): the buy-path liquidated home equity at a 1-based month = `(homeValueAt - schedule balance) x (1 - sellCostPct)`. Exporting it makes the convention unit-pinnable so a future blind re-sync of the two equity conventions fails CI (T-04-G4).
- **Home-value year reconciled** to `Math.max(0, Math.floor(month / 12))`:
  - month 12 -> year 1 — **agrees** with rentVsBuy's `month/12` at the boundary (the fix);
  - month 0 -> year 0 — never a NEGATIVE year (closes **IN-02**: projection.ts:85 seeds the month-0 check with `equityFor(0)`, which previously computed `floor(-1/12) = -1`);
  - months 1-11 -> year 0, months 13-23 -> year 1 — a sensible per-month value between boundaries.
- **Schedule-balance index `month - 1` unchanged** (it already agreed with rentVsBuy:249) — only the appreciation YEAR was diverging. Added a `month - 1 >= 0` lower-bound guard so the month-0 seed reads no schedule row (balance $0 = today's full equity).
- **Comments corrected** (IN-04): the "verbatim from rent-vs-buy.ts 246-253" / "the SAME" overclaims are replaced with an accurate statement — the FI path is the MONTHLY analogue of rentVsBuy's year-boundary snapshot, reconciled to share its valuation basis, explicitly "NOT a verbatim copy." A grep confirms zero false "verbatim" equity claims remain (only accurate negations).
- **Test pin added** (`fi-impact.test.ts`): three assertions lock the convention — month 12 -> year 1 (and strictly greater equity than the old year-0 basis, proving the fix bit), month 0 -> year 0 (no negative year), and the balance index stays `month - 1` at the boundary (must not regress).

## FI Golden: BYTE-IDENTICAL (no regeneration)

The plan flagged that the fix MAY shift the golden's buy-reached month if it straddled a year boundary. It did **not**. The golden test (`golden.test.ts`, FI golden) passes WITHOUT `UPDATE_GOLDEN=1`, and `git diff` on `fi-golden-snapshot.json` is empty:

- buy `{ kind: 'reached', month: 175 }`, baseline `{ month: 217 }`, `fiDeltaMonths: -42` — all **unchanged**.
- Rationale: the corrected (slightly higher) equity basis only changes the discrete reached month if month 175's crossing now lands earlier; for the fixed golden input it does not cross a year boundary in a way that moves the integer month. The convention change is correct AND a no-op for this fixture's reached months.

No silent/unexplained number change occurred; no other golden was touched (this plan does not alter assumptions).

## Deviations from Plan

None — plan executed exactly as written. The recommended option (a) reconciliation (`Math.max(0, Math.floor(month/12))`) was used and verified against rentVsBuy's `month/12` boundary basis before implementing.

## Verification

- `cd packages/core && npx tsc -b` -> exit 0 (clean).
- `npx vitest run src/fi/fi-impact.test.ts src/golden.test.ts src/fi` -> 59 passed (golden byte-identical, no regen).
- `npm test` (full suite) -> **355 passed** (+3 convention pins over the prior 352).
- `npx eslint src/fi/fi-impact.ts src/fi/fi-impact.test.ts` -> 0 errors.
- `grep "verbatim" src/fi/fi-impact.ts` -> only accurate "NOT a verbatim copy" negations remain (0 false equity claims).

## Acceptance Criteria

- [x] equityFor year-index reconciled to a single deliberate convention that agrees with rentVsBuy at year boundaries; false "verbatim" comments corrected; year clamped >= 0 (IN-02 closed).
- [x] A test pins the buy path's month-12 home value (year 1), locking the convention against future silent drift.
- [x] FI golden byte-identical (no UPDATE_GOLDEN regen needed; buy month 175 unchanged) — no silent number change.
- [x] fi suite green; full `npm test` green (355); tsc -b + eslint clean on touched files.
- [x] Task committed atomically (RED `0c9a352` + GREEN `94d328d`); did NOT commit `04-PATTERNS.md`.

## Self-Check: PASSED

- FOUND: packages/core/src/fi/fi-impact.ts (modified, buyEquityAt present)
- FOUND: packages/core/src/fi/fi-impact.test.ts (3 convention pins)
- FOUND commit 0c9a352 (RED test)
- FOUND commit 94d328d (GREEN implementation)
- FI golden unchanged (git diff empty)
