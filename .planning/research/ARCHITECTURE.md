# Architecture Research

**Domain:** Personal financial decision tool (home-affordability + FI-impact modeling) — Next.js + pure TS calc core, local SQLite
**Researched:** 2026-06-22
**Confidence:** HIGH (architecture patterns are well-established; stack pieces verified current)

## Executive Take

This is a **functional-core / imperative-shell** application wrapped in a **hexagonal (ports-and-adapters)** boundary. The brief's four guardrails — pure calc core, `ListingsProvider` port, assumptions-as-data, reproducible scenarios — are not four independent requirements; they are four faces of the same architectural decision: **the calculation is a pure function of explicit, serializable inputs, and everything else (UI, DB, listings) is a replaceable shell around it.**

Get that one idea right and all four guardrails fall out for free. Get it wrong (e.g. an engine that reads `process.env` or `new Date()` or queries SQLite directly) and all four break at once.

The single most important structural rule:

> **`engine(profile, scenarioInputs, assumptionSet) → result` is a pure, synchronous, deterministic function with zero I/O, zero framework imports, zero ambient state (no `Date.now()`, no `Math.random()`, no env reads).**

Everything below serves that rule.

## Standard Architecture

### System Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│                      SHELL (Next.js app)  — apps/web                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐     │
│  │ Profile/     │  │ Scenario     │  │ Comparison + Heatmap +    │     │
│  │ Assumption   │  │ Builder      │  │ Sensitivity views         │     │
│  │ editors (UI) │  │ (UI)         │  │ (UI, read-only of result) │     │
│  └──────┬───────┘  └──────┬───────┘  └────────────┬─────────────┘     │
│         │ React state / Server Actions / route handlers                │
├─────────┼─────────────────┼───────────────────────┼───────────────────┤
│         ▼                  ▼                       ▼                    │
│  ┌────────────────────────────────────────────────────────────┐       │
│  │   APPLICATION SERVICES  — packages/app  (orchestration)      │      │
│  │   loadScenario → resolve assumptions → call engine → save    │      │
│  │   "compute & persist", "compare N", "run sensitivity sweep"  │      │
│  └───┬───────────────────────┬───────────────────────┬─────────┘       │
│      │ uses ports (interfaces), never concretes                        │
├──────┼───────────────────────┼───────────────────────┼────────────────┤
│      ▼ (pure call)            ▼ (port)                 ▼ (port)         │
│ ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────────┐   │
│ │  CORE            │  │  ScenarioRepo    │  │  ListingsProvider    │   │
│ │  packages/core   │  │  (port)          │  │  (port)              │   │
│ │  ── PURE ──      │  └────────┬─────────┘  └──────────┬───────────┘   │
│ │  Affordability   │           │ impl                  │ impl          │
│ │  FI-Impact       │  ┌────────▼─────────┐  ┌──────────▼───────────┐   │
│ │  Town Scoring    │  │ SqliteScenario   │  │ MockListingsProvider │   │
│ │  amortization,   │  │ Repo (Drizzle +  │  │ (static fixtures)    │   │
│ │  money, types    │  │ better-sqlite3)  │  │ [later: RealProvider]│   │
│ └──────────────────┘  └──────────────────┘  └──────────────────────┘   │
│   NO framework deps      ADAPTERS (infra)        ADAPTERS (infra)      │
└──────────────────────────────────────────────────────────────────────┘

Dependency direction:  SHELL → APP → (CORE + PORTS) ← ADAPTERS
                       Core depends on NOTHING. Adapters depend on ports.
