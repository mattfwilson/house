---
phase: 07-web-shell
plan: 10
subsystem: infra
tags: [next, webpack, drizzle, better-sqlite3, recharts, react-is, vitest, eslint, phase-gate]

# Dependency graph
requires:
  - phase: 07-05
    provides: webpack + extensionAlias bundler (the .js→.ts half of the build fix)
  - phase: 07-01
    provides: apps/web scaffold, transpilePackages, server-only container singleton, eslint boundary guards
  - phase: 06-02
    provides: "@house/app persistence package (drizzle migrations) bundled into the build graph"
provides:
  - "Clean production `next build -w apps/web` (exit 0) — the load-bearing boundary proof: no native module / @house/app in the client bundle, no transpile↔externalize conflict"
  - "Workspace-anchored drizzle migrations resolution (Option C) — unblocks bundling the raw-TS @house/app"
  - "Full Vitest suite green across packages/core + packages/app + apps/web (505 tests)"
  - "Verified 07-VALIDATION.md map + seeded human E2E checklist"
affects: [gsd-verify-work, phase-close, future-deploy]

# Tech tracking
tech-stack:
  added: ["react-is@^19 (recharts declared peer dependency)"]
  patterns:
    - "Bundler-safe runtime asset resolution: walk up from process.cwd() to the workspace dir owning a known subpath instead of new URL(<literal>, import.meta.url)"

key-files:
  created:
    - .planning/phases/07-web-shell/07-10-SUMMARY.md
  modified:
    - packages/app/src/adapters/persistence/db.ts
    - apps/web/package.json
    - package-lock.json
    - apps/web/src/app/actions/scenarios.test.ts
    - apps/web/src/lib/dto/scenario.test.ts
    - .planning/phases/07-web-shell/07-VALIDATION.md
    - .planning/phases/07-web-shell/deferred-items.md

key-decisions:
  - "Option C (workspace-anchored migrations walk) chosen over Option A (build step + serverExternalPackages) — preserves the locked 'raw TS, no build step for @house/app' decision; only the path-resolution strategy changed"
  - "react-is added as a direct apps/web dep — it is recharts@3.9.0's declared peer dependency (React-team package), not a new/unvetted top-level dependency; better-sqlite3 stays auto-externalized and absent from apps/web deps"

patterns-established:
  - "Non-statically-analyzable, memoized filesystem walk-up for locating committed runtime asset directories under a bundler"

requirements-completed: []  # SC-1..SC-4 are DEMONSTRATED by Task 2 human verification — NOT yet complete (pending)

# Metrics
duration: ~25min
completed: 2026-06-28
---

# Phase 7 Plan 10: Phase Gate Summary

**Clean production `next build` unblocked (Option C migrations resolution + react-is peer dep) with the full 505-test suite and eslint boundary green — automated phase gate PASSED; the human flight-sim + anti-funnel verification (Task 2) remains pending.**

> STATUS: Task 1 (automated gate) COMPLETE and committed. Task 2 (blocking human-verify
> checkpoint 07-10-02) is PENDING — the phase is NOT closed and SC-1..SC-4 are NOT yet
> marked complete until the developer confirms the running UI. This summary documents the
> automated gate; a continuation will record the human result.

## Performance

- **Duration:** ~25 min (automated portion)
- **Completed (Task 1):** 2026-06-28
- **Tasks:** 1 of 2 (Task 2 = pending blocking human-verify)
- **Files modified:** 7

## Accomplishments

- **Build blocker resolved (Option C):** `packages/app/src/adapters/persistence/db.ts` now resolves the committed `drizzle/` migrations folder by a memoized walk-up from `process.cwd()` (with a runtime module-dir fallback) to the workspace directory owning `packages/app/drizzle` — replacing `fileURLToPath(new URL('../../../drizzle', import.meta.url))`. Webpack no longer asset-analyzes the migrations directory, and the runtime path resolves correctly even when the module is bundled into `.next/server/…`. It fails loud (throws) rather than silently materializing an empty schema.
- **Clean `next build -w apps/web` (exit 0):** compiled in ~3.7s, TypeScript pass ~2.7s, 6 static routes generated. Verified by grep that **no `better-sqlite3` / `@house/app` leaked into `.next/static`** (T-7-02 boundary held end-to-end).
- **Full Vitest suite green:** `npm test` = 505 tests / 51 files across all three projects (core + app + web), 26.1s.
- **eslint boundary gate green:** `npx eslint .` exit 0 (only pre-existing boundaries-plugin deprecation warnings).
- **Phase closes clean on types:** the two deferred 07-03 `noUncheckedIndexedAccess` test errors fixed; `npx tsc -p apps/web --noEmit` now exit 0.
- **07-VALIDATION.md verified against the real run:** every automated map row marked ✅ green, measured runtimes recorded, `nyquist_compliant: true` / `wave_0_complete: true` confirmed, and a step-by-step human E2E checklist seeded for Task 2.

## Task Commits

1. **Task 1a — Option C migrations resolution** - `211f3b8` (fix)
2. **Task 1b — react-is peer dependency** - `979105d` (fix)
3. **Task 1c — two deferred 07-03 tsc guards** - `1115c4c` (fix)

**Plan metadata:** (docs commit with SUMMARY + VALIDATION + STATE + ROADMAP + deferred-items)

