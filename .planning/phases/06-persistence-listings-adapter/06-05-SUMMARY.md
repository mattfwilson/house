---
phase: 06-persistence-listings-adapter
plan: 05
subsystem: persistence
tags: [drizzle-orm, better-sqlite3, repository, ports-and-adapters, canonical-json, reproducibility, frozen-snapshot, contract-test]

# Dependency graph
requires:
  - phase: 06-01
    provides: "ScenarioRepository/ProfileRepository ports + SavedScenario/Profile domain types the adapters implement"
  - phase: 06-03
    provides: "drizzle schema (nine-leaf profiles + scenarios) + openDb/runMigrations/Db factory the adapters query"
provides:
  - "SqliteScenarioRepository — canonicalJson blob SAVE + Zod-validated LOAD over the scenarios table (the golden roundTrip promoted to production)"
  - "SqliteProfileRepository — nine-leaf canonical-decimal round-trip with parseProfile-revalidated load + count() for the service guard"
  - "InMemoryScenarioRepository + InMemoryProfileRepository fakes honoring the same ports (frozen-snapshot fidelity via blob round-trip)"
  - "serializeSnapshot/deserializeSnapshot exported helpers (the shared save/load codec, used by both the SQLite adapter and the fake)"
  - "ONE repositoryContract factory proving both implementations adapter-agnostic incl. byte-identity round-trip + frozen-household + PROF-03 fresh-connection reload"
affects: [06-06, container, scenario-service, profile-service]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Repository SAVE serializes the frozen EngineInput via canonicalJson into a TEXT blob; LOAD re-parses EVERY leaf through the existing Zod boundary parsers (never an `as` cast) — golden.test.ts roundTrip promoted to production"
    - "Frozen self-contained snapshot: LOAD rebuilds solely from the blob and never re-joins the live owning-profile row (PROF-04 / Pitfall 7)"
    - "ONE shared contract factory invoked against the real adapter AND an in-memory fake — the dependency-inversion proof; byte-identity via plain expect().toBe(), never an auto-blessing snapshot matcher"
    - "Defense-in-depth on read: profile rows re-validated through parseProfile on load (the DB is never blindly trusted)"
    - "In-memory fakes store the canonical-JSON blob (not the live object) so a later external mutation cannot retroactively change a stored scenario — byte-identical frozen semantics to the TEXT-blob DB"

key-files:
  created:
    - packages/app/src/adapters/persistence/scenario-repo.ts
    - packages/app/src/adapters/persistence/profile-repo.ts
    - packages/app/src/adapters/persistence/in-memory-repos.ts
    - packages/app/src/adapters/persistence/repository-contract.test.ts
  modified: []

key-decisions:
  - "serializeSnapshot/deserializeSnapshot extracted as exported helpers from scenario-repo.ts so the SQLite adapter and the InMemory fake share ONE codec — the fake cannot drift from the real save/load path"
  - "Profile timestamps sourced from an injectable shell clock (constructor `now: () => number`, default Date.now) because the locked Profile port carries no timestamps and the schema columns are NOT NULL; the app shell owns the clock (sanctioned by the 06-03 schema decision), and the clock is injectable so tests are deterministic"
  - "repositoryContract takes a single `makeRepos: () => {scenarioRepo, profileRepo}` (not two independent makers) so the SQLite arm's two adapters share ONE migrated db — required for the FK and the meaningful frozen-household-after-edit test"
  - "Contract tests seed the owning profile before saving scenarios — the SQLite arm enforces a real FOREIGN KEY constraint (a scenario without an owning profile is not a valid domain state); seeding is harmless for the fake, keeping the contract symmetric"
  - "PROF-03 fresh-connection reload uses a real file-backed DB opened twice (a `:memory:` DB is per-connection); connections closed via `db.$client.close()` before temp cleanup (Windows file lock)"

patterns-established:
  - "Repository contract-factory pattern: one describe-factory run against the real adapter + a fake, byte-identity asserted with plain toBe — the persistence analog of the core golden harness"

requirements-completed: [PROF-01, PROF-02, PROF-03]

# Metrics
duration: 9min
completed: 2026-06-28
---

# Phase 06 Plan 05: SQLite Repository Adapters + Shared Contract Summary

