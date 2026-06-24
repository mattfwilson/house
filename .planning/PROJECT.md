# Boston Home Affordability & FI-Impact Engine

## What This Is

A personal home-affordability decision tool for me and my wife, focused on the greater Boston area. Unlike Zillow/Redfin — which start with houses and make you reverse-engineer whether you can afford them — this tool **inverts the flow**: it starts with our actual finances and FI (financial independence) goals, then projects outward to *what we can truly afford* and *which Massachusetts towns are realistic*.

This build is the **core engine only** — three modules (Affordability, Opportunity-Cost/FI-Impact, Town Scoring & Heatmap) with a thin Next.js shell over a pure, framework-agnostic calculation core. Live listing data is deliberately out of scope, walled off behind a `ListingsProvider` adapter.

## Core Value

Answer **"what does buying this house do to our early-retirement timeline?"** — not "what will a bank lend us." The tool must be allowed to conclude "don't buy" or "rent and invest the difference." It is a decision tool, not a purchase funnel.

## Requirements

### Validated

<!-- Shipped and confirmed valuable. -->

(None yet — ship to validate)

### Active

<!-- Current scope. Building toward these. -->

- [ ] **Affordability Engine** — model both *bank affordability* (DTI-based: ~28% front / ~36% back, configurable, factoring existing debts) and *true affordability* (what fits our savings rate without pushing FI date past threshold); surface the gap between them
- [ ] **Full TCO** — principal + interest (amortization), MA town-level property tax (mill rates), homeowners insurance, PMI (when down payment < 20%, dropping at correct LTV), maintenance reserve (~1–2%/yr configurable), HOA/condo fees, closing costs (one-time, amortizable for comparison); monthly + annualized
- [ ] **Rent-vs-buy** computed at our actual numbers, not a generic calculator
- [ ] **Opportunity-Cost / FI-Impact Engine (flagship)** — treat down payment + closing costs as foregone investment and the monthly housing delta vs renting as a recurring foregone contribution; output the shift in FI date and net-worth trajectory divergence vs the no-purchase baseline
- [ ] **Scenario comparison** — N house scenarios side by side, each showing FI-date delta, ranked by FI-date impact (the headline output)
- [ ] **Town Scoring & Affordability Heatmap** — weighted, normalized composite score across MA towns (mill rate, median price, commute to configurable anchor, school rating, custom amenity weights); given a budget, bucket towns into realistic / stretch / fantasy
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
*Last updated: 2026-06-24 — Phase 1 (Foundations & Determinism Core) complete: pure framework-agnostic calc core, decimal-precise `Money`, runtime+lint determinism guards, versioned assumptions-as-data, and a golden-master reproducibility harness. No engine result computes yet by design — everything downstream imports these primitives. User-facing Active requirements remain unvalidated until an engine produces results.*
