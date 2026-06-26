---
phase: 04-fi-impact-engine-sensitivity-flagship
plan: 03
subsystem: core
tags: [fi, fi-impact, opportunity-cost, ranking, anti-funnel, decimal, discriminated-union, tdd]

# Dependency graph
requires:
  - phase: 04-fi-impact-engine-sensitivity-flagship
    plan: 02
    provides: "fi/projection.ts (projectFiDate + FiOutcome discriminated union, optional equityFor A5), fi/fi-target.ts (fiTargets asymmetric renter/owner FiTargets, all four Money fields)"
  - phase: 02-tco-engine
    provides: "buyMonthlyOutflowAt (time-varying ownership outflow), closingCosts/otherOneTimeCosts (t=0 lump), amortizationSchedule (forced-equity balance), homeValueAt (appreciated value), monthlyGrowthFactor (shared compounding)"
  - phase: 01-foundations-determinism-core
    provides: "Money closed API, internal Dec, EngineInput snapshot, Household.targetAnnualRetirementSpend, canonicalJson (throws on non-finite)"
provides:
  - "fi/fi-impact.ts — fiImpact(input): FiImpactResult — the top-level FI-impact orchestrator (FI-01/FI-03): builds the buy path (DP+closing foregone seed, premium foregone contribution, A5 liquid+equity NW) and the keep-renting baseline (D-05), projects each once, reports the owner−renter FI-date delta in months AND years"
  - "fi/compare.ts — compareScenarios(baselineInput, scenarios[]): CompareResult — N-scenario ranking (FI-04/FI-06): baseline row 0 (delta 0), buy rows ranked by delay ascending, unreached 'don't buy' rows last via a kind-branching comparator (no Infinity/sentinel, L3)"
  - "index.ts — the FI engine public barrel block: fiImpact/compareScenarios/fiTargets/projectFiDate + closed result types + FiOutcome/FiTargets; raw Dec/Decimal + within-package internals stay unexported"
