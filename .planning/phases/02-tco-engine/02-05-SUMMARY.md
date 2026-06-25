---
phase: 02-tco-engine
plan: 05
subsystem: core
tags: [tco, rent-vs-buy, net-worth, fisher, opportunity-cost, golden-master, money, decimal, anti-funnel]

# Dependency graph
requires:
  - phase: 02-tco-engine
    plan: 04
    provides: "computeTco(input) -> TcoBreakdown (total.monthly, amortizedClosing) — the buy-path recurring outflow source"
  - phase: 02-tco-engine
    plan: 01
    provides: "widened ScenarioInputs (monthlyRent, holdingYears, downPaymentPct...), AssumptionsV2 slices (returns/appreciation/transaction/rent/closing), resolveMillRate"
  - phase: 02-tco-engine
    plan: 03
    provides: "homeValueAt (appreciating value), closingCosts/otherOneTimeCosts (t=0 lump)"
  - phase: 02-tco-engine
    plan: 02
    provides: "amortizationSchedule (remaining-balance-per-month = forced-savings principal)"
  - phase: 01-foundations
    provides: "canonicalJson + gated golden harness; Money/Dec; parseAssumptionSet round-trip"
provides:
  - "rentVsBuy(input: EngineInput): RentVsBuyResult — symmetric two-portfolio ending net worth + crossover year + winner"
  - "RentVsBuyResult { buyEndingNetWorth, rentEndingNetWorth, crossoverYear (number|null), winner ('buy'|'rent'|'tie'), holdingYears } — all dollars Money"
  - "toReal(nominal, inflation) — the Fisher real-return helper ((1+n)/(1+i)-1), exposed for nominal knobs"
  - "Committed tco-golden-snapshot.json — the full computeTco + rentVsBuy result golden-tested cent-identically"
  - "Reconciled fixedInput() in golden.test.ts to the full widened ScenarioInputs"
  - "Public barrel: rentVsBuy + RentVsBuyResult"
affects: [04-fi-impact, 03-affordability, 06-persistence]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Two-portfolio net-worth trajectory: month-by-month symmetric invest-the-difference, real monthly compounding (1+r)^(1/12), per-year ending-NW snapshots for crossover detection"
    - "All-real (today's-dollar) convention (D-02): returns/appreciation/rent real rates consumed DIRECTLY; inflation never enters the compounding; toReal exposed only for a future nominal knob"
    - "Forced-savings equity: home equity = appreciated home value (separate appreciation.realAnnual) minus amortization-schedule remaining balance, liquidated with the explicit sellCostPct haircut"
    - "Combined-result golden fixture: serialize { tco, rentVsBuy } with canonicalJson, deep-equal against a committed fixture, gated UPDATE_GOLDEN-only regeneration"

key-files:
  created:
    - packages/core/src/tco/rent-vs-buy.ts
    - packages/core/src/tco/rent-vs-buy.test.ts
    - packages/core/src/__fixtures__/tco-golden-snapshot.json
  modified:
    - packages/core/src/golden.test.ts
    - packages/core/src/index.ts

key-decisions:
  - "Buy monthly outflow = computeTco(input).total.monthly MINUS amortizedClosing.monthly — closing is a t=0 lump (D-11), not a recurring monthly cost; the renter invests that lump (DP + closing + other one-time) as its t=0 portfolio seed"
  - "Portfolios compound MONTHLY at (1+realAnnual)^(1/12) (consistent monthly compounding of the annual real return, not a naive r/12); both the rent portfolio and the buy side-portfolio use the same factor"
  - "crossoverYear is the first 1-based hold year whose 'sold at year-end' BUY ending net worth >= the RENT portfolio (per-year snapshots), else null — null is a legitimate, common anti-funnel outcome (rent never overtaken within the hold)"
  - "winner is decided by EXACT bigint-cent comparison of the two Money ending net worths (toCents); 'tie' is the cent-equal branch"

patterns-established:
  - "Symmetric opportunity-cost model: whichever path is cheaper EACH MONTH invests |diff| into ITS OWN portfolio — flipping which path is cheaper flips which portfolio is fed (Pitfall 6)"
  - "Separate-appreciation equity: equity grows at appreciation.realAnnual, provably independent of returns.realAnnual (raising the portfolio return alone leaves the equity component unchanged)"

requirements-completed: [TCO-07]

# Metrics
duration: 14min
completed: 2026-06-25
---

# Phase 2 Plan 05: Rent-vs-Buy Two-Portfolio Engine + TCO Golden Summary

