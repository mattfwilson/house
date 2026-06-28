# Boston Home Affordability & FI-Impact Engine

## What This Is

A personal home-affordability decision tool for me and my wife, focused on the greater Boston area. Unlike Zillow/Redfin — which start with houses and make you reverse-engineer whether you can afford them — this tool **inverts the flow**: it starts with our actual finances and FI (financial independence) goals, then projects outward to *what we can truly afford* and *which Massachusetts towns are realistic*.

This build is the **core engine only** — three modules (Affordability, Opportunity-Cost/FI-Impact, Town Scoring & Heatmap) with a thin Next.js shell over a pure, framework-agnostic calculation core. Live listing data is deliberately out of scope, walled off behind a `ListingsProvider` adapter.

## Core Value

Answer **"what does buying this house do to our early-retirement timeline?"** — not "what will a bank lend us." The tool must be allowed to conclude "don't buy" or "rent and invest the difference." It is a decision tool, not a purchase funnel.

## Requirements

### Validated

<!-- Shipped and confirmed valuable. -->

- [x] **Town Scoring & Affordability Heatmap** *(engine — Phase 5; heatmap rendering deferred to Phase 7)* — pure `scoreTowns` engine over the 24 curated MA towns: weighted, fixed-range-normalized, direction-corrected composite (mill rate, median price, commute-by-anchor, school rating, multi-amenity sub-scores) with explicit missing-data handling (drop + renormalize, never imputed); budget-driven realistic/stretch/fantasy bucketing (exact integer-cent compare, independent of the composite); per-metric explainable breakdown satisfying the UI-SPEC heatmap data contract; and qualitative MA flags (Prop 2½ universal, betterment/Title 5/40B curated). TOWN-01..TOWN-04.
- [x] **Persistence & Listings Adapter** *(Phase 6)* — the imperative shell (`packages/app`) around the proven core: local SQLite (better-sqlite3 + Drizzle) `SqliteProfileRepository`/`SqliteScenarioRepository` behind core-defined ports, with `InMemory*` fakes proven by one shared `repositoryContract` factory. Two-profile soft cap enforced at the service layer; named scenarios store the full frozen `EngineInput` snapshot as a canonicalJson TEXT blob and reload byte-identical from a fresh connection (the Phase-1 reproducibility contract survives SQLite). Every money leaf is a canonical decimal-string TEXT column re-validated through Zod on load (no `as` bypass). The walled-off `ListingsProvider` port has its one `MockListingsProvider` over hand-seeded Boston fixtures; a single DI `container.ts` is the only file naming concrete adapters, enforced by an eslint `boundaries` rule + lint-as-test. PROF-01, PROF-02, PROF-03, LIST-01, LIST-02.

### Active

<!-- Current scope. Building toward these. -->

- [ ] **Affordability Engine** — model both *bank affordability* (DTI-based: ~28% front / ~36% back, configurable, factoring existing debts) and *true affordability* (what fits our savings rate without pushing FI date past threshold); surface the gap between them
- [ ] **Full TCO** — principal + interest (amortization), MA town-level property tax (mill rates), homeowners insurance, PMI (when down payment < 20%, dropping at correct LTV), maintenance reserve (~1–2%/yr configurable), HOA/condo fees, closing costs (one-time, amortizable for comparison); monthly + annualized
- [ ] **Rent-vs-buy** computed at our actual numbers, not a generic calculator
- [ ] **Opportunity-Cost / FI-Impact Engine (flagship)** — treat down payment + closing costs as foregone investment and the monthly housing delta vs renting as a recurring foregone contribution; output the shift in FI date and net-worth trajectory divergence vs the no-purchase baseline
- [ ] **Scenario comparison** — N house scenarios side by side, each showing FI-date delta, ranked by FI-date impact (the headline output)
- [ ] **Two saved financial profiles**, multiple named scenarios per profile, saved and comparable side by side
- [ ] **`ListingsProvider` adapter interface** defined now, with a `MockListingsProvider` (static fixtures) as the only implementation, proving the adapter end to end
- [ ] **Assumptions as first-class data** — tax rates, DTI thresholds, return assumptions, maintenance % all configurable and stored, never hardcoded
- [ ] **Reproducible scenarios** — a saved scenario captures every input/assumption so its result can be regenerated exactly
- [ ] **Sensitivity analysis** — surface how outputs swing with key assumptions (return rate, maintenance %, tax figures) to avoid false precision

