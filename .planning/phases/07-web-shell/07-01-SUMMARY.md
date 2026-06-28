---
phase: 07-web-shell
plan: 01
subsystem: infra
tags: [nextjs, react, tailwind, vitest, eslint, monorepo, server-only, container]

# Dependency graph
requires:
  - phase: 06-persistence
    provides: "@house/app makeContainer/Container port + service layer (the composition root the web shell wraps)"
  - phase: 01-foundations
    provides: "tsconfig.base.json strictness, vitest.shared.ts, root eslint boundary config style"
provides:
  - "apps/web — the first apps/* workspace (Next 16 App Router + Tailwind v4 shell), buildable"
  - "transpilePackages wiring for the raw-TS workspace packages (@house/core, @house/app); better-sqlite3 left auto-externalized"
  - "container.server.ts — server-only process-singleton over makeContainer(HOUSE_DB_PATH)"
  - "apps/web Vitest project (jsdom) wired into root projects; coverage scoped to packages/**"
  - "eslint boundary guards: client-bundle-leak ban (@house/app + container.server out of components/store) + Number() confined to charts/** + lib/format.ts"
affects: [07-02, 07-03, 07-04, 07-05, 07-06, 07-07, 07-08, 07-09, 07-10, 07-11]

# Tech tracking
tech-stack:
  added: [next@16.2.9, react@19.2.7, react-dom@19.2.7, tailwindcss@4.3.1, "@tailwindcss/postcss@4.3.1", recharts@3.9.0, zustand@5.0.14, lucide-react@0.400.0, server-only, jsdom]
  patterns: [transpilePackages-for-raw-ts-workspace-deps, server-only-process-singleton-container, per-project-vitest-via-mergeConfig, eslint-client-bundle-leak-guard, eslint-Number-display-edge-confinement]

key-files:
  created:
    - apps/web/package.json
    - apps/web/next.config.ts
    - apps/web/tsconfig.json
    - apps/web/postcss.config.mjs
    - apps/web/src/app/layout.tsx
    - apps/web/src/app/page.tsx
    - apps/web/src/app/globals.css
    - apps/web/.env.local.example
    - apps/web/src/lib/container.server.ts
    - apps/web/vitest.config.ts
    - apps/web/src/scaffold.smoke.test.ts
  modified:
    - vitest.config.ts
    - eslint.config.ts
    - package-lock.json

key-decisions:
  - "Manually scaffolded apps/web (create-next-app could not write in the execution environment) to the identical Next 16 + Tailwind v4 end state, extending tsconfig.base.json"
  - "Client-bundle-leak guard implemented via no-restricted-imports scoped to the client tiers (components/**, store/**) + server-only, because 'use client' is a runtime directive eslint-plugin-boundaries cannot classify by path"
  - "Number() display-edge rule written with BOTH allowed paths (components/charts/** + lib/format.ts) from the start so 07-05's lib/format.ts does not trip it"
  - "better-sqlite3 deliberately NOT a direct apps/web dependency — auto-externalized transitively through @house/app (listing it in serverExternalPackages alongside transpilePackages makes Next throw)"
  - "apps/web tsconfig overrides base module/moduleResolution to esnext/bundler + noEmit (Next owns the build; React/shadcn relative imports carry no .js specifier)"

patterns-established:
  - "Raw-TS workspace deps cross into a Next app via transpilePackages, never a build step"
  - "The web composition root is a server-only globalThis-stashed singleton built once per process (never per request — re-runs migrations / leaks SQLite handles)"
  - "Per-project Vitest config spreads sharedTest via mergeConfig (no extends); root projects glob covers apps/*"

requirements-completed: [SC-1]

# Metrics
duration: ~12min
completed: 2026-06-28
---

# Phase 7 Plan 01: Web Shell Scaffold + Monorepo Build Wiring Summary