**Built the flagship-enabling symmetric two-portfolio `rentVsBuy` engine — over `holdingYears` it projects a BUY trajectory (forced-savings principal + separate conservative `appreciation.realAnnual`, liquidated with the explicit `sellCostPct` haircut) against a RENT trajectory (invest the down payment + closing at t=0 plus every cheaper-path monthly difference), both compounding at the REAL return, reporting ending net worth per path + the crossover year + the verdict — and it CAN conclude RENT wins. Then closed the reproducibility loop: a committed `tco-golden-snapshot.json` deep-equals the full `computeTco` + `rentVsBuy` result cent-identically, the canary `fixedInput()` is reconciled to the widened scenario shape, and `rentVsBuy` is public.**

## Performance

- **Duration:** ~14 min
- **Tasks:** 2 (Task 1 TDD: RED -> GREEN; Task 2 golden fixture + barrel)
- **Files:** 5 (3 created, 2 modified)

## Accomplishments

- **`rentVsBuy` is the symmetric two-portfolio net-worth substrate (TCO-07 / SC5).** It derives the recurring BUY monthly outflow from `computeTco(input).total.monthly` minus `amortizedClosing.monthly` (PITI + tax + ins + maint + HOA + PMI; closing excluded — it is the t=0 lump, D-11), and the RENT monthly outflow from `monthlyRent` grown at `rent.realGrowthAnnual` (flat by default, D-06). At t=0 the RENT portfolio is seeded with the cash the buyer commits up front (down payment + closing + any other one-time costs). Each month, whichever path is cheaper invests the absolute difference into ITS OWN portfolio (symmetric — Pitfall 6); both portfolios compound monthly at `(1+returns.realAnnual)^(1/12)`.
- **Forced-savings equity with separate, conservative appreciation (Pitfall 6 / D-04/D-05).** BUY home equity each year = appreciated home value (`homeValueAt`, growing at `appreciation.realAnnual` — NOT the portfolio return) minus the amortization-schedule remaining balance (principal paid is the forced savings). At the horizon the equity is liquidated with the explicit `transaction.sellCostPct` haircut. A test proves equity is independent of `returns.realAnnual` (raising it alone leaves the buy equity component unchanged when the buy side-portfolio is empty).
- **Fisher real conversion, all-real convention (Pitfall 5 / D-02).** `toReal(nominal, inflation) = (1+nominal)/(1+inflation)-1` is exposed (and tested to differ from naive `nominal - inflation`), but the engine consumes `returns.realAnnual` / `appreciation.realAnnual` / `rent.realGrowthAnnual` DIRECTLY — they are already real. A test confirms changing `inflation` alone moves NEITHER ending net worth (inflation never enters the all-real compounding; no double-conversion).
- **Anti-funnel proven (the whole point).** A realistic greater-Boston input set yields `winner === "rent"`; and the committed golden fixture itself (Newton $450k) is a rent-wins result. The tool reaches the "rent and invest the difference" verdict that PROJECT.md requires be reachable.
- **Reproducibility loop closed for the full TCO result.** `tco-golden-snapshot.json` is a committed fixture; `golden.test.ts` serializes `{ tco, rentVsBuy }` via `canonicalJson` and deep-equals it (gated `UPDATE_GOLDEN=1` regeneration only — NEVER `toMatchSnapshot`, T-05-15), plus a serialize -> `parseAssumptionSet` -> recompute round-trip. The canary `fixedInput()` is reconciled to the full widened `ScenarioInputs`. `rentVsBuy` + `RentVsBuyResult` are exported.

## Headline Figures (for the end-of-phase human reasonableness check)

**Anti-funnel RENT-WINS input set** (realistic greater-Boston): Newton $850k, 20% down, 7.0% / 30yr, **7-year hold**, $2,400/yr insurance, no HOA, **$3,200/mo rent**, DEFAULT_ASSUMPTIONS (appreciation 0.75% real, sell cost 6.5%, return 5% real):

| Path | Ending net worth |
|------|------------------|
| BUY  | **$257,910.02** |
| RENT | **$563,157.68** |
| **Winner** | **rent** (crossover: **null** — buy never overtakes within the hold) |

**Buy-favorable input set**: Quincy $500k, 20% down, **3.5% / 30yr**, **30-year hold**, $3,800/mo rent, **appreciation 4% real** -> BUY ending net worth **$2,322,419.17**, **winner buy, crossover year 1**.

**Golden-fixture scenario** (Newton $450k, 20% down, 6.5% / 30yr, 10yr, $2,000 ins, $2,800/mo rent, DEFAULTs): TCO total **$3,280.61/mo** (P+I $2,275.44, property tax $369.75/mo = $4,437/yr at 9.86 mill, insurance $166.67, maintenance $375, amortized closing $93.75); rent-vs-buy buy **$168,035.61** vs rent **$224,885.81** -> **rent wins**. These are the numbers committed in `tco-golden-snapshot.json` for the phase-end sanity check.

