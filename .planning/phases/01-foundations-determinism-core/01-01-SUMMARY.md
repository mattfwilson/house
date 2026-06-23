---
phase: 01-foundations-determinism-core
plan: 01
subsystem: infra
tags: [monorepo, npm-workspaces, typescript, eslint, eslint-plugin-boundaries, vitest, decimal.js, zod]

# Dependency graph
requires: []
provides:
  - "npm-workspaces monorepo root (packages/* + apps/*) with test/lint/typecheck/update-golden scripts"
  - "@house/core package skeleton: decimal.js + zod ONLY runtime deps, no DOM lib / no JSX tsconfig"
  - "ESLint 10 flat config enforcing CORE-01 (no framework in core) + CORE-03 lint half (determinism) as build failures"
  - "Vitest 4 projects wiring (core project, node env) via vitest.shared.ts + mergeConfig (no root extends)"
  - "Negative fixtures + boundary.test.ts proving the guards actually fail the build"
affects:
  - "All Phase 1 plans (01-02 Money/CalendarDate, 01-03 AssumptionSet, 01-04 golden harness)"
  - "Every downstream phase importing @house/core (TCO, Affordability, FI-Impact, Town Scoring, Persistence)"

# Tech tracking
tech-stack:
  added:
    - "typescript@6.0.3, vitest@4.1.9, @vitest/coverage-v8@4.1.9 (dev)"
    - "eslint@10.5.0, typescript-eslint@8.62.0, eslint-plugin-import@2.32.0, eslint-plugin-boundaries@6.0.2 (dev)"
    - "cross-env@10.1.0, jiti@2.7.0 (dev)"
    - "decimal.js@10.6.0, zod@4.4.3 (@house/core runtime)"
  patterns:
    - "Architecture boundary enforced by being a separate package + deny-by-default lint, not convention"
    - "Negative fixtures as durable proof the guards trip (lint + tsc regression guards)"
    - "Per-project Vitest config via mergeConfig(defineProject, sharedTest) — never extends root"

key-files:
  created:
    - "package.json, package-lock.json, .gitignore, tsconfig.base.json, tsconfig.json"
    - "eslint.config.ts, vitest.config.ts, vitest.shared.ts"
    - "packages/core/package.json, packages/core/tsconfig.json, packages/core/vitest.config.ts"
    - "packages/core/src/index.ts"
    - "packages/core/src/_lint-fixtures/{framework-import.fixture.ts,dom-global.fixture.ts,README.md}"
    - "packages/core/src/boundary.test.ts"
  modified: []

key-decisions:
  - "boundaries/external (deny-by-default, allow decimal.js+zod) is the real CORE-01 guard; no-restricted-imports is defense-in-depth (Pitfall 1: import/no-restricted-paths cannot ban npm package names)"
  - "Core lint override scoped to packages/core/src/** so package tooling configs (vitest.config.ts) and *.test.ts are exempt from the deny-by-default external rule"
  - "_lint-fixtures/** excluded from repo-wide 'eslint .' (stays green for real code); boundary.test.ts lints the react fixture directly with --no-ignore to prove the guard"
  - "core tsconfig excludes *.test.ts and the react fixture from tsc -b; dom-global.fixture.ts stays in the tsc graph as a load-bearing no-DOM regression guard"
  - "Decimal.js precision/rounding (D-14) and runtime determinism guard setupFile (D-12 runtime half) deferred to Plan 01-02 (TODO noted in packages/core/vitest.config.ts)"

patterns-established:
  - "Pattern 1: Pure-core boundary = separate package + ESLint boundaries/external deny-by-default + no-DOM/no-JSX tsconfig"
  - "Pattern 2: Determinism lint block (no-restricted-syntax for Date.now/Math.random/new Date/ImportExpression; no-restricted-globals/properties for process/process.env)"
  - "Pattern 3: Vitest 4 projects with shared options factored into vitest.shared.ts (per-project configs cannot extend root)"
  - "Pattern 4: Negative fixtures proven via portable Node execSync + a tsc regression guard (no POSIX 'test $?')"

requirements-completed: [CORE-01, CORE-03]

# Metrics
duration: ~20min
completed: 2026-06-23
---

# Phase 1 Plan 01: Foundations Bootstrap & Build-Time Enforcement Summary

**npm-workspaces monorepo + @house/core skeleton with ESLint 10 deny-by-default boundary and determinism guards, Vitest 4 projects wiring, and negative fixtures that prove a `react` import fails lint and a DOM global fails `tsc -b`.**

