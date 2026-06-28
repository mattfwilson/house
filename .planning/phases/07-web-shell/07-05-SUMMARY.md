---
phase: 07-web-shell
plan: 05
subsystem: ui
tags: [shadcn, base-ui, tailwind-v4, nextjs, geist, dark-slate, design-system, server-actions, zustand, webpack, anti-funnel]

# Dependency graph
requires:
  - phase: 07-01
    provides: "apps/web scaffold — transpilePackages, container.server singleton, eslint client-leak + Number()-edge guards, the lib/format.ts allow-path"
  - phase: 07-03
    provides: "listProfilesAction / listScenariosAction (the header switchers' data sources) + ProfileDTO / SavedScenarioMeta shapes"
  - phase: 07-06
    provides: "the Zustand selection store (activeProfileId/activeScenarioId + setters) the header drives (D-02)"
provides:
  - "shadcn/ui initialized into apps/web (modern stack: style base-nova + Base UI primitives, official registry only) — 18 ui blocks + lib/utils + hooks"
  - "the LOCKED dark-slate design contract in globals.css (forced over shadcn's neutral baseColor) + the .num-readout Geist-Mono/tabular-nums utility"
  - "apps/web/src/app/layout.tsx — Geist Sans+Mono, dark instrument-panel base, persistent Header on every route (D-12/D-02)"
  - "apps/web/src/components/chrome/Header.tsx — the D-02 persistent profile + scenario switcher wired to the list actions + the selection store"
  - "apps/web/src/lib/format.ts — display-edge formatUSD + color-honest fiDeltaLabel (Task 2)"
  - "webpack bundler + extensionAlias for apps/web — the resolution path that lets a client component pull the raw-TS @house/core graph into a build"
affects: [07-07, 07-08, 07-09, 07-10, 07-11]

# Tech tracking
tech-stack:
  added: ["shadcn@4.12.0", "@base-ui/react@1.6.0", "next-themes@0.4.6", "sonner@2.0.7", "tailwind-merge@3.6.0", "tw-animate-css@1.4.0", "class-variance-authority@0.7.1", "clsx@2.1.1"]
  patterns: [force-slate-over-shadcn-neutral-with-inline-hex-tokens, dark-as-default-only-theme, geist-sans+mono-via-next-font, client-header-calls-use-server-list-actions, type-only-core-import-in-client-chrome, webpack+extensionAlias-for-raw-ts-workspace-js-specifiers, num-readout-tabular-nums-utility]

