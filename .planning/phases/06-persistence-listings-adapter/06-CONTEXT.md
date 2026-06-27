# Phase 6: Persistence & Listings Adapter - Context

**Gathered:** 2026-06-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Build the **imperative shell** around the proven pure core (functional-core / hexagonal ports-and-adapters):

1. **Repository ports** (`ProfileRepository`, `ScenarioRepository`) and the **`ListingsProvider` port** defined as pure TypeScript `interface`s **in `packages/core`** — the core owns its contracts; it stays zero-framework-dep.
2. **Local SQLite persistence** (better-sqlite3 + Drizzle + drizzle-kit) for **up to two financial profiles** and **many named, reloadable scenarios** per profile, implemented as concrete adapters in a **new `packages/app`** workspace package, wired to the ports via a **manual DI container**.
3. **`MockListingsProvider`** (static hand-seeded fixtures) implementing the `ListingsProvider` port end to end.

**Snapshots stored here MUST satisfy the Phase-1 reproducibility contract** — a saved scenario captures the full input + assumption snapshot and reloads to a byte-identical canonical-JSON form.

**This phase is engine-shell only — NO Next.js, NO UI, NO rendering.** `apps/web` (forms, comparison table, heatmap, Server Actions) is Phase 7. The shell built here is driven from tests, callable later by Next without modification.

</domain>

<decisions>
## Implementation Decisions

### Package layout & dependency direction
- **D-01:** Introduce a **new `packages/app`** workspace package for the imperative shell — orchestration services + concrete adapters (`SqliteScenarioRepository`, `SqliteProfileRepository`, `MockListingsProvider`) + a **manual DI container** (`container.ts`) that wires adapters → ports. The shell is buildable/testable **without Next.js**; Phase 7's `apps/web` becomes a thin caller. This follows `ARCHITECTURE.md`'s hexagonal design and **supersedes the CLAUDE.md TL;DR wording** ("2 packages — core + apps/web, persistence in apps/web"): persistence lives in `packages/app`, not `apps/web`.
- **D-02:** **Ports/interfaces live in `packages/core`** (`ProfileRepository`, `ScenarioRepository`, `ListingsProvider`) — the side that defines the need owns the contract (dependency inversion). `core` keeps its **zero-framework-dep** rule: pure `interface` declarations only, no better-sqlite3/Drizzle import in core. Adapters in `packages/app` depend inward on these ports.
- **D-03:** **DI discipline (success criterion 3):** outside the DI container, code depends **only on the port interface, never the concrete adapter type**. The container is the single composition root that names concrete types.
- **D-04:** This repo uses **npm workspaces** (root `package.json` `workspaces: ["packages/*","apps/*"]`, `package-lock.json`) — `packages/app` is an npm workspace package consuming `core` via the workspace protocol. (Note: `ARCHITECTURE.md` mentions pnpm; the actual repo is npm — follow npm.)

### Scenario snapshot storage (reproducibility)
- **D-05:** A saved scenario stores its **full input + assumption snapshot as a validated canonical-JSON TEXT blob** — produced by reusing Phase 1's `canonicalJson` serializer and **Zod-parsed on load** (never trust raw JSON). This is the reproducibility primitive: save → reload → re-serialize yields byte-identical canonical JSON.
- **D-06:** Alongside the blob, store **thin queryable columns** — `id`, `profile_id` (FK), `name`, `created_at`, `updated_at` — so scenarios can be listed/reloaded without deserializing every blob. The blob remains the source of truth for the snapshot; columns are derived/index metadata only.
- **D-07:** The scenario snapshot embeds the **`AssumptionSet` snapshot** (already versioned + `parseAssumptionSet`-validated from Phase 1–5). No separate `AssumptionSetRepository` this phase — assumptions travel inside the scenario snapshot.

