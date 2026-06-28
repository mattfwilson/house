# Roadmap: Boston Home Affordability & FI-Impact Engine

## Overview

This build delivers the core decision engine that answers "what does buying this house do to our early-retirement timeline?" — and is allowed to conclude "rent and invest the difference." The dependency graph dictates a horizontal-layer build: a pure, framework-agnostic calculation core comes first (money precision, deterministic types, assumptions-as-data, reproducibility harness — all existential and ruinously expensive to retrofit), then the shared TCO substrate, then the two engines that consume it (Affordability/DTI and the flagship FI-Impact + Sensitivity), then the largely-independent Town Scoring, then persistence + the ListingsProvider adapter, and finally a thin Next.js shell layered over the proven core. Every dollar of correctness risk is fenced into the earliest phase that can prove it, and the FI math is reconciled against the existing retirement model via a golden-master oracle before any UI exists.

## Phases

**Phase Numbering:**

- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Foundations & Determinism Core** - Monorepo, decimal-precise money, pure-core boundary, assumptions-as-data, reproducibility harness (completed 2026-06-23)
- [x] **Phase 2: TCO Engine** - Amortization, MA mill-rate tax, PMI, insurance, maintenance, HOA, closing costs, rent-vs-buy (completed 2026-06-25)
- [x] **Phase 3: Affordability Engine** - Bank DTI affordability, true affordability, and the gap between them (completed 2026-06-26)
- [x] **Phase 4: FI-Impact Engine & Sensitivity (flagship)** - Opportunity cost, FI-date delta, ranked comparison, oracle reconciliation, anti-funnel, sensitivity bands (completed 2026-06-26)
- [x] **Phase 5: Town Scoring & Heatmap** - Weighted normalized composite, budget bucketing, heatmap, MA-specific flags (completed 2026-06-27)
- [x] **Phase 6: Persistence & Listings Adapter** - Local SQLite repos, two profiles, named scenarios, ListingsProvider + MockListingsProvider (completed 2026-06-27)
- [ ] **Phase 7: Web Shell** - Thin Next.js UI over the proven core: editors, scenario builder, comparison, heatmap, sensitivity views

## Phase Details

### Phase 1: Foundations & Determinism Core

**Goal**: Lock the existential, expensive-to-retrofit foundations — a pure framework-agnostic calculation core with decimal-precise money, deterministic functions, assumptions stored as first-class data, and a reproducibility harness that proves a snapshot replays exactly. Nothing computes a real engine result yet; everything downstream imports these.
**Depends on**: Nothing (first phase)
**Requirements**: CORE-01, CORE-02, CORE-03, ASMP-01, PROF-04
**Success Criteria** (what must be TRUE):

  1. The `core` package has zero React/Next/DB dependencies and a lint boundary rule fails the build if a framework import appears inside it
  2. Money arithmetic uses a decimal-precise representation (branded `Money` type / decimal lib) with a documented rounding policy; bare-`number` dollar math is rejected by tests
  3. Core functions are deterministic — no `Date.now()`, `Math.random()`, env reads, or module-level mutable defaults; `asOf` and all assumptions are explicit parameters (verified by tests)
  4. An `AssumptionSet` type holds every tunable (tax rates, DTI thresholds, return, inflation, maintenance %, SWR, PMI rules) as versioned, serializable data — nothing is hardcoded
  5. A reproducibility golden test exists: recomputing a frozen snapshot deep-equals the stored result (cent-identical), proving determinism before persistence exists**Plans**: 5 plans

**Wave 1**

  - [x] 01-01-PLAN.md — Monorepo + core skeleton, ESLint boundary/determinism rules, Vitest projects (CORE-01, CORE-03 lint)

**Wave 2** *(blocked on Wave 1 completion)*

  - [x] 01-02-PLAN.md — Frozen Decimal clone, immutable Money, CalendarDate, runtime determinism guard (CORE-02, CORE-03)

**Wave 3** *(blocked on Wave 2 completion)*

  - [x] 01-03-PLAN.md — Nested versioned AssumptionSet (Zod) + defaults + migrate + EngineInput (ASMP-01)

**Wave 4** *(blocked on Wave 3 completion)*

  - [x] 01-04-PLAN.md — canonicalJson + canary + gated golden-master reproducibility harness + public index (PROF-04)

### Phase 2: TCO Engine