### Out of Scope

<!-- Explicit boundaries. Includes reasoning to prevent re-adding. -->

- **Live listing data (Zillow/Redfin/MLS/IDX/RentCast/ATTOM)** — highest-risk dependency; walled off behind `ListingsProvider` so it can be plugged in later without touching the core. The adapter exists *so we can ignore listings for now.*
- **Live property-tax data refresh** — seed a static table of DOR-published town mill rates for this build; live refresh is future work
- **Auth / multi-tenant / accounts** — private two-user tool; no auth complexity beyond keeping it private
- **A "buy" funnel** — preserve the rent-and-invest conclusion as a real, reachable output; if every path ends in "buy," it has failed

## Context

- **Domain:** greater Boston / Massachusetts residential real estate, modeled against personal FI planning. Target retire-by-45–47.
- **MA-specific realities to model or at least flag:** town-level mill rate variance (Weston vs Lynn is a different planet), Prop 2½ tax levy mechanics, betterment assessments, Title 5 septic (outside urban core), 40B developments.
- **Prior work to reuse:** an existing retirement model (FI math source of truth / test oracle); a prior beach app whose weighted-scoring architecture maps directly onto town scoring; a prior Next.js/Supabase project (stack familiarity).
- **Mental model:** a "flight simulator for a house purchase" — fly the scenario and watch the instruments (FI date, net-worth trajectory, liquidity) respond before committing.

## Constraints

- **Tech stack**: Next.js + TypeScript front end — comfortable with this stack.
- **Architecture**: Pure calculation core, **zero framework deps** (no React inside it). All financial math in testable pure functions; UI is a thin shell. *Rationale: financial correctness is the whole product; it must be unit-testable in isolation and trustworthy.*
- **Persistence**: Local SQLite. Scenarios must be saveable and comparable side by side. *Rationale: simplest thing that saves scenarios for a private two-user tool; defer the rest.*
- **Testing**: calculation core fully unit-tested; FI math reconciled against the existing retirement model as a test oracle.

## Key Decisions

<!-- Decisions that constrain future work. Add throughout project lifecycle. -->

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Pure, framework-agnostic calculation core (no React) | Financial correctness is the product; must be unit-testable in isolation | — Pending |
| `ListingsProvider` interface now, `MockListingsProvider` only impl | Wall off the highest-risk dependency; prove the adapter from day one | — Pending |
| Persistence = local SQLite | Simplest thing that saves scenarios for a private two-user tool | — Pending |
| Re-implement FI math clean, reconcile against existing model as test oracle | Keep the core pure/trustworthy; validate agreement via tests rather than coupling | — Pending |
| Seed static MA town mill-rate table, flag live refresh as future | Unblocks the build without taking on a live data dependency | — Pending |
| Assumptions are first-class stored data, never hardcoded | They drive every output; we'll want to stress-test them | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-06-28 — Phase 6 (Persistence & Listings Adapter) complete: the imperative shell `packages/app` over the proven core — SQLite (better-sqlite3 + Drizzle) profile/scenario repositories behind core ports, two-profile soft cap at the service layer, named scenarios persisting the frozen `EngineInput` as a canonicalJson TEXT blob that reloads byte-identical from a fresh connection (Phase-1 reproducibility contract survives SQLite; money leaves are decimal-string TEXT re-validated through Zod on load, no `as` bypass). Walled-off `ListingsProvider` port + `MockListingsProvider` over hand-seeded Boston fixtures; a single DI `container.ts` is the only concrete-adapter site, enforced by an eslint `boundaries` lint-as-test. Full suite green at 469 tests (+70). PROF-01/02/03, LIST-01/02 validated. Carry-forward warnings (non-blocking): version cast at scenario-repo.ts:64 to revisit before a V5 schema, no `Container.close()`, and 6 `no-unused-vars` lint errors in `persistence.type-test.ts`. Next: Phase 7 web shell.*
