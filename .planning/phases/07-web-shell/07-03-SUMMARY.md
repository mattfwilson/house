---
phase: 07-web-shell
plan: 03
subsystem: web-server-layer
tags: [nextjs, server-actions, dto, rsc-serialization, zod-boundary, money-to-string, persistence, profile-crud]

# Dependency graph
requires:
  - phase: 07-01
    provides: "apps/web scaffold — container.server singleton, jsdom Vitest project, eslint client-leak + Number()-edge guards, transpilePackages"
  - phase: 06-persistence-listings-adapter
    provides: "@house/app services (computeAndSaveScenario/loadScenario/list/delete, saveProfile/listProfiles) + makeContainer Container port"
  - phase: 04-fi-impact
    provides: "@house/core compareScenarios/evaluateScenario/affordabilityGap/fiImpact result types (Money-bearing) + parse* Zod boundaries"
provides:
  - "apps/web/src/lib/dto/* — the Money→string DTO boundary (toCompareDTO/toEvaluateDTO/toGapDTO/toFiImpactDTO/toProfileDTO); the single server-side Money.toDecimalString() site"
  - "apps/web/src/app/actions/scenarios.ts — recompare/evaluate/gap + compute-save/load/list/delete Server Actions (thin validate→one-call→DTO)"
  - "apps/web/src/app/actions/profiles.ts — saveProfile/listProfiles/deleteProfile Server Actions + maxProfilesAction display getter"
  - "@house/core + @house/app profile-delete capability — ProfileRepository.delete (port + SQLite + in-memory + type-test) + deleteProfile service (consumed by deleteProfileAction and downstream 07-11)"
affects: [07-04, 07-05, 07-06, 07-07, 07-08, 07-09, 07-11]

# Tech tracking
tech-stack:
  added: []
  patterns: [validate-through-core-zod-server-action, money-to-string-dto-boundary, flatten-fiOutcome-union-for-table, injected-container-for-action-tests, lazy-container-import-avoids-server-only-in-test, per-file-node-env-for-persistence-tests]

key-files:
  created:
    - apps/web/src/lib/dto/scenario.ts
    - apps/web/src/lib/dto/scenario.test.ts
    - apps/web/src/lib/dto/profile.ts
    - apps/web/src/app/actions/scenarios.ts
    - apps/web/src/app/actions/scenarios.test.ts
    - apps/web/src/app/actions/profiles.ts
  modified:
    - apps/web/vitest.config.ts
    - packages/core/src/ports/repositories.ts
    - packages/core/src/types/persistence.type-test.ts
    - packages/app/src/services/profile-service.ts
    - packages/app/src/adapters/persistence/profile-repo.ts
    - packages/app/src/adapters/persistence/in-memory-repos.ts
    - packages/app/src/index.ts

key-decisions:
  - "The Money→string DTO mapper is the ONE server-side site calling Money.toDecimalString(); never a money float-cast (Pitfall 5, eslint-confined to charts/** + lib/format.ts)"
  - "The bank-vs-true gap framing (Test 3 / SC-4) lives on AffordabilityGapResult, not EvaluateScenarioResult — added toGapDTO (+ gapAction); toEvaluateDTO is a separate pass-through of the report"
  - "deleteProfileAction required a profile-delete capability the persistence stack lacked — added ProfileRepository.delete symmetric to ScenarioRepository.delete (port/SQLite/in-memory/type-test/service)"
  - "Persistence-backed action tests pinned to the node env via the @vitest-environment docblock (the web project defaults to jsdom, under which @house/app's sqlite migrator fileURLToPath(import.meta.url) throws)"
  - "Actions take an optional injected Container (default = lazy server-only singleton import) so tests use a :memory: container without eagerly importing server-only"

requirements-completed: [SC-1, SC-2, SC-4]

# Metrics
duration: ~12min
completed: 2026-06-28
---

# Phase 7 Plan 03: Scenario + Profile Server-Action Layer Summary

**The thin `'use server'` contract for the cockpit: every action validates raw client input through the existing core Zod schemas (D-16), calls exactly ONE `@house/core`/`@house/app` entry point, and maps every `Money`/`Decimal` field to a string via a dedicated DTO mapper before returning a plain serializable object — keeping `Money` off the client, preserving the anti-funnel ranking, and proving save/reload reproducibility.**

## Performance

- **Duration:** ~12 min
- **Completed:** 2026-06-28
- **Tasks:** 3 executed (Tasks 1-2 TDD red→green; Task 3 auto)
- **Files:** 6 created + 7 modified