## Performance

- **Duration:** ~20 min (continuation; Task 1 supply-chain gate satisfied beforehand)
- **Started:** 2026-06-23 (resume at Task 2)
- **Completed:** 2026-06-23
- **Tasks:** 3 (Task 2, 3a, 3b; Task 1 was a pre-satisfied blocking human gate)
- **Files modified/created:** 16

## Accomplishments
- Stood up the npm-workspaces monorepo (`packages/*` + forward-looking `apps/*`) with `test`/`test:watch`/`lint`/`typecheck`/`update-golden` scripts; `update-golden` uses `cross-env` for PowerShell portability.
- `@house/core` skeleton whose ONLY runtime deps are `decimal.js` + `zod`; tsconfig has `lib: ["ES2023"]` (no DOM) and no JSX — the compile-time complement to the lint boundary.
- ESLint 10 flat config with the five guard layers scoped to `packages/core/src/**`: (A) `boundaries/external` deny-by-default, (B) `no-restricted-imports` framework ban, (C) `import/no-restricted-paths` apps zone, (D) `no-restricted-syntax` (Date.now/Math.random/new Date/ImportExpression), (E) `no-restricted-globals`/`no-restricted-properties` (process/process.env).
- Vitest 4 `projects` wiring: root `vitest.config.ts` (`projects: ['packages/*']` + global coverage thresholds 95/95/90/95), `vitest.shared.ts` (`sharedTest`), `packages/core/vitest.config.ts` (`mergeConfig(defineProject(...))`, name `core`, node env — NOT extending root).
- Negative fixtures + `boundary.test.ts` proving the enforcement is real: `import 'react'` exits eslint non-zero (via both `boundaries/external` and `no-restricted-imports`); a `@ts-expect-error document` keeps `tsc -b` green ONLY because the no-DOM lib makes `document` an error (verified: adding `"DOM"` to lib breaks `tsc -b` with TS2578, restoring fixes it).
- Final gate green: `npm run lint`, `npm test`, `npm run typecheck` all exit 0; core-deps guard confirms decimal.js+zod and zero framework deps.

## Task Commits

Each task committed atomically:

1. **Task 2: Scaffold monorepo root + core package skeleton + install deps** — `5845c7a` (chore)
2. **Task 3a: ESLint flat config (boundary + determinism) + Vitest projects wiring** — `98f7fc4` (feat)
3. **Task 3b: Negative fixtures + boundary test (prove the guards fail the build)** — `0722b56` (test)

**Plan metadata:** committed separately with SUMMARY/STATE/ROADMAP/REQUIREMENTS.

## Files Created/Modified
- `package.json` / `package-lock.json` - workspaces root, scripts, committed lockfile (the supply-chain integrity anchor for T-01-SC)
- `.gitignore` - node_modules, dist, coverage, *.tsbuildinfo
- `tsconfig.base.json` - shared strict opts (NodeNext, composite, noUncheckedIndexedAccess, exactOptionalPropertyTypes); no `lib`
- `tsconfig.json` - root project references → packages/core
- `eslint.config.ts` - flat config; packages/core/src override with the five guard layers; `_lint-fixtures/**` ignored repo-wide
- `vitest.config.ts` / `vitest.shared.ts` - projects config + shared test options
- `packages/core/package.json` - `@house/core`, decimal.js + zod
- `packages/core/tsconfig.json` - `lib: ["ES2023"]`, no DOM/JSX, excludes `*.test.ts` + react fixture from tsc graph
- `packages/core/vitest.config.ts` - core project, node env, mergeConfig (TODO: Plan 01-02 determinism setup file)
- `packages/core/src/index.ts` - public surface stub (re-exports added by later plans)
- `packages/core/src/_lint-fixtures/{framework-import,dom-global}.fixture.ts` + `README.md` - negative test assets
- `packages/core/src/boundary.test.ts` - portable execSync proof the react import is rejected by lint