**apps/web stood up as the first Next 16 App-Router workspace — transpilePackages wiring, a server-only container singleton, a jsdom Vitest project, and eslint guards that keep @house/app/better-sqlite3 out of the client bundle and confine money→float conversion to the display edge.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-06-28T18:29Z (approx)
- **Completed:** 2026-06-28T18:41Z
- **Tasks:** 2 executed (Task 1 was a pre-approved blocking-human supply-chain gate with no file changes)
- **Files modified:** 14 (11 created + 3 modified)

## Accomplishments
- apps/web builds cleanly: `npm run build -w apps/web` → exit 0, no transpile/externalize conflict (Next 16.2.9 Turbopack, 3 static routes)
- Server-only container singleton over `makeContainer(HOUSE_DB_PATH ?? './house.sqlite')`, stashed on globalThis for Next dev hot-reload, built once per process
- apps/web Vitest project ('web', jsdom) discovered by the root suite; `npx vitest run apps/web` exits 0; full suite 475 green
- eslint boundary guards green (`npx eslint apps/web` exit 0): client-tier ban on @house/app + container.server, and `Number()` confined to `components/charts/**` + `lib/format.ts` (proven by deny/allow probes)
- better-sqlite3 confirmed ABSENT from apps/web direct dependencies (auto-externalized via @house/app)

## Task Commits

1. **Task 2: Scaffold apps/web (Next 16 + Tailwind v4) + monorepo build wiring** — `fe5362d` (feat)
2. **Task 3: Container singleton + Vitest project + eslint boundary guards** — `190bea2` (feat)

_(Task 1 was the blocking-human supply-chain legitimacy checkpoint — developer approved the install list; no commit.)_