**Goal**: Build the shared TCO substrate that Affordability and FI-Impact both consume — full monthly and annualized total cost of ownership for a scenario, computed correctly down to the cent, plus the rent-vs-buy comparison at the household's actual numbers.
**Depends on**: Phase 1
**Requirements**: TCO-01, TCO-02, TCO-03, TCO-04, TCO-05, TCO-06, TCO-07
**Success Criteria** (what must be TRUE):

  1. Amortization produces a full schedule whose final balance is exactly $0.00 and whose principal sum equals the original loan exactly (invariant tests + external-oracle agreement on a non-round rate)
  2. Property tax is computed as assessed value x seeded MA town mill rate (FY-stamped), never a flat percentage and never a 2.5%-cap on the bill
  3. PMI is added when down payment < 20% and removed at 78% LTV automatic / 80% requested against the original value and scheduled balance (toggle-tested), not at appreciated value
  4. The full TCO breakdown (P+I, tax, insurance, maintenance reserve, HOA, PMI, amortized closing costs) is presented both monthly and annualized
  5. Rent-vs-buy is computed at the household's real numbers, investing the down payment and monthly difference symmetrically and treating principal as forced savings (no opportunity-cost asymmetry)

**Plans**: 4 plans

**Wave 1**

  - [x] 02-01-PLAN.md — AssumptionsV2 (+ v1ToV2 migrate), widened ScenarioInputs, seeded FY-stamped greater-Boston mill-rate table + resolver (TCO-02 data)

**Wave 2** *(blocked on Wave 1)*

  - [x] 02-02-PLAN.md — Fixed-rate amortization (exact $0 payoff, principal-sum, oracle) + PMI 78/80 original-value toggle (TCO-01, TCO-04)
  - [x] 02-03-PLAN.md — Property tax (assessed × mill rate, appreciating, Prop 2½ flag) + carrying costs + closing costs (TCO-02, TCO-03, TCO-05)

**Wave 3** *(blocked on Wave 2)*

  - [x] 02-04-PLAN.md — computeTco monthly+annualized breakdown + no-bare-number type-test + public barrel (TCO-01..06)

**Wave 4** *(blocked on Wave 3)*

  - [x] 02-05-PLAN.md — Two-portfolio rent-vs-buy (symmetric, Fisher real, sell haircut, crossover, anti-funnel) + TCO golden fixture (TCO-07)

**Wave 5** *(gap-closure — VERIFICATION.md remediation)*

  - [x] 02-06-PLAN.md — TCO correctness gap-closure (zero-rate guard, PMI drop-off-aware, time-varying rentVsBuy outflow) (TCO-01..07)
  - [x] 02-07-PLAN.md — ScenarioInputs trust-boundary validation (ScenarioInputsSchema Zod .strict(), parseScenarioInputs, round-trip-through-parse) — closes CR-03 (TCO-01, TCO-07)

### Phase 3: Affordability Engine

**Goal**: Answer "can the bank?" versus "what does our retirement allow?" — compute bank affordability from configurable DTI ratios and true affordability from the savings-rate/FI-threshold constraint, and surface the gap between them as a first-class output.
**Depends on**: Phase 2
**Requirements**: AFF-01, AFF-02, AFF-03
**Success Criteria** (what must be TRUE):

  1. Bank affordability computes the max approvable loan from configurable front-end (~28%) and back-end (~36%) DTI ratios using gross income and the full PITI+HOA+PMI carrying cost (reusing TCO components), factoring existing debts (worked-example tests)
  2. True affordability computes the price that fits the household's target savings rate without pushing the FI date past its threshold
  3. The tool surfaces the numeric gap between bank affordability and true affordability as an explicit output

**Plans**: 5 plans

**Wave 1**

  - [x] 03-01-PLAN.md — Household/profile input contract on EngineInput (HouseholdSchema + parseHousehold, optional, currentAnnualSavings D-17) + boundary tests (AFF-02 boundary)

**Wave 2** *(blocked on Wave 1)*

  - [x] 03-02-PLAN.md — Bank affordability: two-numerator DTI split (lenderDtiCarryingCost, D-14) + max-price binary-search solver (AFF-01)
  - [x] 03-03-PLAN.md — True affordability: savings-rate floor (currentAnnualSavings baseline) + cash-on-hand gate, min of the two (AFF-02)