## Decisions Made
- **CORE-01 guard mechanism:** `boundaries/external` deny-by-default (allow only decimal.js+zod) is the real guard because `import/no-restricted-paths` cannot ban bare npm specifiers (Pitfall 1) and `no-restricted-imports` misses dynamic `import()` (Pitfall 2, covered separately by the `ImportExpression` syntax ban). Layered both for defense-in-depth.
- **Lint override scope = `packages/core/src/**`** (not `packages/core/**`): the package's own tooling config (`vitest.config.ts`) legitimately imports the test runner and must be exempt; `*.test.ts` get a relaxing carve-out (they consume node built-ins + vitest).
- **Fixtures excluded from `eslint .`** so the everyday CI lint gate stays green; the durable proof lives in `boundary.test.ts` which lints the fixture explicitly with `--no-ignore`.
- **Deferred to Plan 01-02:** the frozen `Decimal.clone` (D-14) and the runtime determinism guard setup file (D-12 runtime half) — a TODO comment in `packages/core/vitest.config.ts` marks the `setupFiles` slot.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Installed deps with `--legacy-peer-deps` due to eslint-plugin-import peer-range lag**
- **Found during:** Task 2 (first `npm install`)
- **Issue:** `eslint-plugin-import@2.32.0` (latest stable) declares a peer range `eslint ^2..^9` — it does NOT include the user-approved `eslint@10.5.0`. A plain `npm install` aborts with ERESOLVE. The research's "peer accepts modern ESLint" claim was inaccurate for ESLint 10; there is no newer stable `eslint-plugin-import`.
- **Fix:** Installed with `--legacy-peer-deps`. Same approved package, same approved version — only the resolver flag changed; no package substitution (NOT the excluded "similarly-named alternative" case). The plugin is used only for `import/no-restricted-paths` (apps-zone bans) and functions correctly under ESLint 10 flat config (verified: `npm run lint` exit 0).
- **Files modified:** package.json, package-lock.json
- **Verification:** `npm run lint` / `npm test` / `tsc -b` all green; resolved lockfile versions match the approved set exactly.
- **Committed in:** 5845c7a (Task 2)

**2. [Rule 3 - Blocking] Added jiti@2.7.0 (dev) to load the .ts ESLint flat config**
- **Found during:** Task 3a (first `npm run lint`)
- **Issue:** ESLint 10 errored: "The 'jiti' library is required for loading TypeScript configuration files." The plan/research mandated `eslint.config.ts` (a TS flat config) but did not list jiti.
- **Fix:** Installed `jiti@2.7.0` (official `github.com/unjs/jiti` — the loader ESLint's own error message names). It is the direct, documented requirement of the approved `eslint.config.ts` choice, not an alternative to any approved package. Provenance verified before install.
- **Files modified:** package.json, package-lock.json
- **Verification:** `npm run lint` loads the config and exits 0.
- **Committed in:** 98f7fc4 (Task 3a)

---

**Total deviations:** 2 auto-fixed (both Rule 3 - blocking installs). No package substitutions, no scope creep.
**Impact on plan:** Both were unavoidable to make the user-approved stack (ESLint 10 + TS flat config) install and run. All approved versions retained; lockfile pins them exactly.

## Issues Encountered
- The Task-3a verification one-liner does a naive substring check `v.includes('extends')` against the whole core vitest config file; an explanatory comment containing the word "extends" tripped it. Reworded the comment (config never uses `extends`) — check now passes. No functional change.
- `eslint-plugin-boundaries@6` emits a deprecation warning for `boundaries/external` (prefers `boundaries/dependencies`). Kept `boundaries/external` because the plan's must-have artifact contract requires that exact rule id in `eslint.config.ts`; the warning is non-fatal (lint exits 0). Migration to `boundaries/dependencies` is a future tidy-up, not a Phase-1 blocker.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Wave 0 scaffolding complete; the enforcement substrate is proven (lint rejects framework imports, tsc rejects DOM globals).
- Plan 01-02 should add: the frozen `Decimal.clone` (`packages/core/src/money/decimal-config.ts`, D-14), the `Money` class (D-01/02/03), `CalendarDate` (D-13), and the runtime determinism guard + Vitest `setupFiles` entry (D-12 runtime half — slot is marked TODO in `packages/core/vitest.config.ts`).
- Coverage thresholds (95/95/90/95) are set but not yet exercised (only the boundary test exists); real coverage gating begins once primitives land.
- Note for CI: use `npm ci` (lockfile committed) and run with `--legacy-peer-deps` semantics honored by the lockfile; the eslint-plugin-import peer lag should be revisited when an ESLint-10-compatible release ships.

## Self-Check: PASSED

All 13 created files verified present on disk; all 3 task commits (5845c7a, 98f7fc4, 0722b56) verified in git history.

---
*Phase: 01-foundations-determinism-core*
*Completed: 2026-06-23*
