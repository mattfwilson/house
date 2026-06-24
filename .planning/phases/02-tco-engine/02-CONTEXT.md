# Phase 2: TCO Engine - Context

**Gathered:** 2026-06-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Build the shared **Total Cost of Ownership substrate** that both the Affordability engine (Phase 3) and the flagship FI-Impact engine (Phase 4) consume:

- **Amortization** — full fixed-rate schedule from rate/term/loan, with the exact-$0 final balance and principal-sum invariants (final payment reconciled, not a "normal" payment).
- **MA property tax** — assessed value × seeded, FY-stamped town mill rate (never a flat % and never a 2.5%-cap on the bill).
- **PMI** — added when down payment < 20%, removed at 78% LTV automatic / 80% requested, measured against **original** value and the **scheduled** balance (toggle-tested).
- **Recurring carrying costs** — homeowners insurance, maintenance reserve, HOA/condo fees.
- **One-time costs** — closing costs (amortizable for comparison) + an optional generic one-time-cost line.
- **Full TCO breakdown** — P+I, tax, insurance, maintenance, HOA, PMI, amortized closing costs — both **monthly and annualized**.
- **Rent-vs-buy** at the household's real numbers — a **two-portfolio ending-net-worth comparison** over a per-scenario holding horizon, investing symmetrically and treating principal as forced savings.

This phase **widens `ScenarioInputs`** (today just `{ label }`) into the real house-scenario shape, and **extends the `AssumptionSet`** with the new tunables the two-portfolio model needs.

**Scope boundary vs Phase 4 (flagship):** Phase 2 delivers the *reusable two-portfolio net-worth engine* (buy vs rent+invest over a horizon → ending net worth + crossover). Phase 4 *layers on top of it*: FI-date shift, N-scenario ranking, sensitivity bands, the no-purchase baseline, and reconciliation against the existing retirement-model oracle. Phase 2 does **not** build FI-date, ranking, or sensitivity — but it adopts the project-wide real-vs-nominal convention so Phase 4 inherits it by construction.

</domain>

<decisions>
## Implementation Decisions