```

The arrows point **inward**. `core` imports nothing from `app`, `web`, or any adapter. Adapters implement interfaces that live next to the core/app. This is the classic dependency-inversion that makes the core testable in isolation and the listings dependency genuinely swappable.

### Component Responsibilities

| Component | Responsibility | Implementation |
|-----------|----------------|----------------|
| `core` (pure) | All financial math: amortization, TCO, DTI affordability, FI-date projection, opportunity cost, town composite scoring, sensitivity sweeps. Defines domain **types**. | Pure TS functions + types only. `package.json` has **no** runtime deps except maybe `decimal.js`/`big.js`. Zero React/Next/DB. |
| Ports (interfaces) | Contracts the app depends on: `ListingsProvider`, `ScenarioRepository`, `ProfileRepository`, `AssumptionSetRepository`. | TypeScript `interface` declarations. Live in `core` (or a thin `ports` package) so the core owns its contracts. |
| `app` (services) | Orchestration: load profile + scenario + assumption set from repos, call the pure engine, persist the result, run comparisons/sweeps. The "imperative shell" that wires I/O to pure functions. | TS module that takes port implementations via constructor/factory (manual DI). No business math. |
| Adapters | Concrete I/O: `SqliteScenarioRepository`, `MockListingsProvider`, mill-rate seed loader. | `better-sqlite3` + Drizzle for persistence; static JSON/TS fixtures for listings + town data. |
| `web` (Next.js) | Presentation only: forms for profiles/assumptions/scenarios, comparison table, heatmap, sensitivity charts. Calls `app` services via Server Actions / route handlers. | Next.js App Router, React. Holds **no** financial logic. |

## Recommended Project Structure

A **pnpm workspace monorepo** is the right call. It enforces the boundary mechanically (the core literally cannot import React because React is not in its `package.json`), while keeping everything in one repo for a two-person tool. (Verified current best practice: pnpm workspaces with `apps/` + `packages/` split and `workspace:*` protocol — see Sources.)

```
house/
├── pnpm-workspace.yaml          # packages: apps/*, packages/*
├── package.json                 # root: scripts, shared dev deps (vitest, tsx)
├── tsconfig.base.json           # strict; project references
│
├── packages/
│   ├── core/                    # THE PRODUCT. Pure. Heavily unit-tested.
│   │   ├── package.json         # deps: (none) or just decimal lib. NO react/next/db.
│   │   ├── src/
│   │   │   ├── money/           # Money type, rounding policy, integer-cents or Decimal
│   │   │   ├── types/           # Profile, ScenarioInput, AssumptionSet, *Result types
│   │   │   ├── ports/           # ListingsProvider, ScenarioRepository interfaces
│   │   │   ├── affordability/   # bank DTI affordability + true affordability + gap
│   │   │   ├── tco/             # amortization, property tax, PMI, insurance, maint, HOA, closing
│   │   │   ├── fi/              # FI-date projection, net-worth trajectory, opportunity cost
│   │   │   ├── towns/           # weighted normalized composite score, bucketing
│   │   │   ├── sensitivity/     # parameter sweeps over any engine
│   │   │   └── compute.ts       # top-level: computeScenario(profile, input, assumptions)
│   │   └── test/                # vitest; FI math reconciled vs retirement-model oracle
│   │
│   └── app/                     # Orchestration / use-cases (imperative shell)
│       ├── package.json         # deps: @house/core (workspace:*)
│       └── src/
│           ├── services/        # computeAndSaveScenario, compareScenarios, runSensitivity
│           ├── container.ts     # wires concrete adapters → ports (manual DI)
│           └── adapters/        # SqliteScenarioRepository, MockListingsProvider, seeds
│               ├── persistence/ # drizzle schema + repo impls (better-sqlite3)
│               └── listings/    # MockListingsProvider + fixtures
│
├── apps/
│   └── web/                     # Next.js App Router — thin shell
│       ├── package.json         # deps: @house/app, @house/core (types), next, react
│       └── src/app/             # routes, server actions, components, charts
│
└── data/
    ├── ma-mill-rates.json       # seeded DOR town table (static for this build)
    └── town-attributes.json     # median price, school rating, commute anchors
```

### Structure Rationale

- **`core` as its own package with no framework deps is the enforcement mechanism**, not just convention. A lint rule or even a missing `node_modules` entry stops anyone from `import { useState }` inside the engine. This is *the* guardrail made physical.
- **Ports live inside `core`** (the side that defines the need), adapters live in `app`. This is dependency inversion: the high-level policy (core) owns the interface; the low-level detail (SQLite, fixtures) conforms to it.
- **`app` separate from `web`** so the engine + orchestration can be driven from a test, a CLI, or a future second UI without Next.js. It also means Server Actions become 3-line wrappers.
- **`data/` static seeds** keep the no-live-data decision visible and version-controlled.

> **Pragmatic escape hatch:** If a full monorepo feels heavy for a two-person tool, the *minimum viable* version of this is a single Next.js app with a `src/core/` directory plus an ESLint `no-restricted-imports` rule banning framework imports inside `core/`. You lose mechanical enforcement strength but keep the dependency direction. Recommend the monorepo; accept the single-app fallback if setup friction stalls the build.

## Architectural Patterns

### Pattern 1: Functional Core, Imperative Shell

**What:** All decisions and math are pure functions; all I/O (DB reads, listings fetch, current date, persistence) happens in the thin shell *around* the pure call. The shell gathers inputs, calls one pure function, then does something with the output.

**When to use:** Always here. It is the project's defining constraint.

**Trade-offs:** Forces you to pass everything explicitly (no reaching for `new Date()` mid-calculation) — slightly more plumbing, enormously more testable and reproducible. For a tool whose *entire value is trustworthy numbers*, this is the correct trade.

```typescript
// packages/core/src/compute.ts  — PURE. No I/O. Deterministic.
export function computeScenario(
  profile: Profile,
  input: ScenarioInput,        // house price, down %, term, rent comparison...
  assumptions: AssumptionSet,  // tax rates, DTI thresholds, return %, maint %...
  asOf: CalendarDate           // injected, NEVER read from the clock
): ScenarioResult {
  const tco          = computeTCO(input, assumptions);
  const affordability = computeAffordability(profile, tco, assumptions);
  const fiImpact     = computeFIImpact(profile, tco, assumptions, asOf);
  return { tco, affordability, fiImpact, computedWith: { /* echo inputs hash */ } };
}

