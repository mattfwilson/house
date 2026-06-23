<!-- GSD:project-start source:PROJECT.md -->

## Project

**Boston Home Affordability & FI-Impact Engine**

A personal home-affordability decision tool for me and my wife, focused on the greater Boston area. Unlike Zillow/Redfin — which start with houses and make you reverse-engineer whether you can afford them — this tool **inverts the flow**: it starts with our actual finances and FI (financial independence) goals, then projects outward to *what we can truly afford* and *which Massachusetts towns are realistic*.

This build is the **core engine only** — three modules (Affordability, Opportunity-Cost/FI-Impact, Town Scoring & Heatmap) with a thin Next.js shell over a pure, framework-agnostic calculation core. Live listing data is deliberately out of scope, walled off behind a `ListingsProvider` adapter.

**Core Value:** Answer **"what does buying this house do to our early-retirement timeline?"** — not "what will a bank lend us." The tool must be allowed to conclude "don't buy" or "rent and invest the difference." It is a decision tool, not a purchase funnel.

### Constraints

- **Tech stack**: Next.js + TypeScript front end — comfortable with this stack.
- **Architecture**: Pure calculation core, **zero framework deps** (no React inside it). All financial math in testable pure functions; UI is a thin shell. *Rationale: financial correctness is the whole product; it must be unit-testable in isolation and trustworthy.*
- **Persistence**: Local SQLite. Scenarios must be saveable and comparable side by side. *Rationale: simplest thing that saves scenarios for a private two-user tool; defer the rest.*
- **Testing**: calculation core fully unit-tested; FI math reconciled against the existing retirement model as a test oracle.

<!-- GSD:project-end -->

<!-- GSD:stack-start source:research/STACK.md -->

## Technology Stack

## TL;DR — The Prescriptive Stack

