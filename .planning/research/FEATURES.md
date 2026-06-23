# Feature Research

**Domain:** Personal home-affordability + rent-vs-buy + FI-impact decision tool (greater Boston / MA)
**Researched:** 2026-06-22
**Confidence:** HIGH (well-established calculator category; methodologies are public and stable)

> **Framing note for the roadmap:** This is a private two-user decision tool, not a SaaS product competing for users. "Table stakes" here means "the financial model is incomplete / untrustworthy without it" — not "users will churn." The differentiator (FI-date inversion) is the entire point; everything else exists to make that number credible. The category leaders (NYT Rent-vs-Buy, NerdWallet/Bankrate mortgage calculators, Engaging-Data FIRE calc, Niche/AreaVibes town scoring) define the table stakes for each of the three modules.

## Feature Landscape

### Table Stakes (The Model Is Incomplete Without These)

#### Module 1 — Affordability / Mortgage TCO

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Amortization schedule (P&I split per month) | Every mortgage calc has it; principal paydown is required input to FI-impact equity tracking | MEDIUM | Standard fixed-rate formula. The schedule (not just the monthly payment) is needed downstream for equity/net-worth trajectory. Pure function, fully unit-testable. |
| PITI breakdown (principal, interest, taxes, insurance) | The universal baseline "true monthly payment" | LOW | Composition of other components. |
| Property tax via MA town mill rates | Core MA realism; Weston vs Lynn is "a different planet" (PROJECT.md). Generic calcs use a flat ~1.1% — that's wrong for MA | MEDIUM | Seed static DOR mill-rate table. Mill rate × assessed value. Flag Prop 2½ levy mechanics as an assumption note, don't model it dynamically in v1. |
| Homeowners insurance estimate | Part of PITI everywhere | LOW | Configurable $ or % of value; coastal MA towns skew higher — allow override. |
| PMI with correct LTV drop-off | Standard calcs all model it; getting the drop-off LTV right matters for monthly trajectory | MEDIUM | Applies when down payment < 20%. Auto-cancels at 78% LTV (lender-required) / borrower-request at 80%; model the 80% threshold and note 78% auto. Tiered rate by LTV band is industry standard (1.03% at 95-100% down to 0.375% at 80-85%). |
| Maintenance reserve (% of value/yr) | Industry rule of thumb 1%+/yr; omitting it is the classic "renting looks worse than it is" error | LOW | Configurable 1-2%. Recurring cost feeding TCO and rent-vs-buy. |
| HOA / condo fees | Required for condo scenarios (common in Boston metro) | LOW | Flat monthly input. |
| Closing costs (one-time) | Every serious calc includes; ~2-5% of price; dominate the break-even math | LOW | One-time. Must be amortizable for fair monthly comparison. |
| Monthly + annualized TCO rollup | The headline "what it actually costs" number | LOW | Aggregation of all above. |
| Bank DTI affordability (front ~28% / back ~36%) | The thing every lender/calc computes; needed to surface the gap vs true affordability | MEDIUM | Configurable thresholds; factors existing debts. This is the "what a bank will lend" baseline the tool deliberately contrasts against. |

#### Module 2 — Rent-vs-Buy

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Opportunity cost of down payment + closing costs | THE defining feature of any credible rent-vs-buy calc (NYT, NerdWallet). Renter invests the cash the buyer ties up | MEDIUM | Shared math with Module 2's FI engine — down payment becomes foregone investment at the configured return rate. |
| "Invest the monthly difference" modeling | NYT methodology: renter invests (buy cost − rent cost) each month | MEDIUM | Sign-aware: when buying is cheaper the buyer invests the difference instead. Critical for honesty. |
| Home appreciation rate (configurable) | Standard input; long-run US ~3-4%/yr | LOW | Drives equity growth on the buy side. Must be a tunable assumption (sensitivity-analyzed), not a fixed constant. |
| Rent growth / inflation on ongoing costs | NYT/NerdWallet model rent inflation; without it buying always wins long-run | LOW | Separate rent-growth and general-inflation assumptions. |
| Selling costs on exit (agent + closing, ~5-6%) | Non-recoverable transaction cost; the reason break-even takes years | LOW | Applied at the comparison horizon. |
| Break-even horizon | The canonical rent-vs-buy output ("stay N years for buying to win") | MEDIUM | Year-by-year crossover of cumulative cost/net-worth. Reframes the question from "cheaper?" to "how long?" |
| Tax treatment (SALT cap, itemize vs standard) | MA-relevant: $10k SALT cap + high property tax means many get little/no mortgage-interest benefit; ~90% take standard deduction | MEDIUM | Model honestly — many calcs overstate the deduction. Flag as an assumption; default to "standard deduction, no benefit" and let user opt into itemizing. |

