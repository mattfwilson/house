---
phase: 06-persistence-listings-adapter
plan: 02
subsystem: infra
tags: [npm-workspaces, better-sqlite3, drizzle-orm, drizzle-kit, vitest, typescript, monorepo]

# Dependency graph
requires:
  - phase: 06-01
    provides: pure core ports + persisted domain types (Profile/Listing/SavedScenario) that the app shell will implement against
provides:
  - "@house/app — the first non-core workspace package (the imperative shell home)"
  - "SQLite toolchain installed in @house/app only (better-sqlite3, drizzle-orm, drizzle-kit, @types/better-sqlite3)"
  - "app vitest project (node env) wired into the root project graph"
  - "drizzle-kit config (sqlite dialect, schema path, ./drizzle out dir)"
  - "proven-loadable better-sqlite3 native binary on this machine"
affects: [06-03, 06-04, 06-05, 06-06, persistence, listings, drizzle-schema, repositories, services]

# Tech tracking
tech-stack:
  added: [better-sqlite3@12.11.x, drizzle-orm@0.45.x, drizzle-kit@0.31.x, "@types/better-sqlite3@7.6.x"]
  patterns:
    - "Imperative shell isolated as a separate npm-workspace package; SQLite deps installed -w @house/app ONLY (core purity preserved)"
    - "App tsconfig copies core's verbatim, changing only types [node, better-sqlite3] + adding references ../core"
    - "App vitest project uses mergeConfig(defineProject, sharedTest) name:'app' node env, NO determinism guard.setup (core-only)"

key-files:
  created:
    - packages/app/package.json
    - packages/app/tsconfig.json
    - packages/app/vitest.config.ts
    - packages/app/drizzle.config.ts
  modified:
    - tsconfig.json
    - .gitignore
    - package-lock.json

key-decisions:
  - "SQLite stack installed with -w @house/app only — packages/core deps stay exactly decimal.js + zod (D-02 zero-framework-dep core)"
  - "App tsconfig types: [node, better-sqlite3] (core uses []) + references ../core so tsc -b builds app after core"
  - "App vitest project deliberately omits core's determinism guard.setup — the shell is permitted Date.now() for timestamps"
  - "drizzle.config.ts schema path points at ./src/adapters/persistence/schema.ts (authored in 06-03+); ./drizzle migrations committed, *.sqlite* gitignored (D-11/Pitfall 4)"
  - "Used --legacy-peer-deps to match the repo's pre-existing eslint@10 / eslint-plugin-import@2.32 peer resolution (Rule 3 blocking deviation, not a package-legitimacy issue — all four SQLite packages are slopcheck [OK])"

patterns-established:
  - "First non-core workspace package scaffolded by copying packages/core config shape, adapting the minimum (types, references, name, deps)"
  - "Native-module install gated by a Pitfall-3 in-memory insert/select smoke test before declaring the toolchain ready"

requirements-completed: [PROF-01, PROF-02, PROF-03]

# Metrics
duration: 4min
completed: 2026-06-28
---

# Phase 06 Plan 02: Scaffold @house/app + SQLite Toolchain Summary

**@house/app workspace package scaffolded (package/tsconfig/vitest/drizzle configs) and wired into the root project graph, with better-sqlite3 + drizzle-orm + drizzle-kit installed app-only and the native binary proven to load and execute on this machine.**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-06-28T02:47:52Z
- **Completed:** 2026-06-28T02:51:00Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Created the first non-core workspace package `@house/app` with its four config files, copying the `packages/core` shape and adapting only what differs (types, references, name, deps, no determinism guard).
- Wired the package into the root project graph: root `tsconfig.json` references `./packages/app`; `.gitignore` covers `*.sqlite*`/`*.db` without ignoring committed `drizzle/` migrations.
- Installed the SQLite toolchain (better-sqlite3@12, drizzle-orm@0.45, drizzle-kit@0.31, @types/better-sqlite3) into `@house/app` ONLY — `packages/core` deps remain exactly `decimal.js` + `zod`.
- Proved the better-sqlite3 native prebuilt binary loads and round-trips an in-memory insert/select (Pitfall-3 smoke test).
- Full vitest suite stays green (426 tests, 37 files); the new empty `app` project is discovered without error.