**The persistence ports are now implemented and PROVEN adapter-agnostic: `SqliteScenarioRepository` serializes the frozen `EngineInput` snapshot via `canonicalJson` into the `scenarios.snapshot` TEXT blob and reloads it by re-validating every leaf through the existing Zod parsers (the `golden.test.ts` `roundTrip` promoted to production), `SqliteProfileRepository` round-trips all nine Household money leaves as canonical decimal TEXT (re-validated through `parseProfile` on load), and ONE shared `repositoryContract` factory runs an identical suite against both the SQLite adapters and in-memory fakes — including the byte-identical save→reload round-trip (household present AND absent), the frozen-household-survives-a-profile-edit proof, and a fresh-connection reload (PROF-03).**

## Performance
- **Duration:** ~9 min
- **Tasks:** 3 (1 TDD)
- **Files created:** 4
- **Files modified:** 0

## Accomplishments
- **`scenario-repo.ts`** — `SqliteScenarioRepository implements ScenarioRepository`. SAVE builds the canonical-JSON blob (conditional-spread household OMIT idiom — Pitfall 2) and `onConflictDoUpdate`s on the id for idempotent edit (D-11). LOAD `JSON.parse`s the blob and rebuilds the `EngineInput` through `parseAssumptionSet`/`parseScenarioInputs`/`parseHousehold` + `calendarDate` via `engineInput` — never an `as` cast, so a forged blob throws (T-06-12) — and NEVER re-joins the live owning-profile row (frozen household, PROF-04). `listByProfile` returns the thin `SavedScenarioMeta` projection (D-06); `delete` removes the row. Exports `serializeSnapshot`/`deserializeSnapshot` as the shared codec.
- **`profile-repo.ts`** — `SqliteProfileRepository implements ProfileRepository`. `save` upserts all NINE Household money/rate leaves (`available_net_worth` IS PROF-01 net worth) as canonical decimal TEXT; `load`/`list` route every DB row through `parseProfile` (defense in depth, T-06-13); `count()` runs a real `count(*)` query backing the ≤2 service guard (D-10). Timestamps come from an injectable shell clock.
- **`in-memory-repos.ts`** — `InMemoryScenarioRepository` + `InMemoryProfileRepository` fakes. The scenario fake stores the serialized blob and rebuilds on load through the SAME codec, so frozen-household semantics are byte-identical to the DB; the profile fake re-validates through `parseProfile`.
- **`repository-contract.test.ts`** — ONE `repositoryContract` factory invoked against BOTH arms (25 cases): save/load/listByProfile(thin)/delete/duplicate-name-reject/idempotent-edit; the reproducibility round-trip (`canonicalJson(loaded.input)` BYTE-IDENTICAL to the stored blob via plain `toBe`, household present AND absent); the frozen-household-after-profile-edit proof; the nine-leaf profile round-trip + list + count; plus a SQLite-only PROF-03 fresh-connection reload over a file-backed DB.
- Full suite green at **462 tests** (+34); core goldens untouched; tsc -b + ESLint clean.

## Task Commits
1. **Task 1: SqliteScenarioRepository + InMemory fake** — `5d51fe6` (feat)
2. **Task 2: SqliteProfileRepository + InMemory fake** — `d04b52c` (feat)
3. **Task 3: shared repositoryContract factory + reproducibility + frozen-household** — `e4ea596` (test)

## Files Created
- `packages/app/src/adapters/persistence/scenario-repo.ts` — SQLite scenario adapter + serialize/deserialize codec
- `packages/app/src/adapters/persistence/profile-repo.ts` — SQLite profile adapter (nine-leaf round-trip)
- `packages/app/src/adapters/persistence/in-memory-repos.ts` — InMemory scenario + profile fakes
- `packages/app/src/adapters/persistence/repository-contract.test.ts` — shared contract factory (both arms) + PROF-03 reload

## Decisions Made
- **Shared `serializeSnapshot`/`deserializeSnapshot` codec** exported from `scenario-repo.ts` so the fake cannot drift from the real save/load path.
- **Profile timestamps via an injectable shell clock** (`now: () => number`, default `Date.now`): the locked `Profile` port carries no timestamps but the schema columns are `NOT NULL`. The app shell owning the clock is sanctioned by the 06-03 schema decision; injectability keeps tests deterministic.
- **`repositoryContract(name, makeRepos)`** uses a single paired-repos maker (not two independent makers) so the SQLite arm's two adapters share one migrated `db` — required for the FK and the frozen-household-after-edit test to be meaningful.
- **Contract tests seed the owning profile before scenarios** — the SQLite arm enforces a real `FOREIGN KEY` constraint; a scenario without an owning profile is not a valid domain state.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Repository contract factory takes a single paired-repos maker, not two independent makers**
- **Found during:** Task 3
- **Issue:** The plan sketched `repositoryContract(name, makeScenarioRepo, makeProfileRepo)`, but two independent makers would each open a separate `:memory:` DB — the scenario FK and the frozen-household-after-edit test require the two SQLite adapters to share ONE migrated connection.
- **Fix:** The factory takes `makeRepos: () => { scenarioRepo, profileRepo }`; the SQLite arm constructs both adapters over one `migratedMemoryDb()`. Still invoked twice (the grep gate `repositoryContract(` ≥2 holds).
- **Files modified:** `repository-contract.test.ts`
- **Commit:** `e4ea596`