**Wave 3** *(blocked on Wave 2)*

  - [x] 03-04-PLAN.md — The gap + directional verdict (anti-funnel bankExceedsTrue, D-12/D-13) + evaluate-scenario + type-test + public barrel + reproducibility golden (AFF-03)

**Wave 4** *(gap closure — solver passes(low) precondition, CR-01/CR-02)*

  - [x] 03-05-PLAN.md — Solver feasibility guards: infeasible household → $0 ceiling (CR-01) + bracket-cap exhaustion throws (CR-02), feasible behavior + golden snapshot byte-identical (AFF-01, AFF-02, AFF-03)

### Phase 4: FI-Impact Engine & Sensitivity (flagship)

**Goal**: Deliver the headline product — model the down payment + closing costs as foregone investment and the monthly housing delta as a foregone contribution, project net-worth and FI date vs the no-purchase baseline, rank N scenarios by FI-date impact, reconcile the math against the existing retirement model, ship sensitivity bands, and prove the tool can say "don't buy."
**Depends on**: Phase 2 (TCO substrate); informed by Phase 3
**Requirements**: FI-01, FI-02, FI-03, FI-04, FI-05, FI-06, ASMP-02
**Success Criteria** (what must be TRUE):

  1. The engine models down payment + closing costs as foregone investment and the monthly housing delta vs renting as a recurring foregone contribution, projecting net-worth trajectory and FI date vs the no-purchase baseline using a single declared real-vs-nominal convention, configurable real return, and a long-horizon SWR default (~3-3.5%, not 4%)
  2. The tool outputs the shift in FI date (months/years) per scenario and compares N scenarios side by side ranked by FI-date impact
  3. FI projection math reconciles against the existing retirement model via a golden-master/oracle test across several cases (including 0% return and high-inflation edges)
  4. A realistic input set produces a "rent and invest the difference / don't buy" verdict, present as a first-class comparison row (anti-funnel acceptance check)
  5. Sensitivity analysis ships in this phase: a one-way/tornado view shows FI-date swing across return, inflation, maintenance %, tax, and SWR, with the top drivers labeled (no headline number without a range)

**Plans**: 4 plans + 2 gap-closure plans (04-05, 04-06)

**Wave 1**

  - [x] 04-01-PLAN.md — Foundations: promote monthlyGrowthFactor to a shared helper, bump to AssumptionsV3 (six sensitivity bands + max-horizon), add targetAnnualRetirementSpend household leaf, regenerate the three existing goldens (ASMP-02, FI-01, FI-02)

**Wave 2** *(blocked on Wave 1)*

  - [x] 04-02-PLAN.md — Asymmetric FI targets + monthly projection loop + unreachable verdict, gated by the independent FV-of-annuity oracle (0% exact + high-inflation via Fisher) (FI-01, FI-02, FI-05, FI-06)

**Wave 3** *(blocked on Wave 2)*

  - [x] 04-03-PLAN.md — fiImpact orchestrator (both paths + FI-date delta) + compareScenarios ranking (baseline row 0, unreached last) + public barrel exports (FI-01, FI-03, FI-04, FI-06)

**Wave 4** *(blocked on Wave 3)*

  - [x] 04-04-PLAN.md — Six-driver tornado (ranked FI-date swing, top drivers flagged) + no-bare-number type-test + FI golden master + round-trip (ASMP-02, FI-05)

**Gap Closure** *(post-verification; gaps_found 4/5 + code review 1 Critical + 4 Warnings)*

  - [x] 04-05-PLAN.md — Tornado tax driver bites (overridable mill rate, perturbed relatively, GAP 1/SC5/ASMP-02) + swr.rate zero/negative guard at boundary, in divideBySwr, and tornado swr-low clamp (GAP 2/CR-01) (ASMP-02, FI-05) (completed 2026-06-26)
  - [x] 04-06-PLAN.md — Reconcile equityFor year index with rentVsBuy + correct false "verbatim" comments + month-12 equity-year pin (GAP 3/WR-01; closes IN-02) (FI-05) (completed 2026-06-26)

### Phase 5: Town Scoring & Heatmap

