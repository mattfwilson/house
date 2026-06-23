# Requirements: Boston Home Affordability & FI-Impact Engine

**Defined:** 2026-06-22
**Core Value:** Answer "what does buying this house do to our early-retirement timeline?" — and be allowed to conclude "don't buy / rent and invest the difference."

## v1 Requirements

Requirements for the core-engine build. Each maps to a roadmap phase.

### Calculation Core (CORE)

- [x] **CORE-01**: All financial math lives in a pure, framework-agnostic calculation core with zero React/Next dependencies (enforced by a lint boundary rule)
- [x] **CORE-02**: Money arithmetic uses decimal-precise math so no floating-point error accumulates across multi-decade projections
- [x] **CORE-03**: The core is fully unit-tested, with deterministic functions (no ambient time/randomness inside the core)

### Profiles & Scenarios (PROF)

- [ ] **PROF-01**: User can create and save two financial profiles (household members) capturing net worth, income, savings rate, existing monthly debts, and current rent
- [ ] **PROF-02**: User can create multiple named house scenarios under a profile (price, down-payment %, town, loan term, interest rate, HOA, etc.)
- [ ] **PROF-03**: User can save scenarios and reload them in a later session
- [ ] **PROF-04**: A saved scenario snapshots every input and assumption so its result regenerates exactly (reproducibility), and replaying a snapshot reproduces the stored result

### Affordability (AFF)

- [ ] **AFF-01**: Tool computes bank affordability (max approvable loan) from configurable front-end (~28%) and back-end (~36%) DTI ratios, factoring existing debts
- [ ] **AFF-02**: Tool computes true affordability — the price that fits the household's target savings rate without pushing the FI date past its threshold
- [ ] **AFF-03**: Tool surfaces the gap between bank affordability and true affordability

### Total Cost of Ownership (TCO)

- [ ] **TCO-01**: Tool computes monthly principal + interest via amortization from rate, term, and loan amount
- [ ] **TCO-02**: Tool computes property tax from MA town-level mill rates (seeded static table), not a flat percentage
- [ ] **TCO-03**: Tool includes homeowners insurance, a configurable maintenance reserve (~1–2%/yr of home value), and HOA/condo fees where relevant
- [ ] **TCO-04**: Tool computes PMI when down payment < 20% and drops it at the correct LTV (78% of original value automatic, 80% borrower-requested)
- [ ] **TCO-05**: Tool includes closing costs as a one-time figure, amortizable for cross-scenario comparison
- [ ] **TCO-06**: Tool presents the full TCO breakdown both monthly and annualized
- [ ] **TCO-07**: Tool computes rent-vs-buy at the household's actual numbers — investing the down payment and monthly difference, treating principal as forced savings (no opportunity-cost asymmetry)

### FI-Impact Engine (FI) — flagship

- [ ] **FI-01**: Tool models the down payment + closing costs as foregone investment and the monthly housing delta vs renting as a recurring foregone contribution
- [ ] **FI-02**: Tool projects net-worth trajectory and FI date for a scenario vs the no-purchase baseline, using configurable real return and a long-horizon-appropriate SWR default (~3–3.5%, not 4%)
- [ ] **FI-03**: Tool outputs the shift in FI date (months/years) caused by a scenario
- [ ] **FI-04**: User can compare N scenarios side by side, ranked by FI-date impact
- [ ] **FI-05**: FI projection math reconciles against the existing retirement model, validated by a golden-master/oracle test
- [ ] **FI-06**: Tool can reach a "rent and invest the difference" / "don't buy" conclusion when the numbers warrant it (anti-funnel guarantee)

### Town Scoring & Heatmap (TOWN)

- [ ] **TOWN-01**: Tool scores MA towns via a weighted, normalized composite (mill rate, median price, commute to a configurable anchor, school rating, custom amenity weights)
- [ ] **TOWN-02**: Given a budget, tool buckets towns into realistic / stretch / fantasy
- [ ] **TOWN-03**: Tool displays an affordability heatmap across towns for a given budget
- [ ] **TOWN-04**: Tool flags MA-specific realities qualitatively (Prop 2½ levy mechanics, betterment assessments, Title 5 septic, 40B developments)

