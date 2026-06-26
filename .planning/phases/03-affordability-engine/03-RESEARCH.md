# Phase 3: Affordability Engine - Research

**Researched:** 2026-06-26
**Domain:** Mortgage DTI qualification math + savings-rate-floor affordability solving, pure TypeScript calc core (`@house/core`)
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**True Affordability — Definition & Depth**
- **D-01:** True affordability is governed by a **savings-rate floor**, NOT a FI-date projection. The full FI-date math is deferred to Phase 4. Phase 3 honors AFF-02 by proxy: it preserves the savings rate the household's FI plan already requires.
- **D-02:** The FI "threshold" is expressed as a **target savings rate (or target annual savings) the user supplies** — not a target date or a target FI number. No FI-number/SWR/date math in Phase 3. (`swr.rate` / `returns.realAnnual` stay in the AssumptionSet for Phase 4; Phase 3 does not consume them for true affordability.)
- **D-03:** The savings drain is **incremental: `TCO total monthly − current rent`** (household already pays rent). Mortgage **principal counts as cash out** of the savings flow in Phase 3 (equity offset is Phase 4's job — keep Phase 3 a simple cash measure).
- **D-04:** **Savings rate is measured against GROSS income** (annual savings ÷ gross income). Shares one income input with the DTI denominator (also gross). `tax.effectiveIncomeRate` (0.27) is available to derive after-tax cash *for computing the savings amount*, but the rate's denominator is gross.
- **D-05:** True affordability is **`min(savings-rate ceiling, cash-on-hand ceiling)`**. Cash-on-hand gate: **down payment + closing costs ≤ available investable net worth − a reserve knob**. Reserve default is Claude's discretion (conservative, e.g. an emergency-fund buffer).

**Solve Direction & Down Payment**
- **D-06:** Primary output for both ceilings is **solve for the max affordable price** (inverted flow). Bank's native solve is the max approvable **loan** → price = loan + down payment (SC1). **Additionally** provide a per-scenario evaluation path (DTI ratios, pass/fail, headroom, savings-rate impact) reusing the existing priced `ScenarioInputs` + `computeTco`.
- **D-07:** When solving for max price, the **down payment is a fixed dollar amount** (not a percent). `loan = price − downPaymentCash`, so **LTV (and PMI) rise as price rises**. PMI engages once price exceeds ~5× the down payment.
- **D-08 (mechanism is Claude's discretion):** For each trial price the solver derives `downPaymentPct = downPaymentCash / price` and builds an `EngineInput` to reuse `computeTco` unchanged. Closed-form vs binary search is Claude's discretion; property tax (∝ assessed value), maintenance (∝ value), and PMI (∝ loan) scale with price while insurance/HOA are flat, so the housing payment is near-piecewise-linear in price — binary search over price is a safe, simple default.

**Household / Profile Input Contract**
- **D-09:** Household financials live in a **new `household` (profile) block on `EngineInput`**, alongside `asOf` / `assumptions` / `scenario`, **Zod-validated at the boundary** exactly like `ScenarioInputs` (decimal-string leaves, `.strict()`, a `parseHousehold` loader). This is the exact shape Phase 6 will persist — but **interface-only / not persisted** in Phase 3.
- **D-10:** Household fields (names/units are Claude's discretion; dollars as canonical decimal strings, counts as integers): **gross income**, **existing monthly debt obligations as a single monthly total** (back-end DTI uses minimum monthly obligations, not balances), **target savings rate** (decStr, vs gross), **available investable net worth** (cash-on-hand gate), **current rent** (monthly), and the **down-payment cash** + **reserve** levers. Income annual-vs-monthly is Claude's discretion (DTI needs monthly, savings needs annual — the engine converts).
- **D-11:** **Current rent is a household-level fact**, distinct from `ScenarioInputs.monthlyRent` (the market rent of the comparable for the Phase 2 rent-vs-buy path). The savings drain (D-03) uses the household current rent.

**The Gap Output**
- **D-12:** The gap result reports: **bank max price, true max price, the signed gap (bank − true), AND the binding constraint on each side** — bank: front-end vs back-end DTI; true: savings-rate floor vs cash-on-hand.
- **D-13:** The gap carries a **directional verdict, compared on max PRICE**: `bank > true` → "the bank will lend $X beyond your FI tolerance" (anti-funnel case); `true > bank` → "your FI plan supports more than the bank will lend" (cash-rich case); roughly equal → aligned. The verdict is a structured/enum value (presentation wording is Phase 7's).

**Locked Correctness Notes**
- **D-14:** The **DTI housing numerator** and the **savings drain** must use **`tco.total − amortizedClosing`**, never raw `tco.total`. Specifically the **DTI carrying cost = P+I + property tax + insurance + PMI + HOA** (lender PITI+HOA+PMI; **maintenance is NOT a lender DTI input** — exclude it even though it IS in `tco.total`). The savings drain (D-03) IS a real cash measure and SHOULD include maintenance. **These two numerators differ — define them as separate, explicitly-named derivations from the TCO lines.**
- **D-15:** **All-real (today's-dollar) convention is inherited** (Phase 2 D-02). DTI ratios are a point-in-time (year-0) calculation; the savings floor is also evaluated in today's dollars. No nominal/real mixing.
- **D-16:** **Fixed-rate only** (inherited Phase 2 D-16). Bank affordability uses the scenario's single nominal `annualRate`. A separate higher "stress/qualifying rate" is a deferred idea.

### Claude's Discretion
- Exact identifiers/field names and units (annual vs monthly) of the new `household`/profile type and its Zod schema; the reserve default value; the result-object shapes for bank affordability, true affordability, the per-scenario evaluation, and the gap.
- The max-price solve mechanism (closed-form vs binary search — D-08) and convergence tolerance (to the cent, consistent with the Money rounding boundary).
- Whether to widen the closed `Money` API with comparison/division helpers or use the internal `Dec` directly inside core for the solve/ratio math (Phase 2 precedent: `Dec` is allowed inside core, dollars cross the public boundary only as `Money`).
- Whether bank affordability also returns the front-end and back-end ratios for a given price (almost certainly yes for the evaluate-scenario path, D-06).

### Deferred Ideas (OUT OF SCOPE)
- Actual FI-date shift / net-worth trajectory / no-purchase baseline / N-scenario ranking / sensitivity bands / retirement-model oracle reconciliation — **Phase 4**.
- Bank "stress/qualifying rate" (qualify above the note rate) — deferred refinement; Phase 3 qualifies at the scenario's `annualRate` (D-16).
- Itemized debt list — Phase 3 uses a single existing-monthly-debt total (D-10).
- Persistence of the household/profile + scenarios — **Phase 6**; Phase 3 only defines the interface-only `household` shape (D-09).
- ARM / variable-rate qualification — fixed-rate only (inherited Phase 2 D-16).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AFF-01 | Tool computes bank affordability (max approvable loan) from configurable front-end (~28%) and back-end (~36%) DTI ratios, factoring existing debts | DTI definitions (§Architecture Patterns Pattern 1), the two-numerator split (D-14), and the max-loan→max-price solve (Pattern 2). Thresholds already first-class in `assumptions.dti.frontEnd`/`backEnd`. Worked-example fixtures (§Validation Architecture). |
| AFF-02 | Tool computes true affordability — the price that fits the household's target savings rate without pushing the FI date past its threshold | Savings-rate-floor model (Pattern 3, D-01..D-04), incremental savings drain (D-03), cash-on-hand gate (D-05). FI-date projection is explicitly OUT (Phase 4) — the savings-rate floor is the AFF-02 proxy. |
| AFF-03 | Tool surfaces the gap between bank affordability and true affordability | Gap result object with both ceilings, signed gap, binding constraints, and directional verdict enum (Pattern 4, D-12/D-13). |
</phase_requirements>

## Summary

Phase 3 is a **pure-math, zero-new-dependency** phase. Everything is new pure functions and a new Zod-validated input block inside `@house/core`, all composed from primitives that already exist and are battle-tested: `computeTco`/`TcoBreakdown`, the amortization `scheduledPayment`, the closed `Money` API, the internal `Dec`, the `ScenarioInputs` Zod pattern, and the `canonicalJson` golden-master harness. There is nothing to install and nothing to look up externally — the only domain knowledge needed is the precise definition of front-end vs back-end DTI (verified below against CFPB/Fannie Mae conventions and the project's own Pitfall 4) and a sound max-price solve mechanism.

The single highest-risk correctness item is the **two-numerator split (D-14)**, and it is subtle precisely because both numerators derive from the same `TcoBreakdown` but pick *different line subsets*. The **lender DTI carrying cost** = `principalAndInterest + propertyTax + insurance + pmi + hoa` (PITI + HOA + PMI; **excludes `maintenance` and `amortizedClosing`**). The **household cash savings drain** = `total − amortizedClosing` (i.e. it KEEPS `maintenance` and excludes only the t=0 closing lump, exactly mirroring `rentVsBuy`'s `buyMonthlyOutflowAt`). Confusing these — e.g. putting maintenance in the DTI numerator, or including amortized closing in either — is the classic "looks done but isn't" DTI failure (Pitfall 4) and must be pinned by hand-verified worked-example fixtures.

The second design pillar is the **max-price solver (D-08)**. Because the down payment is a fixed dollar amount (D-07), `downPaymentPct = downPaymentCash / price` *shrinks* as price grows, so LTV and PMI rise with price and the housing carrying cost is monotonically increasing but mildly non-linear (PMI turns on at a kink near price ≈ 5× the cash). This non-linearity rules out a clean closed form for the binding (back-end, or front-end, or savings-floor) constraint and makes **monotonic binary search over price** the correct, simple, fully-deterministic mechanism, converging to the cent.

**Primary recommendation:** Add a new `affordability/` module under `packages/core/src/`, a new `household` block + Zod schema + `parseHousehold` loader on `engine-input.ts`, four explicitly-named derivations/functions (lender DTI numerator, cash savings drain, bank max-price solve, true max-price solve) plus a gap composer, and pin every definition with hand-verified worked-example fixtures and a golden-master snapshot — reusing every existing primitive, widening **no** public API except the new affordability + household exports, and keeping all ratio/solve math in the internal `Dec`.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Front-end / back-end DTI ratio computation | Calc core (`@house/core`) | — | Pure financial math; zero framework deps (CORE-01). Reuses `computeTco`. |
| Max approvable loan → max price solve | Calc core | — | Pure iterative solve over `computeTco`; deterministic, testable in isolation. |
| Savings-rate-floor true affordability | Calc core | — | Pure cash math from TCO lines + household facts. |
| Cash-on-hand gate (DP + closing ≤ NW − reserve) | Calc core | — | Pure comparison; reuses `closingCosts`. |
| Gap composition + directional verdict | Calc core | — | Pure result assembly. |
| Household/profile input contract (Zod boundary) | Calc core (boundary validation) | Persistence (Phase 6) | Validated at assembly here; *persisted* later. Interface-only in Phase 3. |
| Surfacing affordability/gap to the user | Web shell (Phase 7) | — | Out of scope; Phase 3 emits structured results only (verdict enum, not UI copy — D-13). |

All Phase 3 work lands in the **calc core tier**. There is no UI, DB, or network tier touched. This is a pure-functions phase.

## Standard Stack

No new packages. Phase 3 is built entirely from the existing, already-installed core stack.

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| decimal.js (via internal `Dec`) | 10.6.x (installed) | Ratio/solve/comparison math inside the core | Already the project's only core runtime dep; `Dec` is the frozen 34-digit HALF_EVEN clone (`money/decimal-config.ts`). [VERIFIED: codebase grep] |
| zod | 4.4.x (installed) | Boundary validation of the new `household` block (`.strict()`, decStr leaves) | The established trust-boundary tool (`ScenarioInputsSchema`, `AssumptionSetSchema`). [VERIFIED: codebase grep] |
| vitest | 4.1.x (installed) | Unit tests, type-tests, golden-master | The project test runner; `projects` config, core runs in `node` env. [VERIFIED: codebase grep — `packages/core/vitest.config.ts`] |

### Supporting (existing internal modules consumed, not installed)
| Module | Path | Purpose | When to Use |
|--------|------|---------|-------------|
| `computeTco` / `TcoBreakdown` | `tco/tco.ts` | The carrying-cost source; per-trial-price housing cost | Every DTI and savings-drain computation drives this with a per-trial-price `EngineInput`. |
| `Money` | `money/money.ts` | Public dollar type at the affordability-result boundary | Result fields that are dollars cross the boundary as `Money`. |
| `Dec` | `money/decimal-config.ts` | Internal full-precision math | Solve/ratio/comparison math; never re-exported. |
| `closingCosts` | `tco/closing-costs.ts` | One-time closing lump for the cash-on-hand gate (D-05) | Cash-gate = DP + `closingCosts(price, rateOfPrice, override)` ≤ NW − reserve. |
| `engineInput` / `ScenarioInputsSchema` / `parseScenarioInputs` | `engine/engine-input.ts` | Pattern to copy for the new `household` block + loader; per-trial-price input assembly | `engineInput()` validates `household` at assembly mirroring `scenario` (D-09). |
| `canonicalJson` | `serialize/canonical-json.ts` | Golden-master serialization of affordability/gap results | Reproducibility fixtures (Pitfall 11). |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Binary search over price (D-08) | Closed-form algebraic inversion | Closed form is exact and fast but breaks at the PMI kink (PMI ∝ loan turns on at LTV > 80%, a piecewise discontinuity) and at the property-tax mill-rate resolution — you'd have to solve two segments and detect which is binding. Binary search is one monotonic loop, trivially correct, converges to the cent. **Use binary search.** Reserve closed-form only if profiling ever shows it matters (it won't for a 2-user tool). |
| Widening the `Money` API with `div`/comparison | Use internal `Dec` for solve math | The Phase 2 precedent (`rentVsBuy`, `amortization`) keeps `Dec` internal and the `Money` API closed (no public `div`/`pow`/comparison). **Keep the `Money` API closed**; do ratios and price comparisons in `Dec`, cross to `Money` only at result boundaries. Widening `Money` would re-open a surface every downstream phase must respect forever. |

**Installation:**
```bash
# Nothing to install — Phase 3 adds only source files to packages/core.
```

## Package Legitimacy Audit

**Not applicable.** Phase 3 installs **no external packages**. All dependencies (`decimal.js`, `zod`, `vitest`) were vetted and installed in Phases 1–2 and are pinned in the existing lockfile. No registry lookups, no new supply-chain surface. slopcheck gate is moot (zero new packages).

| Package | Registry | Disposition |
|---------|----------|-------------|
| *(none — no new packages)* | — | N/A |

## Architecture Patterns

### System Architecture Diagram

```
                          EngineInput  { asOf, assumptions, household(NEW), scenario }
                                 │
            ┌────────────────────┼─────────────────────────────────────────┐
            │                    │                                          │
            ▼                    ▼                                          ▼
   household facts        assumptions.dti                            scenario (priced)
 (grossIncome, debts,   (frontEnd 0.28,                             OR per-trial price
  targetSavingsRate,     backEnd 0.36)                                     │
  netWorth, currentRent,       │                                          ▼
  downPaymentCash, reserve)    │                                    computeTco(input)
            │                  │                                          │
            │                  │                              ┌───────────┴───────────┐
            │                  │                              ▼                       ▼
            │                  │                  lenderDtiCarryingCost        cashSavingsDrain
            │                  │                  = P+I + tax + ins            = total − amortizedClosing
            │                  │                    + pmi + hoa                  (KEEPS maintenance)
            │                  │                  (EXCLUDES maint +                    │ (D-14)
            │                  │                   amortizedClosing) (D-14)            │
            ▼                  ▼                              │                       ▼
   ┌──────────────────────────────────┐                      ▼            savingsDrain = drain − currentRent (D-03)
   │  BANK AFFORDABILITY (AFF-01)      │           frontEndRatio = numer/grossMo       │
   │  binary-search max price s.t.     │◄──────────  backEndRatio = (numer+debts)/grossMo
   │  frontEndRatio ≤ 0.28 AND          │                                              │
   │  backEndRatio ≤ 0.36              │                                              ▼
   │  → bankMaxPrice, bindingRatio,    │                           ┌──────────────────────────────────┐
   │    frontEndRatio, backEndRatio    │                           │  TRUE AFFORDABILITY (AFF-02)       │
   └──────────────────────────────────┘                           │  ceilingA: binary-search max price │
                       │                                           │   s.t. (annualSavings/grossInc)    │
                       │                                           │        ≥ targetSavingsRate         │
                       │                                           │  ceilingB: cash gate — max price s.t│
                       │                                           │   DP + closing ≤ NW − reserve (D-05)│
                       │                                           │  trueMaxPrice = min(A, B)          │
                       │                                           │  → bindingConstraint (floor|cash)  │
                       │                                           └──────────────────────────────────┘
                       │                                                           │
                       └───────────────────────────┬───────────────────────────────┘
                                                    ▼
                                    ┌────────────────────────────────────┐
                                    │  THE GAP (AFF-03)                   │
                                    │  bankMaxPrice, trueMaxPrice,        │
                                    │  signedGap = bank − true,           │
                                    │  bank bindingRatio, true bindingConstraint,
                                    │  verdict ∈ {bankExceedsTrue,        │
                                    │   trueExceedsBank, aligned} (D-13)  │
                                    └────────────────────────────────────┘

  Per-scenario EVALUATE path (D-06): take a priced ScenarioInputs, run computeTco once,
  report { frontEndRatio, backEndRatio, frontEndPass, backEndPass, savingsRateImpact, headroom }.
```

### Recommended Project Structure
```
packages/core/src/
├── affordability/                  # NEW module
│   ├── dti.ts                      # lenderDtiCarryingCost + front/back ratio fns (D-14, AFF-01)
│   ├── dti.test.ts                 # worked-example front/back fixtures (Pitfall 4)
│   ├── bank-affordability.ts       # max-price binary search over DTI (AFF-01)
│   ├── bank-affordability.test.ts
│   ├── true-affordability.ts       # savings-rate floor + cash-on-hand gate (AFF-02, D-01..D-05)
│   ├── true-affordability.test.ts
│   ├── gap.ts                      # gap composer + directional verdict enum (AFF-03, D-12/D-13)
│   ├── gap.test.ts
│   ├── evaluate-scenario.ts        # per-scenario DTI + savings-impact path (D-06)
│   ├── evaluate-scenario.test.ts
│   └── affordability.type-test.ts  # no-bare-number guard on the result shapes (mirror tco.type-test.ts)
├── engine/
│   ├── engine-input.ts             # EXTEND: add `household` block + HouseholdSchema + parseHousehold
│   ├── engine-input.test.ts        # EXTEND: household validation cases
│   └── engine-input.type-test.ts   # EXTEND: household shape guard
├── __fixtures__/
│   └── affordability-golden-snapshot.json   # NEW golden master (reproducibility)
└── index.ts                        # EXTEND: export the new affordability + household surface
```

### Pattern 1: Front-end vs Back-end DTI (the gating correctness pattern — D-14, Pitfall 4)

**What:** Two explicitly-named, separately-tested ratio functions over a fixed denominator (gross **monthly** income) and a precisely-defined numerator.

**Definitions (VERIFIED against Pitfall 4 + standard CFPB/Fannie conventions):**
- **Gross income, never net.** Denominator = `grossMonthlyIncome` (derive from annual ÷ 12 in `Dec` if income is stored annual).
- **Front-end (housing) ratio** = `lenderDtiCarryingCost / grossMonthlyIncome`, gated by `assumptions.dti.frontEnd` (0.28).
- **Back-end (total debt) ratio** = `(lenderDtiCarryingCost + existingMonthlyDebt) / grossMonthlyIncome`, gated by `assumptions.dti.backEnd` (0.36).
- `existingMonthlyDebt` is the **single monthly minimum-obligations total** (D-10) — NOT balances.
- **`lenderDtiCarryingCost` = `tco.principalAndInterest.monthly + tco.propertyTax.monthly + tco.insurance.monthly + tco.pmi.monthly + tco.hoa.monthly`.** This is PITI + HOA + PMI. It **EXCLUDES `tco.maintenance.monthly`** (not a lender input) and **EXCLUDES `tco.amortizedClosing.monthly`** (a t=0 lump, D-14). Do NOT use `tco.total`.

**When to use:** The evaluate-scenario path (D-06) reports both ratios + pass/fail at a fixed price; the bank max-price solve uses the *binding* ratio as its constraint.

**Example (shape — derive from existing `TcoBreakdown`):**
```typescript
// Source: derived from packages/core/src/tco/tco.ts TcoBreakdown + Pitfall 4 (verified)
// All math in Dec; dollars cross to Money only at result boundaries.
function lenderDtiCarryingCost(tco: TcoBreakdown): Money {
  // PITI + HOA + PMI. EXCLUDES maintenance and amortizedClosing (D-14).
  return tco.principalAndInterest.monthly
    .add(tco.propertyTax.monthly)
    .add(tco.insurance.monthly)
    .add(tco.pmi.monthly)
    .add(tco.hoa.monthly);
}
// frontEndRatio = lenderDtiCarryingCost / grossMonthlyIncome   (computed in Dec)
// backEndRatio  = (lenderDtiCarryingCost + existingMonthlyDebt) / grossMonthlyIncome
```

### Pattern 2: Max-price binary search over the binding DTI ceiling (D-08, AFF-01)

**What:** A monotonic binary search over trial price. At each trial price: derive `downPaymentPct = downPaymentCash / price` (in `Dec`), build an `EngineInput` with that scenario, run `computeTco`, compute the two DTI ratios, and check both pass. The carrying cost is **monotonically increasing in price** (P+I ∝ loan ∝ price; tax ∝ assessed ∝ price; PMI ∝ loan and turns on as LTV rises with price; insurance/HOA flat), so both ratios are monotonic in price and binary search is sound.

**When to use:** Bank affordability's primary output (D-06). The native "max approvable loan" framing (SC1) is recovered as `bankMaxLoan = bankMaxPrice − downPaymentCash`.

**Mechanism notes:**
- **Bounds:** low = `downPaymentCash` (price can't be below the cash you put down for a sane LTV; or low = 0). high = an upper bound that surely fails — start at, e.g., `downPaymentCash + grossAnnualIncome × someMultiple` and **double until the ratio fails** (exponential bracketing) so you never hard-code a ceiling.
- **Convergence tolerance:** iterate until `high − low ≤ $0.01` (one cent), consistent with the `Money` rounding boundary. ~ceil(log2(range/0.01)) iterations — for a $10M range that's ~30 iterations, each one `computeTco` call. Trivial cost.
- **Binding ratio:** at the solved price, report which of front/back is the active constraint (the one whose ratio is at/nearest its threshold).
- **Determinism:** the loop reads only its inputs; no clock, no randomness — safe inside the determinism-guarded core.
- **`downPaymentPct` bound:** `ScenarioInputsSchema` constrains `downPaymentPct` to `[0,1)`. As price → `downPaymentCash`, pct → 1 (excluded). Keep the search's low bound strictly above `downPaymentCash` (e.g. `downPaymentCash + ε` or a small floor) so the per-trial `engineInput()` never throws on `pct ≥ 1`.

### Pattern 3: Savings-rate floor + cash-on-hand gate (AFF-02, D-01..D-05)

**What:** Two ceilings; true affordability is their `min` (D-05).

**Ceiling A — savings-rate floor:**
- Annual savings at a trial price = `(after-tax-or-gross savings capacity) − annualHousingPremium`, where the housing premium (D-03) is **incremental**: `(cashSavingsDrain_monthly − currentRent_monthly) × 12`.
- `cashSavingsDrain` = `tco.total − tco.amortizedClosing` (KEEPS maintenance, excludes the t=0 closing lump — exactly `rentVsBuy`'s `buyMonthlyOutflowAt` convention; principal counts as cash out per D-03).
- The floor: `annualSavings / grossAnnualIncome ≥ targetSavingsRate` (D-04). Savings rate denominator is **gross** (D-04). Note `tax.effectiveIncomeRate` may be used to derive the *baseline* savings capacity (after-tax cash available to save), but the rate is taken against gross.
- Binary-search the max price at which the floor still holds (savings ↓ as price ↑, so monotonic).

**Ceiling B — cash-on-hand gate (D-05):**
- `downPaymentCash + closingCosts(price, closing.rateOfPrice, override) ≤ availableInvestableNetWorth − reserve`.
- Because closing costs grow with price (∝ rateOfPrice unless overridden), the max price under this gate is the price at which the inequality binds. With a percent-of-price closing cost this is closed-form (`closing = price × rateOfPrice`), but binary search is consistent with Ceiling A and handles the dollar-override case uniformly. **Recommend binary search for both, sharing one solver.**

**Reserve default (Claude's discretion, D-05) — RECOMMENDATION:** Default the reserve to a **6-month emergency-fund buffer expressed as a configurable dollar field on the household block**, OR — to avoid coupling to monthly-expense data the household block doesn't carry — a **conservative flat default of `$50,000`** documented as `[ASSUMED]`, overridable. Since the reserve is a household *lever* (D-10 lists "reserve" among household fields), the cleanest design is: **reserve is a household field (decStr dollars) with no engine-side default**; the *loader/UI* may default it, but the core consumes whatever the household supplies. This keeps the core pure and assumption-free for this value. (If a default must live somewhere, put it in the household-construction helper, not in the solver.)

### Pattern 4: The gap + directional verdict (AFF-03, D-12/D-13)

**What:** A composer that runs bank + true affordability and assembles a rich result.

**Result fields (D-12):** `bankMaxPrice`, `trueMaxPrice`, `signedGap = bankMaxPrice − trueMaxPrice`, `bankBindingRatio ∈ {frontEnd, backEnd}`, `trueBindingConstraint ∈ {savingsFloor, cashOnHand}`, and `verdict`.

**Verdict enum (D-13) — compared on max PRICE:**
```typescript
// Source: D-13 (CONTEXT.md)
type AffordabilityVerdict =
  | 'bankExceedsTrue'   // bank > true: "the bank will lend beyond your FI tolerance" (anti-funnel, common)
  | 'trueExceedsBank'   // true > bank: "your FI plan supports more than the bank will lend" (cash-rich)
  | 'aligned';          // roughly equal within a documented tolerance
```
"roughly equal" needs a defined tolerance — recommend a small absolute band (e.g. within $1,000) OR within a small relative fraction; document the chosen rule. The verdict is a **structured enum**, not UI copy (Phase 7 owns wording).

### Anti-Patterns to Avoid
- **Using `tco.total` as the DTI numerator.** It includes maintenance (not a lender input) AND amortized closing (a t=0 lump). Must be the explicit `lenderDtiCarryingCost` subset (D-14).
- **Using net income in the DTI denominator.** Always gross (D-04, Pitfall 4).
- **Back-end using debt balances instead of minimum monthly obligations** (D-10, Pitfall 4).
- **Including `amortizedClosing` in the savings drain.** Closing is a t=0 lump handled by the cash-on-hand gate, not a recurring drain (D-14).
- **Re-deriving a separate payment formula in the affordability module.** Reuse `computeTco` / `scheduledPayment` — never recompute amortization (Pitfall 4 "reuse the same TCO components").
- **Closed-form solve that ignores the PMI kink.** The PMI step (LTV > 80%) makes the carrying cost piecewise; a naive closed form will be wrong near the kink. Binary search avoids this entirely.
- **Reading `Date.now()` / module globals in the solver.** The determinism guard throws; `asOf` is threaded via `EngineInput`.
- **Adding household facts to the `AssumptionSet`.** Household facts are NOT assumptions (D-09) — they live on the new `household` block. DTI thresholds, however, ARE assumptions and stay in `assumptions.dti`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Monthly carrying cost at a trial price | A new PITI calculator | `computeTco(engineInput({...}))` per trial price | `computeTco` already composes P+I, tax (mill-rate), insurance, maintenance, HOA, PMI (78/80 original-value basis) correctly to the cent. Re-deriving invites Pitfalls 2, 3, 4. |
| Amortized monthly P+I | A new closed-form payment | `tco.principalAndInterest.monthly` (or `scheduledPayment`) | Reconciled, zero-balance-proven, oracle-verified in Phase 2. |
| Decimal ratio / division / comparison | Bare `number` math or widening `Money` | Internal `Dec` (`money/decimal-config.ts`) | The closed `Money` API has no `div`/comparison by design; `Dec` is the sanctioned internal tool (Phase 2 precedent). Bare floats are forbidden (Pitfall 1, CORE-02). |
| Boundary validation of household JSON | Hand-written type guards | A `.strict()` Zod `HouseholdSchema` + `parseHousehold` | Mirrors `ScenarioInputsSchema`; rejects forged/extra fields, enforces decStr leaves (T-07 pattern). |
| One-time closing lump for the cash gate | A new closing-cost calc | `closingCosts(price, assumptions.closing.rateOfPrice, override)` | Already handles %-of-price + dollar override (D-12). |
| Reproducibility serialization | A custom serializer | `canonicalJson` | Float-free, sorted-key, the established golden-master substrate (Pitfall 11). |

**Key insight:** Phase 3 is almost entirely *composition* of proven Phase 1/2 primitives. The only genuinely new math is (a) two ratio formulas, (b) two monotonic binary searches, and (c) one gap comparison. Every dollar figure they touch should originate from `computeTco`, never a re-derived formula.

## Runtime State Inventory

*(Greenfield additive phase — no rename/refactor/migration. Section included only to record that the one structural change to an existing type was checked.)*

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — no persistence exists yet (Phase 6). The `household` block is interface-only / not persisted in Phase 3 (D-09). | None. |
| Live service config | None — pure library, no services. | None. |
| OS-registered state | None. | None. |
| Secrets/env vars | None new. (`UPDATE_GOLDEN` env is the only env read, scoped to `golden.test.ts` — a new affordability golden would extend that same harness, not add a new env.) | None. |
| Build artifacts | `EngineInput` gains a `household` field — every existing `engineInput({...})` call site (golden.test.ts `fixedInput`, tests) and the round-trip in `golden.test.ts` must be updated to pass a `household`. **The existing TCO golden snapshot is unaffected** (TCO reads only `scenario`/`assumptions`), but the round-trip serializer `roundTrip()` serializes `{asOf, assumptions, scenario}` — it must add `household` and parse it back through `parseHousehold` to stay lossless. | Update `engineInput` callers + `golden.test.ts` round-trip to include `household`. |

**Critical compatibility note:** Adding a **required** `household` field to `EngineInput` is a breaking change to the `engineInput()` factory signature. `computeTco` and `rentVsBuy` do NOT read `household`, so their behavior is unchanged, but **every call site that constructs an `EngineInput` must now supply a `household`** (the golden test's `fixedInput()`, all TCO/rent-vs-buy tests that build inputs). The planner must include a task to update these call sites, and the existing `tco-golden-snapshot.json` should remain byte-identical (verify with `UPDATE_GOLDEN` producing no diff). Consider whether `household` should be **optional on `EngineInput`** (so TCO-only callers don't need it) but **required by the affordability functions** — this minimizes churn and is the lower-risk choice. Recommend: make `household` **optional on `EngineInput`/`engineInput()`**, and have the affordability entry points require/validate its presence. Document this decision for the planner.

## Common Pitfalls

### Pitfall 1: The two numerators silently merged (the D-14 trap)
**What goes wrong:** Using `tco.total` (or `total − amortizedClosing`) for the DTI numerator pulls maintenance into a lender ratio where it doesn't belong; or excluding maintenance from the savings drain where it DOES belong.
**Why it happens:** Both numerators derive from the same `TcoBreakdown`, so it's tempting to compute one and reuse it.
**How to avoid:** Two **separately-named functions** (`lenderDtiCarryingCost`, `cashSavingsDrain`) with documented line subsets, each pinned by its own worked-example fixture. (CONTEXT.md "two numerators are a feature, not a bug.")
**Warning signs:** Front-end ratio includes maintenance; savings drain equals the DTI numerator; either uses `tco.total` directly.

### Pitfall 2: Net vs gross income in the DTI denominator
**What goes wrong:** Using take-home pay inflates ratios and under-reports affordability.
**How to avoid:** Name the field `grossIncome` / `grossMonthlyIncome`; document gross everywhere (Pitfall 4). Note `tax.effectiveIncomeRate` is used ONLY to derive the *savings amount*, never to net-down the DTI denominator.
**Warning signs:** A `× (1 − taxRate)` anywhere near the DTI denominator.

### Pitfall 3: `downPaymentPct` boundary blow-up in the solver
**What goes wrong:** As trial price approaches `downPaymentCash`, `downPaymentPct = cash/price` → 1, and `ScenarioInputsSchema` rejects `pct ≥ 1`, throwing mid-solve.
**How to avoid:** Keep the binary-search low bound strictly above `downPaymentCash` (so `pct < 1` always). Also guard price = 0.
**Warning signs:** Zod `downPaymentPct must be in [0,1)` errors during a solve.

### Pitfall 4: Non-monotonic assumption breaking binary search
**What goes wrong:** Binary search requires the constraint to be monotonic in price. PMI turning on at the LTV>80% kink is a *step up* in cost — still monotonically non-decreasing, so search is safe — but if any future term *decreased* the cost as price rose, search would break.
**How to avoid:** Document and test monotonicity (the ratio at a higher price is ≥ the ratio at a lower price across the PMI kink). Add a fixture spanning the PMI-on/off boundary (price just below vs just above 5× the cash).
**Warning signs:** A solved price that fails its own constraint; flaky convergence.

### Pitfall 5: Reproducibility regression on the widened `EngineInput`
**What goes wrong:** Adding `household` to the serialized snapshot without round-tripping it through `parseHousehold` breaks the lossless round-trip guarantee (Pitfall 11).
**How to avoid:** Extend `golden.test.ts roundTrip()` to serialize + re-parse `household`; add an affordability golden snapshot via the same `UPDATE_GOLDEN`-gated harness (never `toMatchSnapshot`).
**Warning signs:** Round-trip test drift; a golden auto-blessed.

### Pitfall 6: Anti-funnel direction unreachable
**What goes wrong:** If the gap can never report `bankExceedsTrue`, the product's core thesis is unprovable.
**How to avoid:** Include a realistic worked example where `bankMaxPrice > trueMaxPrice` (the common case for a conservative saver) and assert `verdict === 'bankExceedsTrue'` — mirrors Phase 2's anti-funnel acceptance check (rent-wins fixture).
**Warning signs:** No test exercises the `bankExceedsTrue` branch.

## Code Examples

### Per-trial-price EngineInput assembly (the solver's inner loop)
```typescript
// Source: derived from engine/engine-input.ts + tco/tco.ts (verified codebase pattern)
// downPaymentPct = downPaymentCash / price, derived in Dec (D-07/D-08).
function inputAtPrice(base: EngineInput, price: string): EngineInput {
  const pct = new Dec(base.household!.downPaymentCash).div(new Dec(price)).toFixed();
  return engineInput({
    asOf: base.asOf,
    assumptions: base.assumptions,
    household: base.household,           // carried through (optional-on-input recommendation)
    scenario: { ...base.scenario, price, downPaymentPct: pct },
  });
}
// then: const tco = computeTco(inputAtPrice(base, trialPrice));
```

### Monotonic binary search to the cent (the solve skeleton)
```typescript
// Source: standard monotonic bisection; tolerance pinned to the Money cent boundary (D-08).
// `passes(price)` returns true when ALL active constraints hold at that price.
function maxPriceWhere(passes: (price: string) => boolean, lowStr: string, seedHigh: string): Money {
  let low = new Dec(lowStr);
  let high = new Dec(seedHigh);
  // Exponential bracketing: grow `high` until it fails (no hard-coded ceiling).
  while (passes(high.toFixed())) high = high.times(2);
  const CENT = new Dec('0.01');
  while (high.minus(low).greaterThan(CENT)) {
    const mid = low.plus(high).div(2);
    if (passes(mid.toFixed())) low = mid; else high = mid;
  }
  return Money.of(low.toDecimalPlaces(2, Dec.ROUND_HALF_EVEN).toFixed());
}
```

### Household Zod schema (mirror ScenarioInputsSchema — D-09)
```typescript
// Source: derived from engine/engine-input.ts ScenarioInputsSchema (verified pattern)
export const HouseholdSchema = z
  .object({
    grossAnnualIncome: decStr,        // gross — DTI denominator (÷12 for monthly) + savings denom (D-04)
    existingMonthlyDebt: decStr,      // single monthly minimum-obligations total (D-10)
    targetSavingsRate: decStr,        // vs gross (D-02/D-04), in [0,1)
    availableNetWorth: decStr,        // investable NW for the cash-on-hand gate (D-05)
    currentRent: decStr,              // household-level monthly rent (D-11) — distinct from scenario.monthlyRent
    downPaymentCash: decStr,          // fixed dollar down payment (D-07)
    reserve: decStr,                  // cash buffer subtracted in the gate (D-05)
  })
  .strict();
export function parseHousehold(input: unknown): Household {
  return HouseholdSchema.parse(input) as Household;
}
// Add refine guards as needed (e.g. targetSavingsRate in [0,1), like downPaymentPct).
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| "28/36 rule" as folk wisdom | Configurable `assumptions.dti.frontEnd`/`backEnd`, gated per-ratio | Standing project convention (ASMP-01) | Thresholds are already first-class data; Phase 3 only *consumes* them. |
| Single "DTI" number | Explicit front-end (housing) vs back-end (total debt) split | Standard mortgage convention (CFPB/Fannie) | Two named functions; binding ceiling = lower of the two. |
| Affordability = "what the bank lends" | Lead with *true affordability*, surface bank as the gap | Project anti-funnel thesis | The gap + directional verdict is a first-class output (D-12/D-13). |

**Deprecated/outdated:** Nothing in the existing core is deprecated for this phase. The `dti.frontEnd`/`dti.backEnd`/`tax.effectiveIncomeRate` assumption slices already exist (added Phase 1, carried to V2) and are consumed as-is.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Recommended reserve handling: `reserve` is a household-supplied decStr field (no engine default), with any default living in a loader/UI helper. | Pattern 3 (D-05 discretion) | Low — pure design choice; if the user wants a hard default, it's a one-line change in a helper, not the solver. |
| A2 | Recommended `aligned` tolerance for the verdict: a small absolute band (~$1,000) or small relative fraction (document the chosen rule). | Pattern 4 (D-13 discretion) | Low — cosmetic threshold; affects only the boundary between `aligned` and the directional verdicts. Pin with a fixture. |
| A3 | Recommendation to make `household` **optional** on `EngineInput`/`engineInput()` and required by the affordability entry points, to minimize call-site churn and keep the TCO golden byte-identical. | Runtime State Inventory | Medium — if the planner instead makes it required, every `engineInput()` call site (incl. tests) must be updated in the same wave; both are viable, but the optional path is lower-risk. Confirm with the planner. |
| A4 | Front-end ratio is gated by `dti.frontEnd` and back-end by `dti.backEnd`, with the binding bank ceiling = the lower-price of the two. | Pattern 1/2 (D-14, AFF-01) | Low — this is the standard 28/36 mapping verified against Pitfall 4; mis-mapping would invert which constraint binds. Pinned by worked-example fixtures. |
| A5 | The savings *capacity* baseline (the pre-housing annual savings the floor is measured against) is derived from gross income and `tax.effectiveIncomeRate`; the exact baseline formula (e.g. after-tax income − current rent − existing debt − a living-cost figure?) is **under-specified by CONTEXT.md** — see Open Question 1. | Pattern 3 (D-03/D-04) | **High** — the definition of "annual savings at a trial price" determines the entire true-affordability number. Must be resolved before planning the true-affordability task. |

## Open Questions

1. **What is the household's baseline annual savings capacity that the floor is measured against?**
   - What we know: D-03 says the *drain* is incremental (`TCO total − current rent`); D-04 says savings rate = annual savings ÷ gross income, with `tax.effectiveIncomeRate` available to derive after-tax cash.
   - What's unclear: The household block (D-10) carries gross income, existing monthly debt, current rent, net worth, down-payment cash, reserve, and target savings rate — but **not** a "current annual savings" or "living expenses" figure. So "annual savings at a trial price" must be *computed*. The natural reading is: `annualSavings(price) = afterTaxIncome − annualExistingDebt − annualCurrentRent − annualHousingPremium − (living costs?)`. But there is **no living-costs field**, so either (a) the floor compares the *change* in savings (premium) against a target, or (b) the target savings rate is interpreted as "the housing premium must not push savings below `targetSavingsRate × grossIncome`", which requires knowing baseline savings.
   - Recommendation: **Interpret the floor as: the household currently achieves (or wants to maintain) `targetSavingsRate × grossIncome` in annual savings; buying reduces that by the annual housing premium (D-03); the max price is where post-purchase savings rate first drops below `targetSavingsRate`.** This needs the *current/baseline* savings to be either supplied or assumed equal to `targetSavingsRate × grossIncome` at the no-purchase baseline. **Flag this for the planner / a discuss-phase clarification** — it is the one genuinely ambiguous definitional choice in Phase 3. The cleanest resolution is to add a **`currentAnnualSavings` (or `monthlyLivingExpenses`) field to the household block** so the floor is well-defined; confirm with the user.

2. **Is `household` optional or required on `EngineInput`?** (See Assumption A3.) Recommend optional-on-input, required-by-affordability. Needs a one-line decision.

3. **Verdict `aligned` tolerance** (A2) — pick and document an absolute or relative band.

## Environment Availability

*(Skipped — Phase 3 is a pure code-only change with no external tools, services, runtimes, or new packages. The toolchain — Node, npm, vitest, tsc — was established and verified in Phases 1–2.)*

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.x (installed), core project runs in `node` env with the determinism guard setup file |
| Config file | `packages/core/vitest.config.ts` (merges `vitest.shared.ts`; `setupFiles: ['./src/determinism/guard.setup.ts']`) |
| Quick run command | `npm run -w @house/core test -- affordability` (run the new module's tests) — confirm the exact `-w` workspace alias/script name against root `package.json` during Wave 0 |
| Full suite command | `npm test` (root) — runs all Vitest projects |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AFF-01 | Front-end ratio = lenderDtiCarryingCost / grossMonthly, hand-verified | unit (worked example) | `npx vitest run packages/core/src/affordability/dti.test.ts` | ❌ Wave 0 |
| AFF-01 | Back-end ratio = (numer + existingMonthlyDebt) / grossMonthly, hand-verified | unit (worked example) | `npx vitest run packages/core/src/affordability/dti.test.ts` | ❌ Wave 0 |
| AFF-01 | DTI numerator EXCLUDES maintenance + amortizedClosing (D-14) | unit | `npx vitest run packages/core/src/affordability/dti.test.ts` | ❌ Wave 0 |
| AFF-01 | Bank max price: solved price's binding ratio sits at its threshold; max loan = price − cash | unit (solver) | `npx vitest run packages/core/src/affordability/bank-affordability.test.ts` | ❌ Wave 0 |
| AFF-01 | Solver monotonic across the PMI kink (price below vs above ~5× cash) | unit (property) | `npx vitest run packages/core/src/affordability/bank-affordability.test.ts` | ❌ Wave 0 |
| AFF-02 | Savings drain = (total − amortizedClosing) − currentRent (KEEPS maintenance, D-03/D-14) | unit | `npx vitest run packages/core/src/affordability/true-affordability.test.ts` | ❌ Wave 0 |
| AFF-02 | Savings-rate floor: solved price's post-purchase savings rate = target | unit (solver) | `npx vitest run packages/core/src/affordability/true-affordability.test.ts` | ❌ Wave 0 |
| AFF-02 | Cash-on-hand gate: trueMax = min(floor, cash); cash binds when NW − reserve is small (D-05) | unit | `npx vitest run packages/core/src/affordability/true-affordability.test.ts` | ❌ Wave 0 |
| AFF-03 | Gap = bank − true; bindingRatio + bindingConstraint reported (D-12) | unit | `npx vitest run packages/core/src/affordability/gap.test.ts` | ❌ Wave 0 |
| AFF-03 | Verdict enum correct in all three directions, incl. anti-funnel `bankExceedsTrue` (D-13) | unit (acceptance) | `npx vitest run packages/core/src/affordability/gap.test.ts` | ❌ Wave 0 |
| AFF-01/02/03 | Result types carry no bare-number dollar field (Money-only) | type-test | `npm run -w @house/core typecheck` (tsc -b) | ❌ Wave 0 |
| AFF-01/02/03 | Affordability/gap result recomputes cent-identically (reproducibility, Pitfall 11) | golden-master | `npx vitest run packages/core/src/golden.test.ts` | ⚠️ extend existing |
| (boundary) | `household` block: `.strict()` rejects extra keys, decStr leaves, range refines | unit | `npx vitest run packages/core/src/engine/engine-input.test.ts` | ⚠️ extend existing |
| (boundary) | EngineInput round-trip lossless with `household` (serialize→parseHousehold→recompute) | golden round-trip | `npx vitest run packages/core/src/golden.test.ts` | ⚠️ extend existing |

### Sampling Rate
- **Per task commit:** the touched module's test file (e.g. `npx vitest run packages/core/src/affordability/dti.test.ts`).
- **Per wave merge:** `npm run -w @house/core test` (whole core project) + `npm run -w @house/core typecheck` (tsc -b, picks up `*.type-test.ts`).
- **Phase gate:** full suite green (`npm test`) + golden masters unchanged (no `UPDATE_GOLDEN` diff) before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `packages/core/src/affordability/dti.test.ts` — worked-example front/back DTI fixtures (covers AFF-01, Pitfall 4)
- [ ] `packages/core/src/affordability/bank-affordability.test.ts` — solver + monotonicity (AFF-01)
- [ ] `packages/core/src/affordability/true-affordability.test.ts` — floor + cash gate (AFF-02)
- [ ] `packages/core/src/affordability/gap.test.ts` — gap + verdict incl. anti-funnel (AFF-03)
- [ ] `packages/core/src/affordability/affordability.type-test.ts` — no-bare-number guard (mirror `tco.type-test.ts`)
- [ ] `packages/core/src/__fixtures__/affordability-golden-snapshot.json` — reproducibility golden (extend `golden.test.ts`)
- [ ] Extend `packages/core/src/engine/engine-input.test.ts` + `engine-input.type-test.ts` for the `household` block
- [ ] Extend `golden.test.ts roundTrip()` to carry `household` through `parseHousehold`
- [ ] Framework install: none — Vitest 4 already configured.

*Existing test infrastructure (Vitest projects, determinism guard, `*.type-test.ts` in the tsc -b graph, `UPDATE_GOLDEN`-gated golden harness) fully covers Phase 3's needs; only new test files + extensions are required.*

## Security Domain

> `security_enforcement: true`, `security_asvs_level: 1` per `.planning/config.json`. Phase 3 is a pure offline calculation library for a private 2-user tool — no auth, no network, no session, no secrets, no rendering. Most ASVS categories are N/A; the applicable surface is input validation at the trust boundary.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No auth in scope (private tool, no accounts — REQUIREMENTS Out of Scope). |
| V3 Session Management | no | No sessions; pure library. |
| V4 Access Control | no | No multi-tenant / authz. |
| V5 Input Validation | **yes** | The new `household` block is validated by a `.strict()` Zod `HouseholdSchema` with `decStr` leaves + range refines (`targetSavingsRate ∈ [0,1)`), mirroring `ScenarioInputsSchema`. `engineInput()` validates it at assembly; a forged/corrupt snapshot is rejected, not silently computed (the same trust-boundary control as T-07-01..03). Canonical-decimal-string leaves keep non-finite floats/exponent forms out of the math. |
| V6 Cryptography | no | No crypto; no secrets. Never hand-roll any (none needed). |

### Known Threat Patterns for a pure decimal calc core

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Forged/corrupt snapshot smuggling extra fields or non-canonical numbers | Tampering | `.strict()` Zod + `decStr` regex at the `household` boundary; `parseHousehold` is the only entry (mirrors `parseScenarioInputs`). |
| Non-finite / exponent-form / negative values poisoning the solve (e.g. `downPaymentCash` ≥ price → pct ≥ 1, NaN ratios) | Tampering / DoS | `decStr` (`CANONICAL_DECIMAL_RE`) rejects `NaN`/`Infinity`/exponent; range refines + solver low-bound guard (Pitfall 3) prevent pct ≥ 1; guard price = 0 to avoid div-by-zero in `Dec`. |
| Unbounded solve (exponential bracketing never terminating) | DoS | Constraint is monotonic and `computeTco` is finite; bracketing doubles a finite high and the bisection terminates at the cent tolerance — bounded iteration. Add a sanity iteration cap as defense-in-depth. |
| Reproducibility tampering (silently re-blessing a golden) | Tampering | Reuse the `UPDATE_GOLDEN`-gated harness; never `toMatchSnapshot` (the established T-04-01/T-05-15 control). |

No high/critical security findings expected for this phase; the input-validation control is the single relevant ASVS-L1 requirement and is satisfied by copying the existing Zod boundary pattern.

## Sources

### Primary (HIGH confidence)
- `packages/core/src/tco/tco.ts` — `computeTco` / `TcoBreakdown` line names (`principalAndInterest`, `propertyTax`, `insurance`, `maintenance`, `hoa`, `pmi`, `amortizedClosing`, `total`), `pmiApplies`/`pmiDropOffMonth`. [VERIFIED: codebase read]
- `packages/core/src/tco/rent-vs-buy.ts` — `buyMonthlyOutflowAt` precedent for excluding `amortizedClosing`; internal-`Dec`/`Money` discipline. [VERIFIED: codebase read]
- `packages/core/src/engine/engine-input.ts` — `EngineInput`, `ScenarioInputsSchema` (`.strict()`, `decStr`, `downPaymentPct` refine `[0,1)`), `parseScenarioInputs`, `engineInput()` assembly-time validation. [VERIFIED: codebase read]
- `packages/core/src/assumptions/schema.ts` + `defaults.ts` — `dti.frontEnd` ("0.28"), `dti.backEnd` ("0.36"), `tax.effectiveIncomeRate` ("0.27") present in AssumptionsV2. [VERIFIED: codebase read]
- `packages/core/src/money/money.ts` + `decimal-config.ts` — closed `Money` API (no public `div`/comparison/`pow`), internal frozen `Dec` (34-digit HALF_EVEN). [VERIFIED: codebase read]
- `packages/core/src/tco/amortization.ts` / `closing-costs.ts` — `scheduledPayment` (zero-rate guard), `closingCosts` (%-of-price + dollar override). [VERIFIED: codebase read]
- `packages/core/src/golden.test.ts` + `vitest.config.ts` — `UPDATE_GOLDEN`-gated golden harness, `roundTrip()` boundary re-parse, determinism setup. [VERIFIED: codebase read]
- `.planning/research/PITFALLS.md` Pitfall 4 (DTI front/back — gross income, full PITI+HOA+PMI numerator, minimum monthly obligations not balances, label which threshold gates which ratio), Pitfall 1 (float money), Pitfall 11 (reproducibility). [CITED: PITFALLS.md]
- `.planning/phases/03-affordability-engine/03-CONTEXT.md` — D-01..D-16 locked decisions. [CITED: CONTEXT.md]
- `.planning/ROADMAP.md` §Phase 3 — Goal + 3 success criteria; §Phase 4 scope boundary. [CITED: ROADMAP.md]
- `./CLAUDE.md` — prescriptive stack, "no framework deps in core", "no bare number for money". [CITED: CLAUDE.md]

### Secondary (MEDIUM confidence)
- Standard 28/36 front-end/back-end DTI convention (CFPB / Fannie Mae) — corroborates Pitfall 4's definitions; treated as the verified standard the project already encodes in `assumptions.dti`. [CITED: PITFALLS.md sources — CFPB/FDIC]

### Tertiary (LOW confidence)
- None — all claims grounded in codebase reads or the project's own verified pitfalls research.

## Project Constraints (from CLAUDE.md)

The planner must verify every task complies with these binding CLAUDE.md directives:
- **Pure calculation core, zero framework deps:** all Phase 3 code lives in `packages/core`; no `react`/`next`/DOM imports (enforced by the ESLint boundary rule). Core's only runtime dep stays `decimal.js` (+ `zod` at the boundary).
- **No bare `number` for money/rate math:** dollars cross boundaries as `Money` strings; ratio/solve math uses internal `Dec`; never JS `number` for dollars (CORE-02). Enforced by `*.type-test.ts` in the tsc -b graph.
- **No calc logic in React/components** — N/A this phase (no UI), but the affordability results must be plain-data so Phase 7 stays a thin shell.
- **Vitest, not Jest** (already configured).
- **Drizzle/SQLite/persistence** — OUT of scope (Phase 6); the `household` block is interface-only (D-09).
- **Assumptions are first-class data** — DTI thresholds stay in `assumptions.dti`; household *facts* go on the new `household` block, NEVER in the AssumptionSet (D-09).

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages; all primitives verified by codebase read.
- Architecture / patterns: HIGH — DTI definitions verified against Pitfall 4; solver mechanism follows the Phase 2 `Dec`/binary-monotonic precedent; the two-numerator split mapped to exact `TcoBreakdown` line names.
- Pitfalls: HIGH — drawn from the project's own gating PITFALLS.md (Pitfall 4 especially) and verified against the existing `rent-vs-buy.ts` exclusion precedent.
- Open Question 1 (savings baseline): the one MEDIUM/ambiguous item — flagged for planner/user resolution (A5).

**Research date:** 2026-06-26
**Valid until:** 2026-07-26 (stable — pure internal composition; no fast-moving external dependency. The only revalidation trigger is a change to `TcoBreakdown` line names or the `Money`/`Dec` API.)
