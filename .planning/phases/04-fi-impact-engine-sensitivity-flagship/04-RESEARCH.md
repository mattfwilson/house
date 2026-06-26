# Phase 4: FI-Impact Engine & Sensitivity (flagship) - Research

**Researched:** 2026-06-26
**Domain:** FI (financial-independence) retirement-timeline projection + one-way sensitivity (tornado), layered on the proven Phase 2 two-portfolio substrate in the pure `@house/core` package
**Confidence:** HIGH — every claim is grounded in the actual current source of `@house/core` (read this session) or the binding CONTEXT.md/PITFALLS.md; the only `[ASSUMED]` items are the discretionary defaults CONTEXT.md explicitly leaves to Claude.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions (D-01 … D-14 — binding; do NOT relitigate)

- **D-01 — FI number = `targetAnnualRetirementSpend ÷ swr.rate`** (standard FIRE; `swr.rate` already first-class ~0.033). Adds ONE new household input: `targetAnnualRetirementSpend` (canonical decimal string, annual, today's dollars). Chosen over an explicit FI number (would make SWR un-sweepable) and over a current-spend multiple.
- **D-02 — ASYMMETRIC targets (the fairness fulcrum).** Renter FI target includes perpetual rent; owner FI target includes perpetual property tax + insurance + maintenance. Both in today's dollars:
  - Renter target = `(targetAnnualRetirementSpend + annualRent) ÷ swr.rate`
  - Owner target = `(targetAnnualRetirementSpend + annual(propertyTax + insurance + maintenance)) ÷ swr.rate`
  Both targets and their housing components MUST be explicitly surfaced in the result, not buried. The value the owner's tax+ins+maint rate is applied to at the FI horizon year is Claude's discretion.
- **D-03 — Monthly projection.** NW projected month by month from current investable net worth, compounding at `returns.realAnnual` (monthly real factor, same `monthlyGrowthFactor` discipline as `rentVsBuy`), adding the monthly savings contribution. FI date = first month projected NW ≥ that path's FI target. FI delta = owner FI month − renter (baseline) FI month, reported in months AND years.
- **D-04 — Contribution decomposition (symmetric, reuses Phase 2).** Buy path: investable seed reduced by `downPayment + closingCosts` at t=0; monthly contribution reduced by the ownership-vs-rent premium = `buyMonthlyOutflowAt(month) − currentRent-grown`. Renter (baseline) path keeps renting and invests every dollar the buy path sank — this IS the `rentVsBuy` rent path extended to an FI date (D-06). Buy-path NW composition (home equity counted or not) is Claude's discretion.
- **D-05 — Baseline = keep-renting + invest-the-gap**, NOT a status-quo snapshot. Reuses the proven `rentVsBuy` rent path.
- **D-06 — Accumulation-only.** Project until NW hits the target, then stop. NO decumulation / withdrawal / sequence-of-returns / Monte-Carlo.
- **D-07 — Unreachable verdict.** Project to a stored max-horizon knob (e.g. 60 yrs / age 100 — exact default Claude's discretion). If NW < target at the cap (or savings non-positive), return a first-class "FI not reached within horizon" result, not a number. Encoding (sentinel + flag vs separate result variant) is Claude's discretion; the behavior (cap + first-class unreachable verdict that sorts worst) is locked.
- **D-08 — N-scenario comparison.** Baseline is always a first-class comparison row (delta = 0 by definition); scenarios ranked by FI-date impact. Buy scenario that beats renting shows FI sooner (negative delay); "FI not reached" sorts to bottom. Recommended default shape (Claude finalizes): baseline as row 0, buy scenarios by FI-date delay ascending, unreachable last. Tie-break + exact shape Claude's discretion.
- **D-09 — No usable external retirement model exists.** FI-05 satisfied by an independent derivation serving as oracle, not the engine validating itself.
- **D-10 — Oracle = BOTH** (a) closed-form analytic check (future-value-of-annuity identity, solve for n, asserted against the engine's iterative projection) AND (b) hand-verified numeric fixtures including the 0%-return (linear) case and a high-inflation/low-real case.
- **D-11 — High-inflation edge MUST route through Fisher (`toReal`).** Engine runs all-real; inflation does not enter compounding directly. The high-inflation case supplies a NOMINAL return + high inflation, converts via Fisher, and verifies the resulting real-rate FI date. A case that bypasses Fisher tests nothing. Document this in the test.
- **D-12 — Per-parameter ± bands, stored as configurable data** (not a uniform ±X%). Suggested starting bands (Claude finalizes, stored as assumption data): return ±1.5%, inflation ±1%, appreciation ±1%, maintenance ±0.5%, tax ±15% (relative), SWR ±0.5%.
- **D-13 — Six drivers:** return, inflation, appreciation, maintenance %, property tax, SWR (the ROADMAP SC5 five PLUS home appreciation). Swept list stored as data (≥ the five).
- **D-14 — Output = ranked per-driver FI-date swing.** Each driver's low/base/high FI-date (and swing in months) vs the baseline FI-date, sorted descending by swing magnitude with top drivers flagged. Runs on the focal buy scenario (and the baseline). FI-date is the headline metric; net-worth-at-horizon swing NOT reported in v1.

### Claude's Discretion
- Exact identifiers/units of the new `targetAnnualRetirementSpend` household field and its Zod schema placement (extends the Phase 3 `household` block, same `.strict()` decimal-string discipline).
- Buy-path NW composition for FI-target detection (liquid only vs liquid + home equity); lock + document.
- The value the owner's perpetual tax+ins+maint is computed on at the FI horizon (today's vs appreciated-at-FI-year); pick the consistent all-real treatment, document.
- `swr.rate`-based FI-target arithmetic via internal `Dec` vs widening `Money` API (precedent: `Dec` allowed inside core, dollars cross as `Money`).
- Max-horizon default, unreachable encoding, comparison/ranking shape + tie-break, final sensitivity bands, result shapes for FI projection / FI-delta comparison / tornado.
- Projection-step convention detail (monthly real factor `(1+r)^(1/12)`, consistent with `rentVsBuy`).

### Deferred Ideas (OUT OF SCOPE)
- Decumulation / withdrawal-phase / sequence-of-returns / Monte-Carlo / historical simulation (REQUIREMENTS Out-of-Scope; v2). Phase 4 is accumulation-only (D-06).
- Forking/importing a real external retirement model (none exists — D-09).
- Net-worth-at-horizon swing in the tornado (beyond FI-date swing) — lean v1 (D-14).
- Two-way / interaction sensitivity (joint sweeps), Monte-Carlo bands — one-way only (D-12).
- Variable retirement spend over time / phased retirement / Social Security / pension — single `targetAnnualRetirementSpend` in today's dollars (D-01).
- ARM / variable-rate / stress-qualifying rate — inherited fixed-rate-only.
- Town scoring, persistence, listings adapter, web UI — Phases 5/6/7.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| FI-01 | Model DP + closing as foregone investment; monthly housing delta as recurring foregone contribution | §"FI-date detection loop" + §"Buy-path NW composition" — reuse `rentVsBuy`'s t=0 `upfront` lump and `buyMonthlyOutflowAt(month)` premium verbatim; do NOT re-derive |
| FI-02 | Project NW trajectory + FI date vs no-purchase baseline; configurable real return; long-horizon SWR ~3–3.5% | §"FI-date detection loop" (monthly loop reusing `monthlyGrowthFactor`) + §"Asymmetric targets" (`swr.rate` denominator, default 0.033 verified) |
| FI-03 | Output the FI-date shift (months/years) | §"Result object shapes" — FI delta = owner FI month − renter FI month, months and `months/12` years |
| FI-04 | Compare N scenarios ranked by FI-date impact | §"N-scenario comparison & ranking" (D-08 shape) |
| FI-05 | FI math reconciles via golden-master/oracle (incl. 0% + high-inflation edges) | §"FV-of-annuity closed-form oracle" + §"Result shapes / golden-master plug-in" |
| FI-06 | Reach a "don't buy / rent and invest" verdict (anti-funnel) | §"Unreachable verdict" + §"N-scenario ranking" (baseline-beats-buy / unreachable-sorts-worst) |
| ASMP-02 | Sensitivity analysis shipped alongside the FI engine | §"Sensitivity / tornado architecture" (six drivers, per-driver bands as stored assumption data, cheap re-run) |
</phase_requirements>

## Summary

Phase 4 is **pure composition over an already-proven substrate.** Every primitive it needs already exists in `@house/core` and was read this session: the symmetric two-portfolio monthly loop (`rentVsBuy`), the time-varying buy outflow (`buyMonthlyOutflowAt`), the monthly real compounding factor (`monthlyGrowthFactor`, currently file-private in `rent-vs-buy.ts`), the Fisher conversion (`toReal`, exported-grade and tested), the appreciating-value helpers (`homeValueAt`, `assessedValueAt`, `annualPropertyTax`, `maintenanceAnnual`), the forced-principal source (`amortizationSchedule`), the closed `Money` API + internal 34-digit HALF_EVEN `Dec`, and the gated golden-master harness with `canonicalJson`. The flagship risk is NOT the trajectory math (Phase 2 proved it) — it is **(a) defining the asymmetric FI targets consistently in the all-real convention, (b) making the FI-date detection loop terminate and encode "unreachable" as a first-class verdict, (c) building an oracle that genuinely exercises the engine including the Fisher path, and (d) keeping the tornado a parameterized cheap re-run rather than a bolt-on.**

The single biggest implementation landmine is **the monthly-loop divergence trap**: the oracle (a closed-form FV-of-annuity solve-for-n) compounds and contributes on an *annuity convention* (e.g., contribution at end of month, then growth), while the engine's loop order (`rentVsBuy` invests the difference, *then* compounds — lines 234–244 of `rent-vs-buy.ts`) is a specific convention. If the oracle and the engine use different intra-month ordering, they will disagree by a few months and the "reconciliation" will look like a bug. The plan MUST pin a single intra-month convention and write the closed-form to match it exactly. The 0%-return case (degenerates to linear `n = (target − seed) / monthlyContribution`) is the cleanest hand-checkable anchor and should be implemented first as the convention-locking test.

**Primary recommendation:** Build a new `packages/core/src/fi/` module that imports — never re-implements — the Phase 2 substrate. Promote `monthlyGrowthFactor` from file-private to an internal shared helper (move to a small `fi/` or `tco/` util, or export it within-package) so the FI loop and the oracle compound identically to `rentVsBuy`. Lock the buy-path NW composition to **liquid + home-equity** (consistent with `rentVsBuy`'s own ending-net-worth definition — see §4), and evaluate the owner's perpetual carrying-cost target on the **appreciated home value at the FI year** (consistent all-real treatment — see §3). Encode "unreachable" as a discriminated result variant. Store the six driver bands + max-horizon as a NEW `sensitivity` + `projection` assumption slice; **bump to AssumptionsV3 with a `v2ToV3` migrate arm** (the established versioning pattern — adding tunables that calc reads is exactly what a version bump is for).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| FI-target arithmetic (`spend+housing)/swr`) | `@house/core` (pure) | — | Pure decimal math; no framework/IO. Dollars in/out as `Money`. |
| Monthly NW projection + FI-date detection | `@house/core` (pure) | — | Deterministic loop over assumptions; reuses `rentVsBuy` substrate. |
| Closed-form oracle (FV-of-annuity solve-for-n) | core **test** (`*.test.ts`) | — | The oracle lives in the test, asserting against the engine — NOT a production code path (D-10). Independent derivation, not engine-validates-self. |
| Sensitivity / tornado (perturb-and-re-run) | `@house/core` (pure) | — | Cheap re-run of the pure projection across an assumption grid (Pitfall 10 architecture). |
| Sensitivity bands + max-horizon (stored data) | `AssumptionSet` (versioned Zod) | — | First-class assumption data (ASMP-01/02); snapshot-reproducible. |
| Result serialization for golden-master | `serialize/canonical-json.ts` | golden harness | FI/tornado results are `Money`-typed object graphs feeding `canonicalJson`. |
| Rendering the tornado bar chart | Phase 7 (Next.js) | — | OUT OF SCOPE here — D-14 ships structured core data only. |
| Persisting `targetAnnualRetirementSpend` | Phase 6 (SQLite) | — | OUT OF SCOPE — flows automatically via the frozen `EngineInput`. |

## Standard Stack

No new external packages. This phase composes existing `@house/core` internals only.

### Core (existing, verified this session)
| Symbol | File | Purpose in Phase 4 | Why reuse (not rebuild) |
|--------|------|--------------------|--------------------------|
| `rentVsBuy`, `RentVsBuyResult` | `tco/rent-vs-buy.ts` | The baseline (rent path) NW substrate; reference for intra-month convention | Proven symmetric two-portfolio engine (TCO-07, golden-tested) |
| `buyMonthlyOutflowAt(input, month): Money` | `tco/rent-vs-buy.ts` | The monthly ownership premium = `buyMonthlyOutflowAt − rent` (D-04) | Time-varying (tax+maint appreciate, PMI gated); exported, tested |
| `monthlyGrowthFactor(annualReal): Dec` | `tco/rent-vs-buy.ts` (**file-private**) | Monthly real compounding `(1+r)^(1/12)` for the FI loop | The exact compounding discipline `rentVsBuy` uses — must match (see Landmine L1) |
| `toReal(nominal, inflation): Dec` | `tco/rent-vs-buy.ts` (exported within-package via `import`) | The Fisher path the D-11 high-inflation oracle case MUST route through | `(1+nom)/(1+inf)−1`, the only correct real conversion (Pitfall 5) |
| `homeValueAt(price, appr, year): Money` | `tco/carrying-costs.ts` | Owner equity + appreciated home value at FI year | DRY appreciation idiom |
| `assessedValueAt(price, ratio, appr, year): Money` | `tco/property-tax.ts` | Appreciated assessed value for owner perpetual tax at FI year | Same basis as TCO |
| `annualPropertyTax(assessed, millRate): Money` | `tco/property-tax.ts` | Owner perpetual property-tax component of D-02 target | Mill-rate correct (Pitfall 9) |
| `maintenanceAnnual(homeValue, pct): Money` | `tco/carrying-costs.ts` | Owner perpetual maintenance component of D-02 target | Appreciating basis |
| `computeTco(input): TcoBreakdown` | `tco/tco.ts` | Source of `resolvedMillRate`, year-0 insurance line, PMI flags | Captures mill rate for reproducibility |
| `amortizationSchedule(loan, rate, term)` | `tco/amortization.ts` | Forced-principal / remaining balance for buy-path equity | Exact-zero payoff invariant |
| `Money` (closed API) / `Dec` (internal) | `money/money.ts`, `money/decimal-config.ts` | All dollars as `Money`; all FI/annuity/SWR math in `Dec` | CORE-02; `Dec` not exported |
| `canonicalJson(value): string` | `serialize/canonical-json.ts` | Serialize FI/tornado results for the golden master | Money→string, key-sorted, float-free |
| Golden harness | `golden.test.ts`, `__fixtures__/*.json` | Where FI results + oracle fixtures plug in | `UPDATE_GOLDEN=1` gated regen |
| `EngineInput`, `Household`, `parseHousehold`, `HouseholdSchema` | `engine/engine-input.ts` | Where `targetAnnualRetirementSpend` extends | `.strict()` decimal-string boundary |
| `AssumptionsV2`, `AssumptionSetSchema`, `migrate`, `DEFAULT_ASSUMPTIONS` | `assumptions/*` | Where sensitivity bands + max-horizon land (→ V3) | Versioned discriminatedUnion + migrate arm |

**Verified values (from `defaults.ts`, read this session):** `swr.rate = "0.033"` (the D-01 denominator — long-horizon, NOT 4%, satisfies FI-02/Pitfall 7), `returns.realAnnual = "0.05"`, `appreciation.realAnnual = "0.0075"`, `inflation.annual = "0.025"`, `maintenance.annualPctOfValue = "0.01"`, `rent.realGrowthAnnual = "0"`. **`decimal.js@^10.6.0`** is the pinned dependency; `Dec.prototype.ln`/`log`/`pow` all exist (verified via Node this session) — so the closed-form solve-for-n (which needs a logarithm) is computable in `Dec` at full 34-digit precision.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Closed-form solve-for-n via `Dec.ln` | Iterative month-by-month in the oracle too | An *iterative* oracle that mirrors the engine loop is NOT an independent check — it would pass even if both share a bug. D-10 demands a closed-form analytic identity. Use `Dec.ln` for the annuity solve; keep the engine iterative. The two agreeing is the signal. |
| New `fi/` module | Extending `tco/rent-vs-buy.ts` | A separate `fi/` directory keeps the FI/tornado concerns out of the TCO substrate and matches the `affordability/` precedent (Phase 3 added its own dir). Recommended. |
| AssumptionsV3 bump | Threading bands as a separate non-versioned param | Bands + max-horizon are tunables calc READS — they belong in the versioned, snapshot-captured `AssumptionSet` (ASMP-01/02, Pitfall 11). Bump the version; do not invent a side-channel. |

**Installation:** None — no new packages.

## Package Legitimacy Audit

No external packages are installed in this phase. The only runtime dependency in scope (`decimal.js@^10.6.0`) is already present, established (10+ yr, ~Prisma-internal, tens of millions of weekly downloads), and was verified resolvable this session. No audit table rows required.

## Architecture Patterns

### System Architecture Diagram

```
                 EngineInput (frozen: asOf + assumptionsV3 + scenario + household.targetAnnualRetirementSpend)
                         │
        ┌────────────────┴───────────────────────────────────────────┐
        │                                                             │
   ── FI TARGETS (D-02, pure Dec) ──                        ── PROJECTION SUBSTRATE (reuse) ──
   renterTarget = (spend + annualRent)/swr                   monthlyGrowthFactor(returns.realAnnual)
   ownerTarget  = (spend + annual(tax+ins+maint@FIyear))/swr buyMonthlyOutflowAt(input, month) ── premium
        │                                                    amortizationSchedule ── forced principal
        │                                                    homeValueAt ── appreciated equity
        └───────────────┬─────────────────────────────────────────────┘
                        ▼
        ── projectFiDate(path) : monthly loop ──   (D-03; intra-month convention LOCKED to match oracle)
            seed = currentNW  (buy: − DP − closing)
            for month = 1..maxHorizonMonths:
                contribution = (buy: currentSavings − premium(month);  rent: currentSavings + premium(month))
                NW = (NW + contribution) × monthlyFactor     ◄── single convention, see L1
                buyNW also += forced-equity(month)           ◄── if liquid+equity composition (§4)
                if NW ≥ pathTarget → return FiReached(month)
            return FiNotReached(maxHorizonMonths)             ◄── D-07 first-class verdict
                        │
        ┌───────────────┼───────────────────────────────────┐
        ▼               ▼                                   ▼
  FI-DELTA (FI-03)   N-SCENARIO RANK (FI-04/D-08)      TORNADO (ASMP-02/D-14)
  owner − renter      baseline row0 + buys             for driver in [6]:
  months & years      sorted by delay asc                lo = project(perturb(asm, driver, −band))
                      unreachable last                    hi = project(perturb(asm, driver, +band))
                        │                                  swing = |hi − lo| months
                        ▼                                ranked desc, top flagged
                  canonicalJson(result) ── golden-master + oracle fixtures (FI-05)
```

### Recommended Project Structure
```
packages/core/src/fi/
├── fi-target.ts          # renterTarget / ownerTarget (D-01/D-02) — pure Dec, returns Money
├── projection.ts         # projectFiDate(path) monthly loop (D-03) + unreachable verdict (D-07)
├── fi-impact.ts          # the top-level: build both paths, FI delta (FI-03), result object
├── compare.ts            # N-scenario ranking (FI-04 / D-08): baseline row0, sort, ties
├── sensitivity.ts        # perturb-one-assumption + re-run + rank (ASMP-02 / D-12/13/14)
├── fi.type-test.ts       # no-bare-number type-test (the tco.type-test.ts precedent)
└── *.test.ts             # unit + the FV-of-annuity oracle (D-10), 0% + high-inflation (Fisher) cases
```
New exports land in `packages/core/src/index.ts` (the barrel). `Dec`/`Decimal` stay UNEXPORTED.

### Pattern 1: Reuse the substrate, never rebuild the loop
**What:** The FI projection is `rentVsBuy`'s rent path (baseline) and a buy path that consumes the *same* `buyMonthlyOutflowAt`/`monthlyGrowthFactor`/`amortizationSchedule` primitives — extended past the fixed hold to the FI date.
**When to use:** Always. Re-deriving any compounding or outflow math here re-opens Pitfall 6 (opportunity-cost asymmetry) and risks divergence from the golden-tested Phase 2 result.
**Example (the locked intra-month convention — must match `rent-vs-buy.ts` lines 234–244):**
```typescript
// Source: derived from packages/core/src/tco/rent-vs-buy.ts (the engine's own order):
//   invest-the-difference FIRST, then compound. The FI loop adds a flat monthly contribution.
// LOCK THIS ORDER and write the closed-form oracle to match it exactly.
import { Dec } from '../money/decimal-config.js';
// monthlyGrowthFactor must be shared (promote from file-private — see Landmine L1).
const factor = monthlyGrowthFactor(returns.realAnnual);  // (1+r)^(1/12) in Dec
let nw = new Dec(seedDollars);                            // buy: seed already net of DP+closing
for (let month = 1; month <= maxHorizonMonths; month++) {
  nw = nw.plus(contributionFor(month));                  // contribute at month start
  nw = nw.times(factor);                                 // THEN compound one month
  // buy path (liquid+equity composition): add this month's forced principal + appreciation delta
  if (NW_reaches_target) return { kind: 'reached', month };
}
return { kind: 'unreached', cappedAtMonth: maxHorizonMonths };
```

### Pattern 2: FI target in Dec, surfaced as Money
**What:** `target = (spend + housing) / swr.rate`. Division is the one operation `Money` does NOT expose (intentional — see `money.ts`), so do it in `Dec` and cross back to `Money` once.
```typescript
// Source: mirrors the cashSavingsDrain / savingsRateAt Dec-then-Money idiom in
// affordability/evaluate-scenario.ts (read this session).
import { Dec } from '../money/decimal-config.js';
import { Money } from '../money/money.js';
function fiTarget(spend: Money, annualHousing: Money, swrRate: string): Money {
  const numerator = new Dec(spend.add(annualHousing).toDecimalString());
  return Money.of(numerator.div(new Dec(swrRate)).toFixed());
}
```

### Anti-Patterns to Avoid
- **Re-implementing the monthly loop with a different intra-month order than `rentVsBuy`.** The baseline rent path MUST be numerically consistent with the proven `rentVsBuy` rent path or the anti-funnel comparison is corrupt. Reuse the same `monthlyGrowthFactor` and the same contribute-then-compound order.
- **Passing the project's own real rates through `toReal` again.** `returns.realAnnual` is ALREADY real (D-02) and consumed directly — double-converting is Pitfall 5 inverted. `toReal` is ONLY for the D-11 oracle case that deliberately supplies a nominal knob.
- **An iterative oracle.** An oracle that loops the same way the engine does is not independent (D-10). The oracle must be a closed-form analytic identity.
- **A `number` FI date that silently means "never."** Use a discriminated result, not a sentinel like `-1` or `Infinity` (D-07; `canonicalJson` forbids non-finite numbers anyway — it throws on `Infinity`).
- **Hardcoding the six bands or the max-horizon in code.** They are stored assumption data (ASMP-01/02). Hardcoding breaks reproducibility and sensitivity (Pitfall 10/11).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Monthly real compounding | A new `r/12` or `(1+r)^(1/12)` | `monthlyGrowthFactor` (promote to shared) | Naive `r/12` diverges from `rentVsBuy`; must match the golden-tested factor |
| Nominal→real conversion (oracle) | `nominal − inflation` | `toReal` (`(1+nom)/(1+inf)−1`) | Naive subtraction overstates real return (Pitfall 5); `toReal` is the only correct path and D-11 requires routing through it |
| The monthly ownership outflow | Re-summing P+I/tax/ins/maint/PMI | `buyMonthlyOutflowAt(input, month)` | Already time-varying (appreciation + PMI drop-off gating, CR-01); re-deriving risks the WR-02/WR-03 bugs Phase 2 already fixed |
| Forced-equity / remaining balance | A second amortization | `amortizationSchedule(...).rows[m-1].balance` | Exact-zero-payoff invariant proven; index-clamp pattern shown in `rentVsBuy` |
| Appreciated home/assessed value at FI year | New `(1+appr)^year` | `homeValueAt` / `assessedValueAt` | DRY appreciation idiom (one place) |
| FI-target division | Widening `Money` with `div` | `Dec` then `Money.of(d.toFixed())` | Precedent: `Money` deliberately has no `div`; division lives in `Dec` |
| Versioned tunables | An ad-hoc config object | AssumptionsV3 + `v2ToV3` migrate arm | The discriminatedUnion + migrate pattern is the established, snapshot-safe way |
| Result serialization | Custom JSON | `canonicalJson` | Money→string, key-sorted, float-free, golden-compatible |

**Key insight:** Phase 4's correctness comes almost entirely from *not* writing new financial math. The substrate is golden-tested. The new code is target arithmetic, a termination-guaranteed loop, ranking, and a perturbation harness — orchestration, not arithmetic.

## Runtime State Inventory

> Greenfield-feature phase (adds a new module + one household field + one assumption-version bump). No rename/refactor/migration of existing stored state. The one migration-shaped concern is the assumption SCHEMA version bump (V2→V3), handled below.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — no persistence layer exists yet (Phase 6). `targetAnnualRetirementSpend` is a new optional household field; no existing records to migrate. | None (code-only). Phase 6 persists it later. |
| Live service config | None — pure library, no external services. | None — verified (no services in `@house/core`). |
| OS-registered state | None. | None. |
| Secrets/env vars | Only `UPDATE_GOLDEN` (test-harness env, already whitelisted in `eslint.config.ts`). New oracle/golden fixtures reuse the same gated regen path — no new env var. | None. |
| Build artifacts | New `fi/` source compiled by `tsc -b`; new `*.type-test.ts` joins the type-test graph; new `__fixtures__/*.json` golden(s). If AssumptionsV3 is added, the existing `golden-snapshot.json` / `tco-golden-snapshot.json` / `affordability-golden-snapshot.json` are recomputed ONLY if their serialized assumptions change. | See "Schema bump landmine" (L5): adding V3 slices to `DEFAULT_ASSUMPTIONS` changes the serialized assumptions in those goldens → they must be regenerated via `UPDATE_GOLDEN=1` and the diff reviewed. |

**Schema-version migration (the one migration-shaped task):** Bumping to AssumptionsV3 requires: append `AssumptionsV3` to the `discriminatedUnion`, bump `CURRENT_VERSION` to 3, add a `case 2: return v2ToV3(set)` arm in `migrate.ts`, seed the new slices in `DEFAULT_ASSUMPTIONS`, and update `migrate.test.ts`. This is the exact pattern `v1ToV2` already demonstrates (read this session).

## Common Pitfalls

### Pitfall 1: Oracle/engine intra-month convention mismatch (the flagship landmine)
**What goes wrong:** The closed-form oracle and the iterative engine use different assumptions about *when* in the month the contribution lands vs. when growth applies (annuity-due vs ordinary annuity; contribute-then-grow vs grow-then-contribute). They disagree by 1–3 months and the "reconciliation" reads as a bug for days.
**Why it happens:** `rentVsBuy` (lines 228–264) invests the difference, *then* compounds, *then* grows next month's rent. The closed-form FV-of-annuity has two standard forms (ordinary: `FV = C·((1+i)^n − 1)/i`; due: ×`(1+i)`). They differ by one period of growth.
**How to avoid:** LOCK the engine's order to match `rentVsBuy` (contribute at month start, then compound). Derive the closed form for THAT convention and document it in the oracle test. Implement the 0%-return linear case FIRST as the convention anchor (it has no compounding ambiguity: `n = ceil((target − seed)/contribution)`), then add the compounding case.
**Warning signs:** Oracle and engine agree at 0% but drift at 5%; off-by-one-month differences; `toBeCloseTo` creeping into FI-date tests.

### Pitfall 2: Vacuous high-inflation oracle case (bypasses Fisher)
**What goes wrong:** A "high-inflation" test that just sets a high real return tests nothing about inflation — the all-real engine never sees inflation (D-11).
**Why it happens:** It's tempting to construct the edge case in real terms because the engine is all-real.
**How to avoid:** Supply a NOMINAL return + high inflation in the test, convert with `toReal` to get the real rate the engine consumes, and assert the FI date that real rate produces. Document that the case's whole purpose is exercising the Fisher path (D-11).
**Warning signs:** The high-inflation fixture has no `toReal` call; inflation appears nowhere in the test's derivation.

### Pitfall 3: Non-terminating projection / no first-class unreachable verdict
**What goes wrong:** A buy scenario whose monthly premium drives savings non-positive never approaches its target; an unbounded loop hangs, or a sentinel FI date silently sorts as "great."
**Why it happens:** Forgetting the cap, or modeling "never" as `Infinity`/`-1`.
**How to avoid:** Project to the stored max-horizon (D-07); return a discriminated `FiNotReached` variant that the ranking sorts last (D-08) and that surfaces as the "don't buy" signal (FI-06). Note `canonicalJson` THROWS on non-finite numbers — a sentinel `Infinity` would crash serialization, which is a useful forcing function toward the discriminated variant.
**Warning signs:** No max-horizon read from assumptions; FI date typed as bare `number`; unreachable scenario sorts above a reachable one.

### Pitfall 4: Real/nominal mixing in the targets (Pitfall 5 family)
**What goes wrong:** Computing the owner's perpetual carrying cost on today's value while the engine projects appreciated values (or vice versa), so the target and the trajectory live in different dollar bases.
**How to avoid:** Pick ONE consistent all-real treatment for the owner target's housing basis (recommendation §3: appreciated home value at the FI year) and document it. Keep `spend` and rent in today's dollars (they don't appreciate in this model — `rent.realGrowthAnnual` default "0").
**Warning signs:** The owner target uses `homeValueAt(...,0)` while equity uses `homeValueAt(...,FIyear)`.

### Pitfall 5: Sensitivity bolted on instead of designed in (Pitfall 10)
**What goes wrong:** The tornado special-cases each driver instead of being a uniform "perturb one assumption, re-run the pure projection."
**How to avoid:** Make `projectFiDate` a pure function of `(EngineInput)` with assumptions fully in the input, then the tornado is `for each driver: project(withPerturbedAssumption(input, driver, ±band))`. No new math per driver.
**Warning signs:** A `switch (driver)` with bespoke math per arm; bands hardcoded in `sensitivity.ts`.

## Code Examples

### Asymmetric FI targets (D-02), owner basis at FI year (§3 recommendation)
```typescript
// Source: composed from carrying-costs.ts (homeValueAt, maintenanceAnnual),
// property-tax.ts (assessedValueAt, annualPropertyTax), tco.ts (resolvedMillRate, insurance).
// Owner perpetual housing evaluated at the FI horizon year (consistent all-real — §3).
import { Dec } from '../money/decimal-config.js';
import { Money } from '../money/money.js';

function annualOwnerHousingAt(input: EngineInput, tco: TcoBreakdown, fiYear: number): Money {
  const { price } = input.scenario;
  const { assessmentRatio } = input.assumptions.tax;
  const appr = input.assumptions.appreciation.realAnnual;
  const maintPct = input.assumptions.maintenance.annualPctOfValue;
  const assessed = assessedValueAt(price, assessmentRatio, appr, fiYear);
  const tax = annualPropertyTax(assessed, tco.resolvedMillRate);
  const maint = maintenanceAnnual(homeValueAt(price, appr, fiYear), maintPct);
  const insurance = tco.insurance.annualized; // flat in today's dollars (carrying-costs.ts)
  return tax.add(maint).add(insurance);
}
```

### Closed-form FV-of-annuity oracle, solve-for-n (D-10), matching the contribute-then-grow convention
```typescript
// Source: standard FV-of-annuity identity, derived for the engine's contribute-at-start order.
// Lives in the TEST (independent oracle, NOT a production path). Uses Dec.ln (verified available).
// Solve smallest n with:  seed·f^n + C·f·(f^n − 1)/(f − 1) ≥ target,   where f = (1+r)^(1/12).
// Closed form for n (continuous, then ceil to whole months):
//   let A = target·(f−1) + C·f ;  let B = seed·(f−1) + C·f ;  n = ln(A/B) / ln(f)
import { Dec } from '../../money/decimal-config.js';
function oracleFiMonths(seed: string, contribution: string, target: string, realAnnual: string): number {
  const f = new Dec(1).plus(new Dec(realAnnual)).pow(new Dec(1).div(12));
  const C = new Dec(contribution);
  if (f.equals(1)) {                                  // 0%-return degenerate → linear
    const gap = new Dec(target).minus(new Dec(seed));
    if (C.lessThanOrEqualTo(0)) return Infinity;       // unreachable
    return Math.ceil(Number(gap.div(C).toFixed()));
  }
  const fm1 = f.minus(1);
  const A = new Dec(target).times(fm1).plus(C.times(f));
  const B = new Dec(seed).times(fm1).plus(C.times(f));
  if (A.dividedBy(B).lessThanOrEqualTo(0)) return Infinity;
  const n = A.dividedBy(B).ln().dividedBy(f.ln());
  return Math.ceil(Number(n.toFixed()));
}
// NB: the engine loop and this formula MUST use the SAME convention. Assert |oracle − engine| === 0
// (exact months) for the 0% case; allow at most ±1 month elsewhere ONLY if a documented
// ceil/continuous rounding edge is unavoidable — prefer exact agreement by matching conventions.
```

### Sensitivity as a cheap re-run (ASMP-02 / D-14)
```typescript
// Source: the "parameterized pure function" architecture (Pitfall 10). One projection fn,
// re-run with one perturbed assumption per driver; bands read from the V3 sensitivity slice.
const DRIVERS = ['return','inflation','appreciation','maintenance','tax','swr'] as const;
function tornado(input: EngineInput): TornadoResult {
  const base = projectFiDate(buyPath(input));
  const rows = DRIVERS.map((d) => {
    const lo = projectFiDate(buyPath(perturb(input, d, '-')));
    const hi = projectFiDate(buyPath(perturb(input, d, '+')));
    return { driver: d, low: lo, base, high: hi, swingMonths: swing(lo, hi) };
  });
  rows.sort((a, b) => b.swingMonths - a.swingMonths);   // descending magnitude (D-14)
  return { rows, topDrivers: rows.slice(0, 3).map((r) => r.driver) };
}
```

## State of the Art

| Old Approach | Current Approach | Why |
|--------------|------------------|-----|
| 4% rule / 25× spending | Long-horizon SWR ~3–3.5% (`swr.rate` default "0.033") | 4% is a 30-yr rule; this targets 40–55 yr (Pitfall 7); already the default — DON'T regress it |
| Single confident FI date | FI date ALWAYS paired with a sensitivity band (tornado) | False precision (Pitfall 8/10); "no headline number without a range" (D-12) |
| Naive `nominal − inflation` | Fisher `(1+nom)/(1+inf)−1` (`toReal`) | Naive overstates real return (Pitfall 5); already implemented |
| Asymmetric opportunity cost (renter invests, owner doesn't) | Symmetric two-portfolio invest-the-difference (`rentVsBuy`) | Pitfall 6; already proven in Phase 2 |

**Deprecated/outdated for this phase:** Monte-Carlo / sequence-of-returns is explicitly OUT (REQUIREMENTS Out-of-Scope; D-06) — deterministic projection + sensitivity bands is the honest, in-scope answer. Do not add stochastic modeling.

## Detailed Findings on the Six De-Risk Areas

### 1. FV-of-annuity closed-form oracle (D-10) — exact formula + edge handling
The engine projects `NW_{m} = (NW_{m-1} + C)·f` with `f = (1+r)^(1/12)`, `C` the monthly contribution, seed `S` (buy: net of DP+closing). Unrolled, after `n` months: `NW_n = S·f^n + C·(f^n + f^{n-1} + … + f^1) = S·f^n + C·f·(f^n − 1)/(f − 1)`. Solve `NW_n ≥ T` for the smallest integer `n`: `f^n ≥ (T(f−1) + Cf) / (S(f−1) + Cf)`, hence `n = ⌈ ln(A/B) / ln(f) ⌉` with `A = T(f−1)+Cf`, `B = S(f−1)+Cf` (formula in the code example). **`Dec.ln` exists (verified)**, so this is computable at full precision.
- **0%-return degenerate (ROADMAP SC3 required):** `f = 1`, the geometric series collapses to linear `NW_n = S + nC`, so `n = ⌈(T − S)/C⌉`. Hand-checkable; implement first as the convention anchor.
- **High-inflation case (D-11, MUST route Fisher):** supply nominal `r_nom` + high `inflation`, compute `r_real = toReal(r_nom, inflation)`, feed `r_real` to both the engine and `oracleFiMonths`. The test's whole point is that the Fisher conversion is exercised — assert the FI date the *real* rate produces.
- **Negative/zero net contribution → unreachable:** if `C ≤ 0` (premium swallows savings), `B`/`A` logic and the linear branch both yield unreachable → the engine returns `FiNotReached` and the oracle returns `Infinity`; assert they agree on unreachability.
- **Assertion discipline:** exact `===` on whole-month FI dates for the 0% case; for compounding cases, the ceil rounding is the only ambiguity — pin the convention so agreement is exact, and treat any >0-month gap as a real bug, not tolerance.

### 2. FI-date detection loop (D-03) — reuse + termination + encoding
- **Reuse:** the loop is `rentVsBuy`'s rent path (baseline) and a parallel buy path, both using the SAME `monthlyGrowthFactor`. Promote `monthlyGrowthFactor` from file-private (it's a `function` in `rent-vs-buy.ts`, not exported) to a within-package shared helper so the FI loop and oracle compound identically (Landmine L1).
- **Termination (D-07):** loop bound `maxHorizonMonths` read from the new V3 `projection.maxHorizonYears` slice × 12. No unbounded `while`.
- **Encoding (recommendation):** a discriminated union — `type FiOutcome = { kind: 'reached'; month: number; years: number } | { kind: 'unreached'; cappedAtMonth: number }`. This sorts cleanly (unreached last), serializes via `canonicalJson` (the `kind` string is verbatim, no non-finite numbers), and avoids the `Infinity` sentinel that `canonicalJson` rejects. The ranking maps `unreached` to `+∞`-equivalent ordering WITHOUT putting `Infinity` in the serialized object.

### 3. Asymmetric targets (D-02) — and the open "what value" question
- Renter target = `(spend + annualRent)/swr`. `annualRent` in today's dollars (rent real-growth default 0).
- Owner target = `(spend + annual(tax+ins+maint))/swr`. **Recommendation: evaluate tax+maint on the appreciated value at the FI YEAR** (`assessedValueAt(...,fiYear)`, `homeValueAt(...,fiYear)`), insurance flat. Rationale: the engine projects the owner's NW using appreciated equity and appreciated carrying costs throughout; making the perpetual target's housing basis the FI-year value keeps the target in the SAME all-real dollar basis as the trajectory it's compared against (Pitfall 4). Alternative — today's value (`year 0`) — is simpler but creates a basis mismatch between the rising trajectory and a frozen target. Document the choice in the result. **There is a chicken-and-egg subtlety:** the FI year depends on the target, and the target (under this recommendation) depends on the FI year. Resolve by either (a) a fixed-point iterate (project with a year-0 target to get a provisional FI year, recompute the target at that year, re-project — converges in 1–2 passes), or (b) accept the simpler year-0 basis to avoid the loop. **Recommend (b) year-0 basis if the planner wants to avoid the fixed point**, OR (a) with a documented 2-pass convergence if maximal consistency is wanted. Surface whichever is chosen explicitly. `[ASSUMED — needs a locked decision in planning]`
- **Surface both targets + their housing components** in the result (D-02 requires visibility): `{ renterTarget: Money, ownerTarget: Money, renterHousingAnnual: Money, ownerHousingAnnual: Money }`.

### 4. Buy-path NW composition (Claude's discretion) — recommend liquid + home equity
- **Recommendation: liquid investments + liquidated home equity**, consistent with `rentVsBuy`'s own `buyEndingNetWorth = liquidatedEquity + buyPortfolio` (lines 261, 279). Using a *different* NW definition here than the substrate uses would make the FI baseline inconsistent with the proven rent-vs-buy result.
- **Reuse the forced principal:** per month/year, `equity = homeValueAt(price, appr, year) − schedule.rows[m-1].balance`, liquidated `× (1 − sellCostPct)` — the exact composition `rentVsBuy` already computes (lines 253–261), including the index-clamp for holds past the amortization term.
- **Caveat to warn the planner:** counting liquidated equity assumes the house is sold at FI — defensible for an FI-date comparison (the renter has no house to sell, so comparing total liquidatable NW is apples-to-apples). Document this. The alternative (liquid-only) understates owner NW and biases toward "don't buy"; liquid+equity is the honest symmetric choice and matches Phase 2.

### 5. Sensitivity / tornado architecture (D-12/13/14)
- **Cheap re-run:** `projectFiDate` is a pure fn of `EngineInput`; tornado = perturb one assumption ±band, re-run. No per-driver math.
- **Bands as stored data (ASMP-02):** add a V3 `sensitivity` slice with the six bands and a `projection` slice with `maxHorizonYears`. **Recommend a Zod schema-version bump to V3** with a `v2ToV3` migrate arm seeding the bands from defaults (the established `v1ToV2` pattern). Storing them as first-class data (not hardcoded) is mandatory per ASMP-01/02 and Pitfall 11.
- **Band semantics:** most bands are absolute ± on a rate (return ±0.015, inflation ±0.01, appreciation ±0.01, maintenance ±0.005, swr ±0.005); **tax is ±15% RELATIVE** (D-12) — perturb the mill rate / `propertyRateAnnual` multiplicatively (`× 0.85` / `× 1.15`), not additively. Encode each band with its mode (absolute vs relative) so the perturbation is unambiguous. `[ASSUMED — exact band values are Claude's discretion per D-12]`
- **Result shape (D-14):** `{ rows: { driver, low: FiOutcome, base: FiOutcome, high: FiOutcome, swingMonths: number }[], topDrivers: string[] }`, rows sorted descending by `swingMonths`. An unreachable low/high contributes a max-magnitude swing (handle without `Infinity` in the serialized output).

### 6. Result object shapes & boundary discipline
- **All dollars cross as `Money`**; all FI/annuity/SWR/perturbation math in `Dec`; round to `Money` only at the boundary (the `evaluate-scenario.ts` / `rent-vs-buy.ts` precedent). `Dec` stays unexported.
- **Golden-master plug-in:** add an FI golden exactly like `canonicalTcoResult` / `canonicalAffordabilityResult` in `golden.test.ts` — a `canonicalFiResult(input)` that `canonicalJson`s the FI-impact result, with its own `__fixtures__/fi-golden-snapshot.json`, gated by `UPDATE_GOLDEN=1`. Add a round-trip assertion (serialize → re-parse through `parseHousehold`/`parseAssumptionSet` → recompute → byte-identical), since `targetAnnualRetirementSpend` is a new household leaf that must survive the boundary.
- **Oracle fixtures (D-10):** hand-verified numeric fixtures (0% + high-inflation-via-Fisher) as small pinned JSON or inline test constants — human-readable, the independent agreement record.

## Open Questions

1. **Owner-target housing basis: today's value vs appreciated-at-FI-year (the §3 fixed point).**
   - What we know: both are valid all-real treatments; appreciated-at-FI-year is more consistent with the trajectory but introduces a target↔FI-year fixed point.
   - What's unclear: whether the planner wants the 2-pass convergence (max consistency) or the simpler year-0 basis (no loop).
   - Recommendation: default to **year-0 basis** for simplicity unless the discuss/plan step opts into the documented 2-pass. Lock and surface either way.
2. **AssumptionsV3 bump vs. threading bands separately.**
   - What we know: bands + max-horizon are tunables calc reads → belong in the versioned AssumptionSet (ASMP-01/02).
   - Recommendation: **bump to V3** with `v2ToV3`. Accept that the three existing golden snapshots regenerate (reviewed diff) because their serialized assumptions gain the new slices (Landmine L5).
3. **Max-horizon default (D-07).** Recommendation: 60 years (720 months) — comfortably past any realistic FI date, guarantees termination, age-100-ish. `[ASSUMED — Claude's discretion]`
4. **`monthlyGrowthFactor` promotion.** It is currently file-private in `rent-vs-buy.ts`. Recommendation: extract to a shared within-package util (e.g. `tco/compounding.ts` or `fi/compounding.ts`) and have BOTH `rentVsBuy` and the FI loop import it, so the compounding factor has one definition (Landmine L1). This is a small, safe refactor; the `rentVsBuy` golden must stay byte-identical (it will, since the math is unchanged).

## Environment Availability

> Pure-library phase. No external tools/services/runtimes beyond the existing Node + npm workspace toolchain already proven by Phases 1–3. Step 2.6: effectively SKIPPED — the only dependency, `decimal.js@^10.6.0`, is present and verified (`ln`/`log`/`pow` available).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4 (`projects` config; core runs in `node` env) — per CLAUDE.md + Phases 1–3 |
| Config file | Root `vitest.config.ts` (+ shared `vitest.shared.ts`); core has its own project |
| Quick run command | `npx vitest run packages/core/src/fi` (the new module's tests) |
| Full suite command | `npm test` (or `npx vitest run` at root) |
| Golden regen (gated) | `UPDATE_GOLDEN=1 npx vitest run packages/core/src/golden.test.ts` (then review diff) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| FI-01 | DP+closing seed reduction + monthly premium decomposition | unit | `npx vitest run packages/core/src/fi/fi-impact.test.ts` | ❌ Wave 0 |
| FI-02 | Monthly projection + FI date vs baseline; SWR default 0.033 | unit | `npx vitest run packages/core/src/fi/projection.test.ts` | ❌ Wave 0 |
| FI-03 | FI-date delta in months and years | unit | `npx vitest run packages/core/src/fi/fi-impact.test.ts` | ❌ Wave 0 |
| FI-04 | N-scenario ranking, baseline row0, unreachable last | unit | `npx vitest run packages/core/src/fi/compare.test.ts` | ❌ Wave 0 |
| FI-05 | Oracle reconciliation: 0% (exact) + high-inflation (Fisher) | unit (oracle) | `npx vitest run packages/core/src/fi/oracle.test.ts` | ❌ Wave 0 |
| FI-05 | FI result recomputes cent-identically (golden) | golden | `npx vitest run packages/core/src/golden.test.ts` | ⚠️ extend existing |
| FI-06 | A realistic input set yields "don't buy" / unreachable | unit | `npx vitest run packages/core/src/fi/compare.test.ts` | ❌ Wave 0 |
| ASMP-02 | Tornado: six drivers, ranked swing, top flagged | unit | `npx vitest run packages/core/src/fi/sensitivity.test.ts` | ❌ Wave 0 |
| (boundary) | No-bare-number on FI result types | type-test | `tsc -b` (`fi.type-test.ts`) | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run packages/core/src/fi`
- **Per wave merge:** `npm test` (full core suite, incl. golden + round-trip)
- **Phase gate:** full suite green + golden recomputes (review any regenerated fixture diff) before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `packages/core/src/fi/oracle.test.ts` — the FV-of-annuity oracle (0% exact + high-inflation Fisher) — covers FI-05
- [ ] `packages/core/src/fi/projection.test.ts` — monthly loop, termination, unreachable verdict — covers FI-02, FI-06
- [ ] `packages/core/src/fi/fi-impact.test.ts` — target asymmetry surfaced, FI delta — covers FI-01, FI-03
- [ ] `packages/core/src/fi/compare.test.ts` — ranking + don't-buy row — covers FI-04, FI-06
- [ ] `packages/core/src/fi/sensitivity.test.ts` — tornado ranking — covers ASMP-02
- [ ] `packages/core/src/fi/fi.type-test.ts` — no-bare-number on result types (the `tco.type-test.ts` precedent)
- [ ] Extend `golden.test.ts` + add `__fixtures__/fi-golden-snapshot.json` (+ round-trip through `parseHousehold` for the new field)
- [ ] If V3: update `migrate.test.ts` for the `v2ToV3` arm; regenerate the three existing goldens (reviewed)
- [ ] Framework install: none — Vitest 4 already configured

## Security Domain

> `security_enforcement` status not found in a config file this session; treating as enabled and scoping honestly. This is a pure, offline calculation library with NO network, auth, filesystem (beyond the gated test-harness golden write), or PII surface. The relevant control is the existing **input trust boundary**.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No auth surface (private 2-user local tool; out of scope per REQUIREMENTS) |
| V3 Session Management | no | No sessions |
| V4 Access Control | no | No multi-tenant / access surface |
| V5 Input Validation | **yes** | The new `targetAnnualRetirementSpend` field MUST go through `HouseholdSchema` (`decStr`, `.strict()`); the new V3 assumption slices MUST be `decStr` leaves in a `.strict()` group; bands/max-horizon validated at the Zod boundary. NO bare `z.number()` (Pitfall 7 / T-03-02). |
| V6 Cryptography | no | No crypto in scope |

### Known Threat Patterns for a pure decimal calc core
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Forged/corrupt snapshot smuggling a non-canonical number or extra key | Tampering | `decStr` + `.strict()` Zod at every boundary; `parseHousehold`/`parseAssumptionSet`; the existing pattern — extend it to the new field/slices, never `as`-cast raw JSON |
| Non-finite value (NaN/Infinity) poisoning a result or golden | Tampering | `Money.of` rejects non-canonical strings; `canonicalJson` throws on non-finite numbers — keep the unreachable verdict a discriminated variant, NOT an `Infinity` sentinel |
| Float re-entering the money path | Tampering | All dollars as `Money`; all math in `Dec`; `fi.type-test.ts` no-bare-number guard; `Dec` stays unexported |
| Non-determinism (ambient date/random) breaking reproducibility | Repudiation | No `Date.now`/`Math.random` (determinism guard throws); `asOf` + all assumptions + bands + max-horizon are explicit data on `EngineInput` (Pitfall 11) |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Owner-target housing basis = appreciated value at FI year (vs year-0); recommend year-0 if avoiding the fixed point | §3 / Open Q1 | Basis mismatch between target and trajectory (Pitfall 4) shifts the owner FI date by months–years; either choice is defensible if documented |
| A2 | Bump to AssumptionsV3 for bands + max-horizon | §5 / Open Q2 | Wrong call only costs a migrate arm + golden regen; the data MUST be stored (ASMP-01/02) regardless |
| A3 | Max-horizon default = 60 years (720 months) | Open Q3 | Too short → false "unreachable"; 60yr is safely past any realistic FI date |
| A4 | Exact final band values (return ±1.5%, tax ±15% relative, etc.) | §5 | Bands are explicitly Claude's discretion (D-12); only affects tornado magnitudes, not architecture |
| A5 | Buy-path NW = liquid + liquidated equity | §4 | Liquid-only biases toward "don't buy"; liquid+equity matches the proven `rentVsBuy` definition — the consistent choice |
| A6 | Promote `monthlyGrowthFactor` to a shared within-package helper | §2 / Open Q4 | If not shared and re-implemented, the FI baseline could diverge from the golden-tested `rentVsBuy` (Landmine L1) |

**These six `[ASSUMED]` items are the discretionary decisions CONTEXT.md explicitly leaves to Claude (D-02 basis, D-07 default, D-08 shape, D-12 bands, buy-path composition, schema-version bump). They are architecture-shaping recommendations, not verified external facts — confirm during planning/discuss before locking.**

## Landmines (warn the planner explicitly)

- **L1 — Intra-month convention.** The oracle and engine MUST share contribute-then-compound order (matching `rent-vs-buy.ts` 234–244). Implement the 0% linear case first to lock it. `monthlyGrowthFactor` is currently file-private — promote to shared so there's ONE compounding factor.
- **L2 — Fisher routing.** The high-inflation oracle case is vacuous unless it supplies a nominal rate + inflation and routes through `toReal` (D-11). Do not construct it in real terms.
- **L3 — No `Infinity` in serialized results.** `canonicalJson` THROWS on non-finite numbers (verified in source). The unreachable verdict must be a discriminated variant with a string `kind`, not a numeric sentinel.
- **L4 — Don't double-convert real rates.** `returns.realAnnual` is already real; never pass it through `toReal` (Pitfall 5 inverted).
- **L5 — V3 bump regenerates existing goldens.** Adding V3 slices to `DEFAULT_ASSUMPTIONS` changes the serialized assumptions in `golden-snapshot.json` / `tco-golden-snapshot.json` / `affordability-golden-snapshot.json` (they all serialize the full assumptions). Plan a deliberate `UPDATE_GOLDEN=1` regen + diff review as a task, and update `migrate.test.ts`.
- **L6 — Tax band is RELATIVE (±15%), the others absolute.** Perturb the tax driver multiplicatively, not additively (D-12).
- **L7 — Target↔FI-year fixed point** (only if A1 picks appreciated-at-FI-year). Either accept year-0 basis or document a 2-pass convergence.

## Sources

### Primary (HIGH confidence — read this session)
- `packages/core/src/index.ts` — public barrel; confirmed `Dec` NOT exported, the exact set of existing exports.
- `packages/core/src/tco/rent-vs-buy.ts` — `rentVsBuy`, `buyMonthlyOutflowAt`, `shouldChargePmi`, `monthlyGrowthFactor` (file-private), `toReal`; the intra-month loop order (lines 228–264) and ending-NW definition (liquid+equity).
- `packages/core/src/tco/{tco,carrying-costs,property-tax,amortization}.ts` — `computeTco`/`TcoBreakdown`, `homeValueAt`, `assessedValueAt`, `annualPropertyTax`, `maintenanceAnnual`, `amortizationSchedule`.
- `packages/core/src/engine/engine-input.ts` — `Household`/`HouseholdSchema`/`parseHousehold`, `EngineInput`, the `.strict()` decimal-string boundary the new field extends.
- `packages/core/src/assumptions/{schema,defaults,migrate}.ts` — `AssumptionsV2`, `discriminatedUnion`, `v1ToV2` migrate pattern, verified default values (`swr.rate "0.033"`, etc.).
- `packages/core/src/money/{money,decimal-config}.ts` — closed `Money` API (no `div`), 34-digit HALF_EVEN `Dec`.
- `packages/core/src/serialize/canonical-json.ts` — Money→string, key-sorted, throws on non-finite (the L3 forcing function).
- `packages/core/src/golden.test.ts` + `__fixtures__/*.json` — the `UPDATE_GOLDEN`-gated golden + round-trip pattern the FI golden mirrors.
- `packages/core/src/affordability/evaluate-scenario.ts` — the Dec-then-Money result idiom Phase 4 follows.
- `.planning/phases/04-.../04-CONTEXT.md`, `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md`, `.planning/research/PITFALLS.md`, `CLAUDE.md` — binding decisions, requirements, acceptance bar, pitfalls, stack.
- `decimal.js@^10.6.0` — `ln`/`log`/`pow` availability verified via Node this session (enables the closed-form solve-for-n in `Dec`).

### Secondary / Tertiary
- None required — all findings grounded in primary sources above.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every reused symbol read from current source this session.
- Architecture: HIGH — composition over a golden-tested substrate; the one refactor (promote `monthlyGrowthFactor`) is small and safe.
- Pitfalls: HIGH — drawn from the project's own PITFALLS.md and verified against the actual code (the `Infinity`/canonicalJson and intra-month-order landmines were confirmed in source).
- Discretionary defaults (basis, bands, max-horizon, encoding): MEDIUM — explicitly Claude's-discretion per CONTEXT.md; recommended with rationale, flagged `[ASSUMED]` for confirmation.

**Research date:** 2026-06-26
**Valid until:** ~2026-07-26 (stable — internal codebase, no fast-moving external deps; re-verify only if `@house/core` substrate signatures change).
