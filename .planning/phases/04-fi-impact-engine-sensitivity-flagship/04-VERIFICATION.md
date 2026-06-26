---
phase: 04-fi-impact-engine-sensitivity-flagship
verified: 2026-06-26T19:00:00Z
status: passed
score: 5/5 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 4/5
  gaps_closed:
    - "Sensitivity tornado ships a FI-date swing for the TAX driver — millRateOverride wired through computeTco → ownerHousingAt + buyMonthlyOutflowAt, swingMonths > 0 asserted and passing"
    - "CR-01: swr.rate=0 and negative both rejected at the Zod V3 boundary (.refine) and caught depth-in-depth in divideBySwr; tornado swr low-band clamped to SWR_FLOOR='0.0001'"
    - "WR-01/IN-02/IN-04: equityFor year index reconciled to Math.max(0,floor(month/12)) — month 12 now agrees with rentVsBuy at year 1; month 0 clamped to year 0; false 'verbatim' comments corrected"
  gaps_remaining: []
  regressions: []
---

# Phase 4: FI-Impact Engine & Sensitivity Verification Report

**Phase Goal:** Deliver the headline product — model the down payment + closing costs as foregone investment and the monthly housing delta as a foregone contribution, project net-worth and FI date vs the no-purchase baseline, rank N scenarios by FI-date impact, reconcile the math against an oracle, ship sensitivity bands, and prove the tool can say "don't buy."
**Verified:** 2026-06-26
**Status:** passed
**Re-verification:** Yes — after gap closure (plans 04-05 and 04-06 executed and committed)

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 1 | Engine models DP+closing as foregone investment + monthly housing delta as foregone contribution; projects NW + FI date vs no-purchase baseline; single real-vs-nominal convention; configurable real return; long-horizon SWR (~3–3.5%) | VERIFIED | `fi-impact.ts` buyPath: seed = NW − (DP+closing); contributionFor = monthlySavings − premium; `defaults.ts` swr.rate '0.033'; returns.realAnnual '0.05'; all-real convention enforced |
| 2 | Outputs FI-date shift (months AND years) per scenario; compares N scenarios ranked by FI-date impact | VERIFIED | `fi-impact.ts` FiImpactResult.fiDeltaMonths (number) + fiDeltaYears (decimal string); `compare.ts` compareScenarios with baseline row 0, buys ranked by delta ascending, unreached last |
| 3 | FI projection math reconciles against an independent oracle (golden-master) across several cases incl. 0% return and high-inflation edges | VERIFIED | `oracle.test.ts` closed-form FV-of-annuity oracle (non-iterative); exact === for 0%, 5%, 3%; Fisher high-inflation; fi-golden-snapshot.json buy month 175 / baseline 217 / fiDeltaMonths -42 — byte-identical after gap closure |
| 4 | A realistic input set produces a "rent and invest / don't buy" verdict as a first-class comparison row | VERIFIED | fi-impact.test.ts STRAINED_HOUSEHOLD: buy.kind === 'unreached', baseline.kind === 'reached'; compare.test.ts BRUTAL scenario sorts unreached last; 0 Infinity literals in compare.ts |
| 5 | Sensitivity tornado ships: one-way FI-date swing across the drivers (return, inflation, appreciation, maintenance, tax, SWR) with top drivers labeled | VERIFIED | sensitivity.ts: 6 drivers, relative tax band (L6), sorted DESC by swingMonths, topDrivers[3], no Infinity. TAX driver now bites: millRateOverride set by perturb → computeTco effectiveMillRate → annualPropertyTax in ownerHousingAt (fi-target.ts:60) AND buyMonthlyOutflowAt (rent-vs-buy.ts:138). Test `sensitivity.test.ts:99` asserts `taxRow.swingMonths > 0` — PASSING. Direction sanity asserted. taxBandRelative '0' collapses swing to zero (stored-band sourcing proven). Pitfall 10 preserved: no switch(driver) projection math |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/core/src/assumptions/schema.ts` | V3 with optional `tax.millRateOverride` + positivity `.refine` on `swr.rate` | VERIFIED | Line 169: `millRateOverride: decStr.optional()`; Lines 190-193: `rate: decStr.refine((s) => Number(s) > 0, {...})` on V3 swr group |
| `packages/core/src/tco/tco.ts` | `computeTco` honors `tax.millRateOverride`, falling back to `resolveMillRate(town)` | VERIFIED | Line 164: `const effectiveMillRate = assumptions.tax.millRateOverride ?? resolved.residentialMillRate`; line 173: `annualPropertyTax(assessedValueYear0, effectiveMillRate)`; line 237: `resolvedMillRate: effectiveMillRate` |
| `packages/core/src/fi/fi-target.ts` | `divideBySwr` defense-in-depth guard (non-positive swr throws); `ownerHousingAt` reads `tco.resolvedMillRate` | VERIFIED | Lines 73-77: `if (r.lessThanOrEqualTo(0)) throw new Error(...)` in divideBySwr; line 60: `annualPropertyTax(assessed, tco.resolvedMillRate)` |
| `packages/core/src/fi/sensitivity.ts` | tax driver sets `tax.millRateOverride` from the live rate; swr low-band clamped to SWR_FLOOR | VERIFIED | Lines 165-175: tax arm uses `relative(baseRate, band, dir)` into `millRateOverride`; lines 116-126: `SWR_FLOOR = '0.0001'`, `absoluteClampedPositive`; lines 183-188: swr arm applies clamp for dir '-' |
| `packages/core/src/fi/fi-impact.ts` | `buyEquityAt` exported, year = `Math.max(0, Math.floor(month/12))`, false comments corrected | VERIFIED | Lines 134-149: exported `buyEquityAt` with `const year = Math.max(0, Math.floor(month / 12))`; comments at 118-119 and 191 correctly state "NOT a verbatim copy" and "RECONCILED" |
| `packages/core/src/__fixtures__/fi-golden-snapshot.json` | Committed FI golden — byte-identical after gap closure | VERIFIED | buy `{kind:'reached',month:175}`, baseline `{month:217}`, fiDeltaMonths:-42 — unchanged |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `sensitivity.ts` tax driver | `tco.ts` computeTco | `tax.millRateOverride` set in `perturb` → `apply`; `effectiveMillRate` in computeTco | WIRED | `sensitivity.ts:174` sets `millRateOverride`; `tco.ts:164` reads it via `??` fallback |
| `computeTco` | `fi-target.ts` ownerHousingAt | `tco.resolvedMillRate` (= effectiveMillRate) consumed at `fi-target.ts:60` | WIRED | `ownerHousingAt` reads `tco.resolvedMillRate` for `annualPropertyTax` |
| `computeTco` | `rent-vs-buy.ts` buyMonthlyOutflowAt | `tco.resolvedMillRate` consumed at `rent-vs-buy.ts:138` | WIRED | `buyMonthlyOutflowAt` reads `tco.resolvedMillRate` for monthly property-tax |
| `schema.ts` swr.rate `.refine` | `fi-target.ts` divideBySwr | boundary refine rejects non-positive at parse; depth guard throws if bypassed | WIRED | `schema.ts:190` refine gate; `fi-target.ts:73` lessThanOrEqualTo(0) throw |
| `sensitivity.ts` swr arm | `SWR_FLOOR` clamp | `absoluteClampedPositive` clamps the low sweep so the perturbed input passes the now-stricter boundary | WIRED | `sensitivity.ts:123-126` function; `sensitivity.ts:186` call in the swr apply arm |
| `fi-impact.ts` buyEquityAt | `rent-vs-buy.ts` equity convention | `Math.max(0, Math.floor(month/12))` — agrees with `month/12` at every year boundary | WIRED | `fi-impact.ts:143` year derivation; `fi-impact.test.ts:186-198` pin test asserts month 12 → year 1 and strictly greater than old year-0 basis |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|-------------------|--------|
| `sensitivity.ts` tax driver | `tax.millRateOverride` (perturbed mill rate) | `resolveMillRate(input.scenario.town).residentialMillRate` seeded in `perturb`; then `relative(baseRate, band, dir)` | Yes — resolved from seeded Newton town table; band from stored V3 sensitivity.taxBandRelative | FLOWING |
| `tco.ts` effectiveMillRate | `assumptions.tax.millRateOverride ?? resolved.residentialMillRate` | Override present → perturbed value; absent → town table | Yes | FLOWING |
| `fi-target.ts` ownerHousingAt → tax | `annualPropertyTax(assessed, tco.resolvedMillRate)` | `tco.resolvedMillRate` = effectiveMillRate from computeTco above | Yes — perturbed mill rate reaches the owner perpetual-tax target | FLOWING |
| `rent-vs-buy.ts` buyMonthlyOutflowAt → propertyTax | `annualPropertyTax(assessedValue, tco.resolvedMillRate)` | Same `tco.resolvedMillRate` = effectiveMillRate | Yes — perturbed mill rate reaches the monthly ownership premium | FLOWING |
| `fi-impact.ts` buyEquityAt | `year = Math.max(0, Math.floor(month/12))` | homeValueAt(price, appr, year) | Yes — agrees with rentVsBuy at year boundaries; month 0 → year 0 (no negative year) | FLOWING |
| `fi-golden-snapshot.json` | buy month 175, baseline 217, fiDeltaMonths -42 | `canonicalJson(fiImpact(fixedInput()))` — byte-identical after gap closure | Yes — equityFor reconciliation did not straddle a year boundary for this input | FLOWING |

### Behavioral Spot-Checks

| Behavior | Evidence | Status |
|----------|----------|--------|
| Tax driver swingMonths > 0 for a reached scenario | `sensitivity.test.ts:99` `expect(taxRow.swingMonths).toBeGreaterThan(0)` — PASSING (355 green, confirmed by live `npm test` run) | VERIFIED |
| Tax low endpoint FI month <= high endpoint FI month (higher tax delays FI when buying) | `sensitivity.test.ts:104-106` direction sanity assertion — PASSING | VERIFIED |
| taxBandRelative '0' collapses tax row to zero swing | `sensitivity.test.ts:136-138` — low === base, high === base, swingMonths === 0 — PASSING | VERIFIED |
| swr.rate '0' rejected at boundary | `schema.test.ts:124-132` safeParse fails with /swr\.rate/ message — PASSING | VERIFIED |
| swr.rate '-0.001' rejected at boundary | `schema.test.ts:135-141` safeParse fails — PASSING | VERIFIED |
| divideBySwr forged zero throws clear error | `fi-target.test.ts:173-176` forged swr='0' throws /swr\.rate/ — PASSING | VERIFIED |
| divideBySwr forged negative throws clear error | `fi-target.test.ts:178-181` forged swr='-0.01' throws /swr\.rate/ — PASSING | VERIFIED |
| swr low-band clamp: swr.rate 0.004, swrBand 0.005 stays well-formed | `sensitivity.test.ts:199-225` — swr row low/base/high all valid, finite swingMonths, no Infinity in serialized result — PASSING | VERIFIED |
| equityFor month 12 → year 1 (agrees with rentVsBuy) | `fi-impact.test.ts:186-198` pin test, including strict greater-than the old year-0 basis — PASSING | VERIFIED |
| equityFor month 0 → year 0 (no negative year, IN-02) | `fi-impact.test.ts:201-208` — PASSING | VERIFIED |
| FI golden byte-identical | `golden.test.ts` — buy month 175, baseline 217, fiDeltaMonths -42 unchanged; git diff on fi-golden-snapshot.json is empty | VERIFIED |
| Full suite | `npm test` → 355 passed, 31 files, 0 failed (run confirmed live) | VERIFIED |

### Probe Execution

No probe scripts declared for this phase.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|---------|
| FI-01 | 04-01, 04-02, 04-03 | DP+closing as foregone investment; monthly delta as foregone contribution | SATISFIED | `fi-impact.ts` buyPath: seed = NW − (DP+closing), contributionFor = savings − premium |
| FI-02 | 04-02 | Projects NW + FI date vs no-purchase baseline; configurable real return; SWR ~3–3.5% | SATISFIED | `projection.ts` monthly loop; `defaults.ts` swr.rate '0.033', returns.realAnnual '0.05' |
| FI-03 | 04-03 | Outputs FI-date shift in months AND years | SATISFIED | FiImpactResult.fiDeltaMonths + fiDeltaYears (Dec string) |
| FI-04 | 04-03 | User can compare N scenarios ranked by FI-date impact | SATISFIED | `compareScenarios` in compare.ts; baseline row 0; ranked ascending; unreached last |
| FI-05 | 04-02, 04-04, 04-05 | FI projection math reconciles against independent oracle + golden | SATISFIED | oracle.test.ts closed-form analytic oracle; exact === for 0%/5%/3%; Fisher; fi-golden-snapshot.json byte-identical after all gap-closure plans; swr.rate guard closes the latent crash path that had been masked by passing defaults |
| FI-06 | 04-02, 04-03 | Tool can reach "don't buy" conclusion | SATISFIED | Discriminated kind:'unreached'; STRAINED scenario proves real don't-buy verdict |
| ASMP-02 | 04-04, 04-05 | Sensitivity analysis showing key outputs swing with key assumptions (return, maintenance, tax) | SATISFIED | Five absolute drivers + tax relative driver ALL produce non-zero FI-date swings. Tax driver now wired: millRateOverride → computeTco → tco.resolvedMillRate → ownerHousingAt + buyMonthlyOutflowAt. `swingMonths > 0` asserted and passing for tax. |

### Anti-Patterns Found

| File | Pattern | Severity | Impact |
|------|---------|----------|--------|
| `packages/core/src/fi/fi-impact.ts:164` | `tax.propertyRateAnnual` still present on V3 schema (inert dead leaf) | Info only | Kept for migrate stability and zero golden churn, per plan decision. Documented inline as "INERT (kept for migrate stability; property tax flows through the resolved mill rate)". No FIXME/TODO/TBD marker; the new `millRateOverride` path supersedes it. Intentional. |

No TBD, FIXME, or XXX debt markers found in any file modified by plans 04-05 or 04-06. The verbatim "this is identical to X" overclaim (IN-04) confirmed removed: `grep "verbatim" packages/core/src/fi/fi-impact.ts` returns only the accurate negations "NOT copied verbatim" and "NOT a verbatim copy."

### Human Verification Required

None. All verification is code-level for this phase.

## Re-Verification Summary

**Prior status:** gaps_found (4/5) — one BLOCKER (SC5 tax driver inert) plus code-review CR-01 (swr crash) and WR-01 (equity index divergence).

**Gaps closed by plan 04-05 (commits 2724585, 118e424, b52ee2f):**

1. GAP 1 / SC5 / ASMP-02: `tax.millRateOverride` added as an optional `decStr` leaf on V3 schema (absent from defaults, goldens untouched). `computeTco` derives `effectiveMillRate = millRateOverride ?? resolved.residentialMillRate` at the single resolution point. The tornado tax driver now sets `tax.millRateOverride` via `relative(baseRate, band, dir)` where `baseRate` is seeded from `resolveMillRate(input.scenario.town).residentialMillRate` inside `perturb`. Because `tco.resolvedMillRate` captures `effectiveMillRate`, the perturbation flows through BOTH `ownerHousingAt` (fi-target.ts:60 reads `tco.resolvedMillRate`) and `buyMonthlyOutflowAt` (rent-vs-buy.ts:138 reads `tco.resolvedMillRate`) with no further wiring changes. The test assertion `swingMonths > 0` is now real and passes. Pitfall 10 preserved: no `switch(driver)` projection math.

2. GAP 2 / CR-01: `swr.rate` positivity `.refine` added to V3 schema (load-bearing); `divideBySwr` defense-in-depth guard (clear error on non-positive, not `Money.of('Infinity')` or silent negative target); tornado swr low-band clamped to `SWR_FLOOR='0.0001'` via `absoluteClampedPositive`. Three-layer defense: boundary → depth → perturbation clamp.

**Gaps closed by plan 04-06 (commits 0c9a352, 94d328d):**

3. WR-01 / IN-02 / IN-04: `buyEquityAt` extracted as a pure exported module-level function. Year index changed from `Math.floor((month-1)/12)` to `Math.max(0, Math.floor(month/12))` — month 12 now yields year 1 (agrees with rentVsBuy's `month/12` at the boundary); month 0 yields year 0 (no negative year, closes IN-02). False "verbatim from rent-vs-buy.ts 246-253" comments replaced with accurate "NOT a verbatim copy — RECONCILED to share its valuation basis." FI golden byte-identical (buy month 175 unchanged; the reconciliation did not straddle a year boundary for the fixed golden input). Three convention-pin tests added.

**No regressions:** All previously-verified truths SC1–SC4 confirmed by live test run (355 green, 31 files). Four committed golden fixtures (canary, tco, affordability, fi) all byte-identical — no UPDATE_GOLDEN regeneration performed.

---

_Verified: 2026-06-26_
_Verifier: Claude (gsd-verifier)_
_Re-verification after gap closure (plans 04-05 + 04-06)_
