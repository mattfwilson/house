# Phase 3: Affordability Engine - Context

**Gathered:** 2026-06-26
**Status:** Ready for planning

<domain>
## Phase Boundary

Answer **"can the bank?"** versus **"what does our retirement allow?"** for a greater-Boston home purchase, and surface the gap between the two as a first-class output (AFF-01, AFF-02, AFF-03).

This phase delivers three things, all in the pure `@house/core`:

1. **Bank affordability** — the max approvable loan/price from configurable front-end (~28%) and back-end (~36%) DTI ratios, using **gross** income and the full PITI+HOA+PMI carrying cost (reusing the Phase 2 TCO components), factoring existing monthly debts. The binding ceiling is the **lower** of the front-end and back-end constraints.
2. **True affordability** — a **savings-rate floor** model: the max price whose housing cost still leaves annual savings at/above a household-supplied target savings rate, AND whose down payment + closing costs fit available cash. **No FI-date projection is built here** — the actual FI-date shift is Phase 4's flagship job.
3. **The gap** — both ceilings, the signed gap (bank − true), the binding constraint on each side, and a directional verdict, compared on **max price**.

**Scope boundary vs Phase 4 (flagship):** Phase 3 produces *static affordability ceilings* from a savings-rate constraint. Phase 4 layers the actual FI-date delta, the no-purchase baseline, N-scenario ranking, sensitivity bands, and oracle reconciliation on top. Phase 3 must NOT rebuild trajectory/net-worth math — it adopts the project-wide all-real convention so Phase 4 inherits it. Phase 3 also introduces the **household/profile input contract** that Phase 6 will persist (interface-only here).

</domain>

<decisions>
## Implementation Decisions