- **Repo layout:** npm workspaces monorepo with two packages — `packages/core` (pure calc engine, zero framework deps) and `apps/web` (Next.js shell). The boundary is enforced by *being a separate package*, not by convention.
- **App:** Next.js 16 (App Router), React 19, TypeScript 6.
- **Calc core:** plain TypeScript library, no React, no Next, no DOM. Imported by the app as a workspace dependency.
- **Money/decimal math:** **decimal.js 10** inside the core. **Not** dinero.js — see rationale; this is a rate-compounding engine, not a currency-formatting layer.
- **Testing:** **Vitest 4** with `projects` config so the core and app test independently. Vitest, not Jest.
- **Persistence:** **better-sqlite3 12** as the driver, **Drizzle ORM 0.45 + drizzle-kit** for schema/migrations/queries. Not Prisma.
- **Validation / boundary types:** **Zod 4** at the persistence and provider edges (and to make "assumptions as first-class stored data" round-trippable).
- **State/data:** Server Components + Server Actions for reads/writes; **Zustand 5** for the scenario-builder client UI state. No React Query needed (no network/remote API in scope).
- **Charts:** **Recharts 3** for net-worth / FI-trajectory line charts. Escalate to visx only if a custom heatmap interaction demands it.

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Next.js (App Router) | 16.2.x | UI shell, routing, server-side data access | Current major; App Router is the default and the only actively-developed router. Server Components + Server Actions let the thin shell read/write SQLite on the server without building a separate API layer — ideal for a private 2-user local tool. better-sqlite3 is on Next's auto-externalized list, so the native module "just works" server-side. |
| React | 19.2.x | View layer | Bundled expectation of Next 16; Server Components are stable here. |
| TypeScript | 6.0.x | Types everywhere, esp. the calc core | Non-negotiable for a correctness-critical financial engine. Strict mode + the core as its own package gives compile-time isolation from React. |
| decimal.js | 10.6.x | Arbitrary-precision decimal arithmetic in the calc core | Financial correctness is the product. Floating-point `number` silently corrupts amortization, compounding, and tax math. decimal.js gives exact base-10 arithmetic with configurable precision/rounding — the right primitive for interest accrual, FI projection, and sensitivity sweeps. It is what Prisma uses internally for its `Decimal` type (battle-tested). Zero framework deps; pure functions stay pure. |
| better-sqlite3 | 12.11.x | Synchronous SQLite driver | Fastest, simplest SQLite binding for Node. Synchronous API is a feature here: no async ceremony for a local single-file DB, trivially usable inside Server Actions. Auto-externalized by Next 16 (no `serverExternalPackages` config needed). |
| Drizzle ORM | 0.45.x | Type-safe schema, queries, migrations over SQLite | Schema is plain TypeScript → types are inferred, no codegen step, fast feedback loop. ~7KB, zero deps. First-class better-sqlite3 support. Migrations via drizzle-kit are real, readable SQL files (good for a reproducibility-focused tool). Reportedly far faster than Prisma on SQLite. |
| Vitest | 4.1.x | Unit test runner for the pure core and the app | Native ESM + TS, Vite-powered, near-instant watch loop. `projects` config tests `packages/core` and `apps/web` with separate configs in one command. The right tool for TDD-ing a financial engine against a test oracle. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| drizzle-kit | 0.31.x | Migration generation + `drizzle-studio` | Dev dependency; generate/apply migrations, inspect the local DB. |
| Zod | 4.4.x | Runtime validation + schema-derived types | Validate inputs at the `ListingsProvider` boundary, validate/parse stored assumption blobs and scenario snapshots so "reproducible scenarios" are guaranteed well-formed on load. Pair with drizzle-zod if you want schema-derived validators. |
| Zustand | 5.0.x | Client-side UI state for the scenario builder | Holding the in-progress scenario form / which scenarios are selected for side-by-side compare. Minimal, no boilerplate, no context gymnastics. Only for *ephemeral UI state* — persisted truth lives in SQLite. |
| Recharts | 3.8.x | Line/area charts: net-worth trajectory, FI-date divergence, scenario overlays | The headline visual is "trajectory vs no-purchase baseline" — multi-series line/area charts are Recharts' sweet spot. Declarative, React-native, fast to build. |
| @libsql/client | 0.17.x | (Optional) SQLite driver alternative | Only if you later want remote/edge-hosted SQLite (Turso). Not needed for the local-file build; listed so the persistence layer can be swapped without surprise. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| npm workspaces | Monorepo package linking | Built into npm; no extra tooling (Turborepo/pnpm are overkill for 2 packages). Root `package.json` with `"workspaces": ["packages/*", "apps/*"]`. |
| Vitest `projects` | Per-package test config | Root `vitest.config.ts` lists projects; the core project runs in `node` environment with no JSX transform, the web project can use `jsdom`/`happy-dom` if any component tests are added. Note: with `projects`, per-project configs can't `extends` the root — use a shared `vitest.shared.ts`. |
| `@vitest/coverage-v8` | Coverage for the core | Gate the calc core at high coverage (it's the product). |
| ESLint + Prettier | Lint/format | Add an `import/no-restricted-paths` (or eslint boundaries) rule forbidding `packages/core` from importing anything React/Next — turns the "no framework in the core" constraint into a CI failure, not a hope. |
| tsx / vitest bench | Reconciliation harness | Use to run the new FI core against the existing retirement model as a test oracle (golden-master tests). |

## Installation

# --- root (monorepo) ---

# --- packages/core (pure calc engine) ---

# NO react, NO next, NO dom libs here — that's the point

# --- apps/web (Next.js shell) ---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| decimal.js | big.js | big.js is leaner (precision in decimal places, nice for plain money). Fine if the math were only currency add/subtract/multiply. Chose decimal.js because FI projection needs heavy compounding, powers, and configurable significant-digit precision, and it shares semantics with Prisma's Decimal (familiar, well-tested). |
| decimal.js | dinero.js v2 (`dinero.js@2.0.2`) | Use dinero.js if the job is *representing and formatting discrete currency amounts* (cents-as-integer, 166 ISO currencies, i18n formatting). This project's core is a *rate/compounding engine*, not a transaction ledger — modeling everything as integer minor units fights amortization and growth math. Consider dinero.js only as a thin *display/formatting* helper at the UI edge, never inside the calc core. (Also note: the `@dinero.js/*` scoped alpha packages are a stalled rewrite — ignore them; `dinero.js@2.0.2` is the real stable release.) |
| Drizzle ORM | Prisma 7 | Prisma if you wanted a heavier, batteries-included ORM with Prisma Studio and a large team. For a 2-user local SQLite tool, Prisma's client size (~MBs), codegen step, and engine add weight for no benefit. Drizzle's TS-native schema = better fit. |
| Drizzle ORM | raw better-sqlite3 + hand-written SQL | Defensible for a tiny schema, and zero abstraction is appealing. But "scenarios reproducible / comparable side by side / two profiles" implies enough schema evolution that drizzle-kit migrations and inferred types pay off quickly. |
| better-sqlite3 | node:sqlite (Node built-in) | The built-in `node:sqlite` is maturing and Drizzle supports it. Reasonable in a year; today better-sqlite3 is more proven and Next auto-externalizes it. Revisit to drop a native dependency later. |
| Recharts | visx (@visx/visx 4) | visx (low-level D3 primitives) for the **town affordability heatmap** if it needs bespoke interaction/geographic rendering beyond what a chart lib offers. Trajectory charts stay on Recharts. |
| Recharts | Tremor / Nivo | If you want pre-styled dashboard blocks (Tremor) or a broader chart catalog (Nivo). Recharts is the safest default for line/area trajectory work. |
| Zustand | React Context + useReducer | Fine for trivial state; Zustand avoids re-render footguns and is barely more setup. |
| npm workspaces | pnpm / Turborepo | Use pnpm/Turbo if the repo grows many packages or needs build caching. Two packages don't justify it. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| JavaScript `number` for any money/rate math | Floating-point error (0.1 + 0.2 ≠ 0.3) silently corrupts amortization, compounding, and tax totals — exactly the calculations that ARE the product. Errors compound over a 20-year FI projection. | decimal.js inside the core; convert to `number` only at the chart/display edge. |
| `@dinero.js/core` / `@dinero.js/currencies` (scoped alpha) | Stalled rewrite stuck at alpha; the maintained stable line is the unscoped `dinero.js@2.0.2`. | If you use Dinero at all, use `dinero.js@2.x` — but prefer decimal.js for the core. |
| dinero.js *inside the calc core* | Models money as integer minor units for currency manipulation; wrong abstraction for rate compounding and projection math. | decimal.js for math; optionally dinero.js only for display formatting. |
| Jest | Slower, heavier ESM/TS config for a TS-first pure library; Vitest is the modern default with first-class TS/ESM and a faster watch loop. | Vitest 4. |
| Pages Router | Legacy; App Router is the default and where Server Actions / RSC live (which remove the need for a hand-rolled API layer). | App Router. |
| Prisma for this scope | Heavy client, codegen step, slower on SQLite, more moving parts than a local 2-user tool needs. | Drizzle + better-sqlite3. |
| Putting calc logic in React hooks/components | Makes the financial core untestable in isolation and couples correctness to the framework — violates the project's central constraint. | Pure functions in `packages/core`, enforced by lint boundary rules. |
| ORMs/state libs in `packages/core` | Any non-pure dependency in the core breaks testability and the "zero framework deps" rule. | Core takes plain data in, returns plain data out; persistence lives only in `apps/web`. |

## Stack Patterns by Variant

- better-sqlite3 + a single `.sqlite` file on disk, accessed from Server Actions.
- No auth, no network data layer, no React Query.
- Swap the Drizzle driver to `@libsql/client` (Turso) — Drizzle's SQLite dialect makes this a driver swap, not a rewrite.
- Only then consider TanStack Query if you introduce a remote API surface.
- Add visx for that one view; keep Recharts for trajectory charts. Don't adopt two general chart libs for the same job.
- `packages/core` `tsconfig` has no DOM lib, no JSX.
- ESLint `no-restricted-imports`/boundaries rule: core may not import `react`, `next`, or anything in `apps/`.
- Core's only runtime dependency is decimal.js.

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| next@16 | react@19, react-dom@19 | Next 16 expects React 19; install together. |
| next@16 | better-sqlite3@12 | better-sqlite3 is auto-externalized by Next's server bundler — no `serverExternalPackages` entry required. Verify after upgrades. |
| drizzle-orm@0.45 | better-sqlite3@12, drizzle-kit@0.31 | drizzle-orm + drizzle-kit versions move together; keep them in lockstep. |
| vitest@4 | projects config | `workspace` config is removed/deprecated post-3.2; use the `projects` array. Per-project configs cannot `extends` the root config — factor shared options into `vitest.shared.ts`. |
| typescript@6 | next@16, vitest@4 | TS 6 is current; all three support it. |
| decimal.js@10 | calc core | Pure, dependency-free; works identically in Node test env and browser bundle. |

## Sources

- npm registry (`npm view ... version`) — current `latest` tags for next (16.2.9), react (19.2.7), typescript (6.0.3), vitest (4.1.9), better-sqlite3 (12.11.1), drizzle-orm (0.45.2), drizzle-kit (0.31.10), prisma (7.8.0), decimal.js (10.6.0), dinero.js (2.0.2), big.js (7.0.1), recharts (3.8.1), zod (4.4.3), zustand (5.0.14), @libsql/client (0.17.4), @visx/visx (4.0.0) — HIGH confidence (authoritative registry, 2026-06-22).
- Next.js docs — serverExternalPackages / better-sqlite3 auto-externalization (https://nextjs.org/docs/app/api-reference/config/next-config-js/serverExternalPackages) and vercel/next.js PR #42294 — HIGH.
- Vitest docs — Test Projects / workspace deprecation (https://vitest.dev/guide/projects) — HIGH.
- Drizzle docs — SQLite get-started + driver support (https://orm.drizzle.team/docs/get-started-sqlite) — HIGH.
- dinero.js GitHub (issue #764, v2 release notes) — clarified stable line is `dinero.js@2.0.2`, scoped `@dinero.js/*` is stalled alpha — MEDIUM/HIGH.
- Money-lib comparisons: dev.to "A comparison of BigNumber libraries", frontstuff "How to Handle Monetary Values", LogRocket Dinero.js piece — MEDIUM (informs decimal.js-vs-big.js-vs-dinero rationale).

<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->

## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->

## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->

## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, `.github/skills/`, or `.codex/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->

## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:

- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->

## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