**Task 2 (07-10-02):** blocking human-verify checkpoint — NOT executed (awaiting developer).

## Files Created/Modified

- `packages/app/src/adapters/persistence/db.ts` — workspace-anchored, memoized migrations-folder resolution (Option C); fails loud if not found
- `apps/web/package.json` + `package-lock.json` — added `react-is@^19` (recharts peer)
- `apps/web/src/app/actions/scenarios.test.ts` — `dto.rows[0]!.isBaseline` guard
- `apps/web/src/lib/dto/scenario.test.ts` — `dto.rows[0]!.isBaseline` guard
- `.planning/phases/07-web-shell/07-VALIDATION.md` — verified map, measured runtimes, human checklist
- `.planning/phases/07-web-shell/deferred-items.md` — blocker marked RESOLVED

## Decisions Made

- **Option C over Option A/B** for the migrations blocker — keeps `@house/app` as raw TS with no build step (the locked 07-01 / CLAUDE.md decision); only the path-resolution strategy changed. The walk-up is non-statically-analyzable (no `new URL(<literal>)`), memoized, and verified at runtime by the existing `:memory:` migration tests.
- **react-is as a direct apps/web dependency** — it is recharts@3.9.0's own declared `peerDependency` (`react-is@^16||17||18||19`), a React-team core package, pinned to `^19` to match `react@19.2.7`. This is satisfying a declared peer of an already-vetted package, not introducing an unknown dependency.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Authorized cross-package fix] Option C workspace-anchored migrations resolution**
- **Found during:** Task 1 (next build gate)
- **Issue:** Bundling raw-TS `@house/app` made webpack statically asset-analyze `new URL('../../../drizzle', import.meta.url)` (a directory of `.sql` files), failing the build; even if dodged, the bundled `import.meta.url` would break the runtime migrations path.
- **Fix:** Replaced with a memoized walk-up from `process.cwd()` (module-dir fallback) to the dir owning `packages/app/drizzle`; throws if not found.
- **Files modified:** `packages/app/src/adapters/persistence/db.ts`
- **Verification:** `npx vitest run …/migration.test.ts` green (path resolves at runtime); full app suite green.
- **Committed in:** `211f3b8`

**2. [Rule 3 - Blocking, declared peer dep] react-is for recharts**
- **Found during:** Task 1 (next build gate, second failure)
- **Issue:** `recharts/es6/util/ReactUtils.js` imports `react-is`, recharts' declared peer dependency, which was unresolved → `Module not found: Can't resolve 'react-is'`.
- **Fix:** `npm install react-is@^19.0.0 -w apps/web` (resolves 19.2.7, matches react). Not a slopsquat risk — exact declared peer of an already-approved package; no substitution.
- **Files modified:** `apps/web/package.json`, `package-lock.json`
- **Verification:** `npm run build -w apps/web` exit 0; client-bundle grep clean.
- **Committed in:** `979105d`

**3. [Rule 1 - Deferred cleanup] Two 07-03 noUncheckedIndexedAccess test errors**
- **Found during:** Task 1 (phase-close typecheck)
- **Issue:** `dto.rows[0].isBaseline` flagged `Object is possibly 'undefined'` (the two long-deferred 07-03 test-file errors).
- **Fix:** Non-null assertion `dto.rows[0]!.isBaseline` in both files.
- **Files modified:** `scenarios.test.ts:80`, `scenario.test.ts:109`
- **Verification:** `npx tsc -p apps/web --noEmit` exit 0; suite still 505 green.
- **Committed in:** `1115c4c`

---

**Total deviations:** 3 auto-fixed (1 authorized Rule-2 cross-package gate fix, 1 Rule-3 declared-peer install, 1 Rule-1 deferred typecheck cleanup)
**Impact on plan:** All three were required to reach the clean-build phase gate the plan defines. No scope creep — no financial logic, no migration content, no @house/app build step added; better-sqlite3 stays auto-externalized and absent from apps/web deps.

## Issues Encountered

- The migrations blocker surfaced exactly as the deferred-items analysis predicted; Option C cleared it. A second, undocumented build failure (recharts' unresolved `react-is` peer) then surfaced — resolved by installing the declared peer.

## Known Stubs

None — no placeholder/empty-data stubs introduced. All changes are build/path/typecheck plumbing.

## User Setup Required

None — no external service configuration. The dev/run command for the human verification is `npm run dev -w apps/web`.

## Next Phase Readiness

- **Automated gate GREEN** — clean build, full suite, eslint, and apps/web typecheck all pass.
- **BLOCKING:** the human flight-sim + anti-funnel verification (07-10-02) must be completed against `npm run dev -w apps/web` before the phase can close / `/gsd-verify-work` runs. The five-check checklist is seeded in `07-VALIDATION.md` (§Human E2E Checklist) and returned to the orchestrator as a checkpoint.
- SC-1..SC-4 are demonstrated by that human pass — they are intentionally NOT marked complete here.

## Self-Check: PASSED

- Files verified present: `07-10-SUMMARY.md`, `07-VALIDATION.md`, `packages/app/src/adapters/persistence/db.ts`
- Commits verified in git log: `211f3b8`, `979105d`, `1115c4c`

---
*Phase: 07-web-shell*
*Task 1 completed: 2026-06-28 — Task 2 (human verify) pending*
