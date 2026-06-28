# Phase 6: Persistence & Listings Adapter - Research

**Researched:** 2026-06-27 (refresh — re-verified all in-repo references + package versions same-day)
**Domain:** Imperative shell over a pure calc core — local SQLite persistence (better-sqlite3 + Drizzle) behind repository ports, ListingsProvider adapter, manual DI, canonical-JSON snapshot reproducibility
**Confidence:** HIGH (stack re-verified against npm registry + Drizzle docs; every load-bearing in-repo file path/line re-read against current `master`)

## Summary

This phase builds the **imperative shell** (ports-and-adapters / hexagonal) around the already-proven pure core. Phases 1-5 are complete (26/26 plans); the core owns every reproducibility primitive this phase depends on — `canonicalJson` (recursive key-sort, float-free), the Zod `decStr` boundary, and `parseAssumptionSet` / `parseScenarioInputs` / `parseHousehold` validators, all exported from the public barrel (`packages/core/src/index.ts`, re-read 2026-06-27). The single most important finding is unchanged and re-confirmed: **the save/load path is not new engineering — it is the `roundTrip()` helper in `packages/core/src/golden.test.ts:308-333`, promoted from test helper to production persistence code.** That function already serializes `{ asOf, assumptions, scenario, household? }` via `canonicalJson`, then rebuilds it back through Zod (`parseAssumptionSet`, `parseScenarioInputs`, `parseHousehold`, `calendarDate`) — never a bare cast. Phase 6 stores that serialized blob in a SQLite TEXT column and reloads it through the same validators.

The repo is **still a single-package npm-workspaces monorepo** (`packages/core` only — verified: no `apps/` directory, no `packages/app` yet). This phase introduces the **first second package, `packages/app`** — the imperative shell holding orchestration services, the SQLite adapters, the MockListingsProvider, and the manual DI container. Ports (`ProfileRepository`, `ScenarioRepository`, `ListingsProvider`) and the `Listing`/snapshot domain types are added to core's barrel as pure TypeScript `interface` declarations — core keeps its zero-framework-dep rule, enforced by the existing `eslint-plugin-boundaries` deny-by-default guard (`eslint.config.ts:32-137`).

Two design points sharpened in this refresh:
1. **A `Profile` is `{ id, name } & Household`, and `Household` has NINE leaves, not five.** The five PROF-01-visible fields (net worth, income, savings rate, debt, rent) are necessary but insufficient — the affordability/FI engines also consume `downPaymentCash`, `reserve`, `currentAnnualSavings`, and `targetAnnualRetirementSpend` (verified in `engine-input.ts:116-155`). A profile that persists only the five PROF-01 columns cannot drive the engines. Persist the **full Household** (see Profile-storage recommendation below).
2. **The scenario snapshot embeds a FROZEN copy of the household** (plus assumptions, scenario, asOf), independent of the live profile row. This is the PROF-04 reproducibility guarantee surviving contact with SQLite: a saved scenario reloads to byte-identical canonical JSON even after the owning profile is later edited. The profile row is the editable "current" household; the scenario snapshot is the immutable as-of-save `EngineInput`.

All three runtime packages re-verified same-day and slopcheck-clean: **better-sqlite3 12.11.1, drizzle-orm 0.45.2, drizzle-kit 0.31.10** (exactly the CLAUDE.md prescription). better-sqlite3 12 declares `engines.node: 20.x..26.x` (Node 24.15.0 installed — in range) and installs via `prebuild-install || node-gyp rebuild` — a prebuilt binary, no source compile expected on Windows.

**Primary recommendation:** Scaffold `packages/app` as an npm workspace; define the ports + `Listing` + `Profile` + `SavedScenario` types in core's barrel; build `SqliteScenarioRepository` / `SqliteProfileRepository` (Drizzle + better-sqlite3) and `MockListingsProvider` as adapters wired through `container.ts`; persist the scenario snapshot as a `canonicalJson` TEXT blob re-validated through Zod on load; persist the full `Household` on the profile; and prove the contract with (a) a shared repository contract-test suite run against both the SQLite adapter and an in-memory fake, and (b) a save→reload→byte-identical-canonical-JSON reproducibility test mirroring the existing golden harness.

## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Introduce a **new `packages/app`** workspace package for the imperative shell — orchestration services + concrete adapters (`SqliteScenarioRepository`, `SqliteProfileRepository`, `MockListingsProvider`) + a **manual DI container** (`container.ts`) that wires adapters → ports. The shell is buildable/testable **without Next.js**; Phase 7's `apps/web` becomes a thin caller. Persistence lives in `packages/app`, **not** `apps/web` — this supersedes the CLAUDE.md TL;DR wording.
- **D-02:** **Ports/interfaces live in `packages/core`** (`ProfileRepository`, `ScenarioRepository`, `ListingsProvider`) — the side that defines the need owns the contract (dependency inversion). `core` keeps its **zero-framework-dep** rule: pure `interface` declarations only, no better-sqlite3/Drizzle import in core. Adapters in `packages/app` depend inward on these ports.
- **D-03:** **DI discipline (success criterion 3):** outside the DI container, code depends **only on the port interface, never the concrete adapter type**. The container is the single composition root that names concrete types.
- **D-04:** This repo uses **npm workspaces** (root `package.json` `workspaces: ["packages/*","apps/*"]`, `package-lock.json` — verified). `packages/app` consumes `core` via the workspace protocol. (`ARCHITECTURE.md` mentions pnpm; the actual repo is npm — follow npm.)
- **D-05:** A saved scenario stores its **full input + assumption snapshot as a validated canonical-JSON TEXT blob** — produced by reusing Phase 1's `canonicalJson` serializer and **Zod-parsed on load**. Reproducibility primitive: save → reload → re-serialize yields byte-identical canonical JSON.
- **D-06:** Alongside the blob, store **thin queryable columns** — `id`, `profile_id` (FK), `name`, `created_at`, `updated_at` — so scenarios can be listed/reloaded without deserializing every blob. The blob remains the source of truth; columns are derived/index metadata only.
- **D-07:** The scenario snapshot embeds the **`AssumptionSet` snapshot** (versioned + `parseAssumptionSet`-validated). **No separate `AssumptionSetRepository`** this phase.
- **D-08:** The `ListingsProvider` port exposes a **minimal-but-real** surface: `getListings(query): Listing[]` (query = a small filter, e.g. town and/or price range) and `getListingById(id): Listing | null`. No pagination/structured-filter speculation.
- **D-09:** The `Listing` domain type is seeded from **Boston-home fields** — id, address, town (consistent with the Phase-5 town table where sensible), list price (canonical **decimal string / `Money`**, never bare `number`), beds, baths, living sqft, property type. Exact field set is Claude's discretion within this shape; `MockListingsProvider` returns **hand-seeded static fixtures**.
- **D-10:** **Up to two financial profiles** (soft cap — not hard-pinned to exactly 2). Profile fields: net worth, income, savings rate, existing debts, current rent.
- **D-11:** Scenarios belong to a profile (FK), **uniquely named within their profile**, with **created/updated timestamps** and **edit + delete** support. Schema evolution via **drizzle-kit migrations** (real, readable SQL files).