## Task Commits

1. **Task 1 RED:** failing rent-vs-buy two-portfolio tests (rent-wins + buy-wins) — `7c8c322` (test)
2. **Task 1 GREEN:** rentVsBuy two-portfolio net worth + crossover — `46e4fa7` (feat)
3. **Task 2:** TCO golden fixture + round-trip + reconciled fixedInput + barrel export — `f0d7ad4` (feat)

**Plan metadata:** (this commit) — `docs(02-05): complete rent-vs-buy + TCO golden plan`

No REFACTOR commit — the implementation was clean as first written.

## TDD Gate Compliance

Task 1 followed RED -> GREEN with both gate commits in history:
- RED `7c8c322` (committed failing — module-not-found, the expected stub-absent state; no test passed unexpectedly).
- GREEN `46e4fa7` (10/10 pass).

The GREEN commit also corrected ONE test's premise (the equity-isolation test): the RED version set `monthlyRent: '9000'` intending the buy side-portfolio to stay empty, but for a $500k house buying is the cheaper path at $9k rent, so the BUY side-portfolio is fed and `buyEndingNetWorth` legitimately moves with the return. The fix flips it to `monthlyRent: '1000'` so RENTING is cheaper and the buy side-portfolio is genuinely empty — making `buyEndingNetWorth` pure liquidated equity, which is what proves separate appreciation. This is a test-oracle correction landing GREEN, not a post-hoc behavior change.

## Decisions Made

- **Buy monthly outflow excludes amortized closing** (it is the t=0 lump, D-11); the renter invests that lump as the t=0 portfolio seed.
- **Monthly compounding at `(1+r)^(1/12)`** for both portfolios (consistent with the annual real figure, not `r/12`).
- **`crossoverYear === null` is a first-class outcome** (rent never overtaken within the hold) — the common anti-funnel case.
- **`winner` decided by exact bigint-cent Money comparison**; `'tie'` is the cent-equal branch.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Equity-isolation test premise was self-defeating**
- **Found during:** Task 1 (GREEN — first full run)
- **Issue:** The RED test set `monthlyRent: '9000'` expecting the BUY side-portfolio to stay empty so `buyEndingNetWorth` would be pure equity (independent of `returns.realAnnual`). But at $9k rent, buying a $500k house is the cheaper path, so the buy side-portfolio IS fed and grows with the return — the assertion that buy NW is return-invariant correctly failed. The implementation was right; the test premise was wrong.
- **Fix:** Flipped the scenario to `monthlyRent: '1000'` (renting cheaper -> buy side-portfolio empty -> `buyEndingNetWorth` is pure liquidated equity, genuinely return-invariant). Added a sanity assertion that the RENT portfolio DID move with the return (the knob is live elsewhere).
- **Files modified:** `packages/core/src/tco/rent-vs-buy.test.ts`
- **Commit:** `46e4fa7` (landed with GREEN)

