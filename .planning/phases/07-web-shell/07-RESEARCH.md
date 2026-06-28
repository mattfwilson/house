# Phase 7: Web Shell - Research

**Researched:** 2026-06-28
**Domain:** Thin Next.js 16 App-Router shell over a pure TS calc core + imperative SQLite shell (functional-core / imperative-shell, ports-and-adapters)
**Confidence:** HIGH (stack is prescriptive in CLAUDE.md + verified against the actual code; one load-bearing capability GAP surfaced — see Open Questions Q1)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**App shape & navigation**
- **D-01:** Hybrid IA — a primary **cockpit** route + dedicated routes for the **town heatmap** and the **sensitivity tornado**. Cockpit carries the "flight simulator" feel; data-dense views get their own room.
- **D-02:** Persistent top **profile + scenario switcher** (header bar), always present. Cockpit is home; swapping active scenario re-flies instruments in place. Heatmap and sensitivity routes **inherit the active profile/scenario context** (active budget drives heatmap bucketing).
- **D-03:** **The cockpit IS the comparison view.** Landing shows the ranked-by-FI-date comparison table (all scenarios + rent-baseline row). Selecting a row expands that scenario's FI-impact instruments + assumptions inline.

**Headline view & FI-lead (anti-funnel)**
- **D-04:** Hero metric per row = **FI-date delta vs the no-purchase baseline** (e.g. "+3 yr 4 mo later"), color-honest (NOT green-good). Table ranked by this delta. Net-worth-at-horizon + monthly housing delta are secondary.
- **D-05:** **Rent-and-invest baseline = pinned, visually distinct benchmark row that also competes in the ranking.** If it out-ranks every buy it sorts to #1 — that IS the "don't buy" signal (no separate verdict chip).
- **D-06:** **Bank affordability is presented only as "the gap," framed as a warning.** True affordability is primary; bank appears as contrast ("a bank would approve ~$X more than your FI plan can absorb"), rendered as caution — never a target, never "headroom."
- **D-07:** **Hero visual inside an expanded scenario = the trajectory-vs-baseline chart** — net-worth-over-time line chart overlaying this scenario against the no-purchase (rent & invest) baseline, with the FI-threshold line and FI-date crossover markers on each. Built with **Recharts**.

**Assumptions ↔ results coupling**
- **D-08:** **Live recompute, debounced (~300ms), no Apply button.** Editing an assumption immediately re-flies the cockpit instruments.
- **D-09:** **Shared working assumption set drives the whole comparison** (apples-to-apples). **Saving a scenario freezes the current working set into that scenario's reproducible snapshot** (Phase-6 D-05/D-07: snapshot = canonical-JSON blob, Zod-validated on load). **Re-opening a saved scenario loads its frozen set as the new working set.**
- **D-10:** **Assumptions live in a persistent docked rail/sidebar**, always visible in the cockpit and echoed on heatmap + sensitivity routes, knobs inline next to instruments.

**Visual style & design system**
- **D-11:** **shadcn/ui + Tailwind** foundation (Radix primitives, copy-in). Run the **registry safety gate on init**. Resolves the app-chrome decisions the 05-UI-SPEC deferred.
- **D-12:** **Dense "instrument-panel" aesthetic** — data-forward, tighter spacing, darker surfaces, teal/amber/slate palette doing semantic work. Must stay anti-funnel: no success-green, no aspirational "buy this" styling.
- **D-13:** **Town heatmap rendered as a CSS-grid table-heatmap** (NOT visx this build) — towns×metrics matrix as styled CSS grid, cells colored by the locked bucket palette + lightness intensity, hatched "no data" cells, per-metric tooltips.

**Scenario builder**
- **D-14:** **Manual entry is the default path, with an optional "prefill from a sample listing"** (MockListingsProvider browse). Listings are never the required entry point.
- **D-15:** **Add/Edit is an inline expanding editor** within the comparison table (new/expanded editable row); on save it re-flies and re-ranks immediately. Not a modal, not a separate route.
- **D-16:** **The existing core Zod schemas are the single source of validation at the Server Action boundary.** Form inputs → canonical decimal strings → validated through `parseScenarioInputs` / `ScenarioInputsSchema` (and `parseHousehold` / `parseAssumptionSet`); field-level errors surfaced from the parse result. No duplicated validation in components, no bare-`number` money.