// packages/app/src/services/computeAndSaveScenario.ts — IMPERATIVE shell
export async function computeAndSaveScenario(repo: ScenarioRepository, id: string) {
  const { profile, input, assumptions } = await repo.load(id);   // I/O
  const result = computeScenario(profile, input, assumptions, today()); // PURE
  await repo.saveResult(id, result);                              // I/O
  return result;
}
```

### Pattern 2: Ports and Adapters (Hexagonal) — for `ListingsProvider`

**What:** The app depends on an `interface`, never on a concrete data source. The concrete `MockListingsProvider` is injected at the edge. Swapping in a real provider later changes one line in the DI container and zero lines in core/app logic.

**When to use:** Any external/volatile dependency — here, listings (explicitly walled off) and persistence.

**Trade-offs:** One layer of indirection. Worth it precisely because the brief names listings as "the highest-risk dependency" and wants it ignorable now, pluggable later.

```typescript
// packages/core/src/ports/listings.ts  — the contract, owned by the core
export interface ListingsProvider {
  search(criteria: ListingCriteria): Promise<Listing[]>;
  byId(id: string): Promise<Listing | null>;
}

// packages/app/src/adapters/listings/mock.ts — the only impl for this build
export class MockListingsProvider implements ListingsProvider {
  constructor(private fixtures: Listing[]) {}
  async search(c: ListingCriteria) { return this.fixtures.filter(/* ... */); }
  async byId(id: string) { return this.fixtures.find(l => l.id === id) ?? null; }
}
// Later: RealListingsProvider implements ListingsProvider — nothing else changes.
```

To genuinely "prove the adapter end to end," the app/UI must consume listings **only** through the `ListingsProvider` type — never reference `MockListingsProvider` outside `container.ts`.

### Pattern 3: Assumptions-as-Data + Deterministic Snapshot Reproducibility

**What:** Every tunable number lives in an `AssumptionSet` — a serializable, **versioned**, addressable record (tax rates, DTI front/back, expected return, maintenance %, inflation, PMI rules, closing-cost model). A `Scenario` does not *reference a mutable* assumption set; on compute it **captures a snapshot** of the exact inputs that produced the result. Because `computeScenario` is pure and takes `asOf` explicitly, replaying the snapshot regenerates the identical result forever.

**When to use:** This is the "reproducible scenarios" + "assumptions never hardcoded" guardrails, structurally satisfied.

**Trade-offs:** You store inputs redundantly (snapshot copies live alongside the result). For a personal tool this is trivial storage and buys exact, audit-grade reproducibility — the whole point.

```typescript
interface AssumptionSet {
  id: string; version: number;        // versioned so edits don't mutate history
  taxRatesByTown: Record<TownId, MillRate>;
  dti: { front: number; back: number };
  expectedAnnualReturn: number;
  maintenancePctOfValue: number;
  inflation: number; pmiRules: PmiRules; closingCostModel: ClosingCostModel;
  /* ...all of it, nothing hardcoded in core ... */
}