**Goal**: Score MA towns into a budget-aware affordability picture using a weighted normalized composite (reusing the prior beach-app scoring architecture), bucket towns realistic/stretch/fantasy for a given budget, render a heatmap, and qualitatively flag MA-specific realities. Largely independent of the Affordability/FI chain.
**Depends on**: Phase 1 (types/money/assumptions); seed data
**Requirements**: TOWN-01, TOWN-02, TOWN-03, TOWN-04
**Success Criteria** (what must be TRUE):

  1. Towns are scored via a weighted, normalized composite (mill rate, median price, commute to a configurable anchor, school rating, custom amenity weights) with each metric scaled and direction-corrected and missing data handled explicitly (no silent 0/NaN)
  2. Given a budget, towns bucket into realistic / stretch / fantasy
  3. An affordability heatmap renders across towns for a given budget, with each town's per-metric contribution explainable
  4. MA-specific realities (Prop 2.5 levy mechanics, betterment assessments, Title 5 septic, 40B deed restrictions) are flagged qualitatively per relevant town

**Plans**: 4 plans

**Wave 1**

  - [x] 05-01-PLAN.md — Extend the 24-town table with stamped scoring metrics + curated MA flags behind the .strict() Zod boundary (TOWN-01 data, TOWN-04 data)
  - [x] 05-02-PLAN.md — AssumptionsV4 townScoring block (weights, amenity sub-weights, fixed ranges, stretchFactor) + v3ToV4 migrate; four prior goldens byte-identical (TOWN-01, TOWN-02)

**Wave 2** *(blocked on Wave 1)*

  - [x] 05-03-PLAN.md — Pure scoring math: normalize (fixed-range, direction-folded, clamped) + composite (explainable breakdown + missing renormalization) + bucket overlay (TOWN-01, TOWN-02, TOWN-03)

**Wave 3** *(blocked on Wave 2)*

  - [x] 05-04-PLAN.md — scoreTowns engine entry + UI-SPEC heatmap contract output + universal/curated flags + no-bare-number type-test + reproducibility golden + public barrel (TOWN-01..TOWN-04)

### Phase 6: Persistence & Listings Adapter

**Goal**: Add the imperative shell around the proven core — local SQLite persistence for two profiles and many named reloadable scenarios via repository ports, plus the `ListingsProvider` adapter interface with a `MockListingsProvider` exercising it end to end. Snapshots stored here must satisfy the reproducibility contract proven in Phase 1.
**Depends on**: Phase 1 (snapshot/reproducibility contract); consumes engine results from Phases 2-5
**Requirements**: PROF-01, PROF-02, PROF-03, LIST-01, LIST-02
**Success Criteria** (what must be TRUE):

  1. User can create and save two financial profiles (net worth, income, savings rate, existing debts, current rent) to local SQLite
  2. User can create multiple named house scenarios under a profile and reload them in a later session, with each saved scenario storing the full input + assumption snapshot
  3. A `ListingsProvider` adapter interface is defined in the core, isolated from engine math, and depended on only through the interface (never the concrete type outside the DI container)
  4. A `MockListingsProvider` returning static fixtures exercises the full `ListingsProvider` interface end to end

**Plans**: 6 plans

**Wave 1**

  - [x] 06-01-PLAN.md — Core ports (ProfileRepository, ScenarioRepository, ListingsProvider) + domain types (Profile, Listing, SavedScenario) + barrel (PROF-01, PROF-02, PROF-03, LIST-01)
  - [x] 06-02-PLAN.md — Scaffold packages/app workspace + SQLite stack install + native-binary smoke-test (all 4 packages slopcheck OK; autonomous) (PROF-01, PROF-02, PROF-03)

**Wave 2** *(blocked on Wave 1)*

  - [x] 06-03-PLAN.md — Drizzle schema (nine-leaf profiles; PROF-01 net worth = available_net_worth) + db/migrator wiring + [BLOCKING] migration materialization (live insert/select round-trip) (PROF-01, PROF-02, PROF-03)
  - [x] 06-04-PLAN.md — Listings adapter: MockListingsProvider + hand-seeded fixtures + contract test (LIST-01, LIST-02)

**Wave 3** *(blocked on Wave 2)*

  - [x] 06-05-PLAN.md — SQLite repository adapters (nine-leaf profile round-trip) + InMemory fakes + shared repositoryContract factory + byte-identical reproducibility + frozen-household round-trip (PROF-01, PROF-02, PROF-03)

**Wave 4** *(blocked on Wave 3)*

  - [x] 06-06-PLAN.md — Imperative-shell services (≤2 profile guard) + manual DI container + D-03 boundary enforcement (eslint app block + lint-as-test) (PROF-01, PROF-02, PROF-03) (completed 2026-06-27)