### Claude's Discretion
- **Sensitivity tornado view specifics** (per-driver swing read, bar ordering/labeling) — render faithfully over `tornado` output, top drivers labeled, "no headline number without a range" (FI-05). Whether sweeps recompute live or behind a "Run" trigger is left open (planner's call).
- **First-run / empty states** — follow 05-UI-SPEC copy where it applies (heatmap empty/error copy is verbatim-locked); standard "no profiles / no scenarios yet" affordances elsewhere.
- **Server Action / data-flow wiring** — how `makeContainer` is instantiated per request/process and threaded into Server Actions; App-Router route structure; where Zustand holds ephemeral builder/selection state vs server-truth. Follow ARCHITECTURE.md + the `packages/app` public surface.
- **Responsive layout** of rail + cockpit + inline editor at the ScenarioInputs/AssumptionSet field counts.

### Deferred Ideas (OUT OF SCOPE)
- **visx heatmap** — deferred in favor of a CSS-grid table-heatmap (D-13). Revisit only if interaction needs outgrow the grid.
- **Live/real listings UI** (`RealListingsProvider`, Zillow/Redfin/MLS/IDX) — out of scope project-wide; the port + mock keep it pluggable later.
- **Per-scenario assumption overrides** — deliberately rejected in favor of shared-working-set + freeze-on-save (D-09).
- **Explicit "Run" trigger for sweep-heavy views** — live recompute chosen for the cockpit (D-08); heatmap/sensitivity sweep cadence left to the planner.
- **Out of scope (project boundaries):** live listing data, auth/multi-tenant, any new financial math in the UI layer, live property-tax refresh.
</user_constraints>

<phase_requirements>
## Phase Requirements

Phase 7 introduces **no new v1 requirement** (CONTEXT.md; REQUIREMENTS.md ~line 137). It is the UI surface for engine requirements delivered in Phases 1–6. The table maps each surfaced requirement to the core entry point the UI renders over and the research that enables it.

| ID | Description | Core entry point surfaced | Research Support |
|----|-------------|---------------------------|------------------|
| TCO-* | Total cost of ownership breakdown | `computeTco` → `TcoBreakdown` (Money lines) | §Money at the Display Edge; serialize Money→display strings in the Server Action |
| AFF-01 | Bank (DTI) affordability ceiling | `bankAffordability` → `BankAffordabilityResult` | §Server Action / Service Boundary; D-06 "the gap" framing |
| AFF-02 | True (FI-plan) affordability ceiling | `trueAffordability` → `TrueAffordabilityResult` | same; primary number |
| AFF-03 | The bank-vs-true gap (anti-funnel) | `affordabilityGap` → `AffordabilityGapResult` (+ `evaluateScenario`) | D-06 amber-caution gap readout |
| FI-01/03 | Buy-vs-keep-renting FI-date impact | `fiImpact` → `FiImpactResult` | §Charts (D-07); §Open Q1 (trajectory series GAP) |
| FI-02 | FI-date projection | `projectFiDate` → `FiOutcome` | reached month / unreached cap → hero delta |
| FI-04/06 | N-scenario ranking + don't-buy row | `compareScenarios` → `CompareResult` (`rows[0]` = baseline) | D-03/D-04/D-05 cockpit table |
| FI-05 | "No headline number without a range" | `tornado` → `TornadoResult` | sensitivity route, top-3 drivers |
| ASMP-02 | Assumptions as first-class editable data | `parseAssumptionSet` / `AssumptionSetSchema` | D-10 rail; D-16 boundary validation |
| TOWN-01..04 | Town affordability heatmap matrix | `scoreTowns` → `TownScoreboard` | D-13 CSS-grid heatmap; 05-UI-SPEC encoding |
| PROF-01/02/03 | Profile CRUD + ≤2 cap | `saveProfile` / `listProfiles` / `MAX_PROFILES` | §Server Action boundary; profile editor |
| PROF-04 | Snapshot reproducibility survives the UI | `computeAndSaveScenario` freezes `EngineInput` | D-09 freeze-on-save; never mutate snapshot in place |
| LIST-01/02 | Listings behind a port | `MockListingsProvider` via `Container.listings` | D-14 optional prefill only |
</phase_requirements>

## Summary

Phase 7 builds `apps/web` — the **first** package under `apps/*`, a thin Next.js 16 / React 19 / TypeScript 6 shell over the already-shipped `@house/core` (pure calc engine) and `@house/app` (imperative shell + DI container). The architecture is already proven and locked: every number on screen comes from a core entry point reached through a thin Server Action wrapping a `@house/app` service. The web layer holds **zero financial logic**, performs **zero money math**, and duplicates **zero validation** — it formats core outputs and validates inputs through the existing core Zod schemas.

The single most consequential technical fact for the planner: **`@house/core`'s `Money` is a branded class instance with a private `Decimal` field and methods, and `Decimal` instances are likewise class instances. Neither can cross the React Server→Client serialization boundary.** React Server Components / Server Actions serialize only plain data (objects, arrays, primitives, `Date`, `Map`, `Set`, `BigInt`, `null`) — a class instance with methods/private fields throws or is stripped. Therefore every Server Action MUST convert `Money` → display/decimal strings (and `Decimal`-derived values → strings) BEFORE returning to a client component. The core already provides exactly the right exits: `Money.toString()` (2dp display), `Money.toDecimalString()` (canonical), `Money.toCents()` (bigint). This is the controlled conversion point — and it is also the single place where "no float coercion" is enforced.

The second consequential fact: **both workspace packages export raw `.ts` source** (`"exports": { ".": "./src/index.ts" }`, no build step). Next.js cannot consume raw TS from `node_modules`-linked workspaces without `transpilePackages: ['@house/core', '@house/app']`. Crucially, `@house/app` pulls in `better-sqlite3` (a native module), which Next 16 **auto-externalizes** (default `serverExternalPackages` list) — but a package may appear in `transpilePackages` OR `serverExternalPackages`, never both (Next throws at build start). These are different package names (`@house/app` is transpiled; `better-sqlite3` stays externalized), so they coexist — provided `@house/app` is **never imported into a client component**, which would drag `better-sqlite3` into the client bundle and break the build.

**Primary recommendation:** Scaffold `apps/web` as a Next 16 App-Router + Tailwind v4 + shadcn/ui (New York / slate / dark) workspace. Put `transpilePackages: ['@house/core', '@house/app']` in `next.config.ts`. Mark a `lib/container.server.ts` module `import 'server-only'`, instantiate the container as a process-level singleton there, and expose every engine call as a thin `'use server'` action that (1) parses inputs through the existing core Zod schemas, (2) calls one `@house/app` service or `@house/core` entry point, (3) maps the result's `Money`/`Decimal` fields to strings via a dedicated DTO mapper, and (4) returns the plain DTO. **Address Open Question Q1 first** — the D-07 hero trajectory chart needs a net-worth-over-time *series* that the core does not currently expose; a small pure-core addition (`fiTrajectory`) is the recommended resolution and must be planned as a Wave-0-ish core task, not hand-rolled in the web layer.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Financial math (TCO, affordability, FI, tornado, town scoring) | `packages/core` (pure) | — | Existential project constraint (CORE-01/02); lint + package boundary forbid it anywhere else |
| Orchestration (recompute-then-persist, ≤2-profile cap, snapshot freeze) | `packages/app` services | — | Pattern-1 imperative shell; already shipped Phase 6 |
| DI / adapter wiring (SQLite repos, MockListings) | `packages/app` `container.ts` | — | Single composition root (D-03); only site naming concretes |
| Data I/O (SQLite reads/writes) | `packages/app` adapters (server only) | — | `better-sqlite3` is server-only, auto-externalized by Next |
| Server Action boundary (parse → call service → map to DTO) | Next.js Server Actions / Server Components (`apps/web`) | — | Thin wrappers; the ONLY place Money→string conversion happens |
| `Money`/`Decimal` → display-string mapping | Server-side DTO mapper (`apps/web` server) | `@house/core` Money API | Must happen server-side; class instances can't cross RSC boundary |
| Form rendering, validation-error display, dollar formatting | Client Components (`apps/web`) | — | Render plain DTO strings; `Intl.NumberFormat` over decimal strings at the display edge |
| Ephemeral UI state (in-progress form, which rows selected/expanded, debounce buffer) | Zustand 5 (client) | — | Server-truth lives in SQLite; Zustand holds only transient UI state (D-08/D-15) |
| Charts (trajectory line, tornado bars) | Recharts 3 (client) | — | `'use client'`; consumes `number[]` converted ONCE from decimal strings |
| Heatmap render | CSS-grid table (client/server component) | — | No chart dep (D-13); colors from locked bucket palette |
| Routing / navigation / persistent header | Next App Router (`apps/web`) | — | Hybrid IA (D-01/D-02) |

## Standard Stack

All app-tier libraries below are **named in CLAUDE.md** (the project's authoritative prescriptive stack) and the **05-/07-UI-SPEC** (approved). Versions verified against the npm registry on 2026-06-28.

### Core (new to `apps/web`)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| next | 16.2.9 | App-Router shell, Server Components + Server Actions, native-module externalization | `[CITED: CLAUDE.md]` Current major; auto-externalizes `better-sqlite3`; no separate API layer needed. `[VERIFIED: npm registry 2026-06-28]` |
| react / react-dom | 19.2.x | View layer | `[CITED: CLAUDE.md]` Next 16 expects React 19; Server Components stable. next@16.2.9 peer: `^19.0.0` `[VERIFIED: npm]` |
| typescript | 6.0.x | Types across the shell | `[CITED: CLAUDE.md]` Already the repo's TS; matches core/app |
| tailwindcss | 4.3.1 | Styling foundation | `[CITED: 07-UI-SPEC + D-11]` shadcn/ui v4 path. `[VERIFIED: npm]` |
| @tailwindcss/postcss | 4.3.1 | Tailwind v4 PostCSS plugin (v4 moved the plugin out of core) | `[VERIFIED: npm]` Required for Tailwind v4 in Next |
| shadcn/ui (CLI, copy-in) | CLI latest (use `shadcn@canary` for TW v4 + React 19) | Radix-based copy-in components (you own the code) | `[CITED: 07-UI-SPEC + D-11]` New York is now the default style |
| recharts | 3.9.0 | Trajectory line chart (D-07), tornado bars | `[CITED: CLAUDE.md]` headline visual. peer: `^19.0.0` ok. `[VERIFIED: npm]` |
| zustand | 5.0.14 | Ephemeral scenario-builder / selection UI state | `[CITED: CLAUDE.md]` Only ephemeral UI state; server-truth in SQLite. `[VERIFIED: npm]` |
| lucide-react | shadcn default | Icon library | `[CITED: 07-UI-SPEC]` shadcn default |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| geist (font) | via `next/font` | Geist Sans (UI) + Geist Mono (all numeric readouts, `tabular-nums`) | `[CITED: 07-UI-SPEC]` numeric instrument alignment |
| server-only | latest | Build-time guard: throws if a server module is imported into a client bundle | Mark `lib/container.server.ts` + any `@house/app`-importing module — prevents `better-sqlite3` client-bundle leak |
| @house/core | workspace `*` | Engine entry points + types + Zod schemas | Imported for types (client) AND values (server actions) |
| @house/app | workspace `*` | Services + `makeContainer` + `Container` | **Server-only**; never import into a client component |

### Already present (DO NOT re-add)
`better-sqlite3@^12.11.1`, `drizzle-orm@^0.45.2`, `decimal.js`, `zod@^4.4.3` are dependencies of `@house/core`/`@house/app`. The web app depends on the workspace packages; it should **not** add `better-sqlite3` to its own `package.json` (Next 16.1+ Turbopack resolves the transitive externalized dep without it).

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| CSS-grid heatmap (D-13) | visx (`@visx/visx`) | Deferred — only if interaction outgrows the grid. Do NOT pull in for this build. |
| Recharts | visx | Sanctioned escalation for a bespoke heatmap interaction only; trajectory/tornado stay Recharts. |
| Zustand | React Context + useReducer | Fine for trivial state; Zustand avoids re-render footguns for the debounced builder. |
| Server Actions | Route Handlers / a REST API | No remote API in scope; Server Actions remove the API layer entirely. |

**Installation (after `apps/web` scaffold):**
```bash
# scaffold (run from repo root; creates apps/web in the existing npm-workspace)
npx create-next-app@16 apps/web --ts --app --tailwind --eslint --src-dir --no-import-alias
# inside apps/web: declare workspace deps in apps/web/package.json:
#   "@house/core": "*", "@house/app": "*", "recharts": "^3.9.0",
#   "zustand": "^5.0.14", "lucide-react": "...", "server-only": "..."
npm install            # from repo root (npm workspaces links @house/*)
cd apps/web && npx shadcn@canary init   # New York / slate / dark per 07-UI-SPEC
```
**Version verification (run before locking the plan):**
```bash
npm view next version          # expect 16.2.x
npm view recharts version      # expect 3.9.x  (React 19 peer ok)
npm view zustand version       # expect 5.0.x
npm view tailwindcss version   # expect 4.3.x
```

## Package Legitimacy Audit

> slopcheck could not be installed in this session — the sandbox classifier correctly blocked installing/executing an agent-chosen external package. Per the graceful-degradation protocol, the table records npm-registry verification + the fact that **every package is named in CLAUDE.md / the approved 07-UI-SPEC** (CITED from project-authoritative sources, not agent-discovered). The planner should still gate the *first* `npm install` of any package not already in the lockfile behind a `checkpoint:human-verify` task, but the slop risk here is minimal: all are first-party (Vercel / pmndrs / Tailwind Labs / shadcn) with very high download counts.

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| next | npm | ~9 yrs | ~8M/wk | github.com/vercel/next.js | not run | Approved (CITED: CLAUDE.md) |
| react / react-dom | npm | ~12 yrs | ~30M/wk | github.com/facebook/react | not run | Approved (CITED: CLAUDE.md) |
| recharts | npm | ~9 yrs | ~3M/wk | github.com/recharts/recharts | not run | Approved (CITED: CLAUDE.md) |
| zustand | npm | ~6 yrs | ~6M/wk | github.com/pmndrs/zustand | not run | Approved (CITED: CLAUDE.md) |
| tailwindcss | npm | ~8 yrs | ~15M/wk | github.com/tailwindlabs/tailwindcss | not run | Approved (CITED: 07-UI-SPEC) |
| @tailwindcss/postcss | npm | TW v4 era | high | github.com/tailwindlabs/tailwindcss | not run | Approved (TW v4 requirement) |
| lucide-react | npm | ~4 yrs | ~3M/wk | github.com/lucide-icons/lucide | not run | Approved (shadcn default) |
| server-only | npm | (Vercel) | high | github.com/vercel/next.js | not run | Approved |
| shadcn (CLI) | npm | ~2 yrs | high | github.com/shadcn-ui/ui | not run | Approved (official registry, D-11) |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none
**Registry safety gate (D-11):** No third-party shadcn registries declared (07-UI-SPEC) — only the official registry blocks (button, card, table, dialog, alert-dialog, slider, tabs, tooltip, select, popover, input, form, label, badge, sidebar, sonner). Vetting is N/A unless a third-party block is later introduced.

## Architecture Patterns

### System Architecture Diagram

```
                          BROWSER (client components, 'use client')
  ┌─────────────────────────────────────────────────────────────────────────────┐
  │  Cockpit page         Heatmap page        Sensitivity page                    │
  │  ┌──────────────┐     ┌────────────┐       ┌────────────┐                      │
  │  │ Comparison   │     │ CSS-grid   │       │ Tornado    │   Persistent header: │
  │  │ table (rows  │     │ heatmap    │       │ bars       │   profile + scenario │
  │  │ + baseline)  │     │ (Recharts- │       │ (Recharts) │   switcher (D-02)    │
  │  │ + inline     │     │  free)     │       └────────────┘                      │
  │  │  editor      │     └────────────┘                                           │
  │  │ + Recharts   │     Assumptions rail (D-10) echoed on every route            │
  │  │  trajectory  │                                                              │
  │  └──────┬───────┘   Zustand: ephemeral form/selection/debounce buffer          │
  └─────────┼───────────────────────────────────────────────────────────────────┘
            │  form inputs (plain numerics → decimal strings)
            │  debounced ~300ms (D-08)
            ▼  Server Action call  (React serialization: PLAIN DATA ONLY both ways)
  ┌─────────────────────────────────────────────────────────────────────────────┐
  │            SERVER (Next.js Server Actions / Server Components)                 │
  │  'use server'  actions in  app/actions/*.ts                                   │
  │   1. parse inputs through @house/core Zod (parseScenarioInputs / parse-       │
  │      Household / parseAssumptionSet)  ── D-16 boundary; field errors out      │
  │   2. call ONE @house/app service OR @house/core entry point                   │
  │   3. map result Money/Decimal → strings via toDTO()  ── the ONLY conversion   │
  │   4. return plain DTO (no class instances cross back to the client)           │
  │                                                                               │
  │  lib/container.server.ts  ('import server-only')                              │
  │    process-singleton  makeContainer(DB_PATH)  → Container (ports only)         │
  └───────┬──────────────────────────────────┬────────────────────────────────────┘
          │ pure calls                        │ ports
          ▼                                   ▼
   @house/core (PURE)                  @house/app services → container → SQLite adapters
   computeTco / evaluateScenario /     computeAndSaveScenario / loadScenario /
   affordabilityGap / fiImpact /       listScenarios / deleteScenario /
   compareScenarios / tornado /        saveProfile / listProfiles
   scoreTowns / fiTrajectory*          (*fiTrajectory = NEW pure core entry — Open Q1)
```

### Recommended Project Structure
```
apps/web/
├── package.json                # @house/core, @house/app, next, react, recharts, zustand, lucide, server-only
├── next.config.ts              # transpilePackages: ['@house/core','@house/app']
├── tsconfig.json               # extends repo TS; references ../../packages/{core,app}
├── postcss.config.mjs          # @tailwindcss/postcss
├── components.json             # shadcn (new-york / slate / rsc:true)
├── vitest.config.ts            # NEW vitest project entry (jsdom/happy-dom)
└── src/
    ├── app/
    │   ├── layout.tsx          # geist fonts, dark slate base, persistent header
    │   ├── page.tsx            # cockpit (D-03) — server component reads, client table
    │   ├── heatmap/page.tsx    # town heatmap route (D-01) inherits active context
    │   ├── sensitivity/page.tsx# tornado route (D-01)
    │   └── actions/            # 'use server' — one file per surface
    │       ├── scenarios.ts    # compute/save/load/list/delete + compare + recompute
    │       ├── profiles.ts     # save/list/delete profile
    │       ├── towns.ts        # scoreTowns
    │       └── sensitivity.ts  # tornado
    ├── lib/
    │   ├── container.server.ts # 'server-only' — process-singleton container
    │   ├── dto/                # Money/Decimal → string mappers (server) + DTO types
    │   └── format.ts           # Intl.NumberFormat over decimal strings (CLIENT display edge)
    ├── components/
    │   ├── ui/                 # shadcn copy-in
    │   ├── cockpit/            # comparison table, expanded scenario, inline editor
    │   ├── rail/               # assumptions rail (D-10)
    │   ├── charts/             # 'use client' Recharts wrappers (trajectory, tornado)
    │   └── heatmap/            # CSS-grid heatmap (D-13)
    └── store/                  # Zustand: working-set, selection, debounce buffer
```

### Pattern 1: `transpilePackages` + server-only boundary (the wiring that makes the monorepo build)
**What:** Both `@house/core` and `@house/app` export raw `.ts`. Next must transpile them. `@house/app`'s transitive `better-sqlite3` must stay server-only and externalized.
**When to use:** Always — this is the load-bearing scaffold config.
```typescript
// apps/web/next.config.ts
import type { NextConfig } from 'next';
const nextConfig: NextConfig = {
  // Workspace packages ship raw TS → Next must compile them.
  transpilePackages: ['@house/core', '@house/app'],
  // DO NOT add better-sqlite3 here AND in serverExternalPackages — Next throws.
  // better-sqlite3 is auto-externalized (default list); Next 16.1+ Turbopack resolves
  // the transitive externalized dep through @house/app without extra config.
};
export default nextConfig;
```
```typescript
// apps/web/src/lib/container.server.ts
import 'server-only';                 // build error if this is imported by a client component
import { makeContainer, type Container } from '@house/app';

// Process-level singleton: makeContainer runs migrations at construction (see container.ts),
// so build it ONCE and reuse across requests. better-sqlite3 is synchronous; no pool needed.
let _c: Container | undefined;
export function container(): Container {
  if (!_c) _c = makeContainer(process.env.HOUSE_DB_PATH ?? './house.sqlite');
  return _c;
}
```
**Anti-pattern it prevents:** Importing `@house/app` (or `container.server.ts`) into any `'use client'` component drags `better-sqlite3` into the client bundle → build failure. The `server-only` package turns that into a clear compile-time error.

### Pattern 2: Thin Server Action (parse → call → map → plain DTO)
**What:** Every engine call is a 3–4 line `'use server'` function. No math, no validation logic, no `Money`/`Decimal` returned.
```typescript
// apps/web/src/app/actions/scenarios.ts
'use server';
import { parseScenarioInputs, parseHousehold, parseAssumptionSet,
         engineInput, evaluateScenario, compareScenarios } from '@house/core';
import { container } from '@/lib/container.server';
import { toCompareDTO, toEvaluateDTO } from '@/lib/dto/scenario';

export async function recompareAction(raw: {
  household: unknown; assumptions: unknown; scenarios: unknown[]; baseline: unknown;
}) {
  // D-16: validate ONLY through the existing core schemas; surface field errors from the parse.
  const household   = parseHousehold(raw.household);
  const assumptions = parseAssumptionSet(raw.assumptions);
  const baseline    = engineInput(/* asOf, assumptions, scenario, household */);
  const inputs      = raw.scenarios.map((s) => engineInput(/* ... */));
  // ONE pure call — no financial logic here.
  const result = compareScenarios(baseline, inputs);
  // Map Money/Decimal → strings BEFORE returning (class instances can't cross RSC).
  return toCompareDTO(result);   // plain serializable object
}
```
**Key:** the action returns `toCompareDTO(...)` — a plain object whose every dollar is a `string`. The client never sees `Money`.

### Pattern 3: The single Money→string conversion point (DTO mapper)
**What:** A dedicated server-side mapper is the ONLY place that calls `Money.toString()` / `.toDecimalString()` / `.toCents()`. This is simultaneously the RSC-serialization fix AND the "no float coercion" enforcement point.
```typescript
// apps/web/src/lib/dto/scenario.ts   (SERVER — runs inside the action)
import type { CompareResult } from '@house/core';

export interface CompareRowDTO {
  label: string;
  outcomeKind: 'reached' | 'unreached';
  fiMonth: number | null;          // FiOutcome.month or null
  cappedAtMonth: number | null;    // FiOutcome.cappedAtMonth or null
  fiDeltaMonths: number | null;    // already a number|null in core (safe to pass)
  fiDeltaYears: string | null;     // already a decimal string in core
  isBaseline: boolean;
}
export function toCompareDTO(r: CompareResult): { rows: CompareRowDTO[] } {
  return { rows: r.rows.map((row) => ({
    label: row.label,
    outcomeKind: row.outcome.kind,
    fiMonth: row.outcome.kind === 'reached' ? row.outcome.month : null,
    cappedAtMonth: row.outcome.kind === 'unreached' ? row.outcome.cappedAtMonth : null,
    fiDeltaMonths: row.fiDeltaMonths,
    fiDeltaYears: row.fiDeltaYears,
    isBaseline: row.isBaseline,
  })) };
}
// For Money-bearing results (TcoBreakdown, AffordabilityGapResult, FiTargets):
//   dollars cross as money.toDecimalString()  (canonical, for chart conversion)
//   OR money.toString()                       (2dp, for direct display)
// NEVER Number(money.toDecimalString()) on the server for math — only at the chart edge.
```
Note: `CompareRow.fiDeltaMonths` (`number|null`) and `fiDeltaYears` (`string|null`) and `FiOutcome` are **already plain-serializable** — `compareScenarios` carries no `Money`. The mapper still exists to flatten the discriminated `FiOutcome` for the table and to be the consistent boundary for the Money-bearing results (`evaluateScenario`, `affordabilityGap`, `fiTargets`, `computeTco`).

### Pattern 4: Container instantiation (process singleton, sync, migrations-at-construction)
`makeContainer(dbPath)` opens the DB, **runs migrations at construction**, shares one connection across both repo adapters, and returns a port-typed `Container` (verified in `packages/app/src/container.ts`). It is synchronous (better-sqlite3 is sync). Build it **once per process** in `container.server.ts`; do not call `makeContainer` per request (it would re-run migrations and open a new handle each time, and on Windows an unclosed handle blocks DB-file deletion — see `Container.close`). Dev hot-reload caveat: stash the singleton on `globalThis` to survive Next dev module reloads (the standard Next + native-DB pattern).

### Pattern 5: Live debounced recompute (D-08) without races
**What:** Editing an assumption knob updates Zustand working-set → debounced ~300ms → fires `recompareAction`. Because the core is synchronous and fast, the round-trip is cheap.
**Pitfall to plan for:** out-of-order action responses. Use a monotonically increasing request id (or React `useTransition` + `useDeferredValue`, or an AbortController-style "latest wins" guard) so a slow earlier recompute can't overwrite a newer result. Keep the debounce buffer + "pending" flag in Zustand.

### Anti-Patterns to Avoid
- **Returning `Money`/`Decimal`/class instances from a Server Action** → RSC serialization error or silently-stripped methods. Always map to strings first.
- **Importing `@house/app` into a client component** → `better-sqlite3` in the client bundle → build failure. Use `server-only`.
- **Putting any arithmetic on dollars in a component or action** → violates CORE-01/02 and "no financial logic in the shell." All math stays in `@house/core`.
- **`Number(decimalString)` anywhere except the single chart-conversion edge** → re-opens the float hole the whole project exists to close.
- **Re-deriving a net-worth trajectory in the web layer for the D-07 chart** → that is financial math; it belongs in the core (Open Q1).
- **Listing `better-sqlite3` in both `transpilePackages` and `serverExternalPackages`** → Next throws at build start.
- **Re-reading a mutable assumption set at view time** → breaks snapshot reproducibility (Phase-6 anti-pattern). Saved scenarios replay their frozen `EngineInput` only.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Input validation at the form boundary | A parallel UI Zod schema or ad-hoc checks | `parseScenarioInputs` / `parseHousehold` / `parseAssumptionSet` from `@house/core` | D-16; single source of truth; field errors come from the parse result |
| Money math / formatting precision | `Number(x) * rate`, `.toFixed()` on floats | `Money` API in core; `Intl.NumberFormat` over `toDecimalString()` at the display edge | Float coercion is the project's central forbidden act |
| FI ranking + don't-buy ordering | A client-side sort of scenarios | `compareScenarios` (returns `rows[0]`=baseline, unreached last) | Locked anti-funnel ranking (D-04/D-05/FI-06) |
| Bank-vs-true gap | A component computing the difference | `affordabilityGap` / `evaluateScenario` | AFF-03; the gap is a core output |
| Tornado driver swing | Per-driver perturbation loops in the UI | `tornado` → `TornadoResult` (top-3 already flagged) | FI-05; sensitivity is a core re-run |
| Town heatmap matrix + bucketing | UI computing buckets from price | `scoreTowns` → `TownScoreboard` (bucket/composite/flags per town) | TOWN-01..04; 05-UI-SPEC encoding |
| Persistence / migrations / ≤2-profile cap | A new DB layer or cap check | `@house/app` services + `makeContainer` | Phase 6 shipped this; cap is a service invariant |
| Snapshot freeze on save | UI copying assumptions into a blob | `computeAndSaveScenario` (freezes the `EngineInput`) | PROF-04; canonical-JSON, Zod-validated on load |
| Server/client native-module split | Manual webpack externals | Next `serverExternalPackages` default + `server-only` | Next 16 auto-externalizes better-sqlite3 |

**Key insight:** Phases 1–6 already built every number and every persistence/orchestration concern. The web layer's entire job is **format core outputs + validate inputs through core schemas + wire Server Actions**. Anything that looks like math or a new data rule is a signal you're in the wrong tier.

## Common Pitfalls

### Pitfall 1: `Money` / `Decimal` cannot cross the RSC serialization boundary
**What goes wrong:** A Server Action or Server Component passes a `Money` (or a `TcoBreakdown` containing `Money` lines) to a client component. React's server→client serialization supports only plain data (objects/arrays/primitives/`Date`/`Map`/`Set`/`BigInt`/`null`). A branded class instance with a private `Decimal` field and methods is not serializable — you get a runtime error or a stripped, method-less object.
**Why it happens:** Core results are full of `Money` (e.g. `TcoBreakdown.lines`, `AffordabilityGapResult.signedGap`, `FiTargets.*`). `Decimal` instances are the same hazard.
**How to avoid:** A dedicated server-side DTO mapper converts every `Money` → `toString()`/`toDecimalString()` and every `Decimal`-derived value → string BEFORE the action returns (Pattern 3). The mapper is the single conversion point.
**Warning signs:** "Only plain objects can be passed to Client Components" errors; `money.toString is not a function` on the client; a dollar rendering as `[object Object]` or `{}`.

### Pitfall 2: `better-sqlite3` leaking into the client bundle
**What goes wrong:** Importing `@house/app` (services/container) — even a type-only import that isn't `import type` — from a `'use client'` module pulls the native `better-sqlite3` into the client graph; the build fails or bloats.
**Why it happens:** Convenience imports of service functions or the `Container` type from the wrong tier.
**How to avoid:** `import 'server-only'` at the top of `container.server.ts` and any module that touches `@house/app`. Import only **types** from `@house/core` into client components (and prefer DTO types you own). Keep all `@house/app` value imports inside `app/actions/*` and `lib/*.server.ts`.
**Warning signs:** Webpack/Turbopack error naming `better-sqlite3` or `.node` binaries; "Module not found: Can't resolve 'fs'/'bindings'" in a client chunk.

### Pitfall 3: `transpilePackages` ↔ `serverExternalPackages` conflict
**What goes wrong:** Adding `better-sqlite3` to `transpilePackages` (or to `serverExternalPackages` when it's already in the default list AND you transpile its parent) — Next throws at build start: a package cannot be in both lists.
**Why it happens:** Over-configuring in response to a native-module error.
**How to avoid:** Only the workspace TS packages (`@house/core`, `@house/app`) go in `transpilePackages`. Leave `better-sqlite3` alone — Next 16 auto-externalizes it, and 16.1+ Turbopack resolves it transitively through `@house/app`. Verify with a clean `next build` early.
**Warning signs:** "The packages specified in 'transpilePackages' conflict with 'serverExternalPackages'."

### Pitfall 4: Container re-instantiation per request
**What goes wrong:** Calling `makeContainer()` inside each action re-runs migrations and opens a new SQLite handle every call; on Windows an unclosed handle blocks DB-file deletion (the `Container.close` comment documents this).
**How to avoid:** Process singleton in `container.server.ts`; stash on `globalThis` to survive dev hot-reload. Never call `makeContainer` in a hot path.
**Warning signs:** Slow actions; "database is locked"; EBUSY on the `.sqlite` file in dev.

### Pitfall 5: Float re-entry at the chart edge
**What goes wrong:** Recharts requires `number` data. Converting decimal strings to `number` too early (e.g. in the action, then doing further math) re-opens the float hole.
**How to avoid:** Convert `decimalString → Number(...)` ONLY inside the chart-data builder, at the very last step, after all math is done in the core. Document that single call site. Display dollars use `Intl.NumberFormat` over the **string**, not the float.
**Warning signs:** `Number()` calls outside `components/charts/*`; cent drift in displayed totals vs the table.

### Pitfall 6: Out-of-order debounced recompute (D-08)
**What goes wrong:** Rapid knob edits fire overlapping `recompareAction` calls; a slow earlier response lands after a newer one and stale numbers stick.
**How to avoid:** "Latest wins" guard — monotonic request id in Zustand, or `useTransition`/`useDeferredValue`; ignore responses whose id is stale.
**Warning signs:** Instruments flicker to an old value after a burst of edits.

### Pitfall 7: Server Actions are POST endpoints (security)
**What goes wrong:** Treating Server Actions as private function calls. They compile to publicly-callable POST endpoints. Even for a local 2-user tool, unparsed input reaching the engine is a correctness/DoS hazard.
**How to avoid:** Every action validates through the core Zod schemas (D-16) before doing anything (ASVS V5). Never trust the client-supplied shape.

## Runtime State Inventory

> Phase 7 is greenfield (creating `apps/web`), not a rename/refactor. No stored data, live-service config, OS-registered state, secrets, or build artifacts are being renamed or migrated. The one runtime-state consideration is **where the SQLite DB file lives**: the web app must point `makeContainer` at the same DB path the Phase-6 stack uses (a config/env decision, `HOUSE_DB_PATH`), not create a divergent second store.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | SQLite file consumed via `@house/app` (Phase 6) | Web app must target the same `dbPath`; no schema change (migrations already run at container construction) |
| Live service config | None — local single-process tool | None |
| OS-registered state | None | None |
| Secrets/env vars | `HOUSE_DB_PATH` (new, optional) — DB file location for the web process | Document in `.env.local`; no secret value |
| Build artifacts | `apps/web/.next/` (new, gitignored) | Standard Next gitignore |

## Code Examples

### Display formatting at the client edge (decimal string → formatted dollars, no float math)
```typescript
// apps/web/src/lib/format.ts  (CLIENT — display only)
const USD = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
// Input is a canonical decimal string from Money.toDecimalString(); Number() here is the
// LAST step and feeds only the formatter — never further math.
export const formatUSD = (decimalString: string) => USD.format(Number(decimalString));
// FI-date delta copy (D-04) from fiDeltaMonths:
export function fiDeltaLabel(months: number | null): { text: string; tone: 'delay'|'earlier'|'none' } {
  if (months === null) return { text: '—', tone: 'none' };
  const y = Math.floor(Math.abs(months) / 12), m = Math.abs(months) % 12;
  if (months > 0)  return { text: `+${y} yr ${m} mo later`,  tone: 'delay' };    // amber
  if (months < 0)  return { text: `${y} yr ${m} mo earlier`, tone: 'earlier' };  // neutral, NOT green
  return { text: 'same FI date', tone: 'none' };
}
```

### Recharts trajectory wrapper (consumes pre-converted `number[]`)
```tsx
// apps/web/src/components/charts/TrajectoryChart.tsx
'use client';
import { LineChart, Line, XAxis, YAxis, ReferenceLine, ReferenceDot, Tooltip } from 'recharts';
// points: { month: number; buy: number; rent: number }[]  — converted ONCE upstream from
// decimal strings (Pitfall 5). fiThreshold/buyFiMonth/rentFiMonth are plain numbers.
export function TrajectoryChart({ points, fiThreshold, buyFiMonth, rentFiMonth }: {
  points: { month: number; buy: number; rent: number }[];
  fiThreshold: number; buyFiMonth: number | null; rentFiMonth: number | null;
}) {
  return (
    <LineChart data={points} width={640} height={320}>
      <XAxis dataKey="month" /><YAxis />
      <Line dataKey="rent" dot={false} />   {/* baseline */}
      <Line dataKey="buy"  dot={false} />   {/* this scenario — divergence IS the cost */}
      <ReferenceLine y={fiThreshold} />      {/* FI-threshold line (D-07) */}
      {buyFiMonth  != null && <ReferenceDot x={buyFiMonth}  y={fiThreshold} />}
      {rentFiMonth != null && <ReferenceDot x={rentFiMonth} y={fiThreshold} />}
      <Tooltip />
    </LineChart>
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `next.config.js` `serverComponentsExternalPackages` (experimental) | `serverExternalPackages` (stable, top-level) + auto-externalized default list incl. better-sqlite3 | Next 15+ | No manual config for better-sqlite3 |
| Transitive externalized deps needed in your own package.json | Next 16.1 Turbopack resolves transitive externalized deps automatically | Next 16.1 | Web app needn't declare better-sqlite3 |
| Tailwind config in `tailwind.config.js` + `tailwindcss` PostCSS plugin | Tailwind v4: CSS-first `@theme`, plugin moved to `@tailwindcss/postcss` | TW v4 | New PostCSS config; shadcn supports v4 |
| shadcn default style | New York is now default; `shadcn@canary` for TW v4 + React 19 | 2025 | Matches 07-UI-SPEC lock |

**Deprecated/outdated:**
- `experimental.serverComponentsExternalPackages` → renamed `serverExternalPackages` (stable).
- Pages Router → App Router (Server Actions live here).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The D-07 hero chart requires a net-worth-over-time **series** not currently exposed by the core; a pure-core `fiTrajectory` addition is the right fix | Open Q1 | If the planner instead hand-rolls the series in the web layer, it violates "zero financial logic in the shell" (CORE-01). Needs a decision. |
| A2 | shadcn CLI for Tailwind v4 + React 19 may require `shadcn@canary init` rather than stable `shadcn init` | Standard Stack | If stable CLI already supports v4 at execution time, canary is unnecessary; verify at init. Low risk (init is interactive/idempotent). |
| A3 | Web app should NOT declare `better-sqlite3` in its own package.json (Next 16.1+ resolves it transitively) | Pattern 1 | If transitive resolution fails on the actual project, a single explicit `serverExternalPackages: ['better-sqlite3']` entry (NOT transpilePackages) is the fallback. Verify with `next build`. |
| A4 | `HOUSE_DB_PATH` is the env var name for the DB file location | Runtime State Inventory | Name is a new convention; planner may pick another. No external contract depends on it. |
| A5 | The DB file is shared with the Phase-6 stack at one path | Runtime State | If a separate DB is intended for the app, this changes; needs confirmation but low-stakes for a 2-user tool. |

**All other claims are `[VERIFIED: npm registry]` (versions), `[CITED: CLAUDE.md / 05-/07-UI-SPEC / source code]`, or direct reads of the actual `packages/core` & `packages/app` source.**

## Open Questions

1. **The D-07 hero trajectory chart needs a net-worth-over-time series the core does not expose. (HIGH priority — resolve before planning the chart wave.)**
   - **What we know:** `projectFiDate` returns only a final `FiOutcome` (`reached` month / `unreached` cappedAtMonth). `fiImpact` returns both outcomes + `FiTargets` + deltas — no series. `rentVsBuy` returns only `buyEndingNetWorth` / `rentEndingNetWorth` / `crossoverYear` — no per-period series. Verified by reading `fi/projection.ts`, `fi/fi-impact.ts`, `tco/rent-vs-buy.ts`. The internal projection loop *does* compute month-by-month NW for both paths but discards every point except the crossing.
   - **What's unclear:** D-07 (approved, load-bearing) requires "a net-worth-over-time line chart overlaying this scenario against the no-purchase baseline, with the FI-threshold line and FI-date crossover markers on each." There is no core output that yields the line.
   - **Recommendation:** Add a **pure** `fiTrajectory(input): { points: { month, buyNetWorth: Money, rentNetWorth: Money }[]; fiThreshold: Money; buyFiMonth: number|null; rentFiMonth: number|null }` (or year-sampled) entry point to `@house/core`, reusing the existing `projectFiDate` machinery (refactor the loop to optionally emit the series, or add a thin series-emitting variant). This keeps the trajectory math in the core (CORE-01/02), is a small, well-bounded addition reusing proven primitives, and feeds the chart a plain DTO after Money→string mapping. The planner should schedule this as an early "core capability" task that the cockpit chart wave depends on. Do NOT compute the series in the web layer. (This is technically a small core touch, but it surfaces an existing engine capability rather than introducing new financial *rules* — consistent with "UI surface for previously-built outputs." Flag for user confirmation since it touches `packages/core`.)

2. **Sensitivity recompute cadence (Claude's discretion, D-08 vs sweep cost).** Live debounced recompute is locked for the cockpit. The tornado runs `fiImpact` ~12 times (6 drivers × 2 directions). Recommendation: the tornado route can recompute live on assumption-rail edits (it's still cheap and synchronous), but if profiling shows lag, gate it behind an explicit "Run" affordance (the deferred-ideas escape hatch). Planner's call; no blocker.

3. **Where does the "working assumption set" persist across navigation (D-09/D-10)?** The rail is echoed on heatmap + sensitivity routes which "inherit the active context." Recommendation: hold the working set in Zustand (ephemeral) keyed to the active scenario; persist-to-SQLite happens only on Save (freeze). Confirm the working set is NOT silently written back to the snapshot on navigation (would break PROF-04).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Next 16 build/runtime (needs ≥ 20.9) | ✓ | v24.15.0 | — |
| npm (workspaces) | Monorepo linking | ✓ | 11.12.1 | — |
| better-sqlite3 (native) | Persistence via @house/app | ✓ (installed in @house/app, smoke-tested Phase 6) | ^12.11.1 | — |
| next | apps/web | ✗ (apps/ dir does not exist yet) | target 16.2.9 | install on scaffold |
| recharts / zustand / tailwindcss / shadcn CLI | apps/web | ✗ (not installed) | 3.9.0 / 5.0.14 / 4.3.1 / latest | install on scaffold |

**Missing dependencies with no fallback:** none (all are standard installs during the `apps/web` scaffold).
**Missing dependencies with fallback:** none.
**Note:** Node 24 is well above Next 16's floor (20.9). The native `better-sqlite3` binary already builds/runs in this environment (Phase 6 smoke test) — no rebuild risk from the web layer since it consumes `@house/app`, not the driver directly.

## Validation Architecture

> `workflow.nyquist_validation` is `true` in config.json — this section is required.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.x (already the repo runner) |
| Config file | Root `vitest.config.ts` uses `test.projects: ['packages/*']` — **must extend to include `apps/web`** (see Wave 0) |
| Quick run command | `npx vitest run apps/web` (after the project entry exists) |
| Full suite command | `npm test` (root `vitest run`) |

The new `apps/web` Vitest project needs a **jsdom or happy-dom** environment for any component tests (the core/app projects run in `node`). Vitest 4 `projects` cannot `extends` the root — factor shared options into a shared file if needed (CLAUDE.md note). Component testing of shadcn/Radix + Recharts is optional; the load-bearing tests are the boundary contracts below.

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| D-16 | Server Action rejects invalid input via core Zod (field errors, no UI schema) | unit (server action) | `npx vitest run apps/web/src/app/actions/scenarios.test.ts -t "rejects invalid"` | ❌ Wave 0 |
| Pitfall 1 | DTO mapper returns NO `Money`/class instance — every dollar is a string (RSC-serializable) | unit | `npx vitest run apps/web/src/lib/dto -t "serializable"` (assert `JSON.parse(JSON.stringify(dto))` deep-equals dto; no method-bearing field) | ❌ Wave 0 |
| CORE-01/02 (shell half) | No component/action does dollar math; web never imports raw `Dec`; `Number()` only under `components/charts/**` | lint/grep gate | `npx eslint apps/web` + a grep test for `Number(` outside charts | ❌ Wave 0 |
| Pitfall 2 | `@house/app` / `container.server` not reachable from any `'use client'` module | boundary (eslint) | extend `eslint.config.ts` with an `apps/web` boundaries rule | ❌ Wave 0 |
| D-04/D-05/FI-06 | Comparison DTO preserves core ranking: `rows[0].isBaseline`, unreached rows last | unit | `npx vitest run apps/web/src/lib/dto -t "ranking preserved"` | ❌ Wave 0 |
| FI-05 | Tornado DTO carries finite swings + top-3 (no Infinity) | unit | `npx vitest run apps/web -t "tornado dto finite"` | ❌ Wave 0 |
| D-07 (if Q1 resolved) | `fiTrajectory` core series → chart DTO is finite `number[]` | unit (core + dto) | `npx vitest run packages/core -t "fiTrajectory"` then dto test | ❌ Wave 0 (+ core task) |
| PROF-04 | Save freezes working set; reopen replays frozen snapshot (no live re-join) | integration (action + in-mem container) | `npx vitest run apps/web -t "snapshot replay"` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run apps/web` (web project only — fast).
- **Per wave merge:** `npm test` (full root suite — core 469+ tests stay green; web project added).
- **Phase gate:** Full suite green + `next build` succeeds (proves no client-bundle leak / no transpile conflict) before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `apps/web/vitest.config.ts` — new Vitest project (jsdom/happy-dom) + add `apps/web` to root `projects` (currently `['packages/*']`).
- [ ] `apps/web/src/lib/dto/*.test.ts` — RSC-serializability + ranking-preservation tests (the core boundary guards).
- [ ] `apps/web/src/app/actions/*.test.ts` — Server Action validates-through-core-Zod + snapshot-replay (use an in-memory container / `:memory:` DB).
- [ ] `eslint.config.ts` — `apps/web` boundary block (no `@house/app` in client modules; `Number()` confined to `components/charts/**`).
- [ ] Framework install: covered by the scaffold; confirm `vitest` picks up the new project.

## Security Domain

> `security_enforcement` is `true`, `security_asvs_level` 1, `security_block_on` high. This is a **local, single-process, no-auth, no-network, 2-user** tool (CLAUDE.md). Most ASVS categories are N/A by construction; the live surface is the Server Actions.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No auth in scope (local 2-user tool) |
| V3 Session Management | no | No sessions |
| V4 Access Control | no | No multi-tenant; single local user space |
| V5 Input Validation | **yes** | **Every Server Action parses inputs through the existing core Zod schemas** (`parseScenarioInputs`/`parseHousehold`/`parseAssumptionSet`) before any use (D-16). This is already the locked design. |
| V6 Cryptography | no | No secrets, no crypto (and core is forbidden `crypto` by lint) |

### Known Threat Patterns for Next.js Server Actions (local tool)
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Server Actions compile to public POST endpoints; unvalidated payload reaches the engine | Tampering / DoS | Zod-parse at the boundary (V5, D-16); reject before calling the service. The core also throws on non-canonical money/unseeded towns — defense in depth. |
| Malformed/forged scenario snapshot loaded from DB | Tampering | Already mitigated in `@house/app`: the SQLite adapter re-validates every snapshot leaf through `parseAssumptionSet`/`parseScenarioInputs`/`parseHousehold` on load (Phase 6, T-06-12). The web layer inherits this. |
| Path traversal via DB path / file inputs | Tampering | `HOUSE_DB_PATH` is operator-set config, not user input; no user-supplied file paths reach the filesystem. |
| Native module / dependency in client bundle (info exposure / build integrity) | Information Disclosure | `server-only` guard + boundary lint keep `@house/app`/better-sqlite3 server-side (Pitfall 2). |

**No high-severity security blockers identified for this phase.** The single load-bearing control (Zod validation at the Server Action boundary) is already a locked decision (D-16).

## Sources

### Primary (HIGH confidence)
- `packages/core/src/index.ts`, `money/money.ts`, `fi/compare.ts`, `fi/fi-impact.ts`, `fi/projection.ts`, `fi/sensitivity.ts`, `towns/score-towns.ts`, `tco/rent-vs-buy.ts` — actual engine surface + result shapes (read this session).
- `packages/app/src/index.ts`, `container.ts`, `services/scenario-service.ts` — service surface + DI container (read this session).
- `eslint.config.ts`, root `package.json`, `vitest.config.ts`, `packages/{core,app}/package.json` — boundary rules, workspace + raw-`.ts`-export wiring, test config (read this session).
- `.planning/phases/07-web-shell/07-CONTEXT.md` + `07-UI-SPEC.md` — locked decisions D-01..D-16 + approved UI contract.
- `.planning/research/ARCHITECTURE.md` — functional-core/imperative-shell + ports-and-adapters; dependency direction.
- `CLAUDE.md` — prescriptive stack (Next 16 / React 19 / TS 6 / Recharts 3 / Zustand 5 / decimal.js / better-sqlite3 / Vitest).
- npm registry via `npm view` (2026-06-28): next 16.2.9, recharts 3.9.0, zustand 5.0.14, tailwindcss 4.3.1, @tailwindcss/postcss 4.3.1; next peer react `^19.0.0`; recharts peer react `^19.0.0`.
- [next.config.js: serverExternalPackages | Next.js](https://nextjs.org/docs/app/api-reference/config/next-config-js/serverExternalPackages)
- [next.config.js: transpilePackages | Next.js](https://nextjs.org/docs/app/api-reference/config/next-config-js/transpilePackages)
- [Next.js 16.1 | Next.js](https://nextjs.org/blog/next-16-1) — Turbopack transitive externalized-dep resolution.
- [Tailwind v4 - shadcn/ui](https://ui.shadcn.com/docs/tailwind-v4) + [Next.js - shadcn/ui](https://ui.shadcn.com/docs/installation/next)

### Secondary (MEDIUM confidence)
- [transpilePackages ↔ serverExternalPackages conflict discussion](https://github.com/vercel/next.js/discussions/91901) — confirms a package can't be in both lists.
- [Guides: Package Bundling | Next.js](https://nextjs.org/docs/pages/guides/package-bundling) — externalization default list.

### Tertiary (LOW confidence)
- General community articles on Next + SQLite (Medium) — corroborate the server-only DB pattern; not relied on for specifics.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every library is prescribed in CLAUDE.md/UI-SPEC and version-verified on npm.
- Architecture / wiring: HIGH — grounded in the actual `packages/core` & `packages/app` source + verified Next 16 docs.
- Pitfalls (RSC serialization, native-module leak, transpile conflict): HIGH — RSC serialization limits are well-established React behavior; the Money/Decimal class-instance hazard is confirmed by reading `money.ts`; Next config conflict confirmed by docs/discussion.
- D-07 trajectory GAP (Open Q1): HIGH that the gap exists (read all three candidate sources); recommendation is MEDIUM (the exact core API shape is the planner's/discuss's call).

**Research date:** 2026-06-28
**Valid until:** ~2026-07-28 (Next/shadcn/Tailwind move fast; re-verify versions and the `shadcn@canary` requirement at execution time).