### Claude's Discretion

- Exact `Listing` field set and the `getListings` query shape (which filters: town, price range, beds-min?) — keep minimal, honest, fixture-backed.
- Repository **contract-test** strategy — ideally one shared port-contract test suite run against both the SQLite adapter and an in-memory/mock fake, plus a **snapshot round-trip reproducibility test** (save → reload → identical canonical JSON).
- Whether the soft "≤2 profiles" cap is enforced at the repository/service layer (validate-and-throw) vs left as a UI convention — **lean toward a service-layer guard** so the invariant is real without the UI.
- DB file location/bootstrapping (single local `.sqlite`), Drizzle schema module organization, and the `vitest` `projects` entry for `packages/app` (node env, no JSX).
- Orchestration service granularity (`computeAndSaveScenario`, `loadScenario`, `listScenarios`) — shape per `ARCHITECTURE.md` Pattern 1.

### Deferred Ideas (OUT OF SCOPE)

- `apps/web` Next.js shell (forms, comparison table, heatmap, sensitivity charts, Server Actions) — Phase 7.
- `RealListingsProvider` / live listing data (Zillow/Redfin/MLS/IDX/RentCast/ATTOM) — explicit anti-feature; the port exists precisely to keep this pluggable.
- Richer `ListingsProvider` surface (pagination, structured multi-filter queries).
- Separate `AssumptionSetRepository` — assumptions ride inside the scenario snapshot this phase.
- Scenario comparison / sensitivity-sweep orchestration as user-facing flows — Phase 7.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PROF-01 | Create/save two financial profiles (net worth, income, savings rate, existing monthly debts, current rent) | `Profile` type (`{ id, name } & Household`) + `ProfileRepository` port (core); `SqliteProfileRepository` (app) with service-layer ≤2 soft-cap guard (D-10). **Persist the FULL nine-leaf `Household`** (`engine-input.ts:116-155`), not just the five PROF-01-visible fields, so the profile can drive the affordability/FI engines. Single `parseProfile` boundary reusing `decStr`. |
| PROF-02 | Create multiple named house scenarios under a profile (price, down %, town, term, rate, HOA, …) | `SavedScenario` snapshot wraps the existing `EngineInput` (`{ asOf, assumptions, scenario, household? }`, all already Zod-validated); `ScenarioRepository.save/listByProfile`; unique-name-within-profile constraint (D-11). |
| PROF-03 | Save scenarios and reload them in a later session | `SqliteScenarioRepository` over a persistent `.sqlite` file; load path re-parses the blob through `parseScenarioInputs`/`parseAssumptionSet`/`parseHousehold` + `calendarDate` (the `roundTrip()` body, `golden.test.ts:308-333`). |
| LIST-01 | Clean `ListingsProvider` adapter interface, isolated from the core | Pure `interface ListingsProvider` in `packages/core` barrel (D-02/D-08); no engine math touches it; consumed only through the interface (D-03). |
| LIST-02 | `MockListingsProvider` returning static fixtures exercises the interface end to end | `MockListingsProvider implements ListingsProvider` in app/adapters with hand-seeded `Listing[]`; contract test drives both methods (D-08/D-09). |

> **Note on PROF-04 (reproducibility):** Already complete (Phase 1, re-confirmed `Complete` in REQUIREMENTS.md traceability). Phase 6 must not *re-implement* it — it must *preserve* it. The new persistence path is the first real-world exercise of the Phase-1 snapshot contract; the save→reload→byte-identical test is the proof it survived contact with SQLite. The scenario snapshot embeds a **frozen** household copy precisely so a later profile edit cannot retroactively change a saved scenario's result.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Port/interface contracts (`ProfileRepository`, `ScenarioRepository`, `ListingsProvider`) | Core (`packages/core`) | — | Dependency inversion — the high-level policy owns the contract (D-02). Pure `interface` only; zero framework dep. |
| Domain types (`Profile`, `SavedScenario` snapshot, `Listing`) | Core | — | Types are the product's vocabulary; `Profile` reuses `Household`, `SavedScenario` reuses `EngineInput`/`AssumptionSet`. |
| Orchestration services (`computeAndSaveScenario`, `loadScenario`, `listScenarios`, `saveProfile`) | App (`packages/app`) | Core (pure calc call) | "Imperative shell" — gather I/O, generate timestamps, call the pure engine once, persist (ARCHITECTURE Pattern 1). |
| SQLite persistence (schema, queries, migrations) | App / adapters | Drizzle + better-sqlite3 | Concrete I/O behind the repo ports; the only place native deps live. |
| Snapshot serialization / validation | Core (primitives) | App (call site) | `canonicalJson` + Zod parsers live in core; the app calls them at the persistence boundary. |
| Listings (mock fixtures) | App / adapters | — | Walled-off volatile dependency; `MockListingsProvider` is the only impl this build. |
| Manual DI composition root | App (`container.ts`) | — | Single place that names concrete adapter types (D-03). |
| Timestamp generation (`createdAt`/`updatedAt`) | App (shell) | — | Core forbids `Date.now()` (ESLint `no-restricted-properties`, `eslint.config.ts`). Clock lives in the shell only. |

## Standard Stack

### Core (already installed — reuse, do not re-add to core)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| decimal.js | 10.6.0 | Decimal money math inside `Money` | Already the sole runtime dep of core; list-price/profile money fields use `Money` / decimal strings. `[VERIFIED: packages/core/package.json]` |
| zod | 4.4.3 | Boundary validation | Already core's validation primitive; new persisted Zod schemas (Profile, Listing, SavedScenario wrapper) follow the `decStr` + `.strict()` pattern. `[VERIFIED: packages/core/package.json]` |