### ListingsProvider port surface
- **D-08:** The `ListingsProvider` port exposes a **minimal-but-real** surface: `getListings(query): Listing[]` (query = a small filter, e.g. town and/or price range) and `getListingById(id): Listing | null`. Enough to exercise the adapter end to end without over-anticipating a real API (no pagination/structured-filter speculation — that's an anti-feature for a mock-only build).
- **D-09:** The `Listing` domain type is seeded from **Boston-home fields** — id, address, town (consistent with the Phase-5 town table where sensible), list price (canonical **decimal string / `Money`**, never bare `number`), beds, baths, living sqft, property type. Exact field set is Claude's discretion within this shape; `MockListingsProvider` returns **hand-seeded static fixtures**.

### Profiles & scenarios data model
- **D-10:** **Up to two financial profiles** (soft cap — not hard-pinned to exactly 2). Profile fields: net worth, income, savings rate, existing debts, current rent (the Phase-6 inputs the engines consume).
- **D-11:** Scenarios belong to a profile (FK) and are **uniquely named within their profile**; **created/updated timestamps**; **edit + delete** supported. Schema evolution via **drizzle-kit migrations** (real, readable SQL files — reproducibility-friendly).

### Claude's Discretion
- Exact `Listing` field set and the `getListings` query shape (which filters: town, price range, beds-min?) — keep minimal, honest, fixture-backed.
- Repository **contract-test** strategy — ideally one shared port-contract test suite run against both the SQLite adapter and an in-memory/mock fake, plus a **snapshot round-trip reproducibility test** (save → reload → identical canonical JSON), consistent with prior phases' golden/worked-example discipline.
- Whether the soft "≤2 profiles" cap is enforced at the repository/service layer (validate-and-throw) vs left as a UI convention — lean toward a service-layer guard so the invariant is real without the UI.
- DB file location/bootstrapping (single local `.sqlite`), Drizzle schema module organization, and the `vitest` `projects` entry for `packages/app` (node env, no JSX).
- Orchestration service granularity (`computeAndSaveScenario`, `loadScenario`, `listScenarios`) — shape per the `ARCHITECTURE.md` Pattern 1 examples.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Architecture (load-bearing — this phase IS the hexagonal boundary)
- `.planning/research/ARCHITECTURE.md` — the functional-core / imperative-shell + ports-and-adapters design; the package diagram (`core` / `app` / `web`), the ports table (`ListingsProvider`, `ScenarioRepository`, `ProfileRepository` live in core; adapters in `app`), Pattern 1 (functional core: `computeScenario` pure → `computeAndSaveScenario` shell), and Pattern 2 (`ListingsProvider` interface + `MockListingsProvider`). NOTE: it says pnpm; the repo is npm (D-04).

### Requirements & roadmap
- `.planning/REQUIREMENTS.md` — PROF-01, PROF-02, PROF-03 (two profiles + named reloadable scenarios + reproducible snapshots), LIST-01, LIST-02 (`ListingsProvider` interface + `MockListingsProvider`).
- `.planning/ROADMAP.md` §"Phase 6: Persistence & Listings Adapter" — goal + 4 success criteria.

### Reproducibility primitive (reuse, do not reinvent)
- `packages/core/src/serialize/canonical-json.ts` — `canonicalJson` (recursive key-sort + float-free) — the snapshot serializer scenario blobs MUST use (D-05).
- `packages/core/src/assumptions/assumption-set.ts` — `parseAssumptionSet` / `serializeAssumptionSet` — the validated boundary the embedded assumption snapshot crosses (D-07).
- `packages/core/src/assumptions/schema.ts` — the versioned `AssumptionSet` (V4) Zod schemas + `decStr` canonical-decimal validator — the boundary pattern any new persisted Zod schema follows.

### Stack & constraints
- `CLAUDE.md` — better-sqlite3 12 + Drizzle 0.45 + drizzle-kit, Zod 4 at boundaries, Vitest `projects`, decimal.js (no bare-`number` money). Its TL;DR "persistence in apps/web" is superseded by D-01 (persistence in `packages/app`).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`packages/core/src/serialize/canonical-json.ts`** — the exact serializer scenario snapshots round-trip through (D-05); already byte-stable + float-free.
- **`packages/core/src/assumptions/*`** — `AssumptionSet` (V4) + `parseAssumptionSet` + `decStr`: the embedded snapshot's validated shape (D-07) and the Zod-`.strict()`+`decStr` boundary pattern for any new persisted type.
- **`packages/core/src/money/*`** + decimal discipline — `Money`/decimal strings for list price and any monetary field on `Listing`/profiles (D-09); no bare-`number` money (type-test-enforced in prior phases).
- **`packages/core/src/towns/town-table.ts`** (Phase 5) — the curated MA town set; `Listing.town` should align with it where sensible (D-09).

### Established Patterns
- **Zero-framework-dep core** enforced by package boundary + `eslint-plugin-boundaries` — ports go in core as pure interfaces; better-sqlite3/Drizzle must NOT be imported by core (D-02).
- **Validate-through-Zod-at-every-boundary / no-silent-default** — persisted blobs parse through Zod on load; unknown/malformed rejected (mirrors `parseAssumptionSet`).
- **Pure-in / data-out + reproducibility golden** — the shell wraps the pure engines (Pattern 1); the snapshot round-trip test is the Phase-6 analog of the golden tests.

### Integration Points
- New `packages/app` is the FIRST workspace package besides `core`; it adds the SQLite native dep + drizzle-kit and a new `vitest` `projects` entry (node env).
- `packages/core/src/index.ts` barrel gains the new port interfaces + `Listing`/snapshot types (public contract consumed by `packages/app` now and `apps/web` in Phase 7).

</code_context>

<specifics>
## Specific Ideas

- The build follows `ARCHITECTURE.md`'s explicit code sketches: Pattern 1 (`computeScenario` pure → `computeAndSaveScenario(repo, …)` shell) and Pattern 2 (`interface ListingsProvider` + `class MockListingsProvider implements ListingsProvider`). Treat those as the target shapes.
- The differentiating discipline: the listings dependency is **walled off behind the port now so it can be ignored** — `MockListingsProvider` is the *only* implementation this build; a future `RealListingsProvider` changes one DI-container line and zero core/app logic lines.

</specifics>

<deferred>
## Deferred Ideas

- **`apps/web` Next.js shell** — forms for profiles/assumptions/scenarios, side-by-side comparison table, heatmap rendering, sensitivity charts, Server Actions wiring the DI container → Phase 7 (Web Shell).
- **`RealListingsProvider` / live listing data** (Zillow/Redfin/MLS/IDX/RentCast/ATTOM) — out of scope (explicit anti-feature); the port exists precisely so this stays pluggable later.
- **Richer `ListingsProvider` surface** (pagination, structured multi-filter queries) — deferred until a real provider needs it (D-08 keeps the mock minimal).
- **Separate `AssumptionSetRepository`** — assumptions ride inside the scenario snapshot this phase (D-07); a standalone assumptions store can come later if a shared-assumptions UX emerges.
- **Scenario comparison / sensitivity-sweep orchestration as user-facing flows** — the headline "compare N scenarios" UX is Phase 7; Phase 6 only guarantees scenarios persist and reload reproducibly.

None of the above were scope creep — discussion stayed within the Phase 6 boundary.

</deferred>

---

*Phase: 6-persistence-listings-adapter*
*Context gathered: 2026-06-27*