## Task Commits

Each task was committed atomically:

1. **Task 1: Scaffold @house/app config files + root project-graph edits** - `c415fec` (feat)
2. **Task 2: Install the SQLite stack into @house/app + smoke-test the native binary** - `66cf640` (chore)

## Files Created/Modified
- `packages/app/package.json` - @house/app workspace manifest: @house/core (workspace) + better-sqlite3 + drizzle-orm deps; drizzle-kit + @types/better-sqlite3 devDeps
- `packages/app/tsconfig.json` - copies core's tsconfig; types [node, better-sqlite3], references ../core, excludes test files
- `packages/app/vitest.config.ts` - app vitest project (mergeConfig + sharedTest, name 'app', node env, no setupFiles)
- `packages/app/drizzle.config.ts` - drizzle-kit config: sqlite dialect, schema ./src/adapters/persistence/schema.ts, out ./drizzle, DB_FILE_NAME-overridable url
- `tsconfig.json` (root) - added `{ "path": "./packages/app" }` to references
- `.gitignore` - added `*.sqlite`, `*.sqlite-wal`, `*.sqlite-shm`, `*.db` (committed drizzle SQL stays tracked)
- `package-lock.json` - SQLite stack dependency tree

## Decisions Made
- SQLite deps installed `-w @house/app` only; core purity asserted unchanged (D-02).
- App tsconfig `types: [node, better-sqlite3]` and `references: [../core]` so `tsc -b` builds app after core.
- App vitest project omits core's `determinism/guard.setup.ts` — the shell is allowed `Date.now()` for timestamps.
- `drizzle.config.ts` follows the RESEARCH A5 sketch; schema path anticipates the 06-03 persistence schema.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Used `--legacy-peer-deps` for the SQLite install**
- **Found during:** Task 2 (SQLite stack install)
- **Issue:** A bare `npm install … -w @house/app` aborted with ERESOLVE — a PRE-EXISTING peer conflict in the committed tree (`eslint-plugin-import@2.32` declares peer `eslint@^2..^9`, but the root pins `eslint@10`). This is unrelated to the SQLite packages, which are all slopcheck `[OK]` per RESEARCH (so NOT a package-legitimacy gate).
- **Fix:** Re-ran the install with `--legacy-peer-deps`, matching the resolution strategy the existing lockfile must already have used (eslint@10 + eslint-plugin-import@2.32 already coexist there). No package names substituted or retried under different names.
- **Files modified:** package-lock.json
- **Verification:** All four packages present in node_modules + app package.json; @house/app symlinked; better-sqlite3 native smoke test prints `better-sqlite3 OK`; full suite 426 green.
- **Committed in:** 66cf640 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** The deviation only selected the resolution flag the repo's existing tree already relies on; no scope change, no package substitution. All plan acceptance criteria met.

## Issues Encountered
- The first `npm install -w @house/app` printed a transient "no workspace folder present" warning, but the second pass resolved cleanly and the `node_modules/@house/app` symlink is present — the warning did not affect the final install state (verified by directory listing + smoke test).

## Known Stubs
None. This plan is pure scaffolding — `packages/app/src/` is intentionally empty (schema, adapters, repositories, services land in 06-03+). The `drizzle.config.ts` schema path references a not-yet-authored file by design; drizzle-kit is not invoked this plan.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `@house/app` exists, builds in the project graph, and tests as an (empty) vitest project — every 06-03+ adapter/repository/service now has a package to live in.
- The better-sqlite3 native binary is proven to load on this machine, de-risking the persistence work.
- Note for 06-03: confirm the programmatic migrator import path (`drizzle-orm/better-sqlite3/migrator`, RESEARCH A1 flagged ASSUMED) against the now-installed `drizzle-orm@0.45.2` types before wiring `db.ts`.

## Self-Check: PASSED

All four created config files exist on disk; both task commits (c415fec, 66cf640) are present in git history.

---
*Phase: 06-persistence-listings-adapter*
*Completed: 2026-06-28*