#### Module 3 — FI-Date / Opportunity-Cost Engine (flagship — see Differentiators for the inversion)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Year-by-year net-worth trajectory | Every FIRE calc runs a year-by-year projection to the FI target | MEDIUM | Pure projection over contributions + returns. Foundation for everything. |
| FI number via Safe Withdrawal Rate | Canonical: spending ÷ SWR (4% Trinity default, configurable) | LOW | spend/0.04. Configurable SWR is table stakes among serious FIRE tools. |
| Real (inflation-adjusted) returns | Serious FIRE calcs work in real returns so FI date is meaningful | LOW | Configurable real return; keep nominal-vs-real explicit to avoid double-counting inflation. |
| Configurable return / contribution / spending assumptions | All FIRE calcs expose these; they dominate the output | LOW | First-class stored assumptions per PROJECT.md. |
| FI-date readout (age / calendar year) | The headline FIRE output | LOW | Derived: first year net worth ≥ FI number. |

#### Cross-Cutting (Platform table stakes)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Saved, named scenarios (reproducible) | A scenario must capture all inputs/assumptions to regenerate exactly | MEDIUM | SQLite. Snapshot assumption values into the scenario, don't reference live globals (else old scenarios silently change). |
| Two saved financial profiles | Explicit PROJECT.md requirement (me + wife, or joint vs separate framings) | LOW | Profile = the financial baseline; scenarios hang off it. |
| Assumptions as first-class editable data | They drive every output; must be stress-tested, never hardcoded | MEDIUM | Central assumptions store with sensible MA defaults. |
| `ListingsProvider` adapter + `MockListingsProvider` | Proves the wall around the highest-risk dependency from day one | MEDIUM | Interface + static fixtures only. The point is to NOT integrate listings. |

