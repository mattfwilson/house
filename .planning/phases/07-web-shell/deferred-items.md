# Phase 07 — Deferred Items

Out-of-scope discoveries logged during execution (not fixed — they predate the current task and are
outside its scope per the executor SCOPE BOUNDARY rule).

## From plan 07-04 (2026-06-28)

- **Pre-existing `tsc --noEmit` errors in two 07-03 test files** (surfaced only by a direct
  `npx tsc --noEmit -p apps/web/tsconfig.json`, which is NOT a project verification gate — apps/web uses
  `noEmit` and Next owns the build; the plan gates are `eslint apps/web` + `vitest run apps/web`):
  - `apps/web/src/app/actions/scenarios.test.ts(80)` — `Object is possibly 'undefined'` on `dto.rows[0].isBaseline` (`noUncheckedIndexedAccess`).
  - `apps/web/src/lib/dto/scenario.test.ts(109)` — same `noUncheckedIndexedAccess` indexing pattern.
  - These are in plan 07-03's files, not caused by 07-04. Trivial fixes (a guard or non-null assertion on the indexed access). Left for a 07-03 follow-up or a phase-wide typecheck-gate decision.

## From plan 07-06 (2026-06-28)

- **Same two pre-existing 07-03 `tsc` errors re-confirmed.** 07-06's acceptance gate runs
  `npx tsc -p apps/web/tsconfig.json --noEmit`, which still exits 1 solely because of the two
  07-03 test-file errors above. The 07-06 store files (`working-set.ts`, `selection.ts`,
  `recompute.ts`) contribute ZERO type errors (`grep "store/"` finds none in the tsc output) and
  `npx eslint apps/web/src/store` exits 0. Still out of scope (07-06 is directed to touch
  `apps/web/src/store/*` only; prior-plan files are locked).

## From plan 07-05 (2026-06-28) — BLOCKER for the 07-10 build gate (ARCHITECTURAL / Rule 4)

- **Production `next build` is blocked: bundling the raw-TS `@house/app` persistence package pulls
  its drizzle-migrations runtime directory.** 07-05's Header is the FIRST client component to pull
  the `list Server Action → container.server → @house/app` graph into an actual build. Two latent
  issues surfaced in order (the plan's own gate is `tsc --noEmit` + `eslint`, both PASS; the full
  `next build` is explicitly a 07-10 wave/phase gate, per the 07-05 PLAN):
  1. **FIXED in-scope (Rule 3):** Turbopack cannot remap `@house/core`/`@house/app`'s NodeNext `.js`
     relative re-export specifiers (e.g. `./affordability/bank-affordability.js`) to their `.ts`
     sources for symlinked workspace packages — 37 `Module not found` errors. Resolved by switching
     `apps/web` to the **webpack** bundler (`next dev/build --webpack`) + `experimental.extensionAlias`
     (`'.js' → ['.ts','.tsx','.js','.jsx']`). This preserves the locked "raw TS, no build step"
     decision (07-01 / CLAUDE.md) — only the bundler engine changes. `next.config.ts` documents it.
  2. **DEFERRED (Rule 4, architectural — 07-10):** after (1), webpack fails on
     `packages/app/src/adapters/persistence/db.ts:41` —
     `MIGRATIONS_FOLDER = fileURLToPath(new URL('../../../drizzle', import.meta.url))`. webpack
     statically analyzes `new URL(<literal>, import.meta.url)` as an asset and cannot resolve the
     drizzle **directory** of `.sql` migrations. Even if the build error were dodged, the bundled
     module's `import.meta.url` would point into `.next/server/…`, so the runtime migrations path
     would also be wrong. The correct fix is a **persistence-package server-packaging decision**, not
     a chrome-plan change, and it touches a locked Phase-06 file:
     - **Option A (recommended):** add a JS build step for `@house/app` (tsc emit to `dist/`, point
       its `exports` at the built output) and add `@house/app` (+ `better-sqlite3`, already
       auto-externalized) to `serverExternalPackages` so the Next server `require()`s it at runtime
       from `node_modules`, where `../../../drizzle` resolves intact. Contradicts the 07-01 "no build
       step" decision for `@house/app` specifically — a deliberate trade-off for the server boundary.
     - **Option B:** keep `@house/app` bundled but make the migrations folder runtime-locatable via
       `outputFileTracingIncludes` (copy `packages/app/drizzle/**` into the trace) + resolve the path
       from a stable anchor rather than the bundled `import.meta.url`.
     - **Option C (local-tool pragmatic):** since this is a private 2-user tool run from the repo,
       resolve the migrations folder from a workspace-anchored absolute path.
  - **NOT hacked here:** db.ts was deliberately left untouched — making its path non-statically-analyzable
    would silence the build error while introducing a silent runtime migration `ENOENT`. That belongs
    to the 07-10 build-integration decision above.
