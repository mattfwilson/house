---
phase: 06-persistence-listings-adapter
plan: 03
subsystem: persistence
tags: [drizzle-orm, better-sqlite3, sqlite, schema, migration, drizzle-kit, decimal-string-money]

# Dependency graph
requires:
  - phase: 06-01
    provides: pure core domain types (Profile = {id,name} & nine-leaf Household, SavedScenario snapshot) the schema columns mirror
  - phase: 06-02
    provides: "@house/app workspace + installed SQLite toolchain (better-sqlite3, drizzle-orm, drizzle-kit) + drizzle.config.ts schema-path anchor"
provides:
  - "drizzle profiles table — all NINE Household money leaves as TEXT decimal-string columns (available_net_worth IS PROF-01 net worth; no separate net_worth column)"
  - "drizzle scenarios table — snapshot TEXT blob (frozen EngineInput, D-05) + unique index on (profile_id, name) (D-11)"
  - "openDb(source) + runMigrations(db) factory over the VERIFIED drizzle-orm/better-sqlite3/migrator path; Db type alias"
  - "committed drizzle/0000_*.sql migration + meta/_journal.json (reproducibility artifact)"
  - "live-schema proof: a migrate→insert→select round-trip test (not a type check) + an enforced unique-constraint test"
affects: [06-04, 06-05, 06-06, persistence, repositories, scenario-service, profile-service]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Money/rate columns are TEXT holding canonical decimal STRINGS — never real() (CORE-02/D-09); the float-column constructor appears zero times in schema.ts"
    - "Schema evolution via committed drizzle-kit generate SQL (D-11), NOT drizzle-kit push"
    - "Migrations folder resolved with fileURLToPath(new URL('../../../drizzle', import.meta.url)) so it works under tsx/vitest (src) and built dist, with a real Windows OS path (not /C:/...)"
    - "A migrate→insert→select round-trip test is the load-bearing proof the schema is LIVE — tsc -b is a false positive because Drizzle row types derive from schema.ts, not the DB"

key-files:
  created:
    - packages/app/src/adapters/persistence/schema.ts
    - packages/app/src/adapters/persistence/db.ts
    - packages/app/src/adapters/persistence/migration.test.ts
    - packages/app/drizzle/0000_flaky_shadow_king.sql
    - packages/app/drizzle/meta/_journal.json
    - packages/app/drizzle/meta/0000_snapshot.json
  modified: []

key-decisions:
  - "profiles persists ALL NINE Household leaves as TEXT money columns; PROF-01 net worth maps to available_net_worth with NO separate net_worth column (followed refreshed 06-RESEARCH nine-leaf sketch; the stale 06-PATTERNS sketch was ignored per the plan)"
  - "Programmatic migrator import path drizzle-orm/better-sqlite3/migrator CONFIRMED against installed drizzle-orm@0.45.2 types (migrator.d.ts exports migrate(db, config): void) — RESEARCH A1 resolved from ASSUMED to verified before coding"
  - "Migrations folder resolved via fileURLToPath (not URL.pathname) to avoid the Windows /C:/... leading-slash path bug"
  - "scenarios.snapshot is the frozen-EngineInput source of truth (D-05); thin id/profile_id/name/timestamp columns are queryable metadata only (D-06); uniqueIndex on (profileId,name) enforces D-11"
  - "Used the array-return table-extras form ((t) => [uniqueIndex(...)]) — the current drizzle-orm 0.45 idiom, avoiding the deprecated object-return form"

patterns-established:
  - "Live-schema proof pattern: a fresh openDb(':memory:') + runMigrations + real insert/select round-trip asserting every money column byte-exact, plus a duplicate-insert THROWS UNIQUE case — the persistence analog of the golden harness, plain expect().toBe(), never toMatchSnapshot"

requirements-completed: [PROF-01, PROF-02, PROF-03]

# Metrics
duration: 3min
completed: 2026-06-28
---

# Phase 06 Plan 03: SQLite Schema + Migration (nine-leaf profiles + scenarios) Summary

**The SQLite persistence substrate is materialized and proven LIVE: a Drizzle schema (nine-leaf `profiles` + `scenarios` with a frozen-snapshot blob and a unique-name-per-profile index), a `better-sqlite3`+Drizzle `openDb`/`runMigrations` factory over the verified migrator path, a committed drizzle-kit migration, and a migrate→insert→select round-trip test that exact-matches all nine decimal-string money columns and enforces the unique constraint at the live DB layer — not merely at compile time.**

## Performance

- **Duration:** ~3 min
- **Tasks:** 2 (1 blocking)
- **Files created:** 6
- **Files modified:** 0

## Accomplishments