**2. [Rule 1 - Bug] Contract tests must seed the owning profile (real FOREIGN KEY enforcement)**
- **Found during:** Task 3 (first run — 8 SQLite failures: `FOREIGN KEY constraint failed`)
- **Issue:** Foreign-key enforcement is active in this environment, so saving a scenario whose `profileId` has no profile row throws. The initial test draft saved scenarios without seeding profiles.
- **Fix:** Added `seedProfiles(profileRepo, ...ids)` and seed the owning profile(s) before each scenario save. Harmless for the InMemory fake, keeping the contract symmetric.
- **Files modified:** `repository-contract.test.ts`
- **Commit:** `e4ea596`

**3. [Rule 1 - Bug] PROF-03 file-backed connections closed before temp cleanup**
- **Found during:** Task 3 (first run — `EPERM` deleting the temp dir on Windows)
- **Issue:** The fresh-connection reload test left both better-sqlite3 connections open; Windows could not delete the file-backed DB.
- **Fix:** Close each connection via `db.$client.close()` before `rmSync`; WAL is checkpointed into the main file on close.
- **Files modified:** `repository-contract.test.ts`
- **Commit:** `e4ea596`

**4. [Rule 1 - Source-grounding gate] Reworded comments so literal grep gates stay clean**
- **Found during:** Task 1 + Task 3 acceptance checks
- **Issue:** Explanatory comments contained the literal tokens `profiles` (in scenario-repo.ts, describing what LOAD does NOT do) and `toMatchSnapshot` (in the contract test, describing what is avoided), tripping the source-grounding greps (`profiles` 0-hits in scenario-repo.ts load path; `toMatchSnapshot` 0-hits).
- **Fix:** Reworded to "live owning-profile row" and "auto-blessing inline-snapshot matcher". No behavior change; the code uses neither a profiles join on load nor a snapshot matcher.
- **Files modified:** `scenario-repo.ts`, `repository-contract.test.ts`
- **Commit:** `5d51fe6`, `e4ea596`

**Total deviations:** 4 auto-fixed (1 Rule 3, 3 Rule 1). No architectural changes; no scope change.

## Verification Evidence
- `npx tsc -b` (packages/app): EXIT 0
- `npx vitest run src/adapters/persistence/repository-contract.test.ts`: 25 passed
- `npx vitest run -t round-trip`: 7 passed (byte-identical, household present + absent)
- `npx vitest run -t frozen`: 2 passed (both arms — profile edit does not mutate a saved scenario)
- `npx vitest run -t reload`: 5 passed (PROF-03 fresh-connection)
- `npm test` (full suite): 40 files / 462 tests passed
- ESLint on the four new files: EXIT 0
- Grep gates: `as ScenarioInputs`=0, `profiles` (scenario-repo)=0, `household: undefined`=0, `parseProfile`/`availableNetWorth`/`count` present, `repositoryContract(`=3 (≥2 call sites), `toMatchSnapshot`=0

## Known Stubs
None. Both adapters fully implement their ports against the live schema; the fakes mirror the same observable contract. The DI container wiring (`container.ts`) and services that consume these adapters are intentionally out of scope — they land in 06-06.

## Next Phase Readiness
- 06-06 can wire `SqliteScenarioRepository`/`SqliteProfileRepository` (and the `MockListingsProvider` from 06-04) into `container.ts`, exposing only the ports, and build the `scenario-service`/`profile-service` (the ≤2-profile guard reads `ProfileRepository.count()`).
- The `serializeSnapshot`/`deserializeSnapshot` codec and the contract factory are reusable test infrastructure for any future repository.

## Self-Check: PASSED
All four created files verified present on disk; all three task commits (5d51fe6, d04b52c, e4ea596) verified in git history.

---
*Phase: 06-persistence-listings-adapter*
*Completed: 2026-06-28*