affects: ["04-04 (tornado sensitivity re-runs fiImpact/projectFiDate per perturbed driver; the golden master canonicalizes fiImpact output)"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Opportunity-cost symmetry as the correctness core: the buy path's foregone seed (DP+closing) and foregone contribution (ownership premium = buyMonthlyOutflowAt − grown rent) are EXACTLY the dollars the renter baseline keeps invested — the same premium decomposition rentVsBuy uses, never re-summed (DRY over buyMonthlyOutflowAt + closingCosts)"
    - "Anti-funnel acceptance gate as a first-class TEST: a realistic strained input MUST yield buy:unreached + baseline:reached (the honest 'don't buy' outcome) — the tool is verified to be ABLE to conclude rent-and-invest, not just nominally permitted to"
    - "kind-branching ranking comparator (never a non-finite sentinel): reached-before-unreached, reached by fiDeltaMonths ascending, unreached by cappedAtMonth ascending, stable tie-break by input index — the only canonicalJson-serializable ordering (L3 / D-08)"
    - "fiDelta null semantics: a delta is defined ONLY between two reached dates; either path unreached ⇒ fiDeltaMonths/fiDeltaYears null (the row still sorts via the comparator's kind branch, not a numeric delta)"

key-files:
  created:
    - packages/core/src/fi/fi-impact.ts
    - packages/core/src/fi/fi-impact.test.ts
    - packages/core/src/fi/compare.ts
    - packages/core/src/fi/compare.test.ts
  modified:
    - packages/core/src/index.ts

key-decisions:
  - "FiImpactResult = { baseline: FiOutcome, buy: FiOutcome, fiDeltaMonths: number|null, fiDeltaYears: string|null, targets: FiTargets } — closed/readonly; surfaces both per-path outcomes AND both targets (D-02 visibility); years cross as a decimal STRING"
  - "Buy seed = household.availableNetWorth − (downPayment + closing); reuses closingCosts + the downPayment derivation verbatim from rentVsBuy 182-187 (no re-derived closing %-of-price math)"
  - "Buy contribution = monthlySavings − ownership premium, premium = buyMonthlyOutflowAt(month) − grownRentAt(month); reuses buyMonthlyOutflowAt (no re-summed P+I/tax/ins/maint/PMI). Can go NEGATIVE — the honest don't-buy direction that drives the path unreached"
  - "Renter baseline seed = full availableNetWorth (DP+closing stays liquid), contribution = full monthlySavings (the renter pays only rent, so the buyer's foregone premium is invested here); no equityFor; price-INDEPENDENT (asserted by a test)"
  - "grownRentAt matches rentVsBuy's end-of-month rent-growth convention: month m pays rent × factor^(m-1) (month 1 pays un-grown rent) — so the premium here equals the trajectory engine's premium"
  - "CompareRow.fiDeltaYears carries '0' on the baseline; the baseline row carries the renter (baseline) FiOutcome from fiImpact(baselineInput)"
  - "The L3 grep gate is satisfied by ZERO literal 'Infinity' tokens in compare.ts — comments reworded to '+∞'/'non-finite sort key' (mirroring the projection.ts greppable-invariant precedent); the runtime no-Infinity invariant is also asserted in compare.test.ts via JSON.stringify"

patterns-established:
  - "Top-level FI composer mirroring gap.ts: doc-comment header stating the question + Dec/Money discipline, a closed readonly result interface, a household===undefined guard with a clear throw"
  - "PathBundle builder idiom: buyPath/renterBaselinePath each return { seedDollars, target, contributionFor, factor, equityFor?, maxHorizonMonths } feeding projectFiDate — the two honest paths share the projection loop, differing only in seed/contribution/equity"
  - "Mixed-batch ranking test: three distinct engineInput scenarios (beats-renting / delays / unreachable) asserting the exact structural order beats < delays < unreached, plus input-order-independence of the unreached-last rule"

requirements-completed: [FI-01, FI-03, FI-04, FI-06]

# Metrics
duration: ~10min
completed: 2026-06-26
---

# Phase 4 Plan 03: FI-Impact Orchestrator & N-Scenario Ranking Summary

**The two headline FI-engine outputs — `fiImpact` (the buy-vs-keep-renting FI-date instrument that decomposes the down payment + closing as foregone investment and the ownership premium as a foregone contribution, then reports the owner−renter FI-date delta in months AND years) and `compareScenarios` (the N-scenario ranking whose anti-funnel "don't buy" row sorts last via a non-finite-free comparator) — composed over the Wave-2 primitives and published from the public barrel, with a verified anti-funnel acceptance check proving the tool can honestly conclude "rent and invest the difference".**

## Performance

- **Duration:** ~10 min
- **Completed:** 2026-06-26
- **Tasks:** 3 (Tasks 1-2 TDD RED→GREEN, Task 3 auto)
- **Files:** 4 created (2 production, 2 test), 1 modified (index.ts)

## Accomplishments

- **`fiImpact` (FI-01/FI-03):** the top-level orchestrator composing `fiTargets` + `projectFiDate` over the Phase-2 substrate. It builds the BUY path (seed = investable NW − DP+closing via `closingCosts`; monthly contribution = savings − ownership premium via `buyMonthlyOutflowAt` − grown rent; NW = liquid + liquidated equity via the A5 `equityFor` closure) and the keep-renting BASELINE (seed = full NW, contribution = full savings, no equity, price-independent — D-05), projects each ONCE against its asymmetric target, and reports `fiDeltaMonths = owner − renter` in BOTH months and years (a decimal STRING). When either path is unreached, both deltas are `null`. All four targets + both per-path `FiOutcome`s are surfaced (D-02).
- **The anti-funnel acceptance check (FI-06):** a realistic strained fixture ($1.4M house, $36k/yr savings) genuinely yields `buy: unreached` while `baseline: reached` — the tool is *verified* to be able to conclude "don't buy", not merely permitted to. The premium can go negative (the ownership cost swamps savings), eroding NW until the path hits the cap as a first-class `unreached` verdict.
- **`compareScenarios` (FI-04/FI-06):** N-scenario ranking with the keep-renting baseline as a first-class row 0 (`isBaseline: true`, delta 0, carrying the renter outcome). Buy rows rank by FI-date delay ascending via a `kind`-branching comparator — reached-before-unreached, reached by `fiDeltaMonths` ascending, two unreached by `cappedAtMonth` ascending — with a stable input-index tie-break. The unreached "don't buy" row sorts WORST. NO non-finite sort key is ever materialized (L3): the comparator branches on the discriminant, the unreached delta stays `null`, and the grep gate (`0 literal Infinity in compare.ts`) plus a `JSON.stringify` runtime assertion both hold.
- **Public barrel (index.ts):** the FI engine block exports `fiImpact`/`compareScenarios`/`fiTargets`/`projectFiDate` + their closed result types + `FiOutcome`/`FiTargets`. Raw `Dec`/`Decimal` and the within-package compounding/outflow internals stay UNEXPORTED — dollars cross as `Money`, years as decimal STRINGS.

## Task Commits

Each task was committed atomically (TDD RED→GREEN for Tasks 1-2):

1. **Task 1 RED: failing fiImpact orchestrator** — `c1ff827` (test)
2. **Task 1 GREEN: fiImpact composing both paths + FI-date delta** — `db03e13` (feat)
3. **Task 2 RED: failing compareScenarios ranking** — `658d3b7` (test)
4. **Task 2 GREEN: compareScenarios baseline row 0, unreached last** — `0963d08` (feat)
5. **Task 3: publish the FI engine block from index.ts** — `d9397d3` (feat)

**Plan metadata:** final docs commit below.

## Files Created/Modified

- `packages/core/src/fi/fi-impact.ts` — NEW: `fiImpact(input): FiImpactResult` + the closed result interface; `buyPath`/`renterBaselinePath` PathBundle builders, `buyUpfront` (reuses `closingCosts`), `grownRentAt` (matches rentVsBuy's rent-growth convention).
- `packages/core/src/fi/fi-impact.test.ts` — NEW: both-paths visibility, the months/years delta, the premium-decomposition delay, the price-independent baseline, the anti-funnel `buy:unreached`+`baseline:reached` case, null deltas, the household guard, determinism (8 tests).
- `packages/core/src/fi/compare.ts` — NEW: `compareScenarios` + `CompareResult`/`CompareRow`; the `kind`-branching comparator + stable index tie-break.
- `packages/core/src/fi/compare.test.ts` — NEW: baseline row 0 + delta 0, the mixed-batch beats<delays<unreached order, input-order-independence of unreached-last, the no-Infinity serialization invariant, the stable tie-break, determinism (7 tests).
- `packages/core/src/index.ts` — MODIFIED: added the FI engine export block (4 entry points + closed types + `FiOutcome`/`FiTargets`); `Dec`/`monthlyGrowthFactor` stay unexported.

## Decisions Made

See `key-decisions` frontmatter. Headline: the opportunity-cost symmetry (the buy path's foregone seed + premium are exactly the dollars the renter keeps invested) is the correctness core and reuses `closingCosts` + `buyMonthlyOutflowAt` verbatim; the ranking orders via a `kind`-branching comparator that never materializes a non-finite sort key (L3); `fiDelta` is `null` whenever either path is unreached.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Tuned the compare.test.ts mixed-batch fixtures so each scenario lands in its ordering band**
- **Found during:** Task 2 GREEN (compareScenarios reconciliation)
- **Issue:** The A5 equity inclusion makes a high-price but LOW-leverage house REACH FI via its large liquidated-equity windfall, so the originally-drafted "$950k delays, $2.2M unreachable" fixtures did not land as intended ($950k actually *beat* renting; $2.2M *delayed* but still reached). The "unreached" assertions found no unreached row (a vacuous/failing mixed-batch test).
- **Fix:** Re-tuned the three distinct scenarios so each lands cleanly in its band against the comfortable household — modest $550k (beats renting, negative delta), pricey $2.2M (delays, positive delta), brutal $4M at 10% down (unreachable: expensive AND high-leverage, so the thin equity never closes the gap). This makes the anti-funnel ordering a real, non-vacuous assertion. Production `compare.ts` was untouched — the comparator was correct; the test fixtures needed to exercise all three branches.
- **Files modified:** `packages/core/src/fi/compare.test.ts` (test-only, same RED→GREEN cycle)
- **Verification:** All 7 compare tests pass; the unreached row is genuinely `kind:'unreached'` and sorts last regardless of input order.
- **Committed in:** `0963d08` (Task 2 GREEN)

**2. [Rule 3 - Blocking] Reworded compare.ts comments to satisfy the literal L3 grep gate**
- **Found during:** Task 2 GREEN (acceptance-gate check)
- **Issue:** The plan's L3 acceptance gate is `grep -c 'Infinity' packages/core/src/fi/compare.ts` returns 0 (a strict LITERAL gate). The L3-explaining comments referenced the token "Infinity" 7 times, tripping the literal gate even though no `Infinity` value is materialized in code.
- **Fix:** Reworded the comments to "+∞" / "non-finite sort key" (mirroring the projection.ts greppable-invariant precedent from Plan 02), bringing the literal count to 0 while preserving the L3 documentation. The runtime no-Infinity invariant is independently asserted in `compare.test.ts` via `JSON.stringify(result).not.toContain('Infinity')`.
- **Files modified:** `packages/core/src/fi/compare.ts` (comments only)
- **Verification:** `grep -c 'Infinity' compare.ts` returns 0; tests still green.
- **Committed in:** `0963d08` (Task 2 GREEN)

**3. [Rule 3 - Blocking] Reworded one index.ts comment to satisfy the monthlyGrowthFactor grep gate**
- **Found during:** Task 3 (acceptance-gate check)
- **Issue:** The plan's Task 3 gate is `grep -c 'monthlyGrowthFactor' packages/core/src/index.ts` returns 0. The added FI-block header documented that `monthlyGrowthFactor`/`buyMonthlyOutflowAt` are deliberately NOT re-exported, tripping the literal gate via the comment.
- **Fix:** Reworded the comment to "the within-package compounding / outflow helpers ... return / consume the internal decimal type" — preserving the intent without the literal token. (Note: the pre-existing line-7 header `// Deliberately NOT exported: the raw Dec/Decimal ...` predates this plan and is the canonical boundary-doc; it contains no actual export. `grep -nE '^export.*(Dec|Decimal|monthlyGrowthFactor)\b'` confirms ZERO actual export statements leak any of them.)
- **Files modified:** `packages/core/src/index.ts` (comment only)
- **Verification:** `grep -c 'monthlyGrowthFactor' index.ts` returns 0; `tsc -b` + full `src/fi` suite green.
- **Committed in:** `d9397d3` (Task 3)

---

**Total deviations:** 3 auto-fixed (1 test-fixture correction so the anti-funnel ordering is non-vacuous; 2 comment rewordings so the L3 / no-Dec-leak invariants are literally greppable). No production-logic change beyond the planned implementation; no scope creep.
**Impact on plan:** All three were necessary to make the locked invariants real (a genuinely-unreachable don't-buy row; greppable L3 / boundary gates). The comparator and orchestrator logic match the plan exactly.

## Issues Encountered

The A5 equity windfall surprised the first compare-test fixture set (a low-leverage expensive house reaches FI via liquidated equity, not via savings) — resolved by tuning the unreachable scenario to be both expensive AND high-leverage (deviation 1). This is itself a useful product truth: a cash-heavy buyer of an expensive home can still hit FI on the equity, so "expensive" alone is not "don't buy" — leverage is the discriminator.

## User Setup Required

None — no external service configuration. No packages installed this plan (pure composition over `@house/core` internals; RESEARCH Package Legitimacy Audit confirmed zero new dependencies, T-04-SC).

## Next Phase Readiness

- **04-04 (tornado sensitivity + golden) unblocked:** `fiImpact` is a pure function of `EngineInput`, so the tornado is `for each driver: fiImpact(perturb(input, driver, ±band))`; the six V3 bands + `maxHorizonYears` are stored data. The golden harness canonicalizes `fiImpact` output (the public surface is now exported).
- The full monorepo suite is green (326 tests, was 311) and `tsc -b` + `eslint src/fi` exit 0.
- No blockers.

## Self-Check: PASSED

- All five task commits present in git history (`c1ff827`, `db03e13`, `658d3b7`, `0963d08`, `d9397d3`).
- `fi/fi-impact.ts`, `fi/fi-impact.test.ts`, `fi/compare.ts`, `fi/compare.test.ts` exist on disk; `index.ts` modified.
- `npx vitest run packages/core/src/fi` green (34 tests); `npm test` green (326 passed, was 311); `npx tsc -b` exit 0; `npx eslint packages/core/src/fi` exit 0.
- Grep gates: `fi-impact.ts` has `buyMonthlyOutflowAt` (6) + `closingCosts` (5); `compare.ts` has 0 `Infinity`; `index.ts` has `fiImpact` (2), 0 `monthlyGrowthFactor`, 0 actual `Dec`/`Decimal`/`monthlyGrowthFactor` export statements.
- `04-PATTERNS.md` left untracked (NOT committed).

---
*Phase: 04-fi-impact-engine-sensitivity-flagship*
*Completed: 2026-06-26*