### Phase 7: Web Shell

**Goal**: Layer a thin Next.js shell over the proven core — profile/assumption editors, scenario builder, and the read-only comparison, heatmap, and sensitivity views — holding zero financial logic and leading with FI-impact rather than bank affordability.
**Depends on**: Phase 6 (persistence + adapter), Phases 3-5 (engine outputs)
**Requirements**: (UI surface for previously-built engine requirements; no new v1 requirement introduced)
**Success Criteria** (what must be TRUE):

  1. User can edit profiles, assumptions, and scenarios through forms; all math runs in the core via thin Server Action / service wrappers (no financial logic in components)
  2. User can view a side-by-side scenario comparison ranked by FI-date impact, with the "rent and invest the difference" baseline shown as a first-class row
  3. User can view the town affordability heatmap and the sensitivity (tornado) view, with assumptions visible and editable next to every result
  4. The UI leads with FI-impact / true affordability and presents bank affordability as the gap, never nudging toward a "buy" funnel

**Plans**: 11 plans (5 waves)
**UI hint**: yes

**Wave 1**

  - [x] 07-01-PLAN.md — Scaffold apps/web (Next 16) + monorepo wiring (transpilePackages, server-only container singleton, apps/web Vitest project, eslint client-bundle/Number() boundary guards; Number() allowed in charts/** + lib/format.ts) (SC-1)
  - [x] 07-02-PLAN.md — Pure `fiTrajectory` core entry (D-07 net-worth series, reuses projection loop, reconciles with projectFiDate) + barrel export (SC-2)

**Wave 2** *(blocked on Wave 1)*

  - [x] 07-03-PLAN.md — Scenario + profile Server Actions (validate-through-Zod → call → DTO) + DTO mappers + serializability/ranking/snapshot-replay tests (SC-1, SC-2, SC-4)
  - [ ] 07-04-PLAN.md — Towns + sensitivity + trajectory Server Actions + DTOs (finite tornado, string-bounded trajectory, 05-UI-SPEC heatmap encoding) (SC-2, SC-3)

**Wave 3** *(blocked on Wave 2)*

  - [ ] 07-05-PLAN.md — Client chrome: shadcn init (official registry), dark layout + persistent profile/scenario header (D-02), color-honest display-edge format helpers (SC-1, SC-4)
  - [ ] 07-06-PLAN.md — Zustand stores: shared working set (no auto-persist, PROF-04), selection/expansion, debounced latest-wins recompute coordinator (SC-1, SC-2)

**Wave 4** *(blocked on Wave 3)*

  - [ ] 07-07-PLAN.md — Persistent assumptions rail (D-10) + live debounced recompute wiring (D-08), mounted on every route (SC-1, SC-3)
  - [ ] 07-08-PLAN.md — Cockpit = ranked comparison: pinned rent-baseline (D-05), bank-as-gap caution (D-06), trajectory hero chart (D-07), inline scenario editor (D-15) (SC-2, SC-4)
  - [ ] 07-09-PLAN.md — Town heatmap (CSS-grid, locked 05-UI-SPEC encoding, D-13) + sensitivity tornado route (FI-05) (SC-3, SC-4)
  - [ ] 07-11-PLAN.md — Profile editor: /profile route + ProfileEditor form (all nine Household leaves), create-first-profile empty state + edit/delete, field errors from core parseProfile (D-16), header entry (SC-1, PROF-01/02/03)

**Wave 5** *(blocked on Wave 4)*

  - [ ] 07-10-PLAN.md — Phase gate: clean `next build` (no client-bundle leak) + full suite green + human anti-funnel / flight-simulator / first-profile-creation verification (SC-1..SC-4)

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundations & Determinism Core | 4/4 | Complete    | 2026-06-24 |
| 2. TCO Engine | 7/7 | Complete    | 2026-06-25 |
| 3. Affordability Engine | 5/5 | Complete    | 2026-06-26 |
| 4. FI-Impact Engine & Sensitivity | 6/6 | Complete    | 2026-06-26 |
| 5. Town Scoring & Heatmap | 4/4 | Complete    | 2026-06-27 |
| 6. Persistence & Listings Adapter | 6/6 | Complete    | 2026-06-28 |
| 7. Web Shell | 1/11 | In Progress | - |