### Supporting (NEW — install in `packages/app`, never in `packages/core`)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| better-sqlite3 | 12.11.1 | Synchronous SQLite driver | The DB driver. Synchronous API is a feature: no async ceremony in adapters. `engines.node: 20.x..26.x` → Node-24-compatible prebuilt binaries. `[VERIFIED: npm registry 2026-06-27]` |
| drizzle-orm | 0.45.2 | Type-safe schema + queries | Schema-as-TypeScript; inferred row types; first-class better-sqlite3 support. `[VERIFIED: npm registry 2026-06-27]` |
| drizzle-kit | 0.31.10 | Migration generation + apply (dev dep) | `drizzle-kit generate` emits readable SQL migration files; `drizzle-kit migrate` applies them (D-11). `[VERIFIED: npm registry 2026-06-27]` |
| @types/better-sqlite3 | 7.6.13 | Ambient types (dev dep) | better-sqlite3 ships no bundled types. DefinitelyTyped-maintained; the 7.6.x line tracks the 12.x runtime. `[VERIFIED: npm registry 2026-06-27 — exists at 7.6.13; slopcheck OK]` |

**Installation (run from repo root; `-w` targets the new workspace):**
```bash
# scaffold packages/app/package.json first (name @house/app, "type":"module"), then:
npm install better-sqlite3@12 drizzle-orm@0.45 -w @house/app
npm install -D drizzle-kit@0.31 @types/better-sqlite3 -w @house/app
# core dependency via workspace protocol in packages/app/package.json:
#   "dependencies": { "@house/core": "*", "better-sqlite3": "^12.11.1", "drizzle-orm": "^0.45.2" }
#   "devDependencies": { "drizzle-kit": "^0.31.10", "@types/better-sqlite3": "^7.6.13" }
```

> **Wave-0 install smoke-test:** immediately after install, run `node -e "new (require('better-sqlite3'))(':memory:'); console.log('ok')"` to confirm the native binary loaded before any adapter is written (Pitfall 3).

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| better-sqlite3 | `node:sqlite` (Node built-in) | Drizzle supports it and it drops a native dep, but CLAUDE.md mandates better-sqlite3 and it is more proven today. Revisit in v2 (locked decision — do not substitute). |
| Drizzle | raw better-sqlite3 + hand SQL | Defensible for a tiny schema, but D-11 schema evolution + inferred row types favor drizzle-kit migrations. Locked. |
| Drizzle | Prisma | Heavier client + codegen; CLAUDE.md "What NOT to Use". Locked against. |
| Profile as typed columns | Profile household as a canonical-JSON blob (like scenarios) | A blob is more consistent with the scenario snapshot path and future-proofs `Household` schema growth, but loses queryability. Given ≤2 profiles, queryability is moot — see Profile-storage recommendation. Either is acceptable; recommend typed columns for an editable "current" household plus a single `parseProfile` boundary. |

## Package Legitimacy Audit

