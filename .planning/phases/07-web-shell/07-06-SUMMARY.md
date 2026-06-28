---
phase: 07-web-shell
plan: 06
subsystem: web-client-state
tags: [zustand, ephemeral-ui-state, working-set, freeze-on-save, debounce, latest-wins, race-safety, prof-04]

# Dependency graph
requires:
  - phase: 07-01
    provides: "apps/web scaffold — 'web' jsdom Vitest project + eslint client-tier import guards (store/** banned from @house/app + container.server) + Number() display-edge confinement"
  - phase: 07-03
    provides: "computeAndSaveScenarioAction (the SINGLE freeze-on-save site the working-set store must NOT duplicate) + the AssumptionSet DTO shape recompute feeds"
provides:
  - "apps/web/src/store/working-set.ts — shared working AssumptionSet store (loadFrozenSet + updateKnob); plain decimal-string DTO, never Money; NO auto-persist (PROF-04/T-7-08)"
  - "apps/web/src/store/selection.ts — active profile/scenario + inline-expanded row (D-03) + comparison-set ephemeral state"
  - "apps/web/src/store/recompute.ts — createRecomputeStore factory + useRecompute: ~300ms debounce buffer + monotonic request-id latest-wins guard (D-08/Pitfall 6/T-7-09)"
affects: [07-07, 07-08, 07-09]

# Tech tracking
tech-stack:
  added: []
  patterns: [zustand-ephemeral-store-no-persistence, type-only-core-import-in-client-tier, flush-time-requestid-bump-for-debounce-coalescing, monotonic-latest-wins-settle-guard, injectable-recompute-thunk, isolated-store-factory-for-unit-tests]

key-files:
  created:
    - apps/web/src/store/working-set.ts
    - apps/web/src/store/selection.ts
    - apps/web/src/store/recompute.ts
    - apps/web/src/store/recompute.test.ts
  modified: []

key-decisions:
  - "The working-set store performs ZERO persistence (PROF-04/T-7-08) — loadFrozenSet is a one-way READ of a saved snapshot into ephemeral state; freeze-on-save stays the sole responsibility of computeAndSaveScenarioAction (07-03). Grep gate confirms no save call-expression in store/*."
  - "The monotonic request id is bumped at debounce-FLUSH time, not call time, so a burst of knob edits coalesces to ONE issued id (debounce test) while two genuinely separate recomputes still get distinct ids for the latest-wins guard (race test)."
  - "settle(resultId, result) applies a result ONLY if resultId === the current requestId — a stale out-of-order resolution is dropped (Pitfall 6/T-7-09), proven by an id-N-resolves-after-id-N+1 test."
  - "The recompute call is injected as a thunk (requestRecompute(fn)) so the coordinator is engine-agnostic and unit-testable without a server; createRecomputeStore is a factory (own timer + pending thunk per instance) so tests spin up isolated coordinators."
  - "Only a TYPE (AssumptionSet) is imported from @house/core into the client-tier store — no value, no native dep crosses into the client bundle (defense-in-depth alongside the eslint store/** import ban)."

requirements-completed: [SC-1, SC-2]

# Metrics
duration: ~6min
completed: 2026-06-28
---

# Phase 7 Plan 06: Ephemeral Client-State Layer (Working Set + Selection + Recompute) Summary

**The Zustand substrate for the live cockpit loop: one shared working AssumptionSet that loads from a saved scenario's frozen snapshot and is NEVER auto-persisted back on navigation (D-09/PROF-04/T-7-08), the selection/expansion state for the comparison (D-03), and a ~300ms-debounced recompute coordinator whose monotonic request-id latest-wins guard discards stale out-of-order results (D-08/Pitfall 6/T-7-09).**

## Performance

- **Duration:** ~6 min
- **Completed:** 2026-06-28
- **Tasks:** 2 executed (Task 1 auto; Task 2 TDD red→green)
- **Files:** 4 created + 0 modified