### True Affordability — Definition & Depth
- **D-01:** True affordability is governed by a **savings-rate floor**, NOT a FI-date projection. The full FI-date math (current NW + savings compounded → FI date vs threshold) is deferred to Phase 4. Phase 3 stays pure-affordability and honors AFF-02 by proxy: it preserves the savings rate the household's FI plan already requires.
- **D-02:** The **FI "threshold" is expressed as a target savings rate (or target annual savings) the user supplies** — not a target date or a target FI number. No FI-number/SWR/date math is needed in Phase 3 to evaluate the floor. (Note: `swr.rate` and `returns.realAnnual` remain in the AssumptionSet for Phase 4; Phase 3 does not consume them for true affordability.)
- **D-03:** The **savings drain is incremental: `TCO total monthly − current rent`.** The household is already paying rent (already not-saved), so only the ownership premium reduces savings. Mortgage **principal counts as cash out** of the savings flow in Phase 3 (the equity offset is Phase 4's net-worth job — keep Phase 3 a simple cash measure). Matches the rent-vs-buy delta framing and the anti-funnel baseline.
- **D-04:** **Savings rate is measured against GROSS income** (savings rate = annual savings ÷ gross income). This shares one income input with the DTI denominator (also gross), keeping bank and true affordability consistent. `tax.effectiveIncomeRate` (0.27) is available to derive after-tax cash *for computing the savings amount itself*, but the rate's denominator is gross.
- **D-05:** True affordability is **`min(savings-rate ceiling, cash-on-hand ceiling)`**. The cash-on-hand gate: **down payment + closing costs ≤ available investable net worth − a reserve knob**. This catches "the monthly payment works but you can't fund the down payment." (Reserve default is Claude's discretion — pick a conservative value, e.g. an emergency-fund buffer, and document it.)

### Solve Direction & Down Payment
- **D-06:** Primary output for both ceilings is **solve for the max affordable price** (the product's inverted flow). Bank's native solve is the max approvable **loan** → price = loan + down payment (SC1). **Additionally** provide a per-scenario evaluation path (DTI ratios, pass/fail, headroom, savings-rate impact) that reuses the existing priced `ScenarioInputs` + `computeTco`.
- **D-07:** When solving for max price, the **down payment is a fixed dollar amount** (not a percent). `loan = price − downPaymentCash`, so **LTV (and PMI) rise as price rises** — realistic for a buyer with a set amount of cash, and it ties directly to the cash-on-hand liquidity gate (D-05). PMI engages once price exceeds ~5× the down payment.
- **D-08 (derivation, Claude's discretion on mechanism):** For each trial price the solver derives `downPaymentPct = downPaymentCash / price` and builds an `EngineInput` to reuse `computeTco` unchanged. The solve mechanism (closed-form vs binary search) is Claude's discretion — note property tax (∝ assessed value), maintenance (∝ value), and PMI (∝ loan) scale with price while insurance/HOA are flat, so the housing payment is near-piecewise-linear in price; binary search over price is a safe, simple default.

### Household / Profile Input Contract
- **D-09:** Household financials live in a **new `household` (profile) block on `EngineInput`**, alongside `asOf` / `assumptions` / `scenario`, **Zod-validated at the boundary** exactly like `ScenarioInputs` (decimal-string leaves, `.strict()`, a `parseHousehold` loader). This is clean person-vs-house separation, mirrors PROF-01 (profile) vs PROF-02 (scenario), and is **the exact shape Phase 6 will persist** — but it is **interface-only / not persisted** in Phase 3. Snapshot/reproducibility flows automatically because it's part of the frozen `EngineInput`.
- **D-10:** Household fields (names/exact units are Claude's discretion; dollars as canonical decimal strings, counts as integers): **gross income**, **existing monthly debt obligations as a single monthly total** (back-end DTI uses minimum monthly obligations, not balances), **target savings rate** (decStr, vs gross — D-02/D-04), **available investable net worth** (for the cash-on-hand gate), **current rent** (monthly), and the **down-payment cash** + **reserve** levers for the solve (D-05/D-07). Income annual-vs-monthly is Claude's discretion (DTI needs monthly, savings needs annual — the engine converts).
- **D-11:** **Current rent is a household-level fact**, distinct from `ScenarioInputs.monthlyRent` (which stays as the market rent of the comparable for the Phase 2 rent-vs-buy path). The savings drain (D-03) uses the household current rent.

### The Gap Output
- **D-12:** The gap result reports: **bank max price, true max price, the signed gap (bank − true), AND the binding constraint on each side** — bank: front-end vs back-end DTI; true: savings-rate floor vs cash-on-hand. Richest and most explainable (not just the gap, but *why* each ceiling sits where it does).
- **D-13:** The gap carries a **directional verdict, compared on max PRICE** (bank's max loan + down payment, so both ceilings are apples-to-apples): `bank > true` → "the bank will lend $X beyond your FI tolerance" (the common, anti-funnel case); `true > bank` → "your FI plan supports more than the bank will lend" (cash-rich case); roughly equal → aligned. The verdict is a structured/enum value in the core (presentation wording is Phase 7's; the core surfaces the direction + magnitude, not UI copy).

### Locked Correctness Notes (carried into planning)
- **D-14:** The **DTI housing numerator** and the **savings drain** must use **`tco.total − amortizedClosing`**, never the raw `tco.total`. Closing costs are a t=0 lump, not a monthly carrying cost — including them double-counts. This is the SAME exclusion `rentVsBuy` already makes (`buyMonthlyOutflowAt` excludes the amortized-closing line). Front-end DTI = (P+I + property tax + insurance + maintenance? no — see note) ... specifically the **DTI carrying cost = P+I + property tax + insurance + PMI + HOA** (lender PITI+HOA+PMI; **maintenance is NOT a lender DTI input** — exclude it from the DTI numerator even though it IS in `tco.total`). The savings-drain (D-03), by contrast, is a real cash measure and SHOULD include maintenance (it's real cash you spend). **These two numerators differ — define them as separate, explicitly-named derivations from the TCO lines.**
- **D-15:** **All-real (today's-dollar) convention is inherited** (Phase 2 D-02). DTI ratios are a point-in-time (year-0) calculation; the savings floor is also evaluated in today's dollars. No nominal/real mixing.
- **D-16:** **Fixed-rate only** (inherited Phase 2 D-16). Bank affordability uses the scenario's single nominal `annualRate`. A separate higher "stress/qualifying rate" is a deferred idea (see below).

### Claude's Discretion
- Exact identifiers/field names and units (annual vs monthly) of the new `household`/profile type and its Zod schema; the reserve default value; the result-object shapes for bank affordability, true affordability, the per-scenario evaluation, and the gap.
- The max-price solve mechanism (closed-form vs binary search — D-08) and convergence tolerance (to the cent, consistent with the Money rounding boundary).
- Whether to widen the closed `Money` API with comparison/division helpers or use the internal `Dec` directly inside core for the solve/ratio math (the Phase 2 precedent: `Dec` is allowed inside core, dollars cross the public boundary only as `Money`).
- Whether bank affordability also returns the front-end and back-end ratios for a given price (almost certainly yes for the evaluate-scenario path, D-06).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Stack, Boundary & Existing Primitives (binding)
- `CLAUDE.md` — Prescriptive stack and the "no framework deps in core" rule; `decimal.js`, Vitest 4 `projects`, the "What NOT to Use" list (no bare `number` for money, no calc logic in React).
- `packages/core/src/index.ts` — the `@house/core` public barrel; the stable import boundary. New affordability + household exports land here.
- `packages/core/src/tco/tco.ts` — **`computeTco` / `TcoBreakdown`**: the source of the DTI carrying-cost lines (P+I, propertyTax, insurance, maintenance, hoa, pmi, amortizedClosing, total) and `pmiApplies` / `pmiDropOffMonth`. The header comment explicitly anticipates "Phase 3 reuses PITI+HOA+PMI for DTI." **Note the amortized-closing exclusion (D-14).**
- `packages/core/src/tco/rent-vs-buy.ts` — precedent for excluding amortized-closing from a monthly outflow (`buyMonthlyOutflowAt`) and for the internal-`Dec`/`Money` discipline; do NOT rebuild trajectory math here.
- `packages/core/src/engine/engine-input.ts` — `EngineInput` (`{ asOf, assumptions, scenario }`), `ScenarioInputs` + `ScenarioInputsSchema` + `parseScenarioInputs`. **This is the file the new `household` block + schema + loader extend (D-09); `engineInput()` must validate the household block at assembly, mirroring the scenario.**
- `packages/core/src/assumptions/schema.ts` + `defaults.ts` — `dti.frontEnd` ("0.28"), `dti.backEnd` ("0.36"), `tax.effectiveIncomeRate` ("0.27"), `swr.rate`, `returns.realAnnual`. DTI thresholds are already first-class assumptions (ASMP-01). Household facts are NOT assumptions — do not add them here (D-09).
- `packages/core/src/money/money.ts` — the closed `Money` API (no public `div`/comparison/`pow`; see Claude's Discretion). `packages/core/src/money/decimal-config.ts` — internal frozen `Dec` for ratio/solve math.

### Requirements & Scope
- `.planning/REQUIREMENTS.md` — requirements addressed: **AFF-01, AFF-02, AFF-03**. (Back-end DTI = minimum monthly obligations, not balances.)
- `.planning/ROADMAP.md` §"Phase 3: Affordability Engine" — Goal + 3 success criteria (verbatim acceptance bar). Also §"Phase 4" for the scope boundary referenced in D-01.
- `.planning/PROJECT.md` — core value (anti-funnel; lead with FI/true affordability, show bank as the gap), constraints (pure core), Key Decisions table.

### Correctness Pitfalls (gating)
- `.planning/research/PITFALLS.md` — **Pitfall 4 (DTI front/back definitions — gross income, full PITI+HOA+PMI numerator, minimum-monthly debt obligations, label which ratio each threshold gates)** directly governs bank affordability. Pitfall 1 (float money) and Pitfall 11 (reproducibility) are cross-cutting. The "Looks Done But Isn't" DTI item + the "decision tool → funnel" UX table (lead with FI-impact, conservative defaults) govern the gap framing.

### Prior-Phase Context (binding decisions)
- `.planning/phases/02-tco-engine/02-CONTEXT.md` — TCO substrate decisions, the all-real convention (D-02), the widened `ScenarioInputs`/`AssumptionsV2`, the Phase 2/4 boundary.
- `.planning/phases/01-foundations-determinism-core/01-CONTEXT.md` — Money rounding (HALF_EVEN), full precision until output boundary, determinism guards, versioned AssumptionSet, `EngineInput` as the snapshot unit.

### Background
- `affordability-engine-gsd-brief.md` — original project brief.

No external ADRs/specs beyond the above — implementation decisions are captured in `<decisions>`.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`computeTco` / `TcoBreakdown`** (`tco/tco.ts`) — the DTI carrying-cost source and the per-scenario evaluation engine. Built explicitly to be reused here. Exposes `pmiApplies`/`pmiDropOffMonth` and the seven cents-pinned lines + total.
- **`EngineInput` / `engineInput()` / `ScenarioInputsSchema` / `parseScenarioInputs`** (`engine/engine-input.ts`) — the frozen-snapshot pattern + boundary-validation pattern to copy for the new `household` block.
- **`AssumptionSet`** (`assumptions/*`) — `dti.frontEnd`/`dti.backEnd`/`tax.effectiveIncomeRate` already present; consumed, not extended (no household facts go here).
- **Internal `Dec`** (`money/decimal-config.ts`) — frozen 34-digit HALF_EVEN clone for ratio/solve math (not exported).
- **`canonicalJson` + golden-master harness** — affordability/gap results can be golden-tested for reproducibility (PROF-04 pattern), including DTI worked-example fixtures (Pitfall 4 verification).

### Established Patterns
- Closed-API / no-bare-number discipline (dollars as `Money` strings, rates as `decStr`); determinism guards; type-level `*.type-test.ts` enforcement in the `tsc -b` graph; versioned Zod boundary validation with `.strict()`.
- Two distinct monthly numerators derived from the TCO lines (D-14): lender DTI carrying cost (PITI+HOA+PMI, excludes maintenance + amortized closing) vs cash savings drain (includes maintenance, excludes amortized closing). Name them explicitly; do not reuse `tco.total` blindly.

### Integration Points
- New `household` block on `EngineInput` — consumed by Phase 4 (FI-Impact reads the same profile fields) and persisted by Phase 6 (PROF-01). Signature stability matters; design it as the durable profile shape.
- Affordability + gap results are read by Phase 7's UI (lead with true affordability / the gap, never a buy funnel) and by Phase 4 (the gap and ceilings inform the flagship comparison).

</code_context>

<specifics>
## Specific Ideas

- **"Flight simulator" framing** (PROJECT.md): the gap ("the bank will approve $X beyond your FI tolerance") is an early instrument — it must be honest and reproducible, and the anti-funnel direction must be reachable.
- **Worked-example DTI tests** (Pitfall 4 "Looks Done But Isn't"): include at least one hand-verified front-end and back-end DTI fixture so the definitions are pinned (gross income, full PITI+HOA+PMI, minimum-monthly debts).
- **Two numerators are a feature, not a bug** (D-14): the lender's DTI view and the household's cash-savings view legitimately differ (maintenance is in one, not the other). Surface both clearly.

</specifics>

<deferred>
## Deferred Ideas

- **Actual FI-date shift / net-worth trajectory / no-purchase baseline / N-scenario ranking / sensitivity bands / retirement-model oracle reconciliation** — Phase 4 (flagship). Phase 3 deliberately uses a savings-rate proxy (D-01), not a projection.
- **Bank "stress/qualifying rate"** (qualify the borrower at a rate higher than the note rate) — deferred refinement; Phase 3 qualifies at the scenario's `annualRate` (D-16).
- **Itemized debt list** — Phase 3 uses a single existing-monthly-debt total (D-10); itemization is a later nicety.
- **Persistence of the household/profile + scenarios** — Phase 6; Phase 3 only defines the interface-only `household` shape (D-09).
- **ARM / variable-rate qualification** — fixed-rate only (inherited Phase 2 D-16).

None of the discussion drifted outside phase scope — these are natural downstream dependencies, not scope creep.

</deferred>

---

*Phase: 3-affordability-engine*
*Context gathered: 2026-06-26*