key-files:
  created:
    - apps/web/components.json
    - apps/web/src/components/ui/*  # 18 official blocks
    - apps/web/src/lib/utils.ts
    - apps/web/src/hooks/use-mobile.ts
    - apps/web/src/components/chrome/Header.tsx
    - apps/web/src/lib/format.ts        # Task 2 (already committed pre-continuation)
    - apps/web/src/lib/format.test.ts   # Task 2
    - .npmrc
  modified:
    - apps/web/src/app/layout.tsx
    - apps/web/src/app/globals.css
    - apps/web/next.config.ts
    - apps/web/package.json
    - apps/web/src/components/ui/sonner.tsx
    - package-lock.json

key-decisions:
  - "ACCEPTED modern shadcn (style base-nova — the retired new-york preset no longer exists — + Base UI primitives instead of Radix, baseColor neutral) at the human checkpoint, on the explicit condition that the visual contract is FORCED to the UI-SPEC's locked dark slate"
  - "globals.css overrides shadcn's neutral baseColor with the EXACT UI-SPEC hex tokens kept inline (not oklch) so the slate/teal contract is grep-auditable; dark is the default+only theme (<html class=\"dark\">) so there is never a flash of the light neutral default"
  - "teal #0F766E is wired ONLY to --primary and --ring (active/focus affordance); shadcn's --accent hover token is slate-700, NOT teal, so teal stays reserved per the UI-SPEC accent list; no success-green token exists anywhere"
  - "Header is a client component calling the 'use server' list actions directly (the canonical Server Action pattern) — it imports only @/app/actions/* (allowed) and a TYPE-only SavedScenarioMeta from @house/core; never @house/app or container.server (client-leak guard satisfied)"
  - "switched apps/web from Turbopack to webpack (+ experimental.extensionAlias .js→.ts) because Turbopack cannot remap the raw-TS workspace packages' NodeNext .js relative specifiers — preserves the locked 'no build step' decision, only the bundler engine changes"

patterns-established:
  - "Force a design contract over a shadcn preset by overriding the CSS variables with inline spec hex, rather than re-running init with a different baseColor"
  - "The persistent chrome (Header) is a client component that reads server truth via the thin 'use server' list actions and holds active selection in the ephemeral Zustand store"
  - "Raw-TS workspace packages with NodeNext .js specifiers require webpack + extensionAlias in the consuming Next app (Turbopack cannot remap them)"

requirements-completed: [SC-1, SC-4]

# Metrics
duration: ~40min
completed: 2026-06-28
---

# Phase 7 Plan 05: App Chrome (shadcn init + dark-slate layout + persistent Header) Summary

**The dark instrument-panel chrome is standing: shadcn initialized from the official registry (modern base-nova + Base UI, accepted at the checkpoint) with its neutral palette FORCED to the UI-SPEC's locked dark slate (teal reserved, no success-green), Geist Sans/Mono via next/font, and a persistent D-02 profile + scenario switcher Header wired to the list Server Actions and the 07-06 selection store — present on every route.**

## Performance

- **Duration:** ~40 min (continuation from the shadcn registry-install human checkpoint)
- **Completed:** 2026-06-28
- **Tasks:** 3 (Task 1 install committed from the resolved checkpoint; Task 2 pre-committed; Task 3 executed)
- **Files modified:** 28 (25 in Task 1 install surface + 3 in Task 3 net of overlap)

## Accomplishments
- shadcn/ui initialized into `apps/web` from the OFFICIAL registry only (no third-party `--registry`): `components.json` + 18 ui blocks (button card table dialog alert-dialog slider tabs tooltip select popover input label badge sidebar sonner + separator/sheet/skeleton), `lib/utils.ts`, `hooks/use-mobile.ts`. `better-sqlite3` confirmed STILL absent from apps/web direct deps.
- `globals.css` carries the locked dark-slate contract: slate-900 `#0F172A` app bg, slate-800 `#1E293B` cards/header, slate-700 `#334155` borders, slate-50 `#F8FAFC` text, slate-400 `#94A3B8` muted, teal `#0F766E` reserved accent (`--primary`/`--ring` only), red-600 `#DC2626` destructive. Dark is default+only; `.num-readout` (Geist Mono + tabular-nums) added for instrument numerics.
- `layout.tsx`: Geist Sans + Geist Mono via `next/font/google`, dark instrument base, `<Header/>` mounted above the route `children` slot — present on every route (D-02/D-12).
- `Header.tsx`: client D-02 chrome — profile switcher populated by `listProfilesAction`, scenario switcher populated by `listScenariosAction(activeProfileId)`, both bound to the 07-06 selection store (`setActiveProfile` resets the scenario context; `setActiveScenario`); `aria-label` on each control; teal only on the active affordance; no success-green.
- Verification (the plan's Task 3 gate): `npx tsc -p apps/web/tsconfig.json --noEmit` clean for all plan files (only the two pre-existing deferred 07-03 test-file errors remain), `npx eslint apps/web` exit 0.

## Task Commits

1. **Task 1: shadcn init (official registry, base-nova/Base UI) + .npmrc** — `f48a796` (feat)
2. **Task 2 (RED): failing display-edge format specs** — `5ea58b8` (test) _(pre-continuation)_
3. **Task 2 (GREEN): formatUSD + color-honest fiDeltaLabel** — `1bb6521` (feat) _(pre-continuation)_
4. **Task 3: dark-slate layout + persistent Header (incl. webpack switch + sonner fix)** — `af4da67` (feat)

**Plan metadata:** (final docs commit — see git log)

## Files Created/Modified
- `apps/web/components.json` - shadcn config (style base-nova, baseColor neutral→forced slate in CSS, lucide, rsc)
- `apps/web/src/components/ui/*` - 18 official Base UI-backed blocks
- `apps/web/src/lib/utils.ts`, `apps/web/src/hooks/use-mobile.ts` - shadcn helpers
- `.npmrc` - `legacy-peer-deps=true` (resolves the eslint@10 / eslint-plugin-import ERESOLVE so shadcn's internal npm install succeeds)
- `apps/web/src/app/globals.css` - the LOCKED dark-slate design contract + `.num-readout`
- `apps/web/src/app/layout.tsx` - Geist Sans/Mono, dark base, persistent Header
- `apps/web/src/components/chrome/Header.tsx` - the D-02 profile + scenario switcher
- `apps/web/next.config.ts` - webpack bundler + `experimental.extensionAlias` for the raw-TS `.js` specifiers
- `apps/web/package.json` - `dev`/`build` scripts switched to `--webpack`
- `apps/web/src/components/ui/sonner.tsx` - theme cast fix for `exactOptionalPropertyTypes`

## Decisions Made
- **Accept modern shadcn, force slate** — per the human checkpoint. shadcn@canary has evolved past the UI-SPEC's assumptions: the `new-york` preset is retired (now `base-nova`), and the default primitives are **Base UI** (`@base-ui/react`), not Radix. The modern stack was accepted on the explicit condition that the visual contract is forced to the locked dark slate — done in `globals.css` by overriding the CSS variables with the spec's exact hex.
- **Inline hex tokens (not oklch)** so the contract is grep-auditable against the UI-SPEC.
- **Header is a client component calling the 'use server' list actions** — the canonical pattern; it never imports `@house/app`/`container.server`, only `@/app/actions/*` and a type-only `@house/core` symbol.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Approved at checkpoint] Modern shadcn stack (base-nova + Base UI) instead of "New York / Radix"**
- **Found during:** Task 1
- **Issue:** The plan/UI-SPEC assume `npx shadcn init` yields style `new-york`, baseColor `slate`, Radix primitives. shadcn@canary now installs style `base-nova` (new-york retired), baseColor `neutral`, and **Base UI** (`@base-ui/react`) primitives.
- **Fix:** Accepted the modern stack at the human checkpoint and forced the visual contract to slate in `globals.css` (override the neutral CSS variables with the UI-SPEC's exact dark-slate hex + reserved teal). Official registry only; no third-party registry introduced.
- **Files modified:** apps/web/components.json, apps/web/src/components/ui/*, apps/web/src/app/globals.css
- **Verification:** components.json present; deps are shadcn/Base UI/lucide defaults; better-sqlite3 absent; eslint clean
- **Committed in:** f48a796 (install), af4da67 (slate force)

**2. [Rule 3 - Blocking] .npmrc legacy-peer-deps so shadcn's internal install resolves**
- **Found during:** Task 1
- **Issue:** shadcn's internal `npm install` hit the repo's pre-existing eslint@10 / eslint-plugin-import ERESOLVE peer conflict (the same one prior plans handled with `--legacy-peer-deps`).
- **Fix:** Committed a root `.npmrc` with `legacy-peer-deps=true` (makes the existing convention durable rather than a per-command flag).
- **Files modified:** .npmrc
- **Committed in:** f48a796

**3. [Rule 3 - Blocking] Turbopack → webpack + extensionAlias for the raw-TS `.js` specifiers**
- **Found during:** Task 3 (the first `next build` with a client component pulling the action→core graph)
- **Issue:** `@house/core`/`@house/app` are authored NodeNext — their internal re-exports carry `.js` specifiers (e.g. `./affordability/bank-affordability.js`) resolving to sibling `.ts` files (the locked "raw TS, no build step" decision). Turbopack cannot remap `.js`→`.ts` for symlinked workspace packages → 37 `Module not found` errors the moment the Header pulled the graph into a real build.
- **Fix:** Switched `apps/web` to the webpack bundler (`next dev/build --webpack`) + `experimental.extensionAlias { '.js': ['.ts','.tsx','.js','.jsx'], … }`. Preserves the no-build-step architecture; only the bundler engine changes. Documented in `next.config.ts`.
- **Files modified:** apps/web/next.config.ts, apps/web/package.json
- **Verification:** the 37 `.js` resolution errors are gone; the build advances to the deferred @house/app drizzle-folder blocker below
- **Committed in:** af4da67

**4. [Rule 1 - Bug] sonner.tsx theme cast under exactOptionalPropertyTypes**
- **Found during:** Task 3 typecheck
- **Issue:** the shadcn-default `sonner.tsx` failed `tsc` under this repo's `exactOptionalPropertyTypes`: `theme` could be `undefined` (the `{...props}` spread + the optional-property indexed-access cast `ToasterProps["theme"]` both reintroduce `undefined`).
- **Fix:** moved `theme` AFTER `{...props}` and cast to the concrete literal union `"light"|"dark"|"system"`.
- **Files modified:** apps/web/src/components/ui/sonner.tsx
- **Verification:** apps/web tsc clean (sonner error gone)
- **Committed in:** af4da67

---

**Total deviations:** 4 (1 checkpoint-approved stack change, 2 blocking infra, 1 bug)
**Impact on plan:** All deliverables produced; the chrome matches the locked contract. The webpack switch is the correct foundation the rest of the phase's `next build` work sits on.

## Issues Encountered

**Production `next build` is BLOCKED by a deeper, pre-existing architectural issue (deferred to 07-10).**
After the webpack/extensionAlias fix resolved the `.js` specifiers, webpack fails on
`packages/app/src/adapters/persistence/db.ts:41` — `fileURLToPath(new URL('../../../drizzle', import.meta.url))`:
bundling the raw-TS `@house/app` persistence package statically analyzes the `new URL(<literal>, import.meta.url)`
as an asset and cannot resolve the drizzle **directory** of `.sql` migrations (and even if dodged, the bundled
module's `import.meta.url` would make the runtime migrations path wrong). This is a **persistence-package
server-packaging decision** (Rule 4, architectural), in a locked Phase-06 file, and the 07-05 PLAN explicitly
scopes the full `next build` to the **07-10 wave/phase gate** — not this app-chrome plan (whose gate is
`tsc --noEmit` + `eslint`, both PASS). It is NOT hacked here (silencing the build error would introduce a silent
runtime migration ENOENT). Full analysis + three resolution options (recommended: a JS build step for `@house/app`
+ `serverExternalPackages`) are logged in `deferred-items.md` under "From plan 07-05" and as a STATE.md blocker.

## Known Stubs
None. The Header's switchers are fully wired to the real `listProfilesAction`/`listScenariosAction` and the
selection store. As the plan specifies, the "Manage profiles" entry + empty-state "Create a profile" CTA land in
07-11, and the switchers driving a live recompute land with the cockpit (07-07/07-08) — those are integration
seams, not stubs (no hardcoded/empty data is presented as real).

## Threat Model Coverage
- **T-7-SC** (Tampering on shadcn block install): official registry only, no third-party `--registry`; install surface human-verified at the checkpoint; better-sqlite3 confirmed absent from apps/web deps.
- **T-7-04** (Money float-tamper at the display edge): unchanged — `format.ts` keeps `Number()` as the last formatter input (Task 2, eslint-confined).
- **T-7-07** (header reads profile/scenario lists): accept — local 2-user tool; the lists come from the validated server actions; the Header imports no persistence/native surface.

## Next Phase Readiness
- The dark instrument-panel chrome + persistent D-02 switcher are in place for 07-07 (assumptions rail), 07-08 (cockpit), 07-09 (heatmap/sensitivity), 07-11 (profile editor).
- **BLOCKER for 07-10:** the production `next build` requires the `@house/app` server-packaging decision above (drizzle migrations folder under bundling). The webpack + extensionAlias base is the correct platform for that fix.

---
*Phase: 07-web-shell*
*Completed: 2026-06-28*

## Self-Check: PASSED
- All plan files verified present on disk (components.json, Header.tsx, format.ts, layout.tsx, globals.css, .npmrc, lib/utils.ts).
- All task commits verified in git log (f48a796 install, 5ea58b8/1bb6521 Task 2, af4da67 Task 3).
- better-sqlite3 confirmed ABSENT from apps/web direct deps; tsc clean (sans 2 deferred 07-03 test errors); eslint apps/web exit 0.
