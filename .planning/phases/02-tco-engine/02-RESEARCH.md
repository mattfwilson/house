# Phase 2: TCO Engine - Research

**Researched:** 2026-06-23
**Domain:** Financial calculation engine — fixed-rate amortization, MA property-tax mechanics, PMI/HPA rules, rent-vs-buy two-portfolio modeling (pure TypeScript core, `decimal.js`)
**Confidence:** HIGH (this is an internal calc-engine phase building on a complete, well-documented Phase 1 substrate; the gating domain facts — amortization formula, HPA/PMI mechanics, MA DOR mill-rate sourcing — are verified against authoritative sources; no new external packages are introduced)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Rent-vs-Buy Depth & the Phase 2/Phase 4 Boundary**
- **D-01:** Phase 2's rent-vs-buy is a **two-portfolio ending-net-worth comparison over a configurable holding horizon**: buy path (home equity net of sell costs) vs rent path (rent + invest-the-difference at the real return). Output = ending net worth for each path + crossover year. This engine is the reusable substrate Phase 4 extends — Phase 4 does **not** rebuild trajectory math. Honors SC5 (TCO-07) literally.
- **D-02:** **All-real (today's-dollar) convention, locked project-wide.** Entire projection runs in today's dollars — real return, real appreciation, real rent. Nominal→real conversion uses the **Fisher relation** `(1+nom)/(1+inf) − 1`, never naive subtraction (Pitfall 5). `returns.realAnnual` (already stored as REAL in Phase 1) is consumed directly. **Binding — Phase 4 must inherit.**
- **D-03:** **Holding horizon is a per-scenario input** (`holdingYears` on `ScenarioInputs`).
- **D-04:** **Home appreciation is a separate, conservative real assumption** (`appreciation.realAnnual`, default ~0.5–1% real) — explicitly NOT the ~5% real portfolio return (counters Pitfall 6).
- **D-05:** **Sell-side transaction costs modeled explicitly** as a % haircut on home equity at horizon end (`transaction.sellCostPct` ~0.06–0.07; ~5–6% realtor + MA ~0.456% excise stamp). Required by Pitfall 6 + SC5.
- **D-06:** **Rent is flat in real terms** by default (0% real), backed by a stored knob (`rent.realGrowthAnnual`, default `"0"`).

**Property Tax & Assessed Value**
- **D-07:** **Assessed value defaults to purchase price**, with an optional **assessment-ratio knob** (`assessmentRatio`, default `1.0`). Tax = assessedValue × millRate (Pitfall 9).
- **D-08:** A scenario **references a town**; engine **resolves the FY-stamped mill rate** from the seeded table, and the **resolved rate + FY vintage is captured in the snapshot** (Pitfall 11). Sets up Phase 5 to share the table.
- **D-09:** Phase 2 seeds a **curated greater-Boston subset (~20–40 towns) with real FY-stamped DOR rates**. Full-MA + other scoring metrics are Phase 5.
- **D-10:** Over the horizon, **property tax tracks the appreciating assessed value at a held-constant mill rate**. **No 2.5% cap on the bill** (Pitfall 9); output surfaces a qualitative **"Prop 2½ caps the town levy, not your bill"** flag.

**One-Time & MA-Lumpy Costs**
- **D-11:** For the monthly/annualized TCO breakdown, **closing costs are amortized over `holdingYears`**. In the two-portfolio net-worth model, closing costs remain a **t=0 lump** (foregone investment).
- **D-12:** **Buy-side closing costs = a stored %-of-price rate** (~2–3%) auto-filling the figure, with a **per-scenario dollar override**.
- **D-13:** Phase 2 includes a **generic optional one-time "other costs" input**. MA-specific qualitative flagging (septic/betterment) stays in Phase 5. Full betterment/Title 5 modeling deferred.

**Scenario Input Contract**
- **D-14:** **Down payment is a percent of price** (`downPaymentPct`, rate string); loan = price × (1 − pct); LTV falls straight out.
- **D-15:** **Maintenance = % of (appreciating) home value** (reuse `maintenance.annualPctOfValue`, tracks appreciating value). **Insurance = flat annual $ per scenario; HOA = flat $/mo**, both held flat in today's dollars, all tunable.
- **D-16:** **Fixed-rate mortgages only** in Phase 2. ARM deferred.

### Claude's Discretion
- **Money API extension vs internal `Dec`:** amortization needs division, comparison, and `(1+r)^n` powers (not in closed `Money` API). Since TCO lives *inside* `packages/core`, it may use internal `Dec` directly for rate math and surface results as `Money` — OR widen `Money` with `div`/comparison. Either acceptable provided dollars never cross the public boundary as bare numbers (CORE-02) and closed-API discipline holds. **(This research recommends a concrete answer — see Architecture Patterns.)**
- **AssumptionSet versioning:** bump to `AssumptionsV2` with `migrate(V1→V2)` vs extend V1 in place. No persisted snapshots exist yet (persistence is Phase 6). Versioned-discriminated-union discipline should be honored. **(Recommendation below.)**
- **TCO result-object shape**, exact widened `ScenarioInputs` field names, seeded town-table data structure, insurance default, exact default values for new assumptions (within conservative bounds noted).
- **Day-count / monthly-rate convention** (US standard = nominal annual / 12) — apply the standard, document it.

### Deferred Ideas (OUT OF SCOPE)
- FI-date shift, N-scenario ranking, sensitivity bands, no-purchase baseline, retirement-model oracle reconciliation → **Phase 4**.
- Full-MA mill-rate table (~351 towns) + other town scoring metrics + MA-specific qualitative flags → **Phase 5**.
- ARM modeling → deferred (D-16, fixed-rate only).
- Full betterment-apportionment + Title 5 septic-reserve modeling → deferred (D-13 offers only a generic one-time line).
- Forward property-tax rate drift / revaluation → Phase 2 holds mill rate constant, grows only assessed value (D-10).
- Persistence of scenarios/assumptions → Phase 6 (Phase 2 only defines snapshot-able shapes).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TCO-01 | Monthly P+I via amortization from rate, term, loan amount | Amortization Pattern (below) + verified non-round-rate golden case ($400k / 6.375% / 360mo). Standard closed-form payment formula + iterative reconciled schedule. SC1. |
| TCO-02 | Property tax from MA town-level mill rates (seeded static table), not flat % | MA DOR/DLS mill-rate sourcing (verified source URLs below) + FY-stamped town-table data-structure pattern. Tax = assessedValue × millRate (D-07). SC2. |
| TCO-03 | Homeowners insurance + configurable maintenance reserve (~1–2%/yr of value) + HOA | Carrying-cost pattern: maintenance reuses existing `maintenance.annualPctOfValue` knob (appreciating value, D-15); insurance flat $/yr, HOA flat $/mo. SC4. |
| TCO-04 | PMI when DP < 20%, drop at 78% original-value auto / 80% requested | PMI/HPA mechanics verified against NCUA/FDIC/CFPB. Original value + scheduled balance basis, two thresholds, toggle. SC3. |
| TCO-05 | Closing costs as one-time figure, amortizable for comparison | Closing-cost pattern: %-of-price rate auto-fill + $ override (D-12); amortized over `holdingYears` for the breakdown (D-11), t=0 lump in the net-worth model. SC4. |
| TCO-06 | Full TCO breakdown both monthly and annualized | TCO result-object shape (below): per-line components × {monthly, annualized}. SC4. |
| TCO-07 | Rent-vs-buy at household's actual numbers — invest DP + monthly difference, principal as forced savings, no asymmetry | Two-portfolio model (below): symmetric invest-the-difference, Fisher real conversion, separate home appreciation, explicit sell haircut, crossover year. SC5. |
</phase_requirements>

## Summary

Phase 2 is a **pure calculation-engine phase inside an already-complete, well-architected substrate** (Phase 1). There are **no new external dependencies** — `decimal.js` and `zod` are already installed and the money/assumptions/snapshot/golden machinery exists and works. The entire risk surface is *correctness of financial math*, which is exactly what the gating pitfalls (1, 2, 3, 9, 5, 6, 11, 12) warn about. Every success criterion is a correctness invariant that should be proven by tests, several against an external oracle.

The single most important architectural finding: **the existing `runCanary` already demonstrates the exact pattern the amortization/projection math should follow** — use the internal `Dec` clone directly for rate/power/division math (`new Dec(1).plus(new Dec(r)).pow(n)`), keep full precision, then surface dollar results as `Money` via `Money.of(...)` / `Money.mul(decString)`, rounding only at `toCents()`. This resolves the "Money API extension vs internal Dec" discretion question decisively: **use internal `Dec` for the rate math; do NOT widen the public `Money` API.** The closed `Money` API is a deliberately-defended boundary (see `money.type-test.ts`); adding `div`/`pow`/comparison would weaken it for the benefit of code that lives *inside* the boundary and can already use `Dec`.

The second key finding: **amortization correctness is entirely about the iterative schedule and the reconciled final payment**, not the payment formula. A verified non-round-rate golden case is provided below ($400,000 loan, 6.375% nominal annual, 360 months → payment $2,495.48, final reconciled payment $2,494.85, final balance exactly $0.00, principal sum exactly $400,000.00) for SC1's external-oracle agreement.

**Primary recommendation:** Build TCO as a set of pure functions in a new `packages/core/src/tco/` module that consume the widened `EngineInput`, do all rate math in internal `Dec`, return `Money`-valued result objects, and are golden-tested + invariant-tested + oracle-checked. Extend assumptions via a new **`AssumptionsV2`** with a real `migrate(V1→V2)` arm (honors the versioned-discriminated-union discipline; costs almost nothing now and proves the migration path works before persistence depends on it).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Amortization schedule (TCO-01) | `packages/core` calc (pure) | — | Pure deterministic math; the product's correctness core. Zero framework deps. |
| MA property tax (TCO-02) | `packages/core` calc + seeded data | Phase 5 (extends town table) | Tax math is pure; the seeded mill-rate table is core data Phase 5 reuses. |
| PMI / HPA (TCO-04) | `packages/core` calc (pure) | — | Statutory schedule logic against original value + scheduled balance — pure. |
| Carrying costs (TCO-03) | `packages/core` calc (pure) | — | Per-line cost math reading assumption slices. |
| Closing/one-time costs (TCO-05) | `packages/core` calc (pure) | — | Amortization-for-display + t=0 lump; pure. |
| TCO breakdown monthly+annual (TCO-06) | `packages/core` calc (pure) | — | Aggregation/shape; pure result object. |
| Rent-vs-buy two-portfolio (TCO-07) | `packages/core` calc (pure) | Phase 4 (extends to FI-date) | Reusable net-worth engine; Phase 4 layers FI-date/ranking on top. |
| Snapshot reproducibility of all above | `packages/core` serialize (existing) | Phase 6 (persistence) | Reuse `canonicalJson` + golden harness; persistence later. |

**No browser/server/DB tier is involved in this phase.** The Next.js shell (Phase 7) and persistence (Phase 6) are explicitly downstream. This is the purest-possible core phase.

## Standard Stack

**No new packages.** Phase 2 is implemented entirely with the Phase-1 substrate and the two already-installed runtime deps.

### Core (already present — verified in `packages/core/package.json`)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| decimal.js | ^10.6.0 (installed) | Arbitrary-precision rate/power/division math inside the core via the frozen `Dec` clone | Already the project's money substrate (CLAUDE.md prescriptive stack). Phase 2 uses its `.pow`/`.div`/comparison API *internally* (not exported). `[VERIFIED: packages/core/package.json]` |
| zod | ^4.4.3 (installed) | Versioned `AssumptionsV2` schema + town-table validation at the data boundary | Already the assumptions trust boundary (`schema.ts`). Extending it is a one-object append to the `discriminatedUnion`. `[VERIFIED: packages/core/package.json]` |
| vitest | ^4.1.9 (installed, root) | Unit/invariant/golden tests for the engine | Project test runner; `projects` config already wired. `[VERIFIED: package.json]` |

### Supporting (existing core primitives — reuse, do not rebuild)
| Primitive | Location | Purpose | When to Use |
|-----------|----------|---------|-------------|
| `Money` | `money/money.ts` | All dollar outputs/intermediates that cross any boundary | Every dollar in a TCO result object is a `Money`. `mul`/`percentOf` take a rate string. |
| `Dec` (internal) | `money/decimal-config.ts` | Rate/power/division/comparison math inside TCO functions | Amortization `(1+r)^n`, monthly rate `annual/12`, LTV comparisons, Fisher relation. **Not exported.** |
| `AssumptionsV1`/`decStr`/`group` | `assumptions/schema.ts` | Pattern to extend for `AssumptionsV2` | New slices `appreciation`, `transaction`, `rent`, `closing`, `assessment` (or fold ratio under `tax`). |
| `EngineInput`/`ScenarioInputs`/`engineInput()` | `engine/engine-input.ts` | The frozen snapshot unit to widen | Widen `ScenarioInputs` with house-scenario fields; thread into TCO functions. |
| `canonicalJson` + golden harness | `serialize/canonical-json.ts`, `golden.test.ts`, `__fixtures__/` | Reproducibility/golden tests for TCO results | Add TCO golden fixtures via the same `UPDATE_GOLDEN=1` gated pattern. |
| `calendarDate` | `time/calendar-date.ts` | `asOf` threading; FY-stamp dates if stored as dates | Time is data; never `new Date`. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Internal `Dec` for rate math | Widen public `Money` API with `div`/`pow`/`lt`/`gte` | **Rejected.** Weakens a deliberately-closed, type-test-guarded boundary (`money.type-test.ts`) to serve code that lives inside it and already has `Dec`. The canary precedent (`canary.ts` uses `new Dec(...).pow(n)`) shows the sanctioned path. |
| New `AssumptionsV2` + migrate arm | Extend `AssumptionsV1` in place | **Mild preference for V2.** No persisted snapshots exist yet, so in-place edit is technically safe — but Phase 1 D-05 established the versioned discriminated-union + `migrate` discipline; exercising a real V1→V2 step now (a) proves the migration machinery before Phase 6 depends on it and (b) keeps any already-serialized golden fixtures parseable. Cost is ~10 lines. |
| Iterative schedule | Closed-form remaining-balance formula | Use the iterative schedule (it produces the per-period principal/interest split TCO-01/SC1 needs and is where the reconciled-final-payment + invariants live). A closed-form `B_k = P(1+r)^k − M((1+r)^k −1)/r` is useful only as a cross-check oracle in tests. |

**Installation:** None required — verified all deps already present:
```bash
# packages/core already declares: decimal.js ^10.6.0, zod ^4.4.3
# root already declares: vitest ^4.1.9, typescript ^6.0.3
# Nothing to install for Phase 2.
```

## Package Legitimacy Audit

**Not applicable — Phase 2 installs no external packages.** All functionality is built on packages already vetted and installed in Phase 1 (`decimal.js`, `zod`, `vitest`, `typescript`). No registry lookups, no slopcheck run, no new supply-chain surface. If the planner later decides an oracle/test helper is warranted, run the Package Legitimacy Gate before adding it — but the recommendation is to add **zero** new dependencies (the external oracle is a human-verified spreadsheet/bank-calculator figure baked into a test fixture, not a package).

## Architecture Patterns

### System Architecture Diagram

```
                    EngineInput  (frozen snapshot — D-11)
                    { asOf, assumptions(V2), scenario(widened) }
                              │
              ┌───────────────┼────────────────────────────────┐
              ▼               ▼                                  ▼
      derive loan basics   resolve town millRate          consume real assumptions
      price, downPaymentPct  (FY-stamped from seeded       (returns.realAnnual, inflation,
      → loan, LTV (D-14)      town table → capture in        appreciation.realAnnual, rent...)
              │               snapshot — D-08/Pitfall11)            │
              ▼                       │                             │
   ┌──────────────────────┐          │                             │
   │ AMORTIZATION (TCO-01) │          │                             │
   │ iterative Dec schedule│          │                             │
   │ • monthlyRate=ann/12  │          │                             │
   │ • per-period int/prin │          │                             │
   │ • reconciled final pmt│          │                             │
   │ • invariants: bal=0,  │          │                             │
   │   sum(prin)=loan      │          │                             │
   └─────────┬────────────┘          │                             │
             │ schedule (balances)    │                             │
             ▼                        ▼                             │
   ┌──────────────────────┐  ┌──────────────────────┐              │
   │ PMI (TCO-04)          │  │ PROPERTY TAX (TCO-02) │              │
   │ if DP<20%: charge     │  │ assessed = price ×    │              │
   │ drop@78% orig auto /  │  │  assessmentRatio      │              │
   │  80% requested(toggle)│  │ assessed grows @      │              │
   │ vs ORIGINAL value +   │  │  appreciation.realAnn │              │
   │ SCHEDULED balance     │  │ tax = assessed×millRt │              │
   └─────────┬────────────┘  │ (constant rate, NO    │              │
             │               │  2.5% bill cap — flag) │              │
             │               └──────────┬────────────┘              │
             ▼                          ▼                           │
   ┌────────────────────────────────────────────────┐              │
   │ CARRYING COSTS (TCO-03) + CLOSING (TCO-05)       │              │
   │ maintenance = annualPctOfValue × appreciating val│              │
   │ insurance flat $/yr; HOA flat $/mo               │              │
   │ closing = price×rate OR $override; amortize/hold  │              │
   └──────────────────────┬───────────────────────────┘             │
                          ▼                                          │
        ┌───────────────────────────────────┐                       │
        │ TCO BREAKDOWN (TCO-06)             │                       │
        │ {P+I,tax,ins,maint,HOA,PMI,        │                       │
        │  amortizedClosing} × {monthly,      │                       │
        │  annualized}  (all Money)          │                       │
        └───────────────┬───────────────────┘                       │
                        │                                            ▼
                        └────────────────────► ┌──────────────────────────────────┐
                                                │ RENT-VS-BUY TWO-PORTFOLIO (TCO-07)│
                                                │ BUY path: equity built (principal │
                                                │  forced savings) + appreciation,  │
                                                │  minus sell haircut at horizon end│
                                                │ RENT path: invest DP+closing(t=0) │
                                                │  + monthly difference, compound @  │
                                                │  REAL return (Fisher (1+n)/(1+i)-1)│
                                                │ → ending NW each + crossover year │
                                                └───────────────┬──────────────────┘
                                                                ▼
                                                 canonicalJson → golden fixture
                                                 (reuse Phase-1 harness; cent-identical)
```

A reader traces the primary use case: a frozen `EngineInput` → loan basics + resolved FY-stamped mill rate → amortization schedule → PMI/tax/carrying/closing → monthly+annual breakdown → and (consuming the same numbers) the symmetric two-portfolio net-worth comparison → canonical-JSON golden artifact.

### Recommended Project Structure
```
packages/core/src/
├── tco/                          # NEW — the TCO substrate
│   ├── amortization.ts           # schedule + payment + invariants (TCO-01)
│   ├── amortization.test.ts      # invariant tests + oracle case
│   ├── pmi.ts                    # HPA 78/80 original-value drop-off (TCO-04)
│   ├── pmi.test.ts               # toggle test (auto vs requested)
│   ├── property-tax.ts           # assessed × millRate, appreciating assessed (TCO-02)
│   ├── carrying-costs.ts         # maintenance/insurance/HOA (TCO-03)
│   ├── closing-costs.ts          # %-of-price OR override; amortize-over-hold (TCO-05)
│   ├── tco.ts                    # top-level computeTco() → breakdown (TCO-06)
│   ├── rent-vs-buy.ts            # two-portfolio net worth + crossover (TCO-07)
│   ├── *.test.ts                 # per-module tests
│   └── tco.type-test.ts          # closed-result-shape / no-bare-number guards
├── towns/                        # NEW — seeded MA mill-rate table (Phase 5 extends)
│   ├── town-table.ts             # data + FY stamp + resolver
│   ├── town-table.schema.ts      # Zod row schema (decStr millRate, fy literal/int)
│   └── town-table.test.ts        # resolver + snapshot-capture test
├── assumptions/
│   ├── schema.ts                 # ADD AssumptionsV2 to discriminatedUnion
│   ├── schema-v2.ts (optional)   # or keep V2 in schema.ts
│   ├── defaults.ts               # ADD DEFAULT_ASSUMPTIONS_V2 (or bump existing)
│   └── migrate.ts                # ADD case 1: return v1ToV2(set)
├── engine/
│   └── engine-input.ts           # WIDEN ScenarioInputs
└── index.ts                      # EXPORT new public types/functions (Money-typed results)
```

### Pattern 1: Internal-`Dec` rate math, `Money` results (the canary precedent)
**What:** Do all division/power/comparison in the internal `Dec` clone; convert to `Money` only for dollar quantities; never widen the public `Money` API.
**When to use:** Everywhere amortization/projection needs `div`, `pow`, or `<`/`>=`.
**Example:**
```typescript
// Source: existing pattern in packages/core/src/engine/canary.ts (lines 55–59)
import { Dec } from '../money/decimal-config.js';
import { Money } from '../money/money.js';

// monthly rate = nominal annual / 12 (US standard convention — documented)
const monthlyRate = new Dec(annualRate).div(12);            // Dec.div — internal only
// closed-form payment: M = P r (1+r)^n / ((1+r)^n − 1)
const onePlusR = new Dec(1).plus(monthlyRate);
const factor = onePlusR.pow(termMonths);                    // Dec.pow — internal only
const paymentDec = new Dec(loan).times(monthlyRate).times(factor).div(factor.minus(1));
// surface as Money: feed the decimal STRING to Money (no bare number crosses boundary)
const payment = Money.of(paymentDec.toFixed());             // full precision retained
```
*Note: `Money.of` validates against `CANONICAL_DECIMAL_RE` which rejects exponent form. `Dec.toFixed()` (no arg) emits canonical fixed-point — safe. `Dec.toString()` can emit exponent form for very large/small values; **always use `.toFixed()`** when crossing into `Money.of`/`Money.mul`.*

### Pattern 2: Iterative amortization schedule with reconciled final payment
**What:** Loop period-by-period; each period `interest = round(balance × monthlyRate)`, `principal = payment − interest`, `balance −= principal`. **Force the last period to pay the exact remaining balance** (final payment = remaining balance + that period's interest), so the schedule ends at exactly $0.00.
**When to use:** TCO-01 / SC1. This is where the invariants live.
**Critical decisions:**
- **Rounding cadence:** Round interest (and the per-period dollar split) to cents each period so the schedule reconciles to whole cents — but keep `monthlyRate` at full `Dec` precision. (Per Pitfall 2: computing interest off a *rounded* balance with an *unrounded* schedule is the classic drift bug.) The schedule's dollar columns are `Money`; the per-period interest rounds via `Money.toCents()`-style rounding at the period boundary.
- **Final payment is NOT a normal payment.** In the verified case below it is $2,494.85 vs the normal $2,495.48 — a test must assert the final row differs and that balance hits exactly $0.00.
**Invariants to assert in tests (SC1):**
1. `schedule.length === termMonths`
2. `sum(principal_i) === originalLoan` exactly (compare `Money` decimal strings / cents)
3. `finalBalance === Money.zero()` exactly
4. `sum(interest_i) === sum(payment_i) − originalLoan` (interest-total cross-check)
5. External-oracle agreement on the non-round-rate case below.

### Pattern 3: PMI against ORIGINAL value + SCHEDULED balance (HPA)
**What:** PMI is charged while LTV > threshold; computed against the **original** value (price at origination), using the **scheduled** amortized balance (not appreciated value, not actual extra-payment balance for the auto path).
**Rules (verified — NCUA/FDIC/CFPB):**
- **Automatic termination at 78%:** the month the scheduled principal balance first reaches ≤ 78% of original value (based solely on the initial amortization schedule for a fixed-rate loan), borrower current.
- **Borrower-requested at 80%:** borrower may request cancellation when the scheduled balance reaches 80% of original value (toggle — different, earlier, drop-off month).
- **Appreciation-based early removal is NOT default** — separate optional lever requiring re-appraisal (out of Phase 2 scope per D-04/Pitfall 3).
**Toggle test (SC3):** auto vs requested produce *different* drop-off months; both measured against original value; PMI present only while DP < 20%.

### Pattern 4: Two-portfolio symmetric rent-vs-buy (Fisher real, separate appreciation, sell haircut)
**What:** Two complete net-worth trajectories over `holdingYears`, each investing whatever cash the *other* path frees up, at the **real** return (Fisher), comparing **ending net worth** + **crossover year**.
**Construction (SC5 / Pitfall 6):**
- **t=0:** RENT path invests (down payment + closing-cost lump) — the cash the BUY path spends. BUY path's net worth starts at home equity = down payment (minus nothing yet) but carries the foregone-investment opportunity cost implicitly via the symmetric model.
- **Each period:** compute BUY monthly outflow (P+I + tax + insurance + maintenance + HOA + PMI) and RENT monthly outflow (rent). Whichever path is cheaper that month invests the **difference** into its side's portfolio. (Symmetric — modeling only one side rigs the result.)
- **Returns:** compound the invested portfolios at the **real** return derived via Fisher `(1+nominal)/(1+inflation) − 1`. Since `returns.realAnnual` is already stored as REAL (Phase 1), it is consumed directly — but the rent/appreciation knobs are real too (D-02/D-06), so document the all-real convention and apply Fisher only where a nominal knob exists.
- **Home equity (BUY):** principal paid (forced savings) + appreciation at `appreciation.realAnnual` (conservative, separate from portfolio return — D-04/Pitfall 6), grown on the appreciating home value.
- **At horizon end:** liquidate BUY's home equity with the explicit sell haircut `transaction.sellCostPct` (D-05) before comparing ending net worth.
- **Crossover year:** first year BUY ending net worth ≥ RENT ending net worth (or report "never" within horizon).
**Anti-funnel check:** at least one realistic input set must yield RENT winning (Pitfall "must be able to say no").

### Pattern 5: FY-stamped town-table resolution captured into the snapshot
**What:** Seeded table of ~20–40 greater-Boston towns → `{ town, fy, residentialMillRate (decStr) }`. Scenario references a town; resolver returns the rate **and** FY vintage; both are written into the result/snapshot so reproducibility survives a later table update (D-08 / Pitfall 11).
**Data shape:**
```typescript
// Source: pattern derived from assumptions/schema.ts + Pitfall 11
interface TownRateRow {
  readonly town: string;           // canonical town name (key)
  readonly fy: number;             // fiscal year vintage, e.g. 2025
  readonly residentialMillRate: string; // decStr, $ per $1,000 assessed (DOR "Tax Rates by Class")
}
// resolveMillRate(town) -> { residentialMillRate, fy }; the resolved pair is captured
// in the TCO result so the snapshot is self-contained (not a live table lookup on replay).
```
*Note on units:* DOR publishes the residential rate as **dollars per $1,000 of assessed value** (mill rate). Store it as published and divide by 1000 in the tax math (`tax = assessed × rate/1000`), OR pre-convert to a fraction and store as such — pick one and document. Recommendation: store **as published** (per-$1,000) so it visually matches DOR data and is auditable, convert in the function.

### Anti-Patterns to Avoid
- **Widening `Money` with `div`/`pow`/comparison.** Use internal `Dec`. The closed API is guarded by `money.type-test.ts`; reopening it is a regression.
- **Bare `number` for any dollar or for the `(1+r)^n` chain that feeds a dollar.** Rates stay `Dec`/string; dollars are `Money`. (Pitfall 1.)
- **`Dec.toString()` into `Money.of`.** Use `.toFixed()` — `toString` can emit `1e21`-style exponent strings that `CANONICAL_DECIMAL_RE` rejects.
- **Treating the final amortization payment as a normal payment.** It must be reconciled (Pitfall 2).
- **PMI drop at 80% automatic / at appreciated value.** It's 78% auto / 80% requested, original value, scheduled balance (Pitfall 3).
- **Modeling property tax as a flat % or a 2.5%-capped bill.** Tax = assessed × mill rate; mill rate constant, assessed grows; surface the "Prop 2½ caps the levy, not your bill" flag (Pitfall 9).
- **One-sided invest-the-difference or home equity growing at the portfolio rate.** Symmetric + separate appreciation + sell haircut (Pitfall 6).
- **Reading the town table at replay time instead of capturing the resolved rate+FY into the snapshot.** Breaks reproducibility (Pitfall 11).
- **Naive `nominal − inflation`.** Use Fisher `(1+n)/(1+i)−1` (Pitfall 5).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Decimal/rate/power math | Custom BigInt cents arithmetic with hand-rolled `pow` | Internal `Dec` (`decimal.js` clone) `.pow`/`.div`/comparison | Already configured (34-digit, HALF_EVEN), battle-tested, the project standard. |
| Dollar representation & rounding | A new money type or float dollars | Existing `Money` | Closed, decimal-precise, single rounding boundary (`toCents`). |
| Versioned assumption schema + validation | Hand-rolled version switch / manual JSON checks | Extend the Zod `discriminatedUnion` + add a `migrate` arm | Established pattern; adding V2 is appending one object schema. |
| Reproducibility/golden compare | A bespoke snapshot differ | `canonicalJson` + the gated `UPDATE_GOLDEN=1` golden harness | Float-free, key-sorted, human-diffable; already trusted. |
| Determinism enforcement | Re-checking for `Date.now`/`Math.random` | The existing ESLint + runtime guard (inherited by new core files) | Already fails the build; new `tco/` files are covered automatically. |
| ISO dates | `new Date(...)` for FY stamps / asOf | `calendarDate` branded string | `new Date` is banned in core (nondeterminism). |

**Key insight:** Phase 2 should add **almost no new infrastructure** — it composes existing, defended primitives. The only genuinely new "data" asset is the seeded town→mill-rate table; the only new "math" is amortization/PMI/tax/rent-vs-buy, all expressible with `Dec` + `Money`.

## Runtime State Inventory

*Not applicable — Phase 2 is greenfield additive code inside `packages/core` (new `tco/` and `towns/` modules + additive schema/type widening). No rename/refactor/migration of existing stored data, services, or OS state.* The one near-migration concern: **widening `ScenarioInputs` and bumping to `AssumptionsV2`** changes the golden-snapshot fixture shape. That is a code-and-fixture change handled by regenerating the golden fixture via the existing `npm run update-golden` (reviewable diff) — not a data migration. No persisted snapshots exist (persistence is Phase 6), so there is nothing in the wild to migrate. Verified: only `packages/core/src/__fixtures__/golden-snapshot.json` exists, and it is regenerable.

## Common Pitfalls

(Cross-referenced to `.planning/research/PITFALLS.md` — the binding pitfalls for this phase.)

### Pitfall 2: Amortization rounding / final payment / zero balance
**What goes wrong:** Final balance ≠ $0.00; final row looks like a normal payment; interest computed off rounded vs unrounded balance drifts the schedule.
**How to avoid:** Iterative schedule, round interest each period to cents, force final payment = remaining balance + last interest, assert the four invariants + external oracle.
**Warning signs:** `toBeCloseTo` on dollar assertions; final balance like `$0.03`; last payment == normal payment.

### Pitfall 3: PMI at wrong LTV / wrong value
**What goes wrong:** Dropping at 80% auto, or against appreciated/current value.
**How to avoid:** 78% auto / 80% requested, both vs original value + scheduled balance; toggle-tested.
**Warning signs:** PMI removal date moves with appreciation; auto and requested identical.

### Pitfall 9: Prop 2½ modeled as a 2.5% bill cap
**What goes wrong:** Capping the *bill* growth at 2.5%; treating tax as flat %.
**How to avoid:** tax = assessed × mill rate; mill rate held constant, assessed grows at appreciation; emit the qualitative "Prop 2½ caps the town levy, not your bill" flag.
**Warning signs:** any `≤ 0.025` growth clamp on the tax line; tax insensitive to town.

### Pitfall 5: Real vs nominal mixed / naive subtraction
**What goes wrong:** Mixing nominal returns with today's-dollar targets; `nominal − inflation`.
**How to avoid:** All-real convention (D-02); Fisher `(1+n)/(1+i)−1` for any nominal→real conversion; consume `returns.realAnnual` directly.
**Warning signs:** inflation applied to costs AND a real return used; no documented convention.

### Pitfall 6: Rent-vs-buy asymmetry
**What goes wrong:** Only one path invests the difference; full payment treated as cost; home equity grows at the stock rate; no sell costs.
**How to avoid:** Symmetric invest-the-difference; principal is forced savings; separate conservative appreciation; explicit sell haircut.
**Warning signs:** RENT can never win on any input; equity uses `returns.realAnnual`.

### Pitfall 11: Non-reproducible mill-rate resolution
**What goes wrong:** Replay re-reads a since-updated table → different result.
**How to avoid:** Capture resolved rate + FY into the snapshot; FY-stamp the table.
**Warning signs:** TCO result lacks the rate/FY it used; golden test passes only against the current table.

### Pitfall 1: Float money math
**What goes wrong:** Cent drift across the 360-period loop.
**How to avoid:** `Dec` for rates, `Money` for dollars, exact-equality dollar assertions.

### Pitfall 12: MA lumpy costs ignored
**What goes wrong:** No one-time/lumpy category.
**How to avoid:** Generic one-time "other costs" input (D-13); MA-specific septic/betterment flags deferred to Phase 5.

## Code Examples

### Monthly payment + monthly rate (US convention) — verified pattern
```typescript
// Source: canary.ts Dec pattern + verified golden case below
import { Dec } from '../money/decimal-config.js';
import { Money } from '../money/money.js';

export function monthlyRate(annualRate: string): InstanceType<typeof Dec> {
  return new Dec(annualRate).div(12); // nominal annual / 12 — US mortgage standard
}

export function scheduledPayment(loan: string, annualRate: string, termMonths: number): Money {
  const r = monthlyRate(annualRate);
  const factor = new Dec(1).plus(r).pow(termMonths);     // (1+r)^n full precision
  const m = new Dec(loan).times(r).times(factor).div(factor.minus(1));
  return Money.of(m.toFixed());                           // canonical fixed-point string
}
```

### Fisher real-return conversion
```typescript
// Source: Pitfall 5 / D-02. Use ONLY where a nominal knob must become real.
// returns.realAnnual is ALREADY real (Phase 1) — do not double-convert it.
function toReal(nominal: string, inflation: string): InstanceType<typeof Dec> {
  return new Dec(1).plus(new Dec(nominal))
    .div(new Dec(1).plus(new Dec(inflation)))
    .minus(1);
}
```

### Property tax (assessed × mill rate per $1,000, constant rate, growing assessed)
```typescript
// Source: D-07/D-10 + DOR units. millRate is dollars per $1,000 assessed (decStr).
function annualPropertyTax(assessedValue: Money, millRatePerThousand: string): Money {
  // assessed × (rate / 1000)  — rate as published by DOR
  return assessedValue.mul(new Dec(millRatePerThousand).div(1000).toFixed());
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `Money` had no rate math; canary used `Dec` directly | Same — confirmed sanctioned pattern for Phase 2 | Phase 1 (canary.ts) | Resolves the discretion question: use `Dec` internally, don't widen `Money`. |
| `AssumptionsV1` only | Add `AssumptionsV2` via discriminatedUnion + migrate arm | Phase 2 | Proves migration path before persistence (Phase 6). |
| `ScenarioInputs = { label }` | Widened with house-scenario fields | Phase 2 | Snapshot shape changes → regenerate golden fixture. |

**Deprecated/outdated:** Nothing in-repo. MA DOR mill-rate data: use the **most recent FY available** (FY2025 fully approved; FY2026 publishing) from the DLS "Tax Rates by Class" report — and **FY-stamp** whatever vintage you seed.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The verified golden amortization figures ($2,495.48 payment, $2,494.85 final, $0.00 balance, $400,000.00 principal sum, $498,372.17 total interest) were computed with float + per-period HALF_UP cent rounding; the `decimal.js` HALF_EVEN core may differ by a cent on individual rows | Amortization / Validation | LOW — invariants (zero balance, principal sum) hold regardless of rounding mode; the *exact* per-period figures should be re-derived with the actual `Dec` HALF_EVEN settings and that becomes the committed golden fixture. Treat the provided numbers as an oracle for invariants + order-of-magnitude, not as cent-exact HALF_EVEN truth. |
| A2 | Default values for new assumptions (appreciation.realAnnual ~0.005–0.01, transaction.sellCostPct ~0.06–0.07, rent.realGrowthAnnual "0", closing rate ~0.02–0.03, assessmentRatio "1.0", insurance flat ~$1,500–2,500/yr) are within the conservative bounds CONTEXT.md endorsed but exact figures are Claude's discretion | Standard Stack / assumptions | LOW — CONTEXT.md explicitly delegates exact defaults; planner/user can tune. Keep them conservative (anti-funnel). |
| A3 | DOR publishes residential rate as dollars-per-$1,000 assessed ("mill rate"); store as published and divide by 1000 in math | Pattern 5 / property tax | LOW-MEDIUM — verified DOR uses "Tax Rates by Class" per-$1,000 convention; confirm exact column when seeding the table from the live report. |
| A4 | `AssumptionsV2` (vs in-place V1 edit) is the better choice | Alternatives | LOW — both work since no snapshots persist; V2 is a discipline/future-proofing preference, reversible. |
| A5 | MA deed-excise stamp ~$4.56/$1,000 (~0.456%) folded into the ~6–7% sell-cost default | D-05 sell haircut | LOW — it's bundled into a single tunable `sellCostPct`; exact split immaterial to the model. |

## Open Questions

1. **Exact FY vintage to seed (FY2025 vs FY2026)**
   - What we know: FY2025 is fully DLS-approved (343–351 communities); FY2026 is publishing as of mid-2026.
   - What's unclear: whether all ~20–40 target greater-Boston towns have FY2026 rates approved yet.
   - Recommendation: seed the **latest fully-approved FY available per town**, FY-stamp **per row** (not one global FY), so a mixed-vintage table is honestly represented. Pull from the DLS "Tax Rates by Class" report.

2. **Rounding cadence inside the amortization schedule (per-period vs at-output)**
   - What we know: Phase 1 D-03 says round only at output boundaries; Pitfall 2 says round interest each period to avoid drift.
   - What's unclear: these are in tension for the *schedule* specifically.
   - Recommendation: round the **dollar split per period to cents** (the schedule is a series of real cash flows, each a `Money` rounded at its boundary) while keeping the **rate** at full `Dec` precision — this satisfies both (each period's `Money` rounds at its own `toCents` boundary; the rate never rounds). Document this explicitly as the amortization rounding convention. The planner should make this an explicit, tested decision.

3. **Where `assessmentRatio` lives in the schema**
   - Recommendation: under the existing `tax` group as `tax.assessmentRatio` (it's tax-domain), keeping new top-level groups to `appreciation`, `transaction`, `rent`, `closing`. Claude's discretion.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js (ESM) | running tests/build | ✓ (Phase 1 built/tested here) | project-pinned | — |
| decimal.js | rate math | ✓ installed | ^10.6.0 | — |
| zod | schema | ✓ installed | ^4.4.3 | — |
| vitest | tests | ✓ installed | ^4.1.9 | — |
| typescript | typecheck/type-tests | ✓ installed | ^6.0.3 | — |
| MA DOR/DLS mill-rate data | seeding town table (TCO-02) | ✓ (public web data) | FY2025 approved; FY2026 publishing | Manual transcription from DLS "Tax Rates by Class" report; FY-stamp per row |

**Missing dependencies with no fallback:** None.
**Missing dependencies with fallback:** Mill-rate data is sourced manually from the public DLS report (no live API in Phase 2 — DATA-01 live refresh is explicitly v2/out of scope). Transcribe ~20–40 towns by hand from the authoritative report and FY-stamp each.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4 (`^4.1.9`), `projects: ['packages/*']` config |
| Config file | `vitest.config.ts` (root) + `packages/core/vitest.config.ts` + `vitest.shared.ts` |
| Quick run command | `npx vitest run packages/core/src/tco` (single module) |
| Full suite command | `npm test` (root → `vitest run`, all projects) |
| Golden regenerate | `npm run update-golden` (`UPDATE_GOLDEN=1 vitest run packages/core` — reviewable diff) |
| Coverage gate | v8, root thresholds: lines 95 / functions 95 / branches 90 / statements 95 — **the TCO module must clear these** |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TCO-01 | Schedule final balance == $0.00; sum(principal) == loan; oracle agreement on non-round rate | unit/invariant + oracle | `npx vitest run packages/core/src/tco/amortization.test.ts` | ❌ Wave 0 |
| TCO-02 | tax = assessed × mill rate; FY-stamped; no 2.5% cap; appreciating assessed | unit | `npx vitest run packages/core/src/tco/property-tax.test.ts` | ❌ Wave 0 |
| TCO-03 | maintenance (%-of-appreciating-value), insurance flat, HOA flat | unit | `npx vitest run packages/core/src/tco/carrying-costs.test.ts` | ❌ Wave 0 |
| TCO-04 | PMI on DP<20%; drop 78% auto / 80% requested vs original value + scheduled balance (toggle) | unit/toggle | `npx vitest run packages/core/src/tco/pmi.test.ts` | ❌ Wave 0 |
| TCO-05 | closing = price×rate OR override; amortized over hold; t=0 lump in net-worth model | unit | `npx vitest run packages/core/src/tco/closing-costs.test.ts` | ❌ Wave 0 |
| TCO-06 | breakdown present monthly AND annualized for every line | unit + golden | `npx vitest run packages/core/src/tco/tco.test.ts` | ❌ Wave 0 |
| TCO-07 | symmetric invest-the-difference; Fisher real; separate appreciation; sell haircut; crossover; RENT-can-win | unit + anti-funnel | `npx vitest run packages/core/src/tco/rent-vs-buy.test.ts` | ❌ Wave 0 |
| (cross) | full TCO result recomputes cent-identically (reproducibility) | golden | `npx vitest run packages/core/src/golden.test.ts` (extend) | ⚠️ exists; extend |
| (cross) | result shape closed / no bare-number leak | type-test | `tsc -b` (via `npm run typecheck`) | ❌ Wave 0 (`tco.type-test.ts`) |

### Sampling Rate
- **Per task commit:** `npx vitest run packages/core/src/tco/<module>.test.ts` + `npm run typecheck`
- **Per wave merge:** `npm test` (full core suite, coverage-gated)
- **Phase gate:** Full suite green + golden fixtures regenerated-and-reviewed before `/gsd-verify-work`; invariant + oracle tests for SC1 must pass with exact equality (no `toBeCloseTo`).

### External Oracle for SC1 (non-round-rate amortization)
**Verified golden case** (compute the committed fixture with the actual `Dec`/HALF_EVEN settings; these float-derived figures are the cross-check oracle):
- **Loan:** $400,000.00 · **Annual rate:** 6.375% (non-round) · **Term:** 360 months
- **Monthly rate:** 0.0053125 · **Scheduled payment:** **$2,495.48**
- **Month 1:** interest $2,125.00 / principal $370.48
- **Balance after 12 months:** $395,422.00
- **Final (reconciled) payment:** **$2,494.85** (≠ the normal $2,495.48 — proves reconciliation)
- **Final balance:** **$0.00** (exact) · **Sum of principal:** **$400,000.00** (exact) · **Total interest:** ~$498,372.17
- Cross-check the payment against any bank amortization calculator / spreadsheet `PMT(0.06375/12, 360, -400000)` → 2495.479595… → $2,495.48.
*(See Assumption A1: re-derive exact per-period cents under the project's HALF_EVEN clone and commit that as the golden fixture; invariants hold under any consistent rounding mode.)*

### Wave 0 Gaps
- [ ] `packages/core/src/tco/amortization.test.ts` — TCO-01 invariants + oracle
- [ ] `packages/core/src/tco/property-tax.test.ts` — TCO-02
- [ ] `packages/core/src/tco/carrying-costs.test.ts` — TCO-03
- [ ] `packages/core/src/tco/pmi.test.ts` — TCO-04 toggle
- [ ] `packages/core/src/tco/closing-costs.test.ts` — TCO-05
- [ ] `packages/core/src/tco/tco.test.ts` — TCO-06 + golden
- [ ] `packages/core/src/tco/rent-vs-buy.test.ts` — TCO-07 + anti-funnel "rent wins" case
- [ ] `packages/core/src/tco/tco.type-test.ts` — closed-shape / no-bare-number guard (mirrors `money.type-test.ts`)
- [ ] `packages/core/src/towns/town-table.test.ts` — resolver + FY-stamp-into-snapshot
- [ ] Extend `packages/core/src/golden.test.ts` + add a TCO golden fixture under `__fixtures__/`
- [ ] Framework install: **none** — Vitest already configured.

## Security Domain

> `security_enforcement` not configured in `.planning/config.json` (treated as enabled). This phase is a **pure offline calculation library** with no auth, sessions, network, untrusted input at runtime, or cryptography. The one boundary is data deserialization (snapshots / town table), already handled by Zod.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No auth in core (private 2-user tool, no accounts). |
| V3 Session Management | no | No sessions. |
| V4 Access Control | no | No multi-tenant/access boundary in core. |
| V5 Input Validation | yes | **Zod** at the assumptions/snapshot/town-table boundary (`parseAssumptionSet`, town-row schema); `Money`/`decStr` reject non-canonical/non-finite values; `canonicalJson` throws on non-finite numbers. |
| V6 Cryptography | no | No crypto — never hand-roll any. |

### Known Threat Patterns for a pure calc core
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Corrupt/forged snapshot or town-table JSON (e.g. float where decimal string expected, `NaN`/`Infinity`, unknown schemaVersion) | Tampering | Parse THROUGH Zod (`.strict()`, `discriminatedUnion`, `decStr`); `Money` boundary rejects non-canonical strings; `canonicalJson` throws on non-finite. Extend the same discipline to the new V2 slices and the town-row schema. |
| Silent float reintroduction corrupting long projections | Tampering (integrity) | No bare-number dollar entry points (guarded by `money.type-test.ts`); add a `tco.type-test.ts` asserting TCO result fields are `Money`, not number. |
| Non-deterministic replay (ambient time/randomness) | Repudiation (trust) | Inherited ESLint `no-restricted-globals` + runtime determinism guard; `asOf` is data; new `tco/` files are covered automatically. |

## Sources

### Primary (HIGH confidence)
- `packages/core/src/**` — verified existing primitives: `money/money.ts` (closed API, no div/pow), `money/decimal-config.ts` (Dec clone, 34-digit HALF_EVEN), `engine/canary.ts` (the `Dec.pow` → `Money` precedent), `engine/engine-input.ts` (ScenarioInputs to widen), `assumptions/schema.ts` + `defaults.ts` (V1 + discriminatedUnion + decStr), `serialize/canonical-json.ts`, `golden.test.ts`, `__fixtures__/golden-snapshot.json`, `money/money.type-test.ts`, `vitest.config.ts`, `package.json` (deps).
- `.planning/phases/02-tco-engine/02-CONTEXT.md` — binding decisions D-01..D-16 + Claude's Discretion.
- `.planning/research/PITFALLS.md` — gating pitfalls 1,2,3,5,6,9,11,12 + "Looks Done But Isn't" checklist (verified against CFPB/FDIC/Mass.gov in that doc).
- `.planning/REQUIREMENTS.md` / `.planning/ROADMAP.md` — TCO-01..07 + 5 verbatim success criteria + Phase 4/5 scope boundaries.
- NCUA / FDIC / CFPB — Homeowners Protection Act: 78% automatic termination (scheduled balance, original value), 80% borrower-requested, fixed-rate uses initial amortization schedule. (https://ncua.gov/regulation-supervision/manuals-guides/federal-consumer-financial-protection-guide/compliance-management/lending-regulations/homeowners-protection-act-pmi-cancellation-act ; https://www.fdic.gov/consumer-compliance-examination-manual/v-5-homeowners-protection-act ; https://www.consumerfinance.gov/ask-cfpb/when-can-i-remove-private-mortgage-insurance-pmi-from-my-loan-en-202/)
- Mass.gov DLS — FY2025/FY2026 Tax Levies, Assessed Values and Tax Rates + the "Tax Rates by Class" databank report (residential rate per $1,000). (https://www.mass.gov/info-details/fy2025-tax-levies-assessed-values-and-tax-rates ; https://dls-gw.dor.state.ma.us/reports/rdpage.aspx?rdreport=propertytaxinformation.taxratesbyclass.taxratesbyclass_main ; https://www.mass.gov/lists/property-tax-data-and-statistics)
- Verified amortization computation (this session) — `node` script reproducing the $400k/6.375%/360 golden case with exact $0 balance and $400,000.00 principal sum.

### Secondary (MEDIUM confidence)
- Standard fixed-rate amortization formula `M = P·r·(1+r)^n / ((1+r)^n − 1)` and US monthly-rate convention (nominal annual / 12) — well-established mortgage math, corroborated by the verified golden case.

### Tertiary (LOW confidence)
- Exact default values for new assumptions (within CONTEXT.md's conservative bounds) — Claude's discretion; tag `[ASSUMED]` in the plan until user-confirmed.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new deps; all verified present in repo manifests.
- Architecture: HIGH — the canary already demonstrates the recommended Dec→Money pattern; closed-API boundary is concrete.
- Pitfalls: HIGH — sourced from the project's own verified PITFALLS.md (CFPB/FDIC/Mass.gov-backed) + independent HPA/DOR verification this session.
- Amortization oracle: MEDIUM-HIGH — invariants verified by execution; exact per-period HALF_EVEN cents to be re-derived as the committed fixture (A1).
- Town data specifics: MEDIUM — source verified; exact FY/per-town transcription is a Wave-0 seeding task.

**Research date:** 2026-06-23
**Valid until:** ~2026-07-23 for the engine/stack findings (stable); MA mill-rate vintage advances with the FY (re-check the latest approved FY when seeding).