**2. [Rule 2 - Missing Critical] Branch-coverage gate dipped below 90% from the new code's untested t=0-seed branch**
- **Found during:** Task 2 (phase gate: `vitest run --coverage`)
- **Issue:** The plan's phase gate requires the coverage gate green (branches >= 90%). The new `rentVsBuy` had an uncovered branch — the `otherOneTimeCosts !== undefined` t=0-seed path (plus the `closingCostsOverride` path) — dropping global branches to 88.13% (52/59).
- **Fix:** Added a focused test exercising the one-time-costs path (`closingCostsOverride` + `otherOneTimeCosts`), asserting the extra cash raises the RENT ending net worth (the renter invests it at t=0) while leaving the BUY ending net worth unchanged (the buyer's one-time cash is not equity). Branches -> 91.52% (54/59), gate green.
- **Files modified:** `packages/core/src/tco/rent-vs-buy.test.ts`
- **Commit:** `f0d7ad4`

---

**Total deviations:** 2 auto-fixed (1 bug, 1 missing-critical test coverage)
**Impact on plan:** Both necessary for correctness/gate-compliance. No scope creep. The two remaining uncovered branches in `rent-vs-buy.ts` (the equal-monthly-outflow no-invest branch and the cent-exact `tie` verdict) are defensive paths that cannot be hit without a contrived exact-equality input; global branch coverage exceeds the 90% gate regardless.

## Issues Encountered

- **`golden-snapshot.json` (the canary fixture) is byte-identical after regeneration.** The Plan 01 SUMMARY anticipated the canary fixture would need regeneration after the widened-scenario shape change, but the canary reads ONLY `returns.realAnnual` (never any scenario field), so its serialized output is unaffected by the wider scenario. The widened-shape reconciliation lands instead in `fixedInput()` (now supplying the full `ScenarioInputs`), which the NEW TCO golden consumes. `golden-snapshot.json` is correctly unchanged; `tco-golden-snapshot.json` is the new committed fixture.

## Phase Gate (VALIDATION.md)

- `npx vitest run packages/core/src/tco/rent-vs-buy.test.ts` — **10 passed** (shape, anti-funnel rent-wins, buy-wins crossover, symmetry both directions, separate appreciation, Fisher, sell haircut, one-time-cost seed, determinism).
- `npx vitest run packages/core/src/golden.test.ts` — **4 passed** (canary golden, TCO golden, both round-trips). Mutating one cent in `tco-golden-snapshot.json` makes it fail (verified, then restored).
- `npx vitest run --coverage` (full core suite) — **187 passed (20 files)**, coverage gate GREEN: statements 98.76% / branches 91.52% / functions 98.11% / lines 98.71% (all >= 95/90/95/95).
- `npm run typecheck` (`tsc -b`) — clean (the new barrel export + the type-test graph resolve).
- `npx eslint` on the new source — clean (only the pre-existing `boundaries/external` deprecation warnings).
- Barrel runtime check (via the Vitest resolver): `rentVsBuy` resolves as a function from `@house/core`; `Dec`/`Decimal` absent.

## Threat Surface

All `mitigate` dispositions in the plan's threat register are satisfied:

- **T-05-14 (float reintroduction):** all compounding, the Fisher math, and every comparison happen in the frozen `Dec` clone; dollars are `Money`, crossing only via `.toFixed()`; ending net worths compared via exact `toCents()` bigint; the inherited `tco.type-test.ts` no-bare-number guard covers the result shape (no bare-number dollar field on `RentVsBuyResult`).
- **T-05-15 (golden auto-bless):** the TCO golden uses the gated `UPDATE_GOLDEN=1` write branch only (reviewable git diff), deep-equal against the committed fixture, deliberately NOT `toMatchSnapshot`.
- **T-05-16 (opportunity-cost asymmetry / equity at portfolio rate):** symmetric invest-the-difference (tested both directions), separate `appreciation.realAnnual` (tested return-invariant), explicit `sellCostPct` haircut (tested to reduce buy NW), anti-funnel rent-wins case committed.
- **T-05-17 (naive nominal-minus-inflation):** `toReal` uses the Fisher relation (tested to differ from naive); `returns.realAnnual` consumed directly (tested inflation-invariant — no double-convert).
- **T-02-SC (package installs):** none performed.

No new security surface beyond the planned `EngineInput -> RentVsBuyResult` trust boundary.

## Known Stubs

None. `rentVsBuy` is fully wired over the real `computeTco` aggregator, the real amortization schedule, the appreciating home-value helper, and the seeded town table; every dollar is a real composed `Money`. The two uncovered defensive branches (equal-outflow no-invest; cent-exact tie) are unreachable-without-contrivance paths, not stubs.

## Next Phase Readiness

- **Phase 4 (FI-Impact flagship) is unblocked.** The two-portfolio net-worth trajectory substrate exists and is golden-tested; Phase 4 layers FI-date / ranking / sensitivity ON TOP of `rentVsBuy` and `computeTco` rather than rebuilding trajectory math.
- **Phase 2 (TCO engine) is functionally complete:** amortization, PMI, property tax, carrying costs, closing costs, the `computeTco` aggregator, and now rent-vs-buy + the closed reproducibility loop.
- **End-of-phase human verification pending** (`human_verify_mode: end-of-phase`): a reasonableness sanity check on (1) the anti-funnel rent-wins input plausibility and (2) the committed golden numbers — both documented above under "Headline Figures".

## Self-Check: PASSED

- `packages/core/src/tco/rent-vs-buy.ts` — FOUND
- `packages/core/src/tco/rent-vs-buy.test.ts` — FOUND
- `packages/core/src/__fixtures__/tco-golden-snapshot.json` — FOUND
- `packages/core/src/golden.test.ts` (modified) — FOUND
- `packages/core/src/index.ts` (modified) — FOUND
- Commit `7c8c322` (Task 1 RED) — FOUND
- Commit `46e4fa7` (Task 1 GREEN) — FOUND
- Commit `f0d7ad4` (Task 2) — FOUND

---
*Phase: 02-tco-engine*
*Completed: 2026-06-25*
