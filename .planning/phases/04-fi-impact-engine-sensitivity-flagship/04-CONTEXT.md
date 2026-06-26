# Phase 4: FI-Impact Engine & Sensitivity (flagship) - Context

**Gathered:** 2026-06-26
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver the headline product — the **FI-Impact engine** that turns the proven Phase 2 two-portfolio substrate into a retirement-timeline decision tool, plus **sensitivity (tornado)** bands. In the pure `@house/core`, this phase delivers (FI-01…FI-06, ASMP-02):

1. **FI-date projection vs a no-purchase baseline** — model down payment + closing costs as foregone investment (a t=0 reduction of the buy path's investable seed) and the monthly housing delta vs renting as a recurring foregone contribution; project net-worth **monthly** in today's dollars and detect each path's **FI date** (first month projected net worth ≥ that path's FI target).
2. **FI-date delta + N-scenario ranking** — output the shift in FI date (months/years) per scenario vs the keep-renting baseline, and compare N scenarios side by side ranked by FI-date impact, with the baseline as a first-class row and a first-class "FI not reached within horizon" verdict.
3. **Independent oracle reconciliation** — closed-form annuity derivation + hand-verified numeric fixtures (incl. 0% return and high-inflation edges) as the FI-05 golden master (**see D-11 — FI-05 is reframed: no external model exists**).
4. **Sensitivity / tornado** — per-driver one-way sweep across six drivers, FI-date swing measured and ranked, top drivers labeled. "No headline number without a range."

**Scope boundary — Phase 4 layers ON TOP of the existing engine, does NOT rebuild it.** The symmetric two-portfolio trajectory math (`rentVsBuy`, `buyMonthlyOutflowAt`, Fisher conversion, monthly real compounding) is already built and proven in Phase 2. Phase 4 adds the FI-target definition, the FI-date detection loop, the asymmetric retirement-housing targets, ranking, the unreachable verdict, the oracle tests, and the tornado. It introduces **no nominal/real mixing** (inherits the all-real convention) and **no decumulation / Monte-Carlo** (out of scope, v2).

</domain>

<decisions>
## Implementation Decisions

### FI Target Definition
- **D-01:** **FI number = `targetAnnualRetirementSpend ÷ swr.rate`** (the standard FIRE definition; `swr.rate` is already first-class, ~3.3%). This adds **one new household input**: `targetAnnualRetirementSpend` (canonical decimal string, annual, today's dollars). Chosen over an explicit FI number (which would make SWR decorative and un-sweepable) and over a current-spend multiple. Ties the FI target directly to the SWR assumption so the tornado can sweep SWR meaningfully.
- **D-02 (the fairness fulcrum — ASYMMETRIC targets):** The **renter (no-purchase) FI target includes perpetual rent**; the **owner FI target includes perpetual property tax + insurance + maintenance** (the post-payoff ownership carrying cost). Both perpetual housing costs sit in their respective targets, evaluated in today's dollars:
  - Renter target = `(targetAnnualRetirementSpend + annualRent) ÷ swr.rate`
  - Owner target = `(targetAnnualRetirementSpend + annual(propertyTax + insurance + maintenance)) ÷ swr.rate`
  This is the honest, anti-funnel-correct framing — it neither pretends a paid-off house is free (owner side) nor that a renter stops paying housing (renter side). It is the strongest pro-buy force in the model, so the two targets and their housing components must be **explicitly surfaced** in the result, not buried. The owner's ongoing tax+ins+maint reuses the appreciating lines already in `buyMonthlyOutflowAt` (the value the rate is applied to at the FI horizon year is Claude's discretion — see below).

