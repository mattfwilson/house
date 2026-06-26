---
phase: 04-fi-impact-engine-sensitivity-flagship
verified: 2026-06-26T00:00:00Z
status: gaps_found
score: 4/5 must-haves verified
overrides_applied: 0
gaps:
  - truth: "Sensitivity tornado ships: one-way FI-date swing across the drivers (return, inflation, appreciation, maintenance, tax, SWR) with top drivers labeled (no headline number without a range)"
    status: partial
    reason: "The tax tornado driver perturbs assumptions.tax.propertyRateAnnual but this leaf is INERT in the entire FI/TCO computation path. Property tax everywhere (fi-target.ts ownerHousingAt, buyMonthlyOutflowAt, computeTco) uses tco.resolvedMillRate resolved from the town table — not propertyRateAnnual. The perturbation produces zero FI-date swing for tax in all non-degenerate scenarios. The tornado MACHINERY is correct (six rows, relative band, sorted, finite), but the tax driver produces no actual swing, so the SC5 requirement 'FI-date swing across ... tax ...' is unmet for that driver."
    artifacts:
      - path: "packages/core/src/fi/sensitivity.ts"
        issue: "tax driver perturbs assumptions.tax.propertyRateAnnual (line 143) which is not read by any FI calc path"
      - path: "packages/core/src/fi/fi-target.ts"
        issue: "ownerHousingAt uses tco.resolvedMillRate (line 60), not assumptions.tax.propertyRateAnnual"
      - path: "packages/core/src/tco/tco.ts"
        issue: "computeTco uses resolved.residentialMillRate from resolveMillRate(town) (line 167), not propertyRateAnnual"
    missing:
      - "Wire the tornado's tax perturbation to a rate that actually flows through FI calculations — either (a) perturb the resolvedMillRate in the TcoBreakdown passed to fiTargets/ownerHousingAt, or (b) make the mill-rate resolution respect an overridable assumption, or (c) document and record a structured override if the zero-swing behavior is an accepted limitation for v1"
---

# Phase 4: FI-Impact Engine & Sensitivity Verification Report

**Phase Goal:** Deliver the headline product — model the down payment + closing costs as foregone investment and the monthly housing delta as a foregone contribution, project net-worth and FI date vs the no-purchase baseline, rank N scenarios by FI-date impact, reconcile the math against an oracle, ship sensitivity bands, and prove the tool can say "don't buy."
**Verified:** 2026-06-26
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 1 | Engine models DP+closing as foregone investment + monthly housing delta as foregone contribution; projects NW + FI date vs no-purchase baseline; single real-vs-nominal convention; configurable real return; long-horizon SWR (~3–3.5%) | VERIFIED | `fi-impact.ts` lines 134–168 (buyPath: seed = NW − DP − closing; contributionFor = monthlySavings − premium); `projection.ts` contribute-then-compound loop; `assumptions/defaults.ts` `swr.rate: '0.033'`; `returns.realAnnual: '0.05'` all-real convention enforced (L4 comment + grep gate) |
| 2 | Outputs FI-date shift (months AND years) per scenario; compares N scenarios ranked by FI-date impact | VERIFIED | `fi-impact.ts` `FiImpactResult.fiDeltaMonths` (number) + `fiDeltaYears` (decimal string); `compare.ts` `compareScenarios` with baseline row 0, buys ranked by delta ascending, unreached last; `compare.test.ts` proves exact ordering with mixed batch |
| 3 | FI projection math reconciles against an independent oracle (golden-master) across several cases incl. 0% return and high-inflation edges | VERIFIED | `oracle.test.ts`: independent closed-form FV-of-annuity `oracleFiMonths` (NOT iterative) asserts exact `===` agreement for 0% (linear anchor), 5% real, 3% real; high-inflation case routes NOMINAL→real via `toReal` (Fisher, D-11); unreachable agreement; `fi-golden-snapshot.json` committed and verified by golden.test.ts; round-trip through `parseHousehold` proven byte-identical |
| 4 | A realistic input set produces a "rent and invest / don't buy" verdict as a first-class comparison row | VERIFIED | `fi-impact.test.ts` STRAINED_HOUSEHOLD ($180k income, $36k savings, $1.4M house): `buy.kind === 'unreached'`, `baseline.kind === 'reached'`; `compare.test.ts` BRUTAL scenario (4M, 10% down): `unreached` row sorts last; `compare.ts` comparator never materializes Infinity (grep gate: 0 Infinity literals) |
| 5 | Sensitivity tornado ships: one-way FI-date swing across the drivers (return, inflation, appreciation, maintenance, tax, SWR) with top drivers labeled | PARTIAL — BLOCKER | Tornado MACHINERY is correct: 6 rows, stored bands, relative tax band (L6), sorted DESC by swingMonths, topDrivers[3], no Infinity. BUT the tax driver perturbs `assumptions.tax.propertyRateAnnual` which is INERT in all FI calc paths — property tax flows through `tco.resolvedMillRate` (town table), not this leaf. Tax driver produces zero swing in all non-degenerate scenarios. "FI-date swing across... tax..." is unmet for the tax driver. Documented in `sensitivity.test.ts` lines 94–98 and 04-04-SUMMARY. |