### Rent-vs-Buy Depth & the Phase 2/Phase 4 Boundary
- **D-01:** Phase 2's rent-vs-buy is a **two-portfolio ending-net-worth comparison over a configurable holding horizon**: the buy path (home equity net of sell costs) vs the rent path (rent + invest-the-difference at the real return). Output is ending net worth for each path plus the crossover year. This engine is the reusable substrate Phase 4 extends — Phase 4 does **not** rebuild trajectory math. Honors SC5 (TCO-07) literally.
- **D-02:** **All-real (today's-dollar) convention, locked project-wide.** The entire projection runs in today's dollars — real return, real appreciation, real rent. Nominal→real conversion uses the **Fisher relation** `(1+nom)/(1+inf) − 1`, never naive subtraction (Pitfall 5). `returns.realAnnual` (already stored as REAL in Phase 1) is consumed directly. **This is a binding decision Phase 4 must inherit** — it is the "single declared real-vs-nominal convention" Phase 4 SC1 requires.
- **D-03:** The **holding horizon is a per-scenario input** (`holdingYears` on `ScenarioInputs`) — different houses get different holds (starter vs forever home); it is a primary lever of the rent-vs-buy crossover.
- **D-04:** **Home appreciation is a separate, conservative real assumption** (e.g. `appreciation.realAnnual`, default ~0.5–1% real) — explicitly NOT the ~5% real portfolio return. Directly counters Pitfall 6's "home equity grows at stock-market rate" error.
- **D-05:** **Sell-side transaction costs are modeled explicitly** as a % haircut on home equity at horizon end (e.g. `transaction.sellCostPct` ~0.06–0.07; ~5–6% realtor + MA ~0.456% excise stamp). Required by Pitfall 6 + SC5 (equity haircut on liquidation). Without it the comparison is rigged toward buying.
- **D-06:** **Rent is flat in real terms** by default (rises with inflation → 0% real), backed by a stored knob (e.g. `rent.realGrowthAnnual`, default `"0"`) so a hot rental market can be stressed later.

### Property Tax & Assessed Value
- **D-07:** **Assessed value defaults to purchase price**, with an optional stored **assessment-ratio knob** (`assessmentRatio`, default `1.0`) to set assessed/market < 1 where a town's assessments lag. Tax = assessedValue × millRate (Pitfall 9).
- **D-08:** A scenario **references a town**; the engine **resolves the FY-stamped mill rate** from the seeded table, and the **resolved rate + FY vintage is captured in the snapshot** (Pitfall 11) so reproducibility survives a later table update. This also sets up Phase 5 town scoring to share the same table.
- **D-09:** Phase 2 seeds a **curated greater-Boston subset (~20–40 towns) with real FY-stamped DOR rates**. Full-MA (~351 municipalities) and the other scoring metrics (median price, schools, commute) are **Phase 5's** job, added as new columns on the same table.
- **D-10:** Over the horizon, **property tax tracks the appreciating assessed value at a held-constant mill rate** — tax = (assessed grown at `appreciation.realAnnual`) × constant rate. **No 2.5% cap on the bill** (Pitfall 9); the output surfaces a qualitative **"Prop 2½ caps the town levy, not your bill"** flag.

### One-Time & MA-Lumpy Costs
- **D-11:** For the monthly/annualized TCO breakdown, **closing costs are amortized over the holding horizon** (`holdingYears`), so the per-month figure reflects the actual hold. In the two-portfolio net-worth model, closing costs remain a **t=0 lump** (foregone investment) regardless.
- **D-12:** **Buy-side closing costs = a stored %-of-price rate** (e.g. ~2–3%) auto-filling the figure, with a **per-scenario dollar override** for a real Loan Estimate.
- **D-13:** Phase 2 includes a **generic optional one-time "other costs" input** (absorbs a known betterment/septic lump into TCO). The **MA-specific qualitative flagging** (which towns are largely on septic, betterment likelihood) stays in **Phase 5** where town data lives (Pitfall 12). Full betterment-apportionment / Title 5 modeling is deferred.

### Scenario Input Contract
- **D-14:** **Down payment is a percent of price** (`downPaymentPct`, rate string); loan = price × (1 − pct) and LTV falls straight out — clean for the PMI < 20% trigger and the 78/80 original-value math.
- **D-15:** **Maintenance = % of (appreciating) home value** (reuses the existing `maintenance.annualPctOfValue` knob, tracks the appreciating value each year — consistent with D-10). **Insurance = flat annual $ per scenario; HOA = flat $/mo**, both held flat in today's dollars over the horizon, all tunable.
- **D-16:** **Fixed-rate mortgages only** in Phase 2 — keeps the amortization invariants (exact $0 payoff, principal-sum) clean to prove. ARM support is a deferred future idea.

### Claude's Discretion
- **Money API extension:** amortization needs division, comparison, and `(1+r)^n` powers, which the current closed `Money` API (`add`/`sub`/`mul`/`percentOf`/`toCents`) does not expose. Since the TCO module lives *inside* `packages/core`, it may use the internal `Dec` (`decimal-config.ts`) directly for rate math and surface results only as `Money` — OR the `Money` API may be widened with `div`/comparison helpers. Either is acceptable provided dollars never cross the public boundary as bare numbers (CORE-02) and the closed-API discipline holds. Researcher/planner to decide.
- **AssumptionSet versioning:** the new tunables (`appreciation`, `transaction`, `rent`, closing-cost rate, `assessmentRatio`) extend the schema. Whether to bump to `AssumptionsV2` with a `migrate(V1→V2)` path (per D-05 of Phase 1) or extend V1 in place is Claude's discretion — persistence does not exist until Phase 6, so no stored snapshots need migrating yet, but the versioned-discriminated-union discipline should be honored.
- **TCO result-object shape**, exact identifiers/field names of the widened `ScenarioInputs`, the seeded town-table data structure, the insurance default value, and the exact default values for the new assumptions (within the conservative bounds noted above).
- Day-count / monthly-rate convention detail (US standard is nominal annual / 12) — apply the standard, document it.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Stack, Boundary & Existing Primitives (binding)
- `CLAUDE.md` — Prescriptive stack and the "no framework deps in core" rule; `decimal.js` (vs big.js/dinero), Vitest 4 `projects`, the "What NOT to Use" list (no bare `number` for money, no calc logic in React).
- `packages/core/src/index.ts` — The `@house/core` public barrel: the stable import boundary Phase 2 builds on (`Money`, `CalendarDate`, `EngineInput`, `ScenarioInputs`, `AssumptionSet`, `engineInput`, `canonicalJson`). Raw `Dec`/`Decimal` is intentionally **not** exported.
- `packages/core/src/money/money.ts` — The closed `Money` API. Note it has **no `div`/comparison/`pow`** today (see Claude's Discretion); `mul`/`percentOf` take a rate string, rounding only at `toCents()`.
- `packages/core/src/assumptions/schema.ts` + `packages/core/src/assumptions/defaults.ts` — `AssumptionsV1` already carries `tax.propertyRateAnnual`, `maintenance.annualPctOfValue`, `pmi.annualRateOfLoan`, `pmi.dropOffLtv` ("0.8"), `returns.realAnnual` (REAL), `inflation.annual`. Every tunable is a canonical **decimal string** (`decStr`). The phase extends this schema.
- `packages/core/src/engine/engine-input.ts` — `EngineInput` = `{ asOf, assumptions, scenario }`, frozen; `ScenarioInputs` (currently `{ label }`) is what this phase widens. It is the snapshot/reproducibility unit (D-11 from Phase 1).
- `.planning/phases/01-foundations-determinism-core/01-CONTEXT.md` — Phase 1 decisions D-01..D-14 (Money rounding = banker's HALF_EVEN, full precision until output boundary, determinism guards, versioned AssumptionSet, canonical-JSON reproducibility) that constrain how Phase 2 code must be written.

### Requirements & Scope
- `.planning/REQUIREMENTS.md` — Requirements addressed by this phase: **TCO-01, TCO-02, TCO-03, TCO-04, TCO-05, TCO-06, TCO-07**.
- `.planning/ROADMAP.md` §"Phase 2: TCO Engine" — Goal and the 5 success criteria (verbatim acceptance bar). Also §"Phase 4" and §"Phase 5" for the scope boundaries referenced in D-01/D-09.
- `.planning/PROJECT.md` — Core value (anti-funnel), MA realities to model/flag, constraints (pure core, reconcile FI math against existing retirement model), Key Decisions table.

### Correctness Pitfalls (gating)
- `.planning/research/PITFALLS.md` — **Directly governs this phase:** Pitfall 1 (float money), **Pitfall 2 (amortization rounding / final payment / zero balance)**, **Pitfall 3 (PMI 78/80 against original value + scheduled balance)**, **Pitfall 9 (Prop 2½ = levy not bill cap)**, Pitfall 12 (MA lumpy costs). Pitfalls 5 & 6 (real-vs-nominal, opportunity-cost symmetry) govern the rent-vs-buy two-portfolio model adopted in D-01..D-06. See the "Looks Done But Isn't" checklist for verification.

### Background
- `affordability-engine-gsd-brief.md` — Original project brief (background context).

No external ADRs/specs beyond the above — implementation decisions are captured in the `<decisions>` block.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`Money`** (`packages/core/src/money/money.ts`) — decimal-precise dollar primitive; all TCO dollar outputs flow through it, rounding to cents only at `toCents()`.
- **`AssumptionsV1`** (`schema.ts` / `defaults.ts`) — already has the `tax`, `maintenance`, `pmi`, `returns`, `inflation` slices the TCO engine reads; extend it (new version) with `appreciation`, `transaction`, `rent`, closing-cost rate, `assessmentRatio`.
- **`EngineInput` / `ScenarioInputs`** (`engine/engine-input.ts`) — the frozen snapshot unit to widen with the house-scenario fields; threading via this object preserves determinism + reproducibility automatically.
- **`canonicalJson`** (`serialize/canonical-json.ts`) and the golden-master harness (`golden.test.ts`, `__fixtures__/golden-snapshot.json`) — the reproducibility machinery TCO results can be golden-tested against.
- **Internal `Dec`** (`money/decimal-config.ts`) — the frozen `Decimal.clone({ precision: 34, rounding: HALF_EVEN })`; available *inside* core for the rate/power/division math amortization needs (not exported).

### Established Patterns
- **Closed-API / no-bare-number discipline** — dollars cross boundaries only as `Money` strings; rates are canonical decimal strings (`decStr` / `CANONICAL_DECIMAL_RE`). New code must follow this.
- **Determinism guards** — lint (`no-restricted-globals`) + runtime guard make `Date.now`/`Math.random` throw inside core; `asOf` is data. TCO functions take everything as explicit params.
- **Type-level enforcement** via `*.type-test.ts` in the `tsc -b` graph (esbuild/Vitest don't honor `@ts-expect-error`).
- **Versioned assumptions** via Zod `discriminatedUnion` on `schemaVersion`; adding a version is appending one object schema + a `migrate` arm.

### Integration Points
- Phase 2 widens `ScenarioInputs` and the `AssumptionSet` — these are imported by Phases 3 (Affordability reuses PITI+HOA+PMI components for DTI), 4 (FI-Impact extends the two-portfolio engine), and 5 (Town Scoring reuses the mill-rate table). Signature stability matters.
- The seeded town→mill-rate table introduced here is the seed Phase 5 extends to full MA with additional scoring columns.

</code_context>

<specifics>
## Specific Ideas

- **"Flight simulator for a house purchase"** (PROJECT.md): the rent-vs-buy crossover year and ending-net-worth divergence are early "instruments" the user flies — they must be reproducible and honest, never optimistic-by-default.
- **Anti-funnel from the start:** the two-portfolio model (D-01) must be able to show rent+invest winning; the symmetric invest-the-difference + explicit sell-side haircut (D-05) are what keep it honest rather than buy-biased.
- **External-oracle agreement on amortization:** SC1 wants agreement with a bank/spreadsheet amortization on a **non-round rate** — pick a representative non-round-rate loan as a golden case.

</specifics>

<deferred>
## Deferred Ideas

- **FI-date shift, N-scenario ranking, sensitivity bands, no-purchase baseline, retirement-model oracle reconciliation** — Phase 4 (flagship). Phase 2 builds the reusable two-portfolio engine they sit on, nothing more.
- **Full-MA mill-rate table (~351 towns) + other town scoring metrics** (median price, school rating, commute) and **MA-specific qualitative flags** (septic/Title 5, betterment likelihood, 40B deed restrictions) — Phase 5 (Town Scoring & Heatmap).
- **ARM (adjustable-rate) mortgage modeling** — deferred; Phase 2 is fixed-rate only (D-16).
- **Full betterment-apportionment (up-to-20yr @ ~5%) and Title 5 septic-reserve modeling** — Phase 2 only offers a generic one-time-cost line (D-13); detailed MA-lumpy modeling is later/optional.
- **Forward property-tax rate drift / revaluation modeling** — Phase 2 holds the mill rate constant and grows only the assessed value (D-10); rate-drift is explicitly not modeled (avoids false precision).
- **Persistence of scenarios/assumptions** — Phase 6; Phase 2 only defines the snapshot-able shapes.

None of the discussion drifted outside phase scope — these are natural downstream dependencies, not scope creep.

</deferred>

---

*Phase: 2-tco-engine*
*Context gathered: 2026-06-24*