### Assumptions & Sensitivity (ASMP)

- [x] **ASMP-01**: All assumptions (tax rates, DTI thresholds, return assumptions, maintenance %, SWR) are configurable, stored data — never hardcoded
- [ ] **ASMP-02**: Tool provides sensitivity analysis showing how key outputs swing with key assumptions (return rate, maintenance %, tax), shipped alongside the FI engine

### Listings Adapter (LIST)

- [ ] **LIST-01**: Codebase defines a clean `ListingsProvider` adapter interface, isolated from the core
- [ ] **LIST-02**: A `MockListingsProvider` returning static fixtures exercises the interface end to end

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Listings

- **LIST-03**: Real `ListingsProvider` implementation against a live source (MLS/IDX, RentCast, ATTOM, or manual CSV import)

### Data Refresh

- **DATA-01**: Live refresh path for MA town mill rates from DOR-published data

### Persistence

- **PERS-01**: Swap local SQLite for hosted persistence (Supabase / libSQL-Turso) for multi-device access

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Live listing data (Zillow/Redfin/MLS) in this build | Highest-risk dependency; walled off behind `ListingsProvider` so it can be added later without touching the core. The adapter exists *so we can ignore listings for now.* |
| Monte Carlo / historical sequence-of-returns simulation | False-precision trap (results swing 30%+ on calibration period); deterministic projection + sensitivity bands is the honest answer. Revisit in v2 only if framed honestly. |
| Auth / accounts / multi-tenant | Private two-user tool; no auth complexity beyond keeping it private. |
| Any "buy" funnel or nudge-to-purchase UX | The tool must be able to say no; a buy-funnel would defeat its entire purpose. |
| Dynamic modeling of Prop 2½ / Title 5 / 40B mechanics | Modeled as qualitative flags (TOWN-04), not dynamic simulations — depth here is false precision for a decision tool. |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| CORE-01 | Phase 1 | Complete |
| CORE-02 | Phase 1 | Complete |
| CORE-03 | Phase 1 | Complete |
| ASMP-01 | Phase 1 | Complete |
| PROF-04 | Phase 1 | Pending |
| TCO-01 | Phase 2 | Pending |
| TCO-02 | Phase 2 | Pending |
| TCO-03 | Phase 2 | Pending |
| TCO-04 | Phase 2 | Pending |
| TCO-05 | Phase 2 | Pending |
| TCO-06 | Phase 2 | Pending |
| TCO-07 | Phase 2 | Pending |
| AFF-01 | Phase 3 | Pending |
| AFF-02 | Phase 3 | Pending |
| AFF-03 | Phase 3 | Pending |
| FI-01 | Phase 4 | Pending |
| FI-02 | Phase 4 | Pending |
| FI-03 | Phase 4 | Pending |
| FI-04 | Phase 4 | Pending |
| FI-05 | Phase 4 | Pending |
| FI-06 | Phase 4 | Pending |
| ASMP-02 | Phase 4 | Pending |
| TOWN-01 | Phase 5 | Pending |
| TOWN-02 | Phase 5 | Pending |
| TOWN-03 | Phase 5 | Pending |
| TOWN-04 | Phase 5 | Pending |
| PROF-01 | Phase 6 | Pending |
| PROF-02 | Phase 6 | Pending |
| PROF-03 | Phase 6 | Pending |
| LIST-01 | Phase 6 | Pending |
| LIST-02 | Phase 6 | Pending |

**Coverage:**

- v1 requirements: 31 total
- Mapped to phases: 31 ✓
- Unmapped: 0

**Note:** Phase 7 (Web Shell) surfaces the engine outputs in a thin Next.js UI; it introduces no new v1 requirement (all 31 are delivered by the calculation core, persistence, and adapter in Phases 1-6).

---
*Requirements defined: 2026-06-22*
*Last updated: 2026-06-22 after roadmap creation (traceability populated)*