interface SavedScenario {
  id: string; name: string; profileId: string;
  // FROZEN SNAPSHOT — the exact inputs, copied at compute time:
  snapshot: { input: ScenarioInput; assumptions: AssumptionSet; asOf: CalendarDate;
              engineVersion: string; };
  result: ScenarioResult;
  inputsHash: string;                 // hash(snapshot) — detect drift / verify replay
}
```

**Reproducibility test (cheap, high-value):** `computeScenario(...snapshot)` must deep-equal the stored `result`. Run it in CI for every saved fixture. If `engineVersion` changes the math, the hash mismatch tells you exactly which saved scenarios moved and why — no silent number drift.

### Pattern 4: Money / Numeric Precision Policy

**What:** Pick one numeric representation for the whole core and document the rounding policy. Floating-point dollars will produce off-by-a-cent errors over a 30-year amortization × N scenarios.

**Recommendation:** Use **`decimal.js`** in the core (amortization needs `pow`/compound-growth, which integer-cents handles awkwardly), with explicit rounding modes, OR integer-cents for storage with a documented rounding step. Either is fine; *not* raw `number` for money. Keep the decimal lib as the **only** runtime dep the core is allowed. (Verified: integer-cents is exact for simple arithmetic; `decimal.js`/`big.js` preferred when compounding/exponentials are involved — see Sources.)

**Trade-off:** Slight verbosity vs. raw numbers; correctness is non-negotiable for a financial product.

## Domain Model

```
Profile (1) ──< Scenario (N)          two profiles, many named scenarios each
  │                  │
  │                  ├── snapshot.input        (house price, down %, term, rent comp)
  │                  ├── snapshot.assumptions  (frozen AssumptionSet copy)
  │                  ├── snapshot.asOf         (frozen valuation date)
  │                  └── result                (TCO + Affordability + FI-Impact)
  │
  └── baseline finances (income, savings rate, current investments, debts, FI target)

AssumptionSet (versioned, reusable)   ──snapshot-copied-into──> Scenario.snapshot
Town (static seed: mill rate, median price, school, commute) ──> Town Scoring engine
```

- **Profile:** the financial identity — income, current portfolio, savings rate, existing debts, FI target age/number. Two of them (you + wife, or two strategies).
- **AssumptionSet:** first-class, versioned, editable, shareable across scenarios — but **never mutated in place after a scenario snapshots it**. Edit = new version.
- **Scenario:** a named what-if. Holds a *frozen snapshot* of (input + assumptions + asOf + engineVersion) and the computed result. This is the reproducibility unit.
- **Result:** `{ tco, affordability, fiImpact, townScore? }` — pure output, recomputable from snapshot.

## How the Three Engines Compose

They are **independent pure functions over shared input types**, composed by `computeScenario` — not a pipeline where one mutates state for the next. Shared inputs (profile, assumptions) flow into each; outputs are combined into one `ScenarioResult`.

```
                 ┌────────────► Affordability ──► { bankMax, trueMax, gap }
profile ─────────┤
assumptions ─────┼────────────► TCO ──► monthly/annual housing cost ─┐
input(house) ────┤                                                   │ (TCO feeds FI)
asOf ────────────┼────────────► FI-Impact ◄──────────────────────────┘
                 │                  └─► { fiDateDelta, netWorthTrajectory, oppCost }
                 │
budget ──────────┴────────────► Town Scoring ──► { compositeScore, bucket } per town
                                  (independent; weights live in assumptions)
```

- **TCO is the shared substrate**: Affordability needs monthly TCO (for DTI), FI-Impact needs the housing *delta vs rent* (foregone contribution) + down payment/closing (foregone lump). Compute TCO once, pass it to both. No duplicate amortization.
- **FI-Impact is the flagship and depends on TCO + profile + return assumptions.** It does *not* depend on Affordability — they answer different questions ("can the bank?" vs "what does it cost our retirement?") and the gap between them is itself an output.
- **Town Scoring is the most independent** — a weighted normalized composite (reuse the prior beach-app scoring architecture). It shares `assumptions` (weights) and a `budget` (which can come from Affordability output) to bucket towns realistic/stretch/fantasy.
- **Sensitivity** is a higher-order function: re-run `computeScenario` across a swept parameter range. Because the engine is pure, sensitivity is "call it 20 times with perturbed assumptions" — trivial and exact.

## Data Flow

### Compute & persist flow

```
[User edits scenario in UI]
      ↓  Server Action
[app.computeAndSaveScenario(id)]
      ↓  ScenarioRepository.load(id)         (SQLite via Drizzle)
[profile + input + AssumptionSet]
      ↓  SNAPSHOT (freeze copy of all inputs + asOf + engineVersion)
[core.computeScenario(...)]  ── PURE, deterministic
      ↓  ScenarioResult
[ScenarioRepository.saveResult(id, snapshot, result, inputsHash)]
      ↓