## Files Created/Modified
- `apps/web/package.json` - @house/web workspace; deps @house/core/@house/app + next/react/react-dom/recharts/zustand/lucide-react/server-only; NO better-sqlite3
- `apps/web/next.config.ts` - `transpilePackages: ['@house/core','@house/app']`; better-sqlite3 left auto-externalized
- `apps/web/tsconfig.json` - extends tsconfig.base.json; references core + app; DOM libs + jsx; bundler resolution + noEmit
- `apps/web/postcss.config.mjs` - Tailwind v4 via @tailwindcss/postcss
- `apps/web/src/app/{layout,page}.tsx`, `globals.css` - minimal buildable App-Router root (real chrome lands 07-05+)
- `apps/web/.env.local.example` - documents HOUSE_DB_PATH
- `apps/web/src/lib/container.server.ts` - server-only process-singleton Container
- `apps/web/vitest.config.ts` - 'web' jsdom project via mergeConfig + sharedTest
- `apps/web/src/scaffold.smoke.test.ts` - trivial smoke test so the web project exits 0
- `vitest.config.ts` - projects += 'apps/*'; coverage.include scoped to packages/**
- `eslint.config.ts` - ignore .next + next-env.d.ts; apps/web client-bundle-leak block + Number() display-edge confinement

## Decisions Made
- **Manual scaffold over create-next-app** — the official scaffolder refused to write in this environment ("application path is not writable" on two attempts, sandbox + non-existent apps/ parent). Reproduced the identical Next 16 + Tailwind v4 end state by hand, extending the monorepo base config (which create-next-app would not have done anyway).
- **Client-bundle-leak guard via no-restricted-imports (path-scoped) + server-only** rather than `boundaries/element-types`: `'use client'` is a runtime directive eslint-plugin-boundaries cannot classify, but the client tiers (`components/**`, `store/**`) are path-identifiable. `server-only` is the build-time half; the lint rule is defense-in-depth. @house/core stays importable client-side (pure Money/types).
- **tsconfig module/resolution override** to esnext/bundler + noEmit so Next's compiler owns the build and downstream React/shadcn relative imports need no `.js` specifier.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] create-next-app could not write — scaffolded apps/web manually**
- **Found during:** Task 2
- **Issue:** `npx create-next-app@16 apps/web ...` failed twice with "The application path is not writable" (environment restriction; the `apps/` parent did not yet exist). The Task 2 verb is "run create-next-app"; the deliverable is a buildable apps/web.
- **Fix:** Created the directory tree and authored every file by hand to match Next 16 + Tailwind v4 conventions, extending `tsconfig.base.json` and wiring `transpilePackages` per the plan. `npm install` then linked the workspace and resolved exactly the approved package set.
- **Files modified:** all apps/web/* files listed above
- **Verification:** `npm run build -w apps/web` exit 0 (Next 16.2.9 Turbopack)
- **Committed in:** fe5362d (Task 2 commit)

**2. [Rule 3 - Blocking] Added next-env.d.ts to eslint ignores**
- **Found during:** Task 3
- **Issue:** The Next-generated `next-env.d.ts` carries `/// <reference types="next" />` directives that trip `@typescript-eslint/triple-slash-reference`, which would make `npx eslint apps/web` fail the Task 3 verification.
- **Fix:** Added `**/next-env.d.ts` (and `apps/web/.next/**`) to the top-level eslint ignores.
- **Files modified:** eslint.config.ts
- **Verification:** `npx eslint apps/web` exit 0
- **Committed in:** 190bea2 (Task 3 commit)

**3. [Rule 3 - Blocking] Added jsdom + a trivial smoke test so the web Vitest project exits 0**
- **Found during:** Task 3
- **Issue:** The web project uses `environment: 'jsdom'` (jsdom not previously installed) and Vitest errors on a project with zero test files.
- **Fix:** Added `jsdom` to apps/web devDependencies and a `scaffold.smoke.test.ts` (the plan explicitly allowed "a trivial smoke test"). The smoke test deliberately does NOT import container.server.ts (importing `server-only` throws outside an RSC env).
- **Files modified:** apps/web/package.json, apps/web/src/scaffold.smoke.test.ts
- **Verification:** `npx vitest run apps/web` → 1 passed, exit 0
- **Committed in:** 190bea2 (Task 3 commit)

---

**Total deviations:** 3 auto-fixed (all Rule 3 - blocking)
**Impact on plan:** All necessary to reach the plan's exact end state and pass its verifications. No scope creep — every artifact named in the plan was produced; better-sqlite3 stayed out of apps/web direct deps; the threat-model mitigations (T-7-02 server-only + lint guard, T-7-03 single-list externalization) are all in place.

## Issues Encountered
- create-next-app write failure (resolved via manual scaffold, above). No other issues; the existing `--legacy-peer-deps` install convention (eslint@10 peer resolution) carried over cleanly.

## Threat Model Coverage
- **T-7-02** (better-sqlite3 in client bundle): `import 'server-only'` first statement in container.server.ts + eslint client-tier import ban. Clean `next build` proves no leak.
- **T-7-03** (transpile/externalize misconfig): transpilePackages lists only the two TS workspace packages; better-sqlite3 in neither list (auto-externalized).
- **T-7-SC** (npm install of new packages): Task 1 blocking-human checkpoint approved; better-sqlite3 confirmed not added to apps/web.

## Known Stubs
- `apps/web/src/app/page.tsx` / `layout.tsx` are intentional minimal scaffold stubs (no data wired). The real cockpit/header/chrome are built in 07-03+ / 07-05+. These are buildable placeholders by design, tracked here; not goal-blocking for plan 07-01 (whose goal is the build/boundary scaffold).

## User Setup Required
None for this plan. `HOUSE_DB_PATH` is an optional local env var (documented in `apps/web/.env.local.example`); it defaults to `./house.sqlite` when unset.

## Next Phase Readiness
- Scaffold + boundaries are in place for every downstream 07 plan (Server Actions, DTO mappers, client views, charts).
- 07-02 (`fiTrajectory` core entry) and the Wave-2 Server Actions can build directly on the container singleton and the validated boundary guards.

## Self-Check: PASSED
- All 11 created files verified present on disk.
- Both task commits (fe5362d, 190bea2) verified in git log.
- container.server.ts first statement is `import 'server-only';`.
- root vitest.config.ts `projects` includes `'apps/*'`; better-sqlite3 absent from apps/web direct deps.

---
*Phase: 07-web-shell*
*Completed: 2026-06-28*