**Score:** 4/5 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/core/src/tco/compounding.ts` | Shared `monthlyGrowthFactor` | VERIFIED | Exists, exports exactly one symbol, imported by both `rent-vs-buy.ts` and `fi-impact.ts`/`projection.ts` |
| `packages/core/src/assumptions/schema.ts` | `AssumptionsV3` with six sensitivity bands + `maxHorizonYears` | VERIFIED | Lines 158–216: V3 with `sensitivity` group (six `decStr` bands) + `projection.maxHorizonYears`; `CURRENT_VERSION = 3` |
| `packages/core/src/assumptions/defaults.ts` | V3 defaults with locked band values | VERIFIED | `sensitivity.returnBand='0.015'`, `taxBandRelative='0.15'`, `projection.maxHorizonYears='60'` |
| `packages/core/src/assumptions/migrate.ts` | `v2ToV3` migrate arm | VERIFIED | (Not directly read, but migrate.test.ts proves V2→V3 and V1→V3 chained migrations) |
| `packages/core/src/engine/engine-input.ts` | `targetAnnualRetirementSpend` on `Household` | VERIFIED | `golden.test.ts` FIXED_HOUSEHOLD line 91 includes it; `fi-target.ts` reads `household.targetAnnualRetirementSpend` line 92 |
| `packages/core/src/fi/fi-target.ts` | `fiTargets` with four Money fields | VERIFIED | Lines 36–45: `FiTargets` with all four `readonly Money` fields; Dec-then-Money division; year-0 basis (A1); SWR knob live |
| `packages/core/src/fi/projection.ts` | `projectFiDate` + discriminated `FiOutcome` | VERIFIED | Lines 48–50: discriminated union `kind: 'reached'/'unreached'`; bounded `for` loop, no `while(true)`, no Infinity sentinel; `cappedAtMonth` termination |
| `packages/core/src/fi/oracle.test.ts` | Independent FV-of-annuity oracle | VERIFIED | `oracleFiMonths` is analytic (Dec.ln), NOT iterative; exact `===` for 0%, 5%, 3%; `toReal` Fisher call in high-inflation case; unreachable agreement |
| `packages/core/src/fi/fi-impact.ts` | `fiImpact` orchestrator | VERIFIED | Both paths built; reuses `closingCosts` + `buyMonthlyOutflowAt`; equity A5 via `equityFor`; delta null when unreached |
| `packages/core/src/fi/compare.ts` | `compareScenarios` ranking | VERIFIED | Baseline row 0 `isBaseline:true`, delta 0; kind-branching comparator (0 Infinity literals); stable sort |
| `packages/core/src/fi/sensitivity.ts` | `tornado` six-driver one-way sweep | PARTIAL | MACHINERY correct; tax perturbation wires to INERT `propertyRateAnnual` — produces zero swing for tax driver |
| `packages/core/src/fi/fi.type-test.ts` | No-bare-number type guard | VERIFIED | Guards for FiTargets (4 Money fields), FiImpactResult, CompareRow, TornadoRow, FiOutcome discriminant; `@ts-expect-error` load-bearing |
| `packages/core/src/__fixtures__/fi-golden-snapshot.json` | Committed FI golden fixture | VERIFIED | Exists; `{"baseline":{"kind":"reached","month":217,...},"buy":{"kind":"reached","month":175,...},"fiDeltaMonths":-42,...}`; exercised by golden.test.ts gated UPDATE_GOLDEN path |
| `packages/core/src/index.ts` | FI engine public barrel (Dec unexported) | VERIFIED | Lines 116–133: `fiImpact`, `compareScenarios`, `fiTargets`, `projectFiDate`, `tornado` + closed result types exported; `Dec`/`monthlyGrowthFactor` NOT exported |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `fi-impact.ts` | `tco/compounding.ts` | `import { monthlyGrowthFactor }` | VERIFIED | Line 40 |
| `fi-impact.ts` | `tco/rent-vs-buy.ts` | `import { buyMonthlyOutflowAt }` | VERIFIED | Line 42 |
| `fi-impact.ts` | `fi/fi-target.ts` | `import { fiTargets }` | VERIFIED | Line 46 |
| `fi-impact.ts` | `fi/projection.ts` | `import { projectFiDate }` | VERIFIED | Line 47 |
| `sensitivity.ts` | `fi/fi-impact.ts` | `import { fiImpact }` + re-run per perturbation | VERIFIED | Lines 28, 195–200 |
| `oracle.test.ts` | `tco/rent-vs-buy.ts` | `import { toReal }` for high-inflation case | VERIFIED | Line 22 |
| `oracle.test.ts` | `tco/compounding.ts` | `import { monthlyGrowthFactor }` | VERIFIED | Line 23 |
| `tco/rent-vs-buy.ts` | `tco/compounding.ts` | `import { monthlyGrowthFactor }` (no local copy) | VERIFIED | Grep: 0 occurrences of `function monthlyGrowthFactor` in rent-vs-buy.ts |
| `sensitivity.ts` → tax perturbation | Any FI calc consuming the perturbed rate | `assumptions.tax.propertyRateAnnual` | NOT_WIRED | `fi-target.ts` uses `tco.resolvedMillRate`; `computeTco` uses `resolveMillRate(town).residentialMillRate`. The perturbed leaf never enters any FI math path. |
| `index.ts` | `fi/sensitivity.ts` | `export { tornado, TornadoResult, TornadoRow, TornadoDriver }` | VERIFIED | Lines 129–133 |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|-------------------|--------|
| `fi-impact.ts` | `targets` | `fiTargets(input, computeTco(input))` → `tco.resolvedMillRate` | Yes — resolved from seeded town table | FLOWING |
| `fi-impact.ts` | `buy` outcome | `projectFiDate(buyPath(...))` → real loop with `buyMonthlyOutflowAt` + equity | Yes — full amortization + home value computation | FLOWING |
| `fi-impact.ts` | `baseline` outcome | `projectFiDate(renterBaselinePath(...))` → full monthly savings | Yes | FLOWING |
| `sensitivity.ts` | tax `low`/`high` outcomes | `fiImpact(perturb(input, 'tax', dir)).buy` → perturbs `propertyRateAnnual` | No — `propertyRateAnnual` is not consumed by any FI calc path; all property tax flows through `tco.resolvedMillRate` | HOLLOW — perturbation disconnected from actual FI math |
| `golden.test.ts` | `fi-golden-snapshot.json` | `canonicalJson(fiImpact(fixedInput()))` → committed fixture | Yes — buy:reached month 175, baseline:reached month 217 | FLOWING |

### Behavioral Spot-Checks

These cannot be run live (would require running `npm test` in the project environment). The prompt states: "The full suite is green: `npm test` → 31 files, 337 tests passed. `npx tsc -b` clean." Trusting this as executor-reported external evidence for pass/fail at the suite level; key behavioral properties verified via code inspection above.

| Behavior | Evidence | Status |
|----------|----------|--------|
| 0% return: engine month === ceil((T-S)/C) exactly | `oracle.test.ts` line 91: `expect(engineFiMonths(...)).toBe(expected)` where expected = 120, no toBeCloseTo | VERIFIED |
| High-inflation routes through Fisher | `oracle.test.ts` line 137: `const realRate = toReal(nominal, inflation).toFixed()` consumed by both oracle and engine | VERIFIED |
| Don't-buy verdict produced | `fi-impact.test.ts` line 143: STRAINED scenario → `buy.kind === 'unreached'`, `baseline.kind === 'reached'` | VERIFIED |
| Compare ranks unreached last | `compare.test.ts` line 116: BRUTAL row `outcome.kind === 'unreached'`, confirmed last in ordered result | VERIFIED |
| Tax driver FI-date swing | `sensitivity.test.ts` lines 94–104: test only asserts `kind` matches regex and `swingMonths >= 0` (does NOT assert swing > 0); documented as zero-swing inert leaf | FAILED |
| Golden round-trip byte-identical | `golden.test.ts` lines 247–261: `canonicalFiResult(rebuilt) === canonicalFiResult(original)` with `targetAnnualRetirementSpend` survival asserted | VERIFIED |

### Probe Execution

No probe scripts declared for this phase.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|---------|
| FI-01 | 04-01, 04-02, 04-03 | DP+closing as foregone investment; monthly delta as foregone contribution | SATISFIED | `fi-impact.ts` buyPath: seed = NW − (DP+closing), contributionFor = savings − premium |
| FI-02 | 04-02 | Projects NW + FI date vs no-purchase baseline; configurable real return; SWR ~3–3.5% | SATISFIED | `projection.ts` monthly loop; `defaults.ts` `swr.rate: '0.033'`, `returns.realAnnual: '0.05'` |
| FI-03 | 04-03 | Outputs FI-date shift in months AND years | SATISFIED | `FiImpactResult.fiDeltaMonths: number | null` + `fiDeltaYears: string | null`; Dec arithmetic |
| FI-04 | 04-03 | User can compare N scenarios ranked by FI-date impact | SATISFIED | `compareScenarios` in `compare.ts`; baseline row 0; ranked ascending; unreached last |
| FI-05 | 04-02, 04-04 | FI projection math reconciles against independent oracle + golden | SATISFIED | `oracle.test.ts` closed-form analytic oracle (not iterative); exact `===` 0%/5%/3%; Fisher; `fi-golden-snapshot.json` committed + golden.test.ts gated path |
| FI-06 | 04-02, 04-03 | Tool can reach "don't buy" conclusion | SATISFIED | Discriminated `kind: 'unreached'` variant; unreached rows sort last; STRAINED test case proves real "don't buy" verdict |
| ASMP-02 | 04-01, 04-04 | Sensitivity analysis showing key outputs swing with key assumptions (return, maintenance, tax) | PARTIALLY SATISFIED — BLOCKER | Five drivers (return, inflation, appreciation, maintenance, SWR) produce real swings. Tax driver machinery exists and is wired to the relative-band perturbation, but `propertyRateAnnual` is INERT — property tax flows through the town-resolved mill rate in all calc paths. Tax swing = 0 in all non-degenerate scenarios. ASMP-02 names "tax" as a required driver. |

### Anti-Patterns Found

| File | Pattern | Severity | Impact |
|------|---------|----------|--------|
| `packages/core/src/tco/rent-vs-buy.test.ts:23` | Pre-existing unused import lint error (predates Phase 4, explicitly noted in prompt) | Info | Does not affect Phase 4 deliverables; pre-existing |
| `packages/core/src/fi/sensitivity.ts:143` | `propertyRateAnnual` perturbed but never consumed by any FI calc path | Blocker | Tax tornado driver produces zero FI-date swing; SC5 / ASMP-02 unmet for tax |
| `packages/core/src/fi/sensitivity.test.ts:87–104` | Tax test only asserts well-formedness (`kind` regex match, `swingMonths >= 0`); does NOT assert swing > 0 | Warning | The test passes even though the tax driver does nothing meaningful; gap is masked by the weak assertion |

No TBD/FIXME/XXX debt markers found in Phase 4 modified files (comment in sensitivity.test.ts is a `NOTE:` documenting the known limitation, not a debt marker).

### Human Verification Required

None. All verification is code-level for this phase.

## Gaps Summary

**One BLOCKER identified:** The tornado's tax driver is wired to `assumptions.tax.propertyRateAnnual`, which is never read by any FI calculation path. Property tax in the FI engine flows exclusively through `tco.resolvedMillRate` (resolved from the seeded town table in `computeTco` and passed via `TcoBreakdown` to `fiTargets`/`ownerHousingAt`). Perturbing `propertyRateAnnual` by ±15% has no effect on the FI date. The FI-date swing for the tax driver is zero in all non-degenerate scenarios.

This was discovered and documented by the executor in `04-04-SUMMARY.md` and in a comment in `sensitivity.test.ts` (lines 94–98): "tax.propertyRateAnnual is presently INERT in the FI/TCO path." The test was weakened to only assert well-formedness (`swingMonths >= 0`) rather than a meaningful swing, so the test suite passes green. But the observable truth in SC5 — "FI-date swing across the drivers (return, inflation, appreciation, maintenance, **tax**, SWR)" — is not met for the tax driver.

**Root cause:** The `assumptions.tax.propertyRateAnnual` leaf is a V1 placeholder statewide rate that predates the Phase 2 mill-rate resolver. When Phase 2 introduced the town-level mill-rate table (`resolveMillRate`), property tax computation migrated to use the resolved rate. The assumption leaf became dead weight in the FI path. Phase 4's tornado wired to the assumption leaf without noticing it was disconnected.

**What needs to be fixed:** Either (a) make the tornado's tax perturbation reach the `resolvedMillRate` that actually drives property tax in `fiTargets` and `buyMonthlyOutflowAt`, or (b) accept a structured override documenting that the tax driver is intentionally zero-swing for v1 (the town mill rate is not perturbable at the assumption level in this design). Option (b) would require an `overrides:` entry in the VERIFICATION.md frontmatter accepted by a human reviewer.

**All other SC items are fully verified** (4/5): the FI engine, FI-date delta, oracle reconciliation (including 0% exact + high-inflation Fisher), the don't-buy verdict as a first-class row, and five of the six tornado drivers all work correctly.

---

_Verified: 2026-06-26_
_Verifier: Claude (gsd-verifier)_
