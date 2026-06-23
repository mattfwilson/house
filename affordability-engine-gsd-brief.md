# GSD Project Brief — Boston Home Affordability & FI-Impact Engine

> Paste the **"What do you want to build?"** section into `/gsd-new-project`. The rest is supporting context GSD can pull from as it scaffolds.

---

## What do you want to build?

A personal home-affordability decision tool for me and my wife, focused on the greater Boston area. Unlike Zillow/Redfin — which start with houses and make you reverse-engineer whether you can afford them — this tool **inverts the flow**: it starts with our actual finances and FI (financial independence) goals, then projects outward to *what we can truly afford* and *which towns are realistic*.

The defining principle: this tool answers **"what does buying this house do to our early-retirement timeline?"** — not "what will a bank lend us." It must be allowed to conclude "don't buy" or "rent and invest the difference." It is a decision tool, not a purchase funnel.

**Scope for this build = the core engine only.** Three modules:

1. **Affordability Engine** — Models both *bank affordability* (DTI-based, what a lender would approve) and *true affordability* (what fits our savings rate and FI target). Surfaces the gap between them. Computes full total cost of ownership (TCO), not just principal+interest.

2. **Opportunity-Cost / FI-Impact Engine** — The flagship feature. Treats the down payment plus monthly housing delta as dollars *not invested*, and projects the impact on our FI date. Lets us compare scenarios (e.g., $700K vs. $900K house) and see each one's effect on the retire-by-45–47 target. This is a fork/extension of a retirement model I already maintain.

3. **Town Scoring & Affordability Heatmap** — A weighted scoring engine across Massachusetts towns (property tax rate, commute, school ratings, plus my own amenity weights). Given a budget, classifies towns as **realistic / stretch / fantasy**. This is the "cross-match budget to geography" step — useful with zero live listings.

**Explicitly OUT of scope for now:** live listing data (Zillow/Redfin/MLS). BUT — the architecture must define a clean **`ListingsProvider` adapter interface** now, so a real data source (MLS/IDX, RentCast, ATTOM, or even a manual CSV import) can be plugged in later without touching the core. Build a `MockListingsProvider` returning static fixtures so the interface is exercised and proven from day one.

**Stack:** Next.js + TypeScript front end, with the financial logic isolated in a pure, framework-agnostic, fully unit-tested calculation core (no React inside it). I'm comfortable with this stack (similar to a prior Next.js/Supabase project). Persistence can start local (SQLite/Supabase) — scenarios must be saveable and comparable side by side.

**Users:** Just me and my wife. Two saved financial profiles, multiple named scenarios per profile. No auth complexity beyond keeping it private.

---

## Why this exists (the differentiation)

Commercial sites are structurally incapable of telling you a house will wreck your financial independence date — it's against their interest. This tool's entire reason to exist is to model the trade-off they hide. Think of it as a **flight simulator for a house purchase**: before committing to the real thing, you fly the scenario and watch the instruments (FI date, net worth trajectory, liquidity) respond.

---

## Core domain logic (the parts that must be correct)

### Affordability Engine
- **Bank affordability:** front-end and back-end DTI ratios (~28% / ~36% conventional, configurable), factoring existing debts. Output = max loan a lender would likely approve.
- **True affordability:** what fits our target savings rate *without* pushing the FI date past threshold. This is the number that matters.
- **TCO (monthly + annualized):**
  - Principal + interest (amortization from rate, term, loan amount)
  - **Property tax — MA town-level mill rates** (huge variance; Weston vs. Lynn is a different planet). Town-specific, not a flat %.
  - Homeowners insurance
  - **PMI** when down payment < 20%, dropping off at the right LTV
  - Maintenance reserve (~1–2%/yr of home value, configurable)
  - HOA/condo fees where relevant
  - Closing costs (one-time, amortizable for comparison)
- **Rent-vs-buy** at *our* actual numbers, not a generic calculator.

### Opportunity-Cost / FI-Impact Engine
- Inputs: current net worth, savings rate, expected real return, target annual retirement spend, current FI model assumptions.
- For a given house scenario: compute **down payment + closing costs as foregone investment**, plus the **monthly housing delta vs. renting** as a recurring foregone contribution.
- Output: **shift in FI date** (months/years) and divergence in net-worth trajectory vs. the no-purchase baseline.
- Scenario comparison: N houses side by side, each showing FI-date delta. *This is the headline output of the whole app.*

### Town Scoring & Heatmap
- Per-town data: mill rate, median price, commute time to a configurable anchor, school rating, my custom amenity weights.
- Weighted, normalized composite score (reuse the scoring pattern from my prior beach app — same architecture, new domain).
- Given a budget, bucket towns into realistic / stretch / fantasy.
- **MA-specific realities to model or at least flag:** Prop 2½ tax levy mechanics, betterment assessments, Title 5 septic (outside urban core), 40B developments.

---

## Architecture guardrails (GSD should enforce these)

- **Pure calculation core, zero framework deps.** All financial math lives in testable pure functions. UI is a thin shell over it. *Rationale: financial correctness is the whole product; it must be unit-testable in isolation and trustworthy.*
- **`ListingsProvider` interface defined now, `MockListingsProvider` only implementation for this build.** Walls off the highest-risk dependency.
- **Assumptions are first-class data, never hardcoded.** Tax rates, DTI thresholds, return assumptions, maintenance % — all configurable and stored, because they drive every output and we'll want to stress-test them.
- **Every scenario reproducible.** A saved scenario captures every input/assumption so its result can be regenerated exactly.

---

## What "done" looks like for this build

1. Enter our two financial profiles.
2. Create a house scenario (price, down %, town, etc.).
3. See: bank-affordability vs. true-affordability gap, full TCO breakdown, **and the FI-date impact.**
4. Save multiple scenarios and compare side by side, ranked by FI-date impact.
5. View the town affordability heatmap for a given budget.
6. `MockListingsProvider` proves the adapter works end to end.

---

## Open questions to resolve during GSD planning

- **MA property-tax data source** — annual town mill rates (DOR publishes these). Seed a static table now or build a refresh path? *Recommend: seed static for build, flag refresh as future work.*
- **FI-model reconciliation** — adapt my existing retirement model's assumptions, or re-implement cleanly inside this tool and validate the two agree? *Recommend: re-implement clean, then reconcile against the existing model as a test oracle.*
- **Persistence** — local SQLite vs. Supabase for a two-user private tool. *Recommend: simplest thing that saves scenarios; defer the rest.*

---

## Known risks / things to keep honest

- **Garbage-in on assumptions.** Return rate, maintenance %, and tax figures swing outputs enormously. Build sensitivity analysis early, or every result is false precision wearing a confident face.
- **Scope creep toward listings.** The adapter exists *so we can ignore listings for now*. Don't let "wouldn't it be cool to pull a real listing" leak into this build.
- **The tool must be able to say no.** If every path ends in "buy," it's a sales funnel. Preserve the rent-and-invest conclusion as a real, reachable output.
