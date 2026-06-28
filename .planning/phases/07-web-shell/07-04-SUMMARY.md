---
phase: 07-web-shell
plan: 04
subsystem: web-server-layer
tags: [nextjs, server-actions, dto, rsc-serialization, tornado, trajectory, town-heatmap, money-to-string, finiteness-guard]

# Dependency graph
requires:
  - phase: 07-01
    provides: "apps/web scaffold — jsdom Vitest project, eslint Number()-edge confinement (charts/** + lib/format.ts), transpilePackages, @/ path alias"
  - phase: 07-02
    provides: "@house/core fiTrajectory(input): FiTrajectoryResult — the month-by-month net-worth series (Money dollars, number|null markers) the trajectory action wraps"
  - phase: 07-03
    provides: "the thin validate→one-call→DTO Server-Action convention + buildEngineInput pattern + the Money→string DTO boundary (lib/dto/scenario.ts)"
  - phase: 04-fi-impact
    provides: "@house/core tornado(input): TornadoResult (finite swingMonths, discriminated FiOutcomes) + parse* Zod boundaries"
  - phase: 05-town-scoring-heatmap
    provides: "@house/core scoreTowns(input): TownScoreboard (decimal-string composite/budget, Bucket/MaFlag enums, explicit no-data) + the 05-UI-SPEC heatmap encoding contract"
provides:
  - "apps/web/src/lib/dto/sensitivity.ts — toTornadoDTO (plain discriminated FiOutcomes + boundary finiteness tripwire on swingMonths)"
  - "apps/web/src/lib/dto/trajectory.ts — toTrajectoryDTO (Money net-worth + threshold → decimal strings; FI markers number|null)"
  - "apps/web/src/lib/dto/town.ts — toScoreboardDTO (faithful pass-through preserving the 05-UI-SPEC bucket/composite/flags + explicit no-data markers)"
  - "apps/web/src/app/actions/towns.ts — scoreTownsAction ('use server', validates assumptions/budget/anchor, calls scoreTowns once)"
  - "apps/web/src/app/actions/sensitivity.ts — tornadoAction ('use server', validate→tornado→toTornadoDTO)"
  - "apps/web/src/app/actions/trajectory.ts — fiTrajectoryAction ('use server', validate→fiTrajectory→toTrajectoryDTO, feeds the D-07 chart)"
affects: [07-08, 07-09]

# Tech tracking
tech-stack:
  added: []
  patterns: [validate-through-core-zod-server-action, money-to-string-dto-boundary, boundary-finiteness-tripwire, faithful-passthrough-reconstruct-plain-objects, precompute-expensive-core-result-once-in-test, locked-allowlist-boundary-guard]

key-files:
  created:
    - apps/web/src/lib/dto/sensitivity.ts
    - apps/web/src/lib/dto/trajectory.ts
    - apps/web/src/lib/dto/sensitivity.test.ts
    - apps/web/src/lib/dto/town.ts
    - apps/web/src/app/actions/towns.ts
    - apps/web/src/app/actions/sensitivity.ts
    - apps/web/src/app/actions/trajectory.ts
  modified: []

key-decisions:
  - "toTornadoDTO adds a boundary FINITENESS TRIPWIRE — Number.isFinite(swingMonths) throws loud rather than letting an Infinity JSON.stringify to a silent null (FI-05 / L3). The core never emits one (an unreached endpoint contributes cappedAtMonth), so it never trips on valid input; it is a contract guarantee, not arithmetic"
  - "toTrajectoryDTO is the trajectory's single server-side Money.toDecimalString() site (mirroring lib/dto/scenario.ts) — net worth + fiThreshold cross as decimal strings; the lone float cast is deferred to the chart edge (Pitfall 5). Zero Number( tokens"
  - "toScoreboardDTO is a faithful pass-through (TownScoreboard carries no Money) that reconstructs PLAIN objects and preserves the EXPLICIT no-data markers (composite null, bucket null, missing:true) — never a silent 0/blank (05-UI-SPEC); no bucketing/composite arithmetic in the web layer (D-12)"
  - "towns.ts validates the active budget via Money.of (THROWS on a bare number / non-canonical string — T-7-01) and the commute anchor against a locked three-anchor allow-list (a boundary range guard, not scoring math); assumptions through parseAssumptionSet+migrate"
  - "buildEngineInput is inlined per-action (matching the scenarios.ts precedent) rather than extracted to a shared module not in the plan's file set"