### FI-Date Detection & Projection
- **D-03:** **Monthly projection.** Net worth projected month by month from the household's current investable net worth, compounding at `returns.realAnnual` (monthly real factor, same `monthlyGrowthFactor` discipline as `rentVsBuy`) and adding the monthly savings contribution. **FI date = first month projected NW ≥ that path's FI target.** FI delta = owner FI month − renter (baseline) FI month, reported in **months and years**. Monthly (not annual) to match the existing two-portfolio loop's resolution.
- **D-04:** **Contribution decomposition (symmetric, reuses the Phase 2 engine).**
  - **Buy path:** investable seed reduced by `downPayment + closingCosts` at t=0; monthly contribution reduced by the **ownership-vs-rent premium** = `buyMonthlyOutflowAt(month) − currentRent-grown`. (This mirrors the symmetric invest-the-difference logic already in `rentVsBuy`; the buy path also accrues mortgage-principal as forced equity — exact net-worth composition for the buy path, e.g. whether home equity counts toward the FI target or only liquid investments, is Claude's discretion, see below.)
  - **Renter (baseline) path:** keeps renting at current rent, invests every dollar the buy path sank (the DP+closing seed and the monthly ownership premium) — this **IS the `rentVsBuy` rent path extended to an FI date** (D-06).

### No-Purchase Baseline & Projection Depth
- **D-05:** **Baseline = keep-renting + invest-the-gap**, NOT a status-quo snapshot. The baseline household keeps renting at `currentRent` and invests the DP+closing seed plus the monthly ownership premium symmetrically. This is the apples-to-apples anti-funnel comparator and reuses the proven `rentVsBuy` rent path rather than a new absolute reference.
- **D-06:** **Accumulation-only.** Project until net worth hits the FI target — that month is the FI date — then stop. **No decumulation / withdrawal / sequence-of-returns / Monte-Carlo modeling** (Pitfall 8: sequence risk is mild pre-withdrawal; modeling a 40–55yr retirement draw is false precision and is explicitly out of scope / v2 per REQUIREMENTS).
- **D-07 (unreachable verdict — powers the anti-funnel):** Project to a **stored max-horizon knob** (e.g. 60 years / age 100 — exact default Claude's discretion). If NW < target at the cap (or the monthly premium drives savings non-positive so the target is never approached), return a **first-class "FI not reached within horizon" result**, not a number. This guarantees termination and turns "this house pushes FI past your horizon" into a strong, honest **"don't buy"** signal (FI-06). Exact encoding (sentinel date + boolean flag vs separate result variant) is Claude's discretion; the behavior — cap + first-class unreachable verdict that sorts worst — is locked.

### N-Scenario Comparison & Ranking
- **D-08 (locked rules; shape is Claude's discretion):** The keep-renting **baseline is always a first-class comparison row** (its own FI date; delta = 0 by definition), and scenarios are **ranked by FI-date impact** (FI-04, FI-06). A buy scenario that *beats* renting shows FI sooner (negative delay); "FI not reached" scenarios sort to the bottom. **Recommended default shape (Claude's discretion to finalize):** baseline as row 0, buy scenarios ordered by FI-date delay ascending (least delay first), unreachable last. Tie-break and exact result-object shape are Claude's discretion.

### Oracle Reconciliation (FI-05) — REFRAMED
- **D-09:** **No usable external retirement model exists.** The project brief assumed an existing model to fork; in practice it is not a clean artifact. Therefore FI-05 ("reconcile against the existing retirement model") is satisfied by an **independent derivation serving as the oracle**, not the engine validating itself.
- **D-10:** **Oracle = BOTH** (a) a **closed-form analytic check** — the future-value-of-annuity identity (lump sum compounded + monthly contributions = target → solve for n) computed independently in the test and asserted against the engine's iterative monthly projection; AND (b) a few **hand-verified numeric fixtures** (human-readable, pinned), including the ROADMAP-required **0% return** (degenerates to a linear hand-checkable case) and a **high-inflation / low-real** case.
- **D-11 (correctness note for the high-inflation edge):** Because the engine runs **all-real** (today's dollars), inflation does NOT enter the compounding directly — so the "high-inflation edge" case must be constructed to **exercise the nominal→real Fisher path** (`toReal` in `rent-vs-buy.ts`): supply a nominal return + high inflation, convert via Fisher, and verify the resulting real-rate FI date. A high-inflation case that bypasses Fisher would test nothing. Document this in the test.

### Sensitivity / Tornado
- **D-12:** **Per-parameter ± bands, stored as configurable data** (NOT a uniform ±X% on all). Each driver gets its own realistic band because a flat ±1pt on a 5% return is not comparable to ±1pt on a tax figure. Suggested starting bands (Claude's discretion to finalize, stored as assumption data): return ±1.5%, inflation ±1%, appreciation ±1%, maintenance ±0.5%, tax ±15% (relative), SWR ±0.5%. Reuses the fact that assumptions are already first-class data (ASMP-01) so re-running is cheap (Pitfall 10's "sensitivity must be a cheap re-run" architecture).
- **D-13 (six drivers):** Sweep **return, inflation, appreciation, maintenance %, property tax, SWR** — the ROADMAP SC5 five PLUS **home appreciation** (Pitfall 10 names it a top driver; it swings both the owner's equity and the owner's post-payoff carrying-cost target). The swept list is stored data (≥ the SC5 five) so adding/removing a driver is cheap.
- **D-14:** **Output = ranked per-driver FI-date swing.** For a given scenario, return each driver's **low / base / high FI-date** (and the swing in months) vs the baseline FI-date, **sorted descending by swing magnitude with top drivers flagged** — a ready-to-render tornado as structured core data (the bar chart itself is Phase 7). Runs on the focal buy scenario (and the baseline). FI-date is the headline metric; net-worth-at-horizon swing is NOT reported in v1 (kept lean).

### Claude's Discretion
- Exact identifiers/units of the new `targetAnnualRetirementSpend` household field and its Zod schema placement (extends the Phase 3 `household` block on `EngineInput`, same `.strict()` decimal-string discipline).
- The buy path's **net-worth composition** for FI-target detection: whether the buy path's net worth toward its FI target counts liquid investments only, or liquid + home equity (and how the appreciating-equity / forced-savings principal already computed in `rentVsBuy` is reused). Lock this consistently and document it — it materially affects the owner FI date.
- The **value the owner's perpetual tax+ins+maint is computed on** at the FI horizon (e.g. today's value vs appreciated value at the FI year) — pick the consistent all-real treatment and document.
- The `swr.rate`-based FI target arithmetic via internal `Dec` vs widening the `Money` API (the Phase 2/3 precedent: `Dec` allowed inside core, dollars cross the boundary only as `Money`).
- The max-horizon default (D-07), the unreachable result encoding, the comparison/ranking result-object shape + tie-break (D-08), the final sensitivity bands (D-12), and the result shapes for FI projection, the FI-delta comparison, and the tornado.
- Projection step convention detail (monthly real factor `(1+r)^(1/12)`, consistent with `rentVsBuy`).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Stack, Boundary & Existing Primitives (binding)
- `CLAUDE.md` — Prescriptive stack and the "no framework deps in core" rule; `decimal.js`, Vitest 4 `projects`, the "What NOT to Use" list (no bare `number` for money, no calc logic in React, no Monte-Carlo simulation in core).
- `packages/core/src/index.ts` — the `@house/core` public barrel; the stable import boundary. New FI-impact + sensitivity exports land here. `Dec`/`Decimal` is intentionally NOT exported.
- `packages/core/src/tco/rent-vs-buy.ts` — **THE substrate this phase extends.** `rentVsBuy`, `buyMonthlyOutflowAt` (time-varying buy outflow: P+I/ins/HOA flat, tax+maintenance grow with appreciation, PMI gated at drop-off), `shouldChargePmi`, `monthlyGrowthFactor`, and `toReal` (the Fisher conversion — used by the D-11 high-inflation oracle case). Phase 4 layers FI-date/ranking/sensitivity here; it does NOT rebuild trajectory math.
- `packages/core/src/tco/tco.ts` — `computeTco` / `TcoBreakdown`: the tax/insurance/maintenance/PMI lines feeding the owner's perpetual-carrying-cost target (D-02) and the monthly ownership premium (D-04).
- `packages/core/src/tco/carrying-costs.ts` + `property-tax.ts` — `homeValueAt`, `assessedValueAt`, `maintenanceAnnual`, `annualPropertyTax`: the appreciating-value helpers for the owner's retirement carrying-cost target and the monthly premium.
- `packages/core/src/tco/amortization.ts` — `amortizationSchedule`: remaining-balance / forced-savings-principal source for the buy path's equity.
- `packages/core/src/engine/engine-input.ts` — `EngineInput` (`{ asOf, assumptions, scenario, household }`), the `household` block + `parseHousehold` (Phase 3 D-09) the new `targetAnnualRetirementSpend` field extends, and `ScenarioInputs`. The frozen snapshot/reproducibility unit.
- `packages/core/src/assumptions/schema.ts` + `defaults.ts` — `swr.rate` (~0.033, the FI-number denominator D-01), `returns.realAnnual` ("0.05"), `appreciation.realAnnual` ("0.0075"), `inflation.annual`, `rent.realGrowthAnnual` ("0"). Sensitivity bands + the max-horizon knob are NEW first-class assumption data added here (ASMP-01 / ASMP-02). DTI/tax slices already present.
- `packages/core/src/money/money.ts` (closed `Money` API) + `money/decimal-config.ts` (internal frozen 34-digit HALF_EVEN `Dec` for the FI-target / projection / annuity math).
- `packages/core/src/serialize/canonical-json.ts` + the golden-master harness (`golden.test.ts`, `__fixtures__/`) — the reproducibility machinery FI results + the oracle fixtures (D-10) plug into.

### Requirements & Scope
- `.planning/REQUIREMENTS.md` — requirements addressed: **FI-01, FI-02, FI-03, FI-04, FI-05, FI-06, ASMP-02**. Note the Out-of-Scope row: **Monte Carlo / sequence-of-returns is explicitly excluded** (deterministic projection + sensitivity bands is the honest answer) — governs D-06.
- `.planning/ROADMAP.md` §"Phase 4: FI-Impact Engine & Sensitivity (flagship)" — Goal + 5 success criteria (verbatim acceptance bar). **SC1 names the single real-vs-nominal convention + ~3–3.5% SWR; SC3 requires 0% + high-inflation oracle cases; SC4 requires the anti-funnel 'don't buy' row; SC5 requires the tornado.**
- `.planning/PROJECT.md` — core value (anti-funnel; lead with FI-impact, allow "don't buy"), constraints (pure core, reconcile FI math against a model oracle), Key Decisions table.

### Correctness Pitfalls (gating)
- `.planning/research/PITFALLS.md` — **directly governs this phase:** Pitfall 5 (real-vs-nominal / Fisher — D-11), Pitfall 6 (opportunity-cost symmetry — inherited), **Pitfall 7 (4% SWR invalid over 40–55yr → long-horizon SWR configurable — D-01)**, **Pitfall 8 (sequence-of-returns false certainty → no single confident date, pair with bands — D-06/D-12)**, **Pitfall 10 (false precision / sensitivity not a bolt-on → tornado on the six drivers — D-12/D-13/D-14)**, Pitfall 11 (snapshot every assumption). See the "Looks Done But Isn't" FI/SWR/Sensitivity checklist and the "decision tool → funnel" anti-pattern table (rank by FI-date delta, conservative defaults).

### Prior-Phase Context (binding decisions)
- `.planning/phases/02-tco-engine/02-CONTEXT.md` — **D-02 all-real convention (the single declared convention Phase 4 SC1 requires)**, the two-portfolio engine, the Phase 2/4 boundary, Fisher relation.
- `.planning/phases/03-affordability-engine/03-CONTEXT.md` — the `household`/profile contract (D-09/D-10), `currentAnnualSavings` (D-17), the savings-drain numerator (D-14), the anti-funnel verdict precedent, all-real inheritance (D-15).
- `.planning/phases/01-foundations-determinism-core/01-CONTEXT.md` — Money rounding (HALF_EVEN), full precision until output boundary, determinism guards, versioned AssumptionSet, `EngineInput` as the snapshot unit.

### Background
- `affordability-engine-gsd-brief.md` — original brief (note: the assumed "existing retirement model to fork" does not exist as a clean artifact — see D-09).

No external ADRs/specs beyond the above — implementation decisions are captured in `<decisions>`.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`rentVsBuy` / `buyMonthlyOutflowAt` / `shouldChargePmi` / `monthlyGrowthFactor` / `toReal`** (`tco/rent-vs-buy.ts`) — the symmetric two-portfolio trajectory engine + Fisher conversion. Phase 4's FI-date loop extends the rent path (baseline) and reuses the time-varying buy outflow for the monthly premium; `toReal` powers the D-11 high-inflation oracle case. Do NOT rebuild this.
- **`computeTco` / appreciating-value helpers** (`tco/tco.ts`, `carrying-costs.ts`, `property-tax.ts`) — feed the owner's perpetual tax+ins+maint retirement target (D-02) and the monthly ownership premium.
- **`amortizationSchedule`** (`tco/amortization.ts`) — remaining-balance / forced-savings-principal for the buy path's equity.
- **`household` block + `parseHousehold`** (`engine/engine-input.ts`) — the durable profile shape to extend with `targetAnnualRetirementSpend` (Phase 6 persists it; reproducibility flows automatically via the frozen `EngineInput`).
- **`swr.rate` + `returns.realAnnual`** (`assumptions/*`) — already first-class; consumed for the FI target (D-01) and projection. Sensitivity bands + max-horizon are NEW assumption data added here.
- **Internal `Dec`** (`money/decimal-config.ts`) — frozen 34-digit HALF_EVEN clone for the annuity / FI-target / projection math (not exported).
- **`canonicalJson` + golden-master harness** — FI results + oracle fixtures (D-10) are golden-testable for reproducibility (PROF-04 / Pitfall 11 pattern).

### Established Patterns
- Closed-API / no-bare-number discipline (dollars as `Money`, rates as `decStr`); all compounding/comparison in `Dec`, rounding only at the output boundary.
- Determinism guards (no `Date.now`/`Math.random`); everything (incl. `asOf`, all assumptions, the new household field, sensitivity bands, max-horizon) is explicit data on `EngineInput` / `AssumptionSet`.
- Type-level `*.type-test.ts` enforcement in the `tsc -b` graph; versioned Zod `discriminatedUnion` assumptions (adding sensitivity-band + max-horizon tunables = appending a schema version + `migrate` arm — Claude's discretion whether to bump the version).
- Sensitivity-as-cheap-re-run: parameterized pure functions mean the tornado re-runs the projection with one perturbed assumption — no special-casing.

### Integration Points
- `targetAnnualRetirementSpend` joins the `household` block — consumed here, persisted by Phase 6 (PROF-01), surfaced/edited by Phase 7.
- FI-impact results (FI date, delta, ranked comparison, unreachable verdict, tornado) are the headline outputs Phase 7's UI leads with (FI-impact first, bank affordability shown only as the gap, never a buy funnel).
- The new sensitivity-band + max-horizon assumptions extend the `AssumptionSet` imported across the core.

</code_context>

<specifics>
## Specific Ideas

- **"Flight simulator" framing** (PROJECT.md): the FI-date delta is the master instrument the user flies — it must be honest, reproducible, and paired with a range (D-12), never a single confident number (Pitfall 8/10).
- **The asymmetric-target fulcrum (D-02) must be visible, not hidden:** renter-carries-rent-forever vs owner-carries-tax+ins+maint-forever is the single most load-bearing, most contestable modeling choice in the whole tool. Surface both targets and their housing components explicitly so the user can see and defend the comparison.
- **"FI not reached within horizon" (D-07) is a feature, not an error** — it is the cleanest expression of the anti-funnel "don't buy" conclusion (FI-06).
- **The high-inflation oracle case must route through Fisher (D-11)** — otherwise the all-real engine never sees inflation and the test is vacuous.

</specifics>

<deferred>
## Deferred Ideas

- **Decumulation / withdrawal-phase modeling, sequence-of-returns risk, Monte-Carlo / historical simulation** — explicitly out of scope (REQUIREMENTS Out-of-Scope; v2 only if framed honestly). Phase 4 is accumulation-only (D-06).
- **Forking/importing a real external retirement model** — none exists as a clean artifact (D-09); the independent closed-form + fixtures oracle replaces it. If a real model surfaces later, add it as an additional reconciliation source.
- **Net-worth-at-horizon swing in the tornado** (beyond FI-date swing) — kept lean for v1 (D-14); a later enrichment.
- **Two-way / interaction sensitivity (joint sweeps), and Monte-Carlo bands** — Phase 4 ships one-way tornado only (D-12); richer sensitivity is a later enhancement.
- **Variable retirement spend over time / phased retirement / Social Security / pension modeling** — out of scope; a single `targetAnnualRetirementSpend` in today's dollars (D-01).
- **ARM / variable-rate, stress/qualifying rate** — inherited fixed-rate-only (Phase 2 D-16 / Phase 3 deferred).
- **Town scoring, persistence, listings adapter, web UI** — Phases 5/6/7.

None of the discussion drifted outside phase scope — these are natural downstream dependencies or explicitly-excluded v2 items.

### Note for ROADMAP / downstream
**FI-05 is reframed (D-09/D-10):** the success criterion's "reconcile against the existing retirement model" is satisfied by an independent closed-form + hand-verified-fixture oracle, because no clean external model exists. The acceptance intent (independent agreement across cases incl. 0% return + high-inflation) is fully preserved.

</deferred>

---

*Phase: 4-fi-impact-engine-sensitivity-flagship*
*Context gathered: 2026-06-26*