## Accomplishments
- `working-set.ts`: the shared working `AssumptionSet` store (`loadFrozenSet(snapshot)` replaces the set when a saved scenario opens; `updateKnob(path, value)` immutably sets one nested decimal-string leaf with structural sharing; `selectWorkingSet` read selector). Held in the plain decimal-string DTO form the core boundary already uses — a type-only `AssumptionSet` import, never a `Money` instance. Documented and grep-proven to perform NO persistence (PROF-04/T-7-08).
- `selection.ts`: active `profileId`/`scenarioId` (header switchers, D-02), single inline-`expandedScenarioId` with a `toggleExpanded` (D-03 inline expand/collapse), and the `comparedScenarioIds` comparison set — pure ephemeral UI state, no persistence.
- `recompute.ts`: `createRecomputeStore` factory (+ the app-wide `useRecompute` instance) with a `requestId` counter, a `pending` flag, a `~300ms` (`DEBOUNCE_MS`) debounce buffer, an injectable `requestRecompute(fn)`, and a `settle(resultId, result)` that applies a result only when `resultId` is still the latest id.
- `recompute.test.ts` (2 tests, green): latest-wins (id-N resolves AFTER id-N+1 → N discarded, N+1 kept) via manually-ordered deferred promises; debounce coalescing (3 rapid calls → one issued request id, fn called once) via fake timers.

## Task Commits

1. **Task 1: working-set + selection ephemeral stores** — `04da11e` (feat)
2. **Task 2 (RED): failing latest-wins + debounce specs** — `d750aa8` (test)
3. **Task 2 (GREEN): debounced race-safe recompute coordinator** — `ffaf7ef` (feat)

## TDD Gate Compliance
Task 2 followed RED→GREEN: `d750aa8` (test, module absent → fails) precedes `ffaf7ef` (feat, both specs pass). No REFACTOR commit needed (implementation landed clean). RED was confirmed by running the test before the implementation existed (transform error: `recompute.ts` not found), and GREEN by `2 passed`.

## Deviations from Plan

None — both tasks executed exactly as written. No Rule 1–4 deviations; no architectural changes; no auth gates.

## Threat Model Coverage
- **T-7-08** (working-set auto-persist breaking PROF-04): the working-set store performs NO persistence — `loadFrozenSet` is a one-way read; `updateKnob` mutates only ephemeral state. Grep gate confirms no `computeAndSaveScenario`/`saveProfile` call-expression and no `@house/app`/`container.server` import in `store/*` (the only textual match is a comment documenting the invariant).
- **T-7-09** (out-of-order recompute results): the monotonic request-id latest-wins guard in `settle` discards a stale resolution; proven by the id-N-after-id-N+1 test (`result` stays `'NEW'` when the older `'STALE'` lands late).

## Known Stubs
None — all three stores are fully functional. The recompute coordinator's call is an injected thunk by design (engine-agnostic); 07-07 wires the assumptions rail + the `recompareAction`/`trajectoryAction` Server Actions into it, and 07-08 consumes the working-set/selection stores in the cockpit. These are integration seams, not stubs (no hardcoded/empty data flows to a UI here).

## Deferred Issues
- The 07-06 acceptance gate `npx tsc -p apps/web/tsconfig.json --noEmit` exits 1 SOLELY because of two pre-existing `TS2532` errors in 07-03 test files (`scenarios.test.ts:80`, `scenario.test.ts:109`) — already logged under 07-04 in `deferred-items.md` and out of scope (this plan is directed to touch `apps/web/src/store/*` only; prior-plan files are locked). The 07-06 store files contribute ZERO type errors (`grep "store/"` finds none in the tsc output) and `npx eslint apps/web/src/store` exits 0. Re-confirmed in `deferred-items.md` under a "From plan 07-06" note.

## Verification Evidence
- `npx vitest run apps/web/src/store` → **2 passed** (latest-wins + debounce).
- `npx eslint apps/web/src/store` → exit 0 (client-tier import guards + Number() ban satisfied; only `zustand` value imports + a type-only `@house/core` import).
- Persistence grep gate → NO save call-expression, NO `@house/app`/`container.server` import in `store/*`.
- `npx tsc -p apps/web/tsconfig.json --noEmit` → the only errors are the two pre-existing deferred 07-03 ones; zero in `store/*`.

## Self-Check: PASSED
- All 4 created files verified present on disk (`working-set.ts`, `selection.ts`, `recompute.ts`, `recompute.test.ts`).
- All 3 task commits (`04da11e`, `d750aa8`, `ffaf7ef`) verified in git log.
- Recompute test re-run green (2 passed); store eslint exit 0; persistence grep gate clean.

---
*Phase: 07-web-shell*
*Completed: 2026-06-28*
