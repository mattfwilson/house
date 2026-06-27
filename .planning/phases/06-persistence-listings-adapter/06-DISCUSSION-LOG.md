# Phase 6: Persistence & Listings Adapter - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-27
**Phase:** 6-persistence-listings-adapter
**Areas discussed:** Shell package placement, Scenario snapshot storage, ListingsProvider interface, Profiles & scenarios model

---

## Shell package placement

| Option | Description | Selected |
|--------|-------------|----------|
| New `packages/app` | Separate workspace package for orchestration + adapters + DI container; buildable/testable without Next.js; ports in core; matches ARCHITECTURE.md hexagonal design | ✓ |
| `apps/web` now | Create the Next.js app early and put persistence in Server Actions; matches CLAUDE.md TL;DR but pulls Next.js forward into Phase 6 | |
| `packages/persistence` | Persistence-only package; narrower than packages/app; may need a second package for listings/DI | |

**User's choice:** New `packages/app`
**Notes:** Resolves the CLAUDE.md-TL;DR-vs-ARCHITECTURE.md conflict in favor of the hexagonal research — persistence + adapters live in `packages/app`, ports stay in `core`, `apps/web` is deferred to Phase 7 as a thin caller.

---

## Scenario snapshot storage

| Option | Description | Selected |
|--------|-------------|----------|
| Blob + queryable columns | Canonical-JSON snapshot as a validated TEXT blob (Zod-parsed on load, reusing Phase 1's canonicalJson) PLUS thin indexed columns (id, profile_id, name, created_at) | ✓ |
| Pure canonical-JSON blob | One opaque snapshot blob per scenario, minimal columns; simplest + maximally reproducible but every query deserializes | |
| Fully normalized columns | Break snapshot into typed columns/tables; most queryable but risks drift from the canonical snapshot | |

**User's choice:** Blob + queryable columns
**Notes:** The blob is the source of truth for reproducibility; columns are derived index metadata for listing/reloading without deserializing.

---

## ListingsProvider interface

| Option | Description | Selected |
|--------|-------------|----------|
| `getListings(query)` + `getById` | Minimal but real: filtered list + by-id over a small Listing type; proves the adapter end-to-end without over-anticipating a real API | ✓ |
| List-only `getListings()` | Ultra-minimal single method, no query/by-id; may under-exercise the adapter | |
| Richer (pagination/filter) | Anticipate a real provider with pagination + structured filters; speculative for a mock-only build (anti-feature risk) | |

**User's choice:** `getListings(query)` + `getById`
**Notes:** `Listing` seeded from Boston-home fields (address, town, list price as decimal/Money, beds/baths, sqft, type); MockListingsProvider returns hand-seeded fixtures.

---

## Profiles & scenarios model

| Option | Description | Selected |
|--------|-------------|----------|
| ≤2 profiles, name-unique scenarios | Up to 2 profiles (soft cap), scenarios uniquely named per profile, created/updated timestamps, edit+delete, drizzle-kit migrations | ✓ |
| Exactly 2 fixed profiles | Hard-cap at 2 pre-seeded slots; simpler invariant but less flexible | |
| N profiles | No cap at the data layer; "2 profiles" becomes a UI convention; weakens the stated success criterion | |

**User's choice:** ≤2 profiles, name-unique scenarios
**Notes:** Soft cap leaning toward a service-layer guard so the invariant is real without a UI. Profile fields: net worth, income, savings rate, existing debts, current rent.

---

## Claude's Discretion

- Exact `Listing` field set and `getListings` query shape (which filters).
- Repository contract-test strategy (shared port-contract suite vs per-adapter) + snapshot round-trip reproducibility test.
- Whether the ≤2-profile cap is enforced at the service layer vs UI convention (leaning service-layer guard).
- DB file location/bootstrapping, Drizzle schema module organization, and the `vitest` `projects` entry for `packages/app`.
- Orchestration service granularity (`computeAndSaveScenario`, `loadScenario`, `listScenarios`).

## Deferred Ideas

- `apps/web` Next.js shell (forms, comparison table, heatmap, Server Actions) → Phase 7.
- `RealListingsProvider` / live listing data → out of scope (anti-feature); port keeps it pluggable.
- Richer `ListingsProvider` surface (pagination/structured filters) → until a real provider needs it.
- Separate `AssumptionSetRepository` → assumptions ride inside the scenario snapshot this phase.
- Scenario comparison / sensitivity-sweep user-facing flows → Phase 7.