### Differentiators (The Reason This Tool Exists)

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **FI-date delta as the headline output** | The inversion: not "what will a bank lend" but "what does THIS house do to our retire-by-45 date." No mainstream tool leads with this | HIGH | Diff between FI date of the no-purchase baseline trajectory and the purchase-scenario trajectory. Requires Module 1 (TCO → monthly delta) + Module 3 (projection). This IS the product. |
| **Net-worth trajectory divergence vs no-purchase baseline** | Visual "flight simulator instrument" — watch FI date / net worth respond before committing | MEDIUM | Two trajectories on one chart: baseline (rent + invest) vs purchase. The buy side accrues home equity (from amortization + appreciation) but loses the invested down payment + monthly delta. |
| **True affordability vs bank affordability gap** | Surfaces that the bank's number is not your number; anchors the whole "don't overbuy" thesis | MEDIUM | "Bank says $X; without pushing FI past your threshold you can afford $Y." The gap is a first-class output. |
| **Scenario comparison ranked by FI-date impact** | N houses side by side, sorted by years-added-to-FI — the decision view | MEDIUM | The headline table. Each row = one scenario's FI-date delta, TCO, liquidity. Depends on saved scenarios + FI engine. |
| **Town scoring → realistic/stretch/fantasy buckets** | Personalized weighted MA composite (mill rate, median price, commute to anchor, schools, custom weights), then bucketed against the user's true budget | HIGH | Reuses prior beach-app weighted-scoring architecture (PROJECT.md). Normalize each metric, apply user weights, then bucket by affordability against Module 1's true-affordability number. The bucketing-against-your-real-budget is the differentiating twist vs generic Niche/AreaVibes scoring. |
| **Affordability heatmap over MA towns** | Spatial "where can we actually live" view | MEDIUM-HIGH | Color towns by bucket/score on a map. Useful but the bucket *list* delivers 80% of value at far lower cost — treat the map as the enhancement layer, the table as the MVP. |
| **Sensitivity analysis on key assumptions** | Defends against false precision (the documented #1 failure of finance calculators); shows how FI date swings with return %, maintenance %, appreciation, tax | MEDIUM | Tornado/range view over a few key levers. This is a *differentiator* here because it directly serves the tool's credibility mission, not a nice-to-have. |
| **MA-specific realism flags** | Title 5 septic, betterment assessments, 40B, Prop 2½ surfaced as warnings/notes per town/scenario | LOW-MEDIUM | Don't fully model these — flag them as qualitative caveats attached to relevant towns/scenarios. High realism payoff, low math cost. |
| **"Don't buy / rent-and-invest" as a first-class reachable conclusion** | Explicit anti-funnel design; the tool must be able to say no | LOW (design) | Not a feature to build so much as a constraint to honor: the comparison must rank "keep renting" alongside houses, and it must be able to win. |

### Anti-Features (Deliberately Do NOT Build — Scope-Creep & Buy-Funnel Traps)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **Live listings (Zillow/Redfin/MLS/IDX/RentCast/ATTOM)** | "Wouldn't it be great to pull real houses?" | Highest-risk dependency: ToS/licensing, scraping fragility, cost, scope explosion; pulls the tool toward a search/browse product and away from the decision engine | Keep it behind `ListingsProvider` with a Mock impl. Type the address/price by hand. The adapter exists *so listings can be ignored.* |
| **Any "find homes / start your search / get pre-approved" CTA** | Mimics every real-estate site | Turns a decision tool into a purchase funnel; if every path ends in "buy," the tool has failed its core value | No CTAs. Outputs are conclusions (incl. "rent"), never next-step nudges toward a lender or listing. |
| **Lender / agent / affiliate integrations** | Standard monetization on calc sites | Introduces bias toward buying; conflicts with the rent-and-invest conclusion | None. Private tool, no monetization, no third parties. |
| **Auth / accounts / multi-tenant** | "Real apps have login" | Pure overhead for a private two-user local tool | Local SQLite, two hardcoded profiles, kept private. |
| **Monte Carlo / historical-sequence simulation (in v1)** | "Real FIRE tools simulate thousands of futures" | Documented that MC results swing 30%+ on calibration period — adds apparent rigor but more false precision and large complexity; the existing retirement-model oracle is deterministic | Deterministic real-return projection + **sensitivity analysis** (range of outcomes via a few levers) gives honest uncertainty at a fraction of the cost. Defer MC to v2 if ever. |
| **Live property-tax / mill-rate refresh** | "Keep data current" | Live-data dependency creep; rates change slowly (annual DOR publish) | Seed a static DOR mill-rate table; flag staleness; manual refresh later. |
| **Detailed amortization with refis, ARMs, points, biweekly, extra-payment optimizers** | Mortgage-calc feature arms race | Combinatorial complexity, marginal to the FI-date question, easy rabbit hole | Fixed-rate, single-loan, optional one-off extra-payment assumption at most. Note ARMs as out-of-scope. |
| **Full Prop 2½ / betterment / Title 5 dynamic modeling** | "Be maximally MA-accurate" | Each is a deep modeling project; precision exceeds decision value | Surface as qualitative flags (see differentiators), not dynamic line items. |
| **Map/heatmap before the bucket list works** | "Heatmaps look impressive" | Geo/rendering complexity can sink the schedule before the cheaper, higher-value bucket table exists | Ship the ranked bucket table first; add the map as an enhancement layer. |
| **Live commute-time API (Google/Mapbb traffic)** | "Real commute times" | API keys, cost, rate limits, another live dependency | Static distance/drive-time estimates to a configurable anchor in the seed town data. |
| **Generic "calculator" mode with stock defaults** | "Make it usable by anyone" | Dilutes the whole premise — the value is *your actual numbers*; generic mode invites the table-stakes-only commodity calculators | Compute everything at the user's real profile numbers, always. |

## Feature Dependencies

```
Assumptions store (first-class data)
    └──required by──> ALL calculation modules

Mortgage TCO (Module 1)
    ├── Amortization schedule ──required by──> Net-worth trajectory (equity side)
    ├── PMI drop-off ──requires──> Amortization (LTV over time)
    └── True-affordability number ──required by──> Town bucketing (realistic/stretch/fantasy)

Net-worth trajectory (Module 3)
    ├──requires──> Assumptions (real return, contributions, spending)
    └──required by──> FI-date readout ──required by──> FI-date DELTA (flagship)

FI-date DELTA (flagship)
    ├──requires──> Module 1 monthly TCO delta vs rent
    ├──requires──> Module 2 opportunity-cost math (down payment + monthly diff)
    └──requires──> Module 3 baseline-vs-purchase trajectories

Saved scenarios (reproducible snapshots)
    ├──requires──> Assumptions snapshotting
    └──required by──> Scenario comparison (ranked by FI-date impact)

Town scoring (weighted composite)
    ├──requires──> Seed MA town data (mill rate, median price, commute, schools)
    ├──requires──> True-affordability number (for bucketing)
    └──enhanced by──> Affordability heatmap (map = view over the same scores)

Sensitivity analysis ──enhances──> FI-date delta + rent-vs-buy (re-runs over assumption ranges)

ListingsProvider/Mock ──independent──> (proves the wall; feeds scenario inputs optionally)

Buy-funnel CTAs ──CONFLICTS WITH──> "rent-and-invest as reachable conclusion" (mutually exclusive by design)
```

### Dependency Notes

- **FI-date delta requires all three modules:** it is the composition of TCO (monthly delta), opportunity-cost (down payment + monthly diff invested), and the net-worth projection. It cannot be built before the projection and TCO exist — so it lands *after* Modules 1 and 3, not first, even though it's the flagship.
- **Town bucketing requires the true-affordability number:** "realistic/stretch/fantasy" is defined relative to what the user can afford without pushing FI past threshold — so Module 1's true-affordability output must precede bucketing. Raw scoring can be built independently; bucketing is the join point.
- **PMI drop-off requires the amortization schedule:** drop-off is an LTV-over-time event, so the schedule must exist first; a single monthly payment is insufficient.
- **Saved scenarios must snapshot assumptions:** if scenarios reference live global assumptions, editing an assumption silently rewrites historical results — breaking reproducibility (an explicit requirement). Snapshot on save.
- **Sensitivity analysis enhances rather than blocks:** it re-runs the deterministic engine over ranges; it depends on a working engine but nothing depends on it. Safe to schedule late.
- **Heatmap enhances, never blocks, town scoring:** the map is a rendering of scores the table already shows; build the table first.
- **Buy-funnel CTAs conflict with the core conclusion:** these are mutually exclusive by design intent — documented so they're never co-scheduled.

## MVP Definition

### Launch With (v1) — proves the inversion thesis end to end

- [ ] **Assumptions store + two profiles** — everything depends on it; cheap; foundational
- [ ] **Mortgage TCO (full PITI + PMI drop-off + maintenance + HOA + closing + MA mill-rate tax)** — the credible cost number
- [ ] **Bank DTI vs true-affordability gap** — anchors the "don't overbuy" thesis
- [ ] **Net-worth trajectory + FI-date via SWR (real returns)** — reconciled against the existing retirement-model oracle
- [ ] **Rent-vs-buy with opportunity cost + break-even** — the honest comparison incl. invest-the-difference
- [ ] **FI-date DELTA per scenario (flagship)** — the headline number
- [ ] **Saved, reproducible, comparable scenarios ranked by FI-date impact** — the decision view
- [ ] **"Keep renting" as a rankable, winnable scenario** — honors anti-funnel core value
- [ ] **`ListingsProvider` interface + `MockListingsProvider`** — proves the wall

### Add After Validation (v1.x)

- [ ] **Town scoring → realistic/stretch/fantasy bucket table** — add once true-affordability is trusted; reuses prior weighted-scoring architecture
- [ ] **Sensitivity analysis** — add once outputs exist; defends credibility, prevents false precision
- [ ] **MA-specific qualitative flags (Title 5, betterment, 40B, Prop 2½ notes)** — low cost, high realism once towns are in
- [ ] **Affordability heatmap (map view)** — enhancement over the bucket table once it works

### Future Consideration (v2+)

- [ ] **Monte Carlo / historical-sequence FIRE modeling** — only if deterministic + sensitivity proves insufficient; high complexity, false-precision risk
- [ ] **Live property-tax / mill-rate refresh** — when static table staleness becomes painful
- [ ] **Live listings via real `ListingsProvider` impl** — the wall is already built; plug in only if ever desired (and never as a buy funnel)
- [ ] **Live commute-time API** — only if static estimates prove inadequate

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Assumptions store + profiles | HIGH | LOW | P1 |
| Mortgage TCO (full) | HIGH | MEDIUM | P1 |
| Bank vs true affordability gap | HIGH | MEDIUM | P1 |
| Net-worth trajectory + FI date (real returns, SWR) | HIGH | MEDIUM | P1 |
| Rent-vs-buy (opp cost + break-even) | HIGH | MEDIUM | P1 |
| FI-date DELTA (flagship) | HIGH | HIGH | P1 |
| Saved scenarios + ranked comparison | HIGH | MEDIUM | P1 |
| ListingsProvider + Mock | MEDIUM | MEDIUM | P1 (de-risks) |
| Town scoring + bucket table | HIGH | HIGH | P2 |
| Sensitivity analysis | MEDIUM-HIGH | MEDIUM | P2 |
| MA-specific qualitative flags | MEDIUM | LOW | P2 |
| Affordability heatmap (map) | MEDIUM | MEDIUM-HIGH | P3 |
| Monte Carlo simulation | LOW (here) | HIGH | P3 (likely never) |
| Live listings / tax / commute refresh | LOW (here) | HIGH | P3 |

**Priority key:** P1 = must have for launch · P2 = add after validation · P3 = future/defer

## Competitor Feature Analysis

| Feature | NYT / NerdWallet Rent-vs-Buy | FIRE calcs (Engaging-Data, WalletBurst) | Niche / AreaVibes town scoring | Our Approach |
|---------|------------------------------|-----------------------------------------|--------------------------------|--------------|
| Opportunity cost of capital | Yes (down payment + monthly diff invested) | Implicit (contributions) | N/A | Yes — and we connect it to a *personal FI date*, not a generic break-even |
| Break-even horizon | Yes (the headline) | N/A | N/A | Yes, but secondary to FI-date delta |
| FI date / SWR | N/A | Yes (4% default, configurable) | N/A | Yes, reconciled against our own retirement-model oracle |
| Net-worth trajectory | Partial | Yes (year-by-year) | N/A | Yes — baseline vs purchase divergence is the core viz |
| Town/area scoring | N/A | N/A | Yes (weighted, customizable weights) | Yes — plus bucketing against *your true budget* (their differentiator + ours) |
| MA-specific tax realism | No (flat % tax) | N/A | Coarse cost-of-living index | Yes — town mill rates + Prop 2½/Title 5/40B flags |
| Uncertainty handling | Single-point | MC in advanced tools | Single ranking | Deterministic + sensitivity ranges (honest, not false-precise) |
| Buy funnel / CTAs | Yes (lender/listing nudges) | No | "Find homes" links | **Deliberately none** — rent-and-invest must be able to win |

**Key insight:** Each competitor category nails one module's table stakes. None *compose* the three into "what does this house do to my retirement date." That composition — plus refusing the buy funnel — is the entire differentiation.

## Sources

- [NYT Rent-vs-Buy methodology discussion — Bogleheads](https://www.bogleheads.org/forum/viewtopic.php?t=344366) (MEDIUM — methodology of down-payment + monthly-difference investing)
- [NerdWallet Rent vs Buy Calculator](https://www.nerdwallet.com/mortgages/calculators/rent-vs-buy-calculator) (HIGH — table stakes inputs)
- [Calculator.net Rent vs Buy](https://www.calculator.net/rent-vs-buy-calculator.html) (HIGH — appreciation, rent growth, selling costs, inflation discounting)
- [USMortgageCalculator.org](https://usmortgagecalculator.org/) (HIGH — PMI LTV tiers and drop-off mechanics)
- [Calculator.net Mortgage Calculator](https://www.calculator.net/mortgage-calculator.html) (HIGH — PITI, PMI auto-cancel at 80%, maintenance ~1%, property tax ~1.1%)
- [Engaging-Data FIRE Calculator](https://engaging-data.com/fire-calculator/) (HIGH — year-by-year projection, return-mode taxonomy: fixed/historical/Monte Carlo)
- [WalletBurst FIRE Calculator](https://walletburst.com/tools/fire-calculator/) (MEDIUM — FI number, SWR, real returns)
- [MadFientist — Safe Withdrawal Rate](https://www.madfientist.com/safe-withdrawal-rate/) (HIGH — 4% Trinity Study basis, SWR for early retirees)
- [Niche Best Places to Live Methodology](https://www.niche.com/about/methodology/best-places-to-live/) (HIGH — weighted-factor scoring, no-single-factor-dominates)
- [AreaVibes Methodology](https://www.areavibes.com/methodology/) (HIGH — multi-category livability scoring, user-customizable sort)
- [MyLocationScore Neighborhood Scorer](https://mylocationscore.com/) (MEDIUM — user-weighted 0-100 personalized scoring, weight presets)
- [Analytica — Monte Carlo "whoops factor" in personal finance](https://analytica.com/blog/monte-carlo-modeling-in-personal-finance-the-whoops-factor/) (MEDIUM — false precision; MC results swing 30%+ on calibration)
- [SALT cap + mortgage-interest deduction reality](https://www.nerdwallet.com/calculator/rent-vs-buy-calculator) (MEDIUM — ~90% take standard deduction; $10k SALT cap especially relevant in high-tax MA)

---
*Feature research for: personal MA home-affordability + FI-impact decision tool*
*Researched: 2026-06-22*