- **`schema.ts`** — `profiles` table carrying ALL NINE Household money/rate leaves (`gross_annual_income`, `existing_monthly_debt`, `target_savings_rate`, `available_net_worth`, `current_rent`, `down_payment_cash`, `reserve`, `current_annual_savings`, `target_annual_retirement_spend`) as TEXT decimal-string columns + integer epoch-ms timestamps. PROF-01 "net worth" IS `available_net_worth` — there is no separate `net_worth` column. `scenarios` table with a `snapshot` TEXT blob (frozen `EngineInput`, D-05) + a `uniqueIndex('uniq_scenario_name_per_profile')` on `(profile_id, name)` (D-11). Zero `real()` columns.
- **`db.ts`** — `openDb(source)` opens `better-sqlite3` (WAL pragma), returns `drizzle({ client, schema })`; `runMigrations(db)` applies the committed SQL via `migrate(db, { migrationsFolder })`. Exports `openDb`, `runMigrations`, and the `Db` type alias. The migrator import path was **confirmed against the installed `drizzle-orm@0.45.2` types** before coding (RESEARCH A1).
- **Committed migration** — `npx drizzle-kit generate` emitted `drizzle/0000_flaky_shadow_king.sql` (both `CREATE TABLE`s, all nine money columns incl. `available_net_worth`, the unique index) + `meta/_journal.json` + `meta/0000_snapshot.json`, all committed as the D-11 reproducibility artifact.
- **`migration.test.ts`** — the [BLOCKING] live-schema proof: migrates a fresh `:memory:` DB then performs a real `insert`/`select` round-trip of a fully-populated nine-leaf profile + a scenario row, asserting EXACT decimal-string round-trip of all nine money columns (behavior, not a type check); a second case asserts the duplicate `(profileId, name)` scenario insert THROWS a SQLite `UNIQUE` constraint error.
- Full suite green at **428 tests** (+2 new migration tests); core goldens untouched.

## Task Commits

1. **Task 1: Drizzle schema (nine-leaf profiles + scenarios) + db/migrator wiring** — `ee99106` (feat)
2. **Task 2: [BLOCKING] Generate the migration + prove the LIVE schema applies** — `5081ee0` (feat)

## Files Created

- `packages/app/src/adapters/persistence/schema.ts` — drizzle `profiles` (nine money leaves) + `scenarios` tables + unique-name index
- `packages/app/src/adapters/persistence/db.ts` — `openDb` + `runMigrations` + `Db` factory over the verified migrator path
- `packages/app/src/adapters/persistence/migration.test.ts` — migrate→insert→select round-trip + unique-constraint enforcement
- `packages/app/drizzle/0000_flaky_shadow_king.sql` — generated, committed migration SQL
- `packages/app/drizzle/meta/_journal.json`, `packages/app/drizzle/meta/0000_snapshot.json` — drizzle-kit migration metadata (reproducibility)

## Decisions Made

- Followed the refreshed 06-RESEARCH nine-leaf schema sketch; the stale 06-PATTERNS sketch (showing a `net_worth` column + ~five leaves) was deliberately ignored per the plan's CRITICAL callout. PROF-01 net worth = `available_net_worth`.
- Resolved RESEARCH A1 from ASSUMED to VERIFIED: `drizzle-orm/better-sqlite3/migrator` exists in the installed tree and exports `migrate(db, config): void` (`migrator.d.ts`), so the import path is confirmed, not guessed.
- Used `fileURLToPath` (not `URL.pathname`) for the migrations folder to avoid the Windows `/C:/...` leading-slash path bug — the path is a real OS path under both `vitest`/`tsx` (src) and built `dist`.
- Used the current array-return table-extras form `((t) => [uniqueIndex(...)])` rather than the deprecated object-return form.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Source-grounding gate] Reworded schema.ts comments to keep the `real(` grep gate clean**
- **Found during:** Task 1 acceptance check
- **Issue:** The plan's acceptance assertion is "grep `real(` returns 0 hits in schema.ts". My explanatory comments contained the literal text `` `real()` `` (describing what NOT to do), which tripped the grep with 2 comment-only hits even though no `real()` column type is used.
- **Fix:** Reworded the comments to describe the float-column prohibition without the literal `real(` token. The schema uses zero `real()` columns either way; this only keeps a literal-grep verifier from a false positive.
- **Files modified:** `packages/app/src/adapters/persistence/schema.ts`
- **Verification:** `grep -i 'real('` now returns 0 hits; `tsc -b` still passes.
- **Committed in:** `ee99106` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1, cosmetic comment wording — no behavior change)
**Impact on plan:** None. All acceptance criteria met; no scope change.

## Verification Evidence

- `npx tsc -b` (packages/app): EXIT 0
- `npx vitest run -t migration`: 2 passed
- `npx vitest run` (full suite): 38 files / 428 tests passed
- `drizzle/0000_flaky_shadow_king.sql` grep: `CREATE TABLE` (x2), `available_net_worth`, `uniq_scenario_name_per_profile` all present
- `schema.ts` grep: `real(` = 0 hits; `uniqueIndex`/`snapshot`/`available_net_worth` present

## Known Stubs

None. The schema persists the full nine-leaf profile and the frozen-snapshot scenario; nothing is a placeholder. The repository CLASSES that QUERY these tables are intentionally out of scope here — they land in 06-05 (per the plan's `artifacts_this_phase_produces`).

## Next Phase Readiness

- The live SQLite schema (nine-leaf `profiles` + `scenarios`) is the substrate every 06-05 repository builds on; `openDb`/`runMigrations`/`Db` are exported and proven.
- 06-05 `SqliteScenarioRepository`/`SqliteProfileRepository` can now `openDb(':memory:')` + `runMigrations` in their contract tests against a real migrated schema.
- The scenario `snapshot` column is ready to receive the `canonicalJson(EngineInput)` blob via the `roundTrip()`-derived save/load path (06-04/06-05).

## Self-Check: PASSED

All six created files exist on disk; both task commits (ee99106, 5081ee0) are present in git history.

---
*Phase: 06-persistence-listings-adapter*
*Completed: 2026-06-28*