## Accomplishments
- DTO boundary (`lib/dto/scenario.ts` + `profile.ts`): `toCompareDTO` (flattens the discriminated `FiOutcome` + preserves the FI-06 ranking — baseline row 0, unreached rows last), `toFiImpactDTO` (the four `Money` FI targets → strings), `toGapDTO` (signed gap + ceilings → strings, verdict enum — SC-4), `toEvaluateDTO`/`toProfileDTO` (already-string pass-throughs). The ONLY server-side `Money.toDecimalString()` site; zero `Number(` tokens.
- Scenario actions (`app/actions/scenarios.ts`): `recompareAction`/`evaluateAction`/`gapAction` (one pure core call each) + `computeAndSaveScenarioAction`/`loadScenarioAction`/`listScenariosAction`/`deleteScenarioAction` (thin `@house/app` service wrappers). First line `'use server'`; no dollar arithmetic.
- Profile actions (`app/actions/profiles.ts`): `saveProfileAction`/`listProfilesAction`/`deleteProfileAction` + `maxProfilesAction` (the cap surfaced for display only — never re-checked; the ≤2 invariant stays in `saveProfile`).
- Boundary tests proven: DTO JSON-round-trip deep-equality + no-Money-instance (Pitfall 1); ranking preserved (FI-06); D-16 invalid-input rejection at the Zod parse (bare-number money → `ZodError`, engine never reached); PROF-04 snapshot replay (reloaded DTO deep-equals saved, frozen snapshot not re-joined).
- Profile-delete persistence capability added (port + SQLite + in-memory + type-test guard + service + barrel) — symmetric to scenarios; consumed by `deleteProfileAction` and required by downstream 07-11.
- Full monorepo suite **487 green** (+8); `tsc -b` core+app exit 0 (type-test guard intact); `npx eslint apps/web` + touched core/app files exit 0; goldens byte-identical (no regen).

## Task Commits

1. **Task 1 (RED): failing DTO serializability/ranking/gap tests** — `e7a2b4b` (test)
2. **Task 1 (GREEN): DTO mappers** — `f6f9ff9` (feat)
3. **Task 2 (RED): failing scenario-action tests (D-16 + PROF-04)** — `ed01cad` (test)
4. **Task 2 (GREEN): scenario Server Actions** — `5f714fe` (feat)
5. **Task 3: profile Server Actions + profile-delete persistence capability** — `15c3d7e` (feat)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Plan inconsistency] Gap framing lives on `AffordabilityGapResult`, not `EvaluateScenarioResult`**
- **Found during:** Task 1
- **Issue:** Behavior Test 3 asks `toEvaluateDTO` to expose "the bank-vs-true gap as a string + the verdict enum", but `EvaluateScenarioResult` carries no gap and no `Money` (its fields are all decimal-string ratios + booleans). The signed gap + directional verdict + `Money` ceilings live on `AffordabilityGapResult` (gap.ts), which the plan also lists in `read_first` and which SC-4 ("bank gap as warning") targets.
- **Fix:** Implemented the gap-framing mapper as `toGapDTO(r: AffordabilityGapResult)` (Test 3 asserts against it) and kept `toEvaluateDTO(r: EvaluateScenarioResult)` as a separate plain pass-through. Added `gapAction` (→ `affordabilityGap` → `toGapDTO`) so SC-4 has a wired one-call action.
- **Files:** apps/web/src/lib/dto/scenario.ts, apps/web/src/app/actions/scenarios.ts, scenario.test.ts
- **Committed in:** f6f9ff9, 5f714fe