slopcheck (latest) scanned all four packages on the npm registry: **4 OK, 0 SLOP, 0 SUS.** (The scan completed cleanly; the tool's subsequent attempt to run a real `npm install` was blocked by the sandbox — irrelevant to the legitimacy verdict.)

| Package | Registry | Age / Version | Source Repo | slopcheck | Disposition |
|---------|----------|---------------|-------------|-----------|-------------|
| better-sqlite3 | npm | ~8 yrs, v12.11.1 latest | github.com/WiseLibs/better-sqlite3 | [OK] | Approved |
| drizzle-orm | npm | active, v0.45.2 latest | github.com/drizzle-team/drizzle-orm | [OK] | Approved |
| drizzle-kit | npm | active, v0.31.10 latest | github.com/drizzle-team/drizzle-orm | [OK] | Approved |
| @types/better-sqlite3 | npm | DefinitelyTyped, v7.6.13 | github.com/DefinitelyTyped/DefinitelyTyped | [OK] | Approved |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

All three primary packages match the exact versions CLAUDE.md prescribes (verified independently via `npm view`), each `dist-tags.latest` equals the installed-target version (no drift), and better-sqlite3's install script is the standard `prebuild-install || node-gyp rebuild --release` — a native-module prebuild, no postinstall network-call red flags.

## Architecture Patterns

### System Architecture Diagram

```
        ┌──────────────────────────────────────────────────────────────┐
        │  TEST DRIVERS (this phase) / apps/web Server Actions (Phase 7) │
        └───────────────────────────┬──────────────────────────────────┘
                                     │ calls services, gets the DI container
                                     ▼
   ┌──────────────────────── packages/app (imperative shell) ───────────────────────┐
   │                                                                                 │
   │   container.ts ──(names concrete types — the ONLY place)──┐                      │
   │      │ provides ports                                     │                      │
   │      ▼                                                    ▼                      │
   │  services/                                          adapters/                    │
   │   computeAndSaveScenario(repo, listings, …) ─┐       persistence/                │
   │   loadScenario(repo, id) ────────────────────┤        SqliteScenarioRepository   │
   │   listScenarios(repo, profileId) ────────────┤        SqliteProfileRepository    │
   │   saveProfile(repo, profile)  [≤2 guard] ────┘        db.ts (drizzle+better-sql3)│
   │      │ depend ONLY on port interfaces                  schema.ts (drizzle tables) │
   │      │ (timestamps generated HERE)                    listings/                   │
   │      │                                                 MockListingsProvider       │
   │      ▼                                                 fixtures.ts                │
   └──────┼──────────────────── ports (interfaces) ───────────────────────────────────┘
          │                                  ▲ implemented by adapters above
          ▼ pure call                        │
   ┌─────────────── packages/core (PURE — zero framework dep) ─────────────────┐
   │  ports/  ProfileRepository · ScenarioRepository · ListingsProvider         │
   │  types   Profile(={id,name}&Household) · SavedScenario(EngineInput) · Listing│
   │  reuse   canonicalJson · parseAssumptionSet · parseScenarioInputs ·        │
   │          parseHousehold · calendarDate · Money · fiImpact/compareScenarios │
   └────────────────────────────────────────────────────────────────────────────┘

   SAVE path:  EngineInput {asOf, assumptions(V4), scenario, household?}
               → canonicalJson(...)  → TEXT blob → SQLite scenarios.snapshot column
   LOAD path:  SQLite TEXT → JSON.parse → parseAssumptionSet / parseScenarioInputs /
               parseHousehold / calendarDate (NEVER a bare cast) → re-canonicalJson === stored blob
```

### Recommended Project Structure

```
packages/app/
├── package.json              # @house/app; deps: @house/core, better-sqlite3, drizzle-orm; dev: drizzle-kit, @types/better-sqlite3
├── tsconfig.json             # extends ../../tsconfig.base.json; types:["node","better-sqlite3"]; rootDir src; composite
├── vitest.config.ts          # mergeConfig(defineProject({ ...sharedTest, name:'app', environment:'node' }), {})
├── drizzle.config.ts         # dialect:'sqlite', schema:'./src/adapters/persistence/schema.ts', out:'./drizzle'
├── drizzle/                  # GENERATED migration SQL files + meta/_journal.json (committed — reproducibility)
└── src/
    ├── index.ts              # app public surface (services + makeContainer)
    ├── container.ts          # manual DI composition root — ONLY file naming concrete adapters
    ├── boundary.test.ts      # lint-as-test: services may not import concrete adapters (D-03)
    ├── services/
    │   ├── scenario-service.ts   # computeAndSaveScenario, loadScenario, listScenarios, deleteScenario
    │   └── profile-service.ts    # saveProfile (≤2 guard), listProfiles
    └── adapters/
        ├── persistence/
        │   ├── db.ts                       # openDb(source) better-sqlite3 + drizzle factory; runMigrations()
        │   ├── schema.ts                   # drizzle tables: profiles, scenarios
        │   ├── scenario-repo.ts            # SqliteScenarioRepository implements ScenarioRepository
        │   ├── profile-repo.ts             # SqliteProfileRepository implements ProfileRepository
        │   ├── in-memory-repos.ts          # InMemory*Repository fakes (contract-test second target)
        │   └── repository-contract.test.ts # shared repositoryContract() factory, run twice
        └── listings/
            ├── mock-provider.ts  # MockListingsProvider implements ListingsProvider
            ├── mock-provider.test.ts
            └── fixtures.ts       # hand-seeded Listing[] (Boston towns from town-table)

packages/core/src/
├── ports/                    # NEW — pure interfaces (D-02)
│   ├── repositories.ts       # ProfileRepository, ScenarioRepository
│   └── listings.ts           # ListingsProvider, ListingsQuery
├── types/                    # NEW — Profile, SavedScenario(snapshot), Listing + their Zod schemas + parse fns
│   ├── profile.ts
│   ├── listing.ts
│   └── saved-scenario.ts
└── index.ts                  # barrel gains the above exports
```

### Pattern 1: Functional Core, Imperative Shell (ARCHITECTURE Pattern 1)
**What:** Services gather I/O, generate timestamps, call one pure function, persist the output.
**When:** Every service in `packages/app`.
```typescript
// packages/app/src/services/scenario-service.ts — IMPERATIVE shell
// Source: ARCHITECTURE.md Pattern 1
import type { ScenarioRepository } from '@house/core';        // PORT, not concrete
import { fiImpact } from '@house/core';                       // PURE calc
import type { SavedScenario } from '@house/core';

export function loadScenario(repo: ScenarioRepository, id: string): SavedScenario | null {
  return repo.load(id);   // I/O → returns a VALIDATED EngineInput-shaped snapshot (re-parsed inside the adapter)
}
// computeAndSaveScenario: build EngineInput → fiImpact(...) (pure) → repo.save({...snapshot, createdAt: Date.now()})
// Date.now() lives HERE (the shell), never inside a core function.
```

### Pattern 2: Ports and Adapters — ListingsProvider (ARCHITECTURE Pattern 2)
**What:** App depends on the `interface`; the concrete `MockListingsProvider` is injected at the edge.
```typescript
// packages/core/src/ports/listings.ts — the contract, owned by core (D-02/D-08)
export interface ListingsProvider {
  getListings(query: ListingsQuery): Listing[];      // D-08: synchronous, minimal filter
  getListingById(id: string): Listing | null;
}
export interface ListingsQuery {
  readonly town?: string;          // align with town-table where sensible (D-09)
  readonly minPrice?: string;      // canonical decimal string (never bare number)
  readonly maxPrice?: string;
}

// packages/app/src/adapters/listings/mock-provider.ts — the ONLY impl this build
export class MockListingsProvider implements ListingsProvider {
  constructor(private readonly fixtures: readonly Listing[]) {}
  getListings(q: ListingsQuery): Listing[] { return this.fixtures.filter(/* town/price */); }
  getListingById(id: string): Listing | null { return this.fixtures.find(l => l.id === id) ?? null; }
}
```
> **Synchronous vs async (RESOLVED):** ARCHITECTURE.md sketched `Promise<…>`, but **D-08 specifies synchronous** listings methods, and better-sqlite3 is synchronous. Make the repository ports **synchronous too** — async would be cosmetic and force every contract test to `await` nothing. Keep `container.ts`, services, and contract tests consistent on sync. (See Open Questions §1 — resolved.)

### Pattern 3: Canonical-JSON Snapshot Persistence (the reproducibility load-bearing pattern)
**What:** The save/load path is the existing `roundTrip()` helper promoted to production.
**Source:** `packages/core/src/golden.test.ts:308-333` — re-read 2026-06-27, this is the exact template.
```typescript
// SAVE: serialize the EngineInput snapshot to canonical JSON (float-free, key-sorted) → store as TEXT
const blob = canonicalJson({
  asOf: input.asOf,                 // CalendarDate serializes to its string
  assumptions: input.assumptions,   // AssumptionSet V4 (CURRENT_VERSION === 4)
  scenario: input.scenario,         // ScenarioInputs
  ...(input.household ? { household: input.household } : {}),  // exactOptionalPropertyTypes — OMIT, never set undefined/null
});
// db.insert(scenarios).values({ id, profileId, name, snapshot: blob, createdAt, updatedAt })

// LOAD: parse TEXT → re-validate EVERY leaf through Zod (never a bare `as` cast)
const raw = JSON.parse(row.snapshot) as { asOf: string; assumptions: unknown; scenario: unknown; household?: unknown };
const input = engineInput({
  asOf: calendarDate(raw.asOf),
  assumptions: parseAssumptionSet(raw.assumptions) as CurrentAssumptionSet,
  scenario: parseScenarioInputs(raw.scenario),
  ...(raw.household !== undefined ? { household: parseHousehold(raw.household) } : {}),
});
// REPRODUCIBILITY ASSERTION: canonicalJson(<rebuilt EngineInput snapshot>) === blob  (byte-identical)
```
**Why this is safe:** `canonicalJson` sorts keys recursively and emits every `Money` as a decimal string, so insertion order from SQLite/JSON cannot perturb the bytes. Re-parsing through Zod (`.strict()`) rejects any corrupt/forged blob loudly (matches the no-silent-default discipline). `engineInput()` itself re-parses internally (02-07), so the round-trip is double-validated by design — but the loader-facing `parse*` functions are the documented entry points.

### Pattern 4: Manual DI Composition Root (D-03)
```typescript
// packages/app/src/container.ts — the ONLY file that names concrete adapter types
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { SqliteScenarioRepository } from './adapters/persistence/scenario-repo.js';
import { SqliteProfileRepository } from './adapters/persistence/profile-repo.js';
import { MockListingsProvider } from './adapters/listings/mock-provider.js';
import { LISTING_FIXTURES } from './adapters/listings/fixtures.js';
import type { ScenarioRepository, ProfileRepository, ListingsProvider } from '@house/core';

export interface Container {
  scenarios: ScenarioRepository;   // exposed as PORT types only (D-03)
  profiles: ProfileRepository;
  listings: ListingsProvider;
}

export function makeContainer(dbPath: string): Container {
  const sqlite = new Database(dbPath);
  const db = drizzle({ client: sqlite });
  // runMigrations(db) here — once, at composition.
  return {
    scenarios: new SqliteScenarioRepository(db),
    profiles: new SqliteProfileRepository(db),
    listings: new MockListingsProvider(LISTING_FIXTURES),
  };
}
```
> **Enforcing D-03 mechanically:** add an `eslint-plugin-boundaries` `app` override (mirror the existing core override at `eslint.config.ts:32-137`) defining `services`/`adapters`/`container` elements and a rule disallowing `services/**` imports of concrete adapter modules — only `container.ts` may import them. Then add `packages/app/src/boundary.test.ts` that shells out to `npx eslint --no-ignore <fixture>` and asserts a non-zero exit (mirror `packages/core/src/boundary.test.ts:20-50`). This turns "depend only on the port" from a hope into a CI failure.

### Drizzle + better-sqlite3 wiring (verified against Drizzle docs)
```typescript
// db.ts
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import * as schema from './schema.js';

export function openDb(source: string) {              // source = file path OR ':memory:'
  const sqlite = new Database(source);
  sqlite.pragma('journal_mode = WAL');                // recommended for file-backed DBs
  return drizzle({ client: sqlite, schema });
}
export function runMigrations(db: ReturnType<typeof openDb>) {
  migrate(db, { migrationsFolder: new URL('../../../drizzle', import.meta.url).pathname });
}
```
```typescript
// drizzle.config.ts  — Source: orm.drizzle.team/docs/get-started-sqlite (verified 2026-06-27)
import { defineConfig } from 'drizzle-kit';
export default defineConfig({
  dialect: 'sqlite',
  schema: './src/adapters/persistence/schema.ts',
  out: './drizzle',
  dbCredentials: { url: process.env.DB_FILE_NAME ?? './house.sqlite' },
});
```
- `drizzle({ client: sqlite })` — pass an existing better-sqlite3 instance `[CITED: orm.drizzle.team/docs/get-started-sqlite]`.
- `drizzle-kit generate` (emit SQL into `out`) then `drizzle-kit migrate` (apply) `[CITED: orm.drizzle.team/docs/get-started/sqlite-new]`.
- Programmatic migrator import `drizzle-orm/better-sqlite3/migrator` + `migrate(db, { migrationsFolder })` `[ASSUMED — established Drizzle API; not quoted in the fetched docs excerpt. Confirm the exact subpath against installed drizzle-orm@0.45.2 types in the Wave-0 wiring task (A1).]`.

### Drizzle schema sketch (decimal-string money discipline — NINE profile leaves)
```typescript
// schema.ts
import { sqliteTable, text, integer, uniqueIndex } from 'drizzle-orm/sqlite-core';

// Profile = { id, name } & Household. Household has NINE leaves (engine-input.ts:116-155) —
// persist ALL of them so the profile can drive the affordability/FI engines, not just the
// five PROF-01-visible fields. Every money/rate leaf is a canonical decimal STRING in TEXT.
export const profiles = sqliteTable('profiles', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  grossAnnualIncome: text('gross_annual_income').notNull(),
  existingMonthlyDebt: text('existing_monthly_debt').notNull(),
  targetSavingsRate: text('target_savings_rate').notNull(),       // [0,1) refine in Zod
  availableNetWorth: text('available_net_worth').notNull(),       // PROF-01 "net worth"
  currentRent: text('current_rent').notNull(),
  downPaymentCash: text('down_payment_cash').notNull(),
  reserve: text('reserve').notNull(),
  currentAnnualSavings: text('current_annual_savings').notNull(),
  targetAnnualRetirementSpend: text('target_annual_retirement_spend').notNull(),
  createdAt: integer('created_at').notNull(),   // epoch ms; set in the app layer (determinism)
  updatedAt: integer('updated_at').notNull(),
});

export const scenarios = sqliteTable('scenarios', {
  id: text('id').primaryKey(),
  profileId: text('profile_id').notNull().references(() => profiles.id),
  name: text('name').notNull(),
  snapshot: text('snapshot').notNull(),        // canonicalJson EngineInput blob — source of truth (D-05)
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
}, (t) => ({
  uniqNamePerProfile: uniqueIndex('uniq_scenario_name_per_profile').on(t.profileId, t.name),  // D-11
}));
```
> **Note on PROF-01 "net worth":** the engine field is `availableNetWorth` (investable net worth for the cash-on-hand gate). Map the PROF-01 "net worth" input to `availableNetWorth`; do not invent a separate `netWorth` column (it would diverge from what the engines read).

### Profile-storage recommendation (Claude's discretion)
Two acceptable shapes, both reusing `parseProfile`:
1. **Typed columns (recommended)** — the nine Household leaves as TEXT columns above. The profile is the editable "current" household; columns are honest and inspectable. Reconstruct a `Household` in `parseProfile`/the adapter and re-validate through `HouseholdSchema`.
2. **Household-as-blob** — store `{ id, name, household: <canonicalJson> }` with the household serialized like a scenario snapshot. More consistent with the scenario path and future-proofs Household growth, but loses column-level queryability. With ≤2 profiles, queryability is irrelevant, so this is defensible — but typed columns read better.

Either way: a profile edit updates the live row; it must **not** mutate any already-saved scenario snapshot (snapshots are frozen — that is PROF-04).

### Anti-Patterns to Avoid
- **Storing money as SQLite `REAL`/number.** Reintroduces the float hole the whole core exists to prevent. Store decimal strings in TEXT; lift to `Money` in memory.
- **Persisting only the five PROF-01-visible profile fields.** The engines need nine Household leaves; a five-column profile cannot drive affordability/FI.
- **`as ScenarioInputs` cast on load.** Bypasses the Zod boundary; a corrupt blob would compute silently. Always re-parse through `parseScenarioInputs`/`parseAssumptionSet`/`parseHousehold`.
- **Referencing `MockListingsProvider` / `SqliteScenarioRepository` outside `container.ts`.** Defeats the swappability that justifies the ports (D-03).
- **Generating `createdAt`/`updatedAt` inside core.** Core forbids `Date.now()` (`eslint.config.ts` `no-restricted-properties` / `no-restricted-globals`). Timestamps are produced in the app layer (the shell) and passed in, or set in the adapter — never inside a core function.
- **Importing better-sqlite3/drizzle into `packages/core`.** Breaks zero-framework-dep; the existing `boundaries/external` deny-by-default rule (`eslint.config.ts:52-54`, allow-list = `decimal.js`, `zod`) would (and must) fail the build.
- **Letting a profile edit rewrite a saved scenario's embedded household.** Snapshots freeze the household at save time; re-deriving from the live profile on load breaks reproducibility.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Canonical serialization | A custom key-sorter / JSON stringifier | `canonicalJson` (core barrel) | Already float-free + recursively key-sorted + proven byte-stable across five golden suites. |
| Snapshot validation on load | Hand-written field checks / `as` casts | `parseAssumptionSet` / `parseScenarioInputs` / `parseHousehold` | The trust boundary already exists, with `decStr` + `.strict()` + discriminated-union versioning. |
| Profile money schema | A parallel Zod schema for profile dollars | Reuse `HouseholdSchema` / `decStr` via `parseProfile` | `Household` already validates all nine leaves; a parallel validator risks drift. |
| Schema migrations | Hand-written `CREATE TABLE` strings + ad-hoc version switch | drizzle-kit `generate`/`migrate` | Readable, reviewable SQL files; reproducibility-friendly (D-11). |
| Decimal money in adapters | Parsing/formatting decimals by hand | `Money.of(str)` / `.toDecimalString()` | Closed, banker's-rounding API; bare-number math is type-test-rejected. |
| Versioned snapshot schema | A new bespoke version field | Embed the existing `AssumptionSet` discriminated union (V4 current) | D-07 — assumptions already carry `schemaVersion` 1-4 + `migrate()`. |

**Key insight:** Phase 6 adds almost no new *logic* — it adds *plumbing*. Every hard problem (canonicalization, validation, decimal precision, versioning) was solved in Phases 1-5. The risk is re-solving them slightly differently and breaking byte-identity. Reuse the core primitives verbatim.

## Common Pitfalls

### Pitfall 1: Global Vitest coverage thresholds now gate `packages/app`
**What goes wrong:** The root `vitest.config.ts` sets process-global coverage thresholds (lines 95 / functions 95 / branches 90 / statements 95). Coverage in Vitest is process-global, so once `packages/app` joins `projects: ['packages/*']`, its code counts toward the same gate. New adapter code (especially error branches) can sink coverage and fail CI.
**Why it happens:** `projects` is a glob; the new package is auto-included (the root config comment even says "the only project this phase" — that becomes false the moment `packages/app` lands).
**How to avoid:** Plan for high app-layer coverage from the start (the contract test + round-trip test cover most paths), OR have the planner decide whether to scope thresholds per-project. Note `vitest.shared.ts` exists precisely because per-project configs **cannot** `extends` the root (Vitest 4) — shared options spread via `mergeConfig`.
**Warning signs:** `npm test` passes locally per-file but the coverage gate fails at the end.

### Pitfall 2: `exactOptionalPropertyTypes` + optional snapshot fields
**What goes wrong:** `tsconfig.base.json` sets `exactOptionalPropertyTypes: true`. Writing `{ household: undefined }` is a type error vs omitting the key. The existing `roundTrip()` carefully spreads `...(x ? { household: x } : {})` to **omit** the key — and omitting vs. null-setting also changes the canonical-JSON bytes.
**How to avoid:** Mirror the conditional-spread idiom from `engine-input.ts:224+` and `golden.test.ts:319-321` exactly. Never set an optional snapshot field to `undefined`/`null`.

### Pitfall 3: better-sqlite3 native module on Windows / Node 24
**What goes wrong:** Native module fails to load if no prebuilt binary matches the Node ABI, forcing a source build (needs MSVC build tools).
**Why it happens rarely here:** better-sqlite3 12.11.1 declares `engines.node: 20.x..26.x` and installs via `prebuild-install || node-gyp rebuild` — Node 24.15.0 (installed, verified) has a matching prebuilt binary. Install should download a binary, not compile.
**How to avoid:** Run the Wave-0 smoke check (`new Database(':memory:')`) before building adapters. If it fails, `npm rebuild better-sqlite3` or install MSVC build tools.
**Warning signs:** `Error: Could not locate the bindings file` at import time.

### Pitfall 4: Committing / gitignoring the `.sqlite` file
**What goes wrong:** The local DB file gets committed, or migration SQL files get ignored. The current `.gitignore` (re-read 2026-06-27) has `node_modules/`, `dist/`, `*.tsbuildinfo`, `coverage/`, `.DS_Store`, `*.log`, `.claude/scheduled_tasks.lock` — **no `*.sqlite` entry yet**.
**How to avoid:** Add `*.sqlite`, `*.sqlite-wal`, `*.sqlite-shm`, `*.db` to `.gitignore`. **Do** commit the `packages/app/drizzle/` migration SQL + `meta/_journal.json` (reproducibility — D-11). Tests should use `:memory:` (fast, isolated) or a temp-dir file, never the dev DB.

### Pitfall 5: Async/sync mismatch between ports and reality (RESOLVED → sync)
**What goes wrong:** Following ARCHITECTURE's `Promise<…>` sketch makes every adapter method async even though better-sqlite3 is synchronous and the mock has no I/O — cosmetic `async` that the round-trip test then has to `await`.
**How to avoid:** D-08 mandates **sync** listings methods; make **sync** repository methods too. Pick one and keep `container.ts`, services, and contract tests consistent.

### Pitfall 6: Enforcing "≤2 profiles" and "depend only on the port"
**What goes wrong:** Both invariants silently degrade to "convention" if not mechanized.
**How to avoid:** (a) ≤2 cap — a service-layer guard in `saveProfile` that reads `repo.count()` (or `repo.list().length`) and throws on a third insert (D-10 lean-toward-service-layer); test it. (b) port-only dependency — an `eslint-plugin-boundaries` `app` override (new `services`/`adapters`/`container` elements) failing any `services/**` import of a concrete adapter module, plus a negative fixture + `boundary.test.ts` asserting it trips (mirror `packages/core/src/boundary.test.ts`).

### Pitfall 7: Profile/scenario household divergence (reproducibility)
**What goes wrong:** A scenario is saved with a frozen household snapshot; later the owning profile is edited; reloading the scenario must still reproduce the original result. If the adapter re-derives the scenario's household from the live profile row on load, the snapshot is no longer reproducible.
**How to avoid:** The scenario `snapshot` blob is self-contained — it embeds its own `household` copy. The load path rebuilds the `EngineInput` **only** from the blob, never joining to the current profile row. The profile FK is for ownership/listing, not for re-hydrating the snapshot's inputs.

## Runtime State Inventory

> This is a greenfield additive phase (new package + new tables), not a rename/refactor/migration of existing runtime state.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — no DB exists yet; the new `house.sqlite` is created by this phase. Verified: `find packages/core/src` shows pure code only; no `apps/`, no `.sqlite`. | None |
| Live service config | None — local file tool, no deployed services. | None |
| OS-registered state | None — no scheduled tasks, daemons, or registry entries touch this. | None |
| Secrets/env vars | None this phase. (`DB_FILE_NAME` is an optional drizzle-kit config knob, not a secret.) | None |
| Build artifacts | None pre-existing. New: `packages/app/dist`, `*.tsbuildinfo` (already gitignored), and generated `drizzle/*.sql` (committed by design). | None to migrate |

**Nothing found in any category** — verified by directory listing (no `apps/`, no existing DB, no deployed services).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | All | ✓ | v24.15.0 (in better-sqlite3 20-26.x support range) | — |
| npm (workspaces) | Monorepo linking | ✓ | 11.12.1 | — |
| better-sqlite3 prebuilt binary | SQLite driver | ✓ (expected) | 12.11.1 for Node 24 | `npm rebuild` / MSVC build tools |
| MSVC C++ build tools (Windows) | Only if prebuild missing | unknown | — | Source-build fallback for better-sqlite3 |

**Missing dependencies with no fallback:** none — Node + npm present, better-sqlite3 supports Node 24 with prebuilds.
**Missing dependencies with fallback:** native-compile toolchain (only needed if the prebuilt binary is unavailable; not expected on Node 24.15.0).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.9 (`projects` config, node environment) |
| Config file | Root `vitest.config.ts` (`projects: ['packages/*']`); NEW `packages/app/vitest.config.ts` (Wave 0) |
| Quick run command | `npx vitest run packages/app` |
| Full suite command | `npm test` (runs all projects; `vitest run`) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PROF-01 | Save + reload two profiles (all nine Household leaves round-trip); 3rd rejected by service guard | unit/integration | `npx vitest run packages/app -t profile` | ❌ Wave 0 |
| PROF-02 | Named scenario under a profile; duplicate name within profile rejected | integration | `npx vitest run packages/app -t scenario` | ❌ Wave 0 |
| PROF-03 | Save then reload in a fresh DB connection returns the scenario | integration | `npx vitest run packages/app -t reload` | ❌ Wave 0 |
| PROF-03/PROF-04 | save → reload → `canonicalJson` byte-identical; profile edit does NOT mutate a saved snapshot | reproducibility | `npx vitest run packages/app -t round-trip` | ❌ Wave 0 |
| LIST-01/02 | `getListings(query)` filters; `getListingById` hit/miss | contract | `npx vitest run packages/app -t listings` | ❌ Wave 0 |
| D-03 | services never import concrete adapters (eslint boundary) | lint-as-test | `npx vitest run packages/app -t boundary` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run packages/app` (fast — in-memory SQLite).
- **Per wave merge:** `npm test` (all projects, includes the core golden suites to prove core is untouched — five committed golden snapshots must stay byte-identical).
- **Phase gate:** full suite green before `/gsd-verify-work`.

### Repository contract-test strategy (Claude's-discretion recommendation)
One shared `describe` factory `repositoryContract(makeRepo: () => ScenarioRepository)` invoked twice:
1. against `SqliteScenarioRepository(openDb(':memory:'))` (real adapter, migrated schema),
2. against an `InMemoryScenarioRepository` fake.
Both must pass identical assertions (save/load/listByProfile/delete/unique-name/round-trip). This is the Phase-6 analog of the golden harness — the fake proves the *contract* is adapter-agnostic; the SQLite run proves the *adapter* honors it. Mirror the gated, reviewable style of `golden.test.ts` for the byte-identity assertion (plain `expect(produced).toBe(stored)`, **not** `toMatchSnapshot`, which auto-re-blesses).

### Wave 0 Gaps
- [ ] `packages/app/package.json` + `tsconfig.json` (`types:["node","better-sqlite3"]`) + `vitest.config.ts` (node env, `mergeConfig(defineProject({...sharedTest, name:'app'}), {})`)
- [ ] `packages/app/drizzle.config.ts` + initial generated migration in `drizzle/`
- [ ] `packages/app/src/adapters/persistence/db.ts` (`openDb(':memory:')` helper + `runMigrations`) + confirm the `drizzle-orm/better-sqlite3/migrator` import path against installed types (A1)
- [ ] Shared `repositoryContract` factory + `InMemory*Repository` fakes
- [ ] `.gitignore` entries for `*.sqlite*` / `*.db`
- [ ] eslint flat-config `app` boundary override (`services`/`adapters`/`container` elements) + adapter-import restriction + negative fixture + a `boundary.test.ts` asserting it trips
- [ ] Add `{ path: "./packages/app" }` to root `tsconfig.json` `references`
- [ ] Wave-0 install smoke-test (`new Database(':memory:')`) confirming the native binary loaded

## Security Domain

`security_enforcement: true`, ASVS level 1, block-on high. This phase has **no network surface, no auth, no sessions, no untrusted multi-tenant input** — it is a local two-user file-backed tool (auth explicitly out of scope per REQUIREMENTS.md "Out of Scope"). The relevant ASVS surface is narrow.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No auth in scope (local 2-user tool). |
| V3 Session Management | no | No sessions. |
| V4 Access Control | no | Single local DB file, no multi-tenant boundary. |
| V5 Input Validation | yes | **Every persisted blob re-parsed through Zod `.strict()` on load** (`parseAssumptionSet`/`parseScenarioInputs`/`parseHousehold`) — a corrupt/forged snapshot is rejected, not computed. New `Profile`/`Listing` schemas follow the same `decStr` + `.strict()` pattern. |
| V6 Cryptography | no | No secrets, no crypto; determinism guard forbids `crypto.getRandomValues` in core anyway. |

### Known Threat Patterns for SQLite + Drizzle
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| SQL injection | Tampering | Drizzle parameterizes all queries; never string-concatenate SQL. No raw user SQL in scope. |
| Malformed/forged snapshot blob computed silently | Tampering | Re-validate through Zod on load (no-silent-default); the existing `migrate.test.ts`/`schema.test.ts` prove the boundary rejects a forged `schemaVersion`. |
| Float re-entering money at the DB boundary | Tampering (data integrity) | Money stored as canonical decimal TEXT; `decStr` validates on load; `Money` is the only in-memory dollar type. |
| Path traversal via DB file path | Tampering | DB path is app-supplied config, not user input; keep it a constant/env in the container. |

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Vitest `workspace` config key | `test.projects` array | Vitest post-3.2 | Already adopted in root `vitest.config.ts`; new app project added as another `packages/*` entry. |
| `drizzle({ client })` vs legacy connection objects | Pass an existing better-sqlite3 instance | drizzle-orm 0.3x+ | Use `drizzle({ client: sqlite })` form (verified in docs). |
| CLAUDE.md "persistence in apps/web" (2-package layout) | Persistence in a new `packages/app` (3-package hexagonal) | Phase-6 discussion (D-01) | Supersedes the CLAUDE.md TL;DR; ARCHITECTURE.md's `core/app/web` split is the authority. |
| AssumptionSet V1-V3 | **V4 current** (`CURRENT_VERSION === 4`, `schema.ts:359`) | Phase 5 (townScoring block) | The embedded snapshot carries V4; `migrate()` chains v1→v2→v3→v4 so any older persisted blob upgrades on load. |

**Deprecated/outdated:**
- `boundaries/external` (eslint-plugin-boundaries v6) is deprecated but **deliberately retained + version-pinned `6.0.2`** with a negative test (`external-import.fixture.ts` + `boundary.test.ts` "arbitrary non-allowlisted external" case). New `app` boundary rules must coexist with this; do **not** "fix" the deprecation as part of this phase.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Programmatic migrator import is `drizzle-orm/better-sqlite3/migrator` + `migrate(db, { migrationsFolder })` | Drizzle wiring | Low — long-standing API; confirm the exact subpath against installed `drizzle-orm@0.45.2` types in the Wave-0 db.ts task before coding. |
| A2 | `@types/better-sqlite3@7.6.13` is the correct, maintained types package | Stack | Very low — RESOLVED to verified: exists on npm at 7.6.13, DefinitelyTyped-maintained, slopcheck [OK]. |
| A3 | Node 24.15.0 has a matching better-sqlite3 12.11.1 prebuilt binary (no source compile) | Environment | Low-Medium on Windows — engines say 20-26.x and install is `prebuild-install`; if a prebuild is absent, a C++ toolchain is needed. Smoke-test right after install. |
| A4 | Global Vitest coverage thresholds will apply to `packages/app` once added | Pitfall 1 | Low — coverage is process-global in Vitest; confirmed by root config comment. Planner decides per-project scoping. |
| A5 | drizzle-kit config uses `dialect: 'sqlite'` with `dbCredentials.url` (no separate `driver` field) | Drizzle config | Low — verified against current Drizzle get-started docs. |

## Open Questions (RESOLVED)

1. **Repo method shape: sync or async?** — **RESOLVED: synchronous repositories.** better-sqlite3 is synchronous; D-08 mandates sync listings; the port abstraction already absorbs a future async (libSQL) swap without changing call sites. All port methods are sync.
2. **Where does the dev `.sqlite` file live, and who runs migrations at runtime?** — **RESOLVED: single configurable path, migrate at container construction, `:memory:` in tests.** `openDb(path)` defaults to `./house.sqlite` (gitignored); `runMigrations()` runs once at container construction; tests migrate a fresh `:memory:` db per suite (the contract factory).
3. **Profile vs Household type relationship.** — **RESOLVED: `Profile = { id, name } & Household`.** `Household` already has the PROF-01 fields plus the FI/affordability leaves (nine total), fully Zod-validated. Model `Profile` as `{ id, name }` + the full Household, reusing `HouseholdSchema`/`decStr` via a single `parseProfile` boundary — no parallel money schema. **Refinement (this refresh): persist ALL nine leaves**, not just the five PROF-01-visible fields, or the profile cannot drive the engines.
4. **Does the scenario snapshot embed the household, or join to the live profile on load?** — **RESOLVED: embed a frozen copy.** The `EngineInput` snapshot (`{ asOf, assumptions, scenario, household? }`) is self-contained; the load path rebuilds only from the blob. A later profile edit must not mutate a saved scenario (PROF-04 reproducibility). The profile FK is for ownership/listing, not snapshot re-hydration.

## Sources

### Primary (HIGH confidence)
- In-repo source, re-read 2026-06-27 (authoritative for patterns): `packages/core/src/golden.test.ts` (round-trip helper, lines 308-333), `serialize/canonical-json.ts`, `assumptions/schema.ts` (`decStr`, `CURRENT_VERSION === 4`), `assumptions/assumption-set.ts` (`parseAssumptionSet`/`serializeAssumptionSet`/`CurrentAssumptionSet`), `engine/engine-input.ts` (`Household` nine leaves 116-155, `ScenarioInputs`, `parse*`, `engineInput`, `EngineInput`), `index.ts` (public barrel), `boundary.test.ts` (lint-as-test idiom), `eslint.config.ts` (boundary/determinism overrides 32-137), `vitest.config.ts` + `vitest.shared.ts`, `tsconfig.base.json` (`exactOptionalPropertyTypes`), root `package.json` + `.gitignore`.
- npm registry (`npm view`) — better-sqlite3 12.11.1 (engines node 20-26.x; install `prebuild-install || node-gyp rebuild`), drizzle-orm 0.45.2, drizzle-kit 0.31.10, @types/better-sqlite3 7.6.13 — verified 2026-06-27.
- slopcheck — scanned better-sqlite3 / drizzle-orm / drizzle-kit / @types/better-sqlite3 on npm: 4 OK, 0 SLOP, 0 SUS.
- `.planning/research/ARCHITECTURE.md` — Patterns 1-4, component responsibilities, build order.
- `.planning/phases/06-persistence-listings-adapter/06-CONTEXT.md` — D-01..D-11 locked decisions.
- `.planning/REQUIREMENTS.md` + `.planning/ROADMAP.md` + `.planning/STATE.md` — phase status (1-5 complete), traceability, accumulated decisions.

### Secondary (MEDIUM confidence)
- orm.drizzle.team/docs/get-started-sqlite — better-sqlite3 `drizzle({ client })` instance creation (fetched 2026-06-27).
- orm.drizzle.team/docs/get-started/sqlite-new — `drizzle.config.ts` shape, `drizzle-kit generate`/`migrate` commands (fetched 2026-06-27).

### Tertiary (LOW confidence)
- Programmatic migrator import path (`drizzle-orm/better-sqlite3/migrator`) — training knowledge; not quoted in fetched docs (A1 — confirm against installed types).

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all versions match CLAUDE.md + npm registry + slopcheck clean (now including @types/better-sqlite3).
- Architecture: HIGH — patterns codified in ARCHITECTURE.md and already exercised in-repo (the round-trip helper is literally the persistence path; re-read this session).
- Pitfalls: HIGH — derived from re-reading the actual repo configs (coverage globality, exactOptionalPropertyTypes, boundary enforcement, gitignore gap, nine-leaf Household).
- Drizzle wiring specifics: MEDIUM — config + instance creation verified from docs; programmatic migrator import flagged ASSUMED (A1).

**Research date:** 2026-06-27 (refresh)
**Valid until:** 2026-07-27 (stack is stable; drizzle-kit moves faster — re-verify config shape if the phase starts >30 days out).