requirements-completed: [SC-2, SC-3]

# Metrics
duration: ~10min
completed: 2026-06-28
---

# Phase 7 Plan 04: Towns + Sensitivity + Trajectory Server-Action Layer Summary

**The data-dense views' thin server endpoints: `scoreTowns`, `tornado`, and `fiTrajectory` each reach the UI only through a `'use server'` wrapper that validates input through the core Zod boundary, calls exactly ONE core entry, and maps to a plain DTO — the tornado swings cross as boundary-asserted FINITE numbers (no Infinity, FI-05), the trajectory dollars as decimal strings for the single chart-edge float cast (Pitfall 5), and the town heatmap as the locked 05-UI-SPEC encoding with explicit no-data markers preserved.**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-06-28T19:18Z
- **Completed:** 2026-06-28
- **Tasks:** 3 executed (Task 1 TDD red→green; Tasks 2-3 auto)
- **Files:** 7 created, 0 modified

## Accomplishments
- **Tornado + trajectory DTOs (Task 1, TDD):** `toTornadoDTO` reconstructs plain discriminated `FiOutcome`s and asserts every `swingMonths` finite at the boundary (FI-05 tripwire); `toTrajectoryDTO` maps each point's `buyNetWorth`/`rentNetWorth` and `fiThreshold` to canonical decimal strings via `Money.toDecimalString()` (zero `Number(` tokens — the float cast stays at the chart edge). FI markers pass through as `number | null`.
- **Tornado/trajectory boundary tests proven:** finite `swingMonths` for both reached AND unreached endpoints (the strained "don't buy" fixture, where naive `|high−low|` would risk `Infinity`); `JSON.stringify` does not throw and carries no `"Infinity"`; `topDrivers` ≤ 3; every trajectory dollar `typeof === 'string'`; `buyFiMonth` null on the unreached buy path; both DTOs JSON-round-trip deep-equal (no class instance survives).
- **Town heatmap DTO + action (Task 2):** `toScoreboardDTO` faithfully preserves the 05-UI-SPEC encoding (`Bucket` enum or null no-data, `[0,1]` decimal-string composite, `MaFlag` enums, the explainable per-metric `MetricContribution` breakdown recursing into amenities sub-metrics) with the explicit no-data markers intact. `scoreTownsAction` validates assumptions (`parseAssumptionSet`+`migrate`), the active budget (`Money.of`, throws on a bare number), and the anchor (locked allow-list), then calls `scoreTowns` exactly once.
- **Sensitivity + trajectory actions (Task 3):** `tornadoAction`/`fiTrajectoryAction` are thin `'use server'` parse→one-call→DTO wrappers (each calls its core entry exactly once; no perturbation/net-worth math in the web layer).
- **Verification:** `npx vitest run apps/web` 16 green; full monorepo suite **494 green** (+7 new); `eslint apps/web` exit 0; each action `'use server'` first-line, single core call, no `Number(` tokens.

## Task Commits