**2. [Rule 2 - Missing critical functionality] Profile-delete capability absent from the persistence stack**
- **Found during:** Task 3
- **Issue:** The plan requires `deleteProfileAction` (and downstream 07-11 wires a profile delete button to it), but `ProfileRepository` had no `delete` method and `@house/app` exposed no `deleteProfile` service — only `ScenarioRepository`/`scenario-service` did. A thin wrapper had nothing to call; a throwing stub would ship a broken 07-11 delete affordance.
- **Fix:** Added `ProfileRepository.delete(id)` to the core port (mirroring `ScenarioRepository.delete`), implemented it in `SqliteProfileRepository` (DELETE on the existing `profiles` table — no migration) and `InMemoryProfileRepository`, added the missing `delete` arm to `persistence.type-test.ts`'s `_asyncRepo` literal (else `tsc -b` fails), and exported a `deleteProfile` service. `deleteProfileAction` is a true thin wrapper over it.
- **Note:** This touches the Phase-6 "locked" core port — a deliberate, minimal, symmetric CRUD completion (no new table, no new service layer). FK is RESTRICT, so deleting a profile that still owns scenarios surfaces a constraint error (caller deletes scenarios first).
- **Files:** packages/core/src/ports/repositories.ts, packages/core/src/types/persistence.type-test.ts, packages/app/src/adapters/persistence/profile-repo.ts, packages/app/src/adapters/persistence/in-memory-repos.ts, packages/app/src/services/profile-service.ts, packages/app/src/index.ts
- **Verification:** tsc -b core+app exit 0; full suite 487 green (contract + golden tests intact)
- **Committed in:** 15c3d7e

**3. [Rule 3 - Blocking] Persistence-backed action test needs the node env (web project defaults to jsdom)**
- **Found during:** Task 2
- **Issue:** The `:memory:` container constructs `@house/app`'s sqlite migrator, whose `fileURLToPath(new URL('../../../drizzle', import.meta.url))` throws `The URL must be of scheme file` under the web project's jsdom environment.
- **Fix:** Added `// @vitest-environment node` to `scenarios.test.ts` — persistence/action tests need no DOM and belong in node (jsdom stays the default for the upcoming component tests).
- **Committed in:** ed01cad

**4. [Rule 3 - Infra] `@/` path alias for Vitest**
- **Found during:** Task 2
- **Issue:** Action/DTO modules use the Next `@/*` → `./src/*` path alias, but the per-project Vitest config (which cannot inherit the root) had no matching `resolve.alias`, so `@/app/actions/...` / `@/lib/...` failed to resolve in tests.
- **Fix:** Added `resolve.alias { '@': ./src }` to `apps/web/vitest.config.ts`, mirroring the tsconfig path.
- **Committed in:** ed01cad

### Other small additions (within plan intent)
- `gapAction` (SC-4 — one call to `affordabilityGap`) and `maxProfilesAction` (a `'use server'` module may export only async functions, so `MAX_PROFILES` is surfaced as an async getter for display copy).
- Actions accept an optional injected `Container` (default = lazy `container.server` import) — the plan-sanctioned `:memory:` injection path, which also avoids eagerly importing `server-only` in a Vitest worker.

**Total deviations:** 4 (1 plan-inconsistency fix, 1 missing-functionality add, 2 blocking/infra)

## Threat Model Coverage
- **T-7-01** (Tampering/DoS on recompare/evaluate/save): every action validates raw input through `parseAssumptionSet`/`parseHousehold`/`parseScenarioInputs` (via `buildEngineInput`) or `parseProfile` BEFORE any engine/persistence call — proven by the D-16 invalid-input rejection test.
- **T-7-04** (Money float-tamper at the DTO edge): the DTO mapper converts `Money`→string server-side; zero `Number(` tokens; the serializability test proves no class instance crosses (a `Money` would `JSON.stringify` to `{}` and fail the deep-equal).
- **T-7-03** (forged snapshot on load): inherited from `@house/app` — the SQLite adapter re-parses every snapshot leaf on load; the replay test confirms reloaded == saved and the action does not mutate the snapshot.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: destructive-endpoint | apps/web/src/app/actions/profiles.ts | `deleteProfileAction(id)` is a new public POST that removes a profile by id (no body to Zod-parse — id only). Referential safety rests on the scenarios→profiles FK (RESTRICT). A future auth/ownership-check belongs here if multi-user is ever introduced. |

## Known Stubs
None — all actions are fully wired to real core/service calls; `maxProfilesAction` returns the real `MAX_PROFILES` constant.

## Self-Check: PASSED
- All 6 created files verified present on disk; 7 modified files staged + committed.
- All 5 task commits (e7a2b4b, f6f9ff9, ed01cad, 5f714fe, 15c3d7e) verified in git log.
- `npx vitest run apps/web/src/lib/dto` (5) + `apps/web/src/app/actions/scenarios.test.ts` (3) green; full suite 487 green; `tsc -b` + `eslint apps/web` exit 0.
- `scenarios.ts` first line is `'use server'`; no `Number(`/`.mul(`/`.add(` in it; gap+verdict+Money-string proven by toGapDTO test.

---
*Phase: 07-web-shell*
*Completed: 2026-06-28*