[UI renders result]   ←── pure read of stored result
```

### Comparison flow (the headline output)

```
[Select N scenarios]
      ↓
[app.compareScenarios([ids])]
      ↓  load each (already-computed results, OR recompute from snapshot)
[sort by fiDateDelta]   ── ranking is the product's core verdict
      ↓
[Comparison view: side-by-side FI-date delta, net-worth divergence, TCO]
      including the "don't buy / rent & invest" baseline as a first-class row
```

The "rent and invest the difference" baseline is itself a scenario (or a synthetic zero-house row) so it always appears in the comparison and the tool can genuinely conclude "don't buy."

### State management (UI)

Keep it boring: server state lives in SQLite, fetched via Server Actions / route handlers; React holds **transient form state** only. No global client store needed for a two-user tool. Results are read-only projections of persisted data, so cache invalidation is "refetch after save."

## Build Order (dependency-driven)

The dependency graph dictates the order. Build inward-out: types and pure math first (they depend on nothing and are the product), persistence and UI last (they depend on everything).

1. **Foundations:** monorepo scaffold (pnpm workspace, `core`/`app`/`web`, strict tsconfig, vitest), Money/precision policy, core domain **types** (`Profile`, `ScenarioInput`, `AssumptionSet`, result types). *Nothing computes yet; everything else imports these.*
2. **TCO engine (pure):** amortization, MA property tax (mill rate), PMI w/ LTV dropoff, insurance, maintenance, HOA, closing costs. *Shared substrate — Affordability and FI both consume it, so it must exist first.* Unit-test exhaustively.
3. **Affordability engine (pure):** bank DTI + true affordability + the gap. Depends on TCO + profile + assumptions.
4. **FI-Impact engine (pure, flagship):** opportunity cost, FI-date delta, net-worth trajectory vs baseline. Depends on TCO + profile + return assumptions. **Reconcile against the existing retirement model as test oracle here** — this is the trust anchor.
5. **Reproducibility harness:** snapshot type + `inputsHash` + "replay snapshot == stored result" test. Lock determinism *before* persistence exists so the contract is proven on pure data.
6. **Ports + Mock adapters:** define `ListingsProvider` / `ScenarioRepository` interfaces; build `MockListingsProvider` (fixtures) and an in-memory repo. Prove the adapter end-to-end against the engine without a DB.
7. **Persistence adapter:** Drizzle schema + `SqliteScenarioRepository` (better-sqlite3) implementing the repo port; migrations; assumption-set versioning. Two profiles, named scenarios.
8. **Town Scoring engine (pure) + seed data:** weighted normalized composite + bucketing; load static mill-rate/town tables. Largely independent — can be parallelized with steps 6–7.
9. **Web shell:** Next.js — profile/assumption editors, scenario builder, then the **comparison view + heatmap + sensitivity charts**. Thin wrappers over `app` services.
10. **Sensitivity sweeps + polish:** higher-order re-runs of the engine; surface output swings to fight false precision.

**Parallelizable:** Town Scoring (8) is independent of the Affordability/FI chain and can be built any time after step 1. Persistence (7) can proceed alongside Town Scoring. Everything in steps 2–5 is strictly sequential because of the shared TCO substrate and the determinism contract.

**Critical path:** 1 → 2 → 3/4 → 5 → 7 → 9. The FI-Impact reconciliation (4) and the reproducibility harness (5) are the highest-risk-of-being-wrong steps and should not be deferred.

## Scaling Considerations

| Scale | Architecture adjustments |
|-------|--------------------------|
| 2 users (actual target) | Local SQLite + better-sqlite3 synchronous driver is ideal. No optimization needed. Single Next.js process. |
| If it ever grew (hypothetical) | Swap `SqliteScenarioRepository` for a Postgres adapter (port unchanged); swap better-sqlite3 for libSQL/Turso if remote/edge needed (driver becomes async — see note). Core unchanged. |
| Listings at real scale | Replace `MockListingsProvider` with a rate-limited, cached `RealListingsProvider`. The wall is already there. |

**Driver note (verified 2026):** `better-sqlite3` is the fastest local-only Node SQLite driver and is synchronous (great fit, and lets the *repo* be sync while the *service* stays async-shaped for future-proofing). `libSQL` is the migration path if you ever want Turso/remote — drop-in but all-async. For this build: **better-sqlite3 + Drizzle.** Don't over-build for scale that won't come; the ports make the swap cheap if it does.

## Anti-Patterns

### Anti-Pattern 1: I/O or ambient state leaking into the core
**What people do:** `new Date()`, `process.env`, `Math.random()`, or a DB query inside an engine function "just this once."
**Why it's wrong:** Destroys determinism and reproducibility — the same snapshot can produce different results. Silently breaks the headline guarantee.
**Do this instead:** Inject `asOf`, all rates, and all data as explicit parameters. The core is a function of its arguments and nothing else. Enforce with the no-deps `package.json` and a lint rule.

### Anti-Pattern 2: Referencing a mutable AssumptionSet from a saved scenario
**What people do:** Store `scenario.assumptionSetId` and re-read the (now-edited) assumptions at view time.
**Why it's wrong:** Editing assumptions silently changes past scenarios' results — "reproducible scenarios" guarantee is violated; comparisons become apples-to-oranges.
**Do this instead:** Snapshot a frozen copy of the full AssumptionSet into the scenario at compute time. Versioning lets you edit going forward without mutating history.

### Anti-Pattern 3: Business math creeping into Next.js components / Server Actions
**What people do:** "Quick" affordability calc inside a React component or a route handler.
**Why it's wrong:** Untested, untrustworthy, unreproducible — and now the math lives in two places.
**Do this instead:** Components render `ScenarioResult`; Server Actions are 3-line wrappers around `app` services; *all* math is in `core`.

### Anti-Pattern 4: Touching `MockListingsProvider` outside the DI container
**What people do:** `import { MockListingsProvider }` directly in a page to "save a step."
**Why it's wrong:** Couples the UI to the concrete mock; the adapter is no longer provably swappable — defeats the entire reason it exists.
**Do this instead:** UI/app depend on the `ListingsProvider` interface only; the one concrete reference lives in `container.ts`.

### Anti-Pattern 5: Raw float dollars
**What people do:** `number` for money across 30-year amortization.
**Why it's wrong:** Cent-level drift accumulates; "false precision" is the explicit enemy of this tool.
**Do this instead:** Decimal lib (or integer-cents) with a documented rounding policy, applied consistently in `core/money`.

## Integration Points

### External Services
| Service | Integration pattern | Notes |
|---------|---------------------|-------|
| Listings (Zillow/Redfin/MLS) | `ListingsProvider` port; **not integrated this build** | Mock only. Real impl is future work behind the existing interface. |
| MA DOR mill rates | Static seeded JSON in `data/` | Live refresh explicitly out of scope; loader is an adapter so refresh is a future swap. |
| Existing retirement model | Test oracle only (not a runtime dep) | FI math reconciled against it in `core/test`; no coupling. |

### Internal Boundaries
| Boundary | Communication | Notes |
|----------|---------------|-------|
| web ↔ app | Server Actions / route handlers calling service functions | Web holds no logic. |
| app ↔ core | Direct pure function calls | Synchronous, deterministic. |
| app ↔ adapters | Via ports (interfaces) only | Concretes wired in `container.ts`. |
| core ↔ everything | **core imports nothing** | Enforced by package boundary + lint. |

## Sources

- pnpm Workspaces (apps/ + packages/, workspace protocol) — https://pnpm.io/workspaces (HIGH)
- Next.js monorepo structure example — https://github.com/belgattitude/nextjs-monorepo-example (MEDIUM)
- Drizzle ORM SQLite get-started — https://orm.drizzle.team/docs/get-started-sqlite (HIGH)
- better-sqlite3 vs libSQL vs sql.js (2026) — https://www.pkgpulse.com/guides/better-sqlite3-vs-libsql-vs-sql-js-sqlite-nodejs-2026 (MEDIUM)
- SQLite driver benchmark (better-sqlite3 / node:sqlite / libSQL / Turso) — https://sqg.dev/blog/sqlite-driver-benchmark/ (MEDIUM)
- decimal.js vs big.js vs bignumber.js (2026) — https://www.pkgpulse.com/guides/decimal-js-vs-big-js-vs-bignumber-js-arbitrary-2026 (MEDIUM)
- Handling money / financial precision in JS (integer-cents vs decimal libs) — https://dev.to/benjamin_renoux/financial-precision-in-javascript-handle-money-without-losing-a-cent-1chc (MEDIUM)
- Ports & Adapters / Hexagonal + Functional-Core-Imperative-Shell — established architecture patterns (HIGH, training-data + widely documented)

---
*Architecture research for: personal home-affordability + FI-impact decision tool (Next.js + pure TS core + local SQLite)*
*Researched: 2026-06-22*