1. **Task 1 (RED): failing tornado finiteness + trajectory string-boundary tests** — `05d8390` (test)
2. **Task 1 (GREEN): tornado + trajectory DTO mappers** — `28c824d` (feat)
3. **Task 2: scoreTowns Server Action + town heatmap DTO** — `50a40e8` (feat)
4. **Task 3: tornado + fiTrajectory Server Actions** — `dba5fc0` (feat)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Precompute expensive core results once at module load (test perf)**
- **Found during:** Task 1 (GREEN)
- **Issue:** `tornado(STRAINED)` runs `fiImpact` ~13× to the horizon cap on an unreached path (~5s). Re-invoking it inside multiple tests blew the default per-test 5s timeout (2 tests timed out, 5 passed). The mapper — not the engine speed — is what's under test.
- **Fix:** Computed each `TornadoResult`/`FiTrajectoryResult` ONCE at module load (module eval is not bound by the per-test timeout); every test now maps an already-computed result. Test-only change; no production code affected.
- **Files:** apps/web/src/lib/dto/sensitivity.test.ts
- **Committed in:** 28c824d

**2. [Rule 3 - Trivial] Reworded two trajectory.ts comments to satisfy the literal grep acceptance**
- **Found during:** Task 1 (GREEN)
- **Issue:** The acceptance criterion is "grep finds no `Number(` in trajectory.ts". The eslint AST `Number()`-confinement guard already passed (it ignores comments), but two explanatory comments contained the literal token `Number()`.
- **Fix:** Reworded the comments to "float cast" / "float conversion" so even a naive `grep` is clean (now 0 matches). No behavior change.
- **Files:** apps/web/src/lib/dto/trajectory.ts
- **Committed in:** 28c824d

### Other small additions (within plan intent)
- The town DTO + tornado DTO each reconstruct PLAIN objects rather than passing the core shapes through by reference — a defense-in-depth guarantee that no method-bearing instance can ride the RSC boundary even if a core shape later evolves.
- `tornadoAction`/`fiTrajectoryAction` require a `household` in their raw payload (the cockpit always has a profile context, D-02; `tornado`/`fiTrajectory` need it via `buildFiPaths`).

**Total deviations:** 2 (both Rule 3 — one test-perf, one trivial comment reword)

## Deferred Issues
- **2 pre-existing `tsc --noEmit` errors in 07-03 test files** (`scenarios.test.ts:80`, `scenario.test.ts:109` — `noUncheckedIndexedAccess` on `rows[0]`). Surfaced only by a direct `npx tsc --noEmit -p apps/web/tsconfig.json`, which is NOT a project verification gate (apps/web uses `noEmit`; Next owns the build; the plan gates are `eslint apps/web` + `vitest run apps/web`, both green). Out of scope (predate 07-04); logged to `.planning/phases/07-web-shell/deferred-items.md`. My 7 new files produced zero tsc errors.

## Threat Model Coverage
- **T-7-01** (Tampering/DoS on towns/sensitivity/trajectory actions): every action validates raw input through `parseAssumptionSet`/`parseHousehold`/`parseScenarioInputs` (via `buildEngineInput`) or `Money.of`+anchor allow-list BEFORE any core call (D-16). Budget crosses as a decimal string (`Money.of` throws on a bare number), never a bare number.
- **T-7-04** (Money float-tamper / non-finite swings at the DTO edge): trajectory dollars cross as decimal strings (zero `Number(` tokens; the float cast is the chart's, Pitfall 5); the tornado mapper asserts `swingMonths` finite (FI-05) and the test proves `JSON.stringify` carries no `"Infinity"`.
- **T-7-06** (Information Disclosure on town no-data cells — accept): the explicit no-data markers (`composite: null`, `bucket: null`, `missing: true`) are preserved verbatim — never a silent 0.

## Known Stubs
None — all three actions are fully wired to real core calls; the DTOs surface genuine core outputs.

## Self-Check: PASSED
- All 7 created files verified present on disk.
- All 4 task commits (05d8390, 28c824d, 50a40e8, dba5fc0) verified in git log.
- `npx vitest run apps/web/src/lib/dto/sensitivity.test.ts` 7 green; `vitest run apps/web` 16 green; full suite 494 green; `eslint apps/web` exit 0.
- `grep 'Number(' trajectory.ts` → 0; each action `'use server'` first-line + single core call (tornado/fiTrajectory/scoreTowns each 1×).

---
*Phase: 07-web-shell*
*Completed: 2026-06-28*
