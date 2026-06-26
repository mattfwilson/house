---
phase: 04-fi-impact-engine-sensitivity-flagship
plan: 02
subsystem: core
tags: [fi, projection, oracle, fv-of-annuity, decimal, discriminated-union, tdd]

# Dependency graph
requires:
  - phase: 04-fi-impact-engine-sensitivity-flagship
    plan: 01
    provides: "tco/compounding.ts (shared monthlyGrowthFactor), AssumptionsV3 (swr.rate, returns.realAnnual, projection.maxHorizonYears), Household.targetAnnualRetirementSpend"
  - phase: 02-tco-engine
    provides: "toReal (Fisher), buyMonthlyOutflowAt, homeValueAt/assessedValueAt/annualPropertyTax/maintenanceAnnual, amortizationSchedule, TcoBreakdown (resolvedMillRate, insurance.annualized)"
  - phase: 01-foundations-determinism-core
    provides: "Money closed API, internal Dec (34-digit HALF_EVEN), EngineInput snapshot, canonicalJson (throws on non-finite)"
provides:
  - "fi/projection.ts — projectFiDate(opts): FiOutcome — the termination-guaranteed monthly NW loop (contribute-then-compound, A5 optional equityFor) + the FiOutcome discriminated union (reached | unreached)"
  - "fi/fi-target.ts — fiTargets(input, tco): FiTargets — the asymmetric renter/owner FI targets, all four Money fields surfaced (D-02)"
  - "fi/oracle.test.ts — the INDEPENDENT closed-form FV-of-annuity solve-for-n reconciling the engine (0% exact, compounding exact, high-inflation via Fisher, unreachable agreement) — FI-05"
affects: ["04-03 (fiImpact orchestrator composes projectFiDate + fiTargets)", "04-04 (tornado re-runs projectFiDate per perturbed driver)"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Independent closed-form oracle (FV-of-annuity solve-for-n via Dec.ln) living in the TEST, asserting EXACT === month agreement with the iterative engine — not the engine validating itself (D-09/D-10)"
    - "Contribute-then-compound intra-month convention LOCKED by a 0%-return linear anchor (n = ceil((T-S)/C)) before trusting the compounding case (Pitfall 1 / L1)"
    - "First-class unreached verdict as a discriminated kind:'unreached' variant (no Infinity/-1 sentinel) — the only canonicalJson-serializable encoding (L3 / T-04-04)"
    - "Owner-target year-0 housing basis (A1) avoiding the target<->FI-year fixed point; fiYear param keeps the appreciated-basis upgrade API-stable (L7)"

key-files:
  created:
    - packages/core/src/fi/projection.ts
    - packages/core/src/fi/projection.test.ts
    - packages/core/src/fi/oracle.test.ts
    - packages/core/src/fi/fi-target.ts
    - packages/core/src/fi/fi-target.test.ts
  modified: []

key-decisions:
  - "FiOutcome = { kind:'reached'; month; years(decimal string) } | { kind:'unreached'; cappedAtMonth } — no Infinity, no -1; cappedAtMonth === maxHorizonYears*12 (D-07/L3)"
  - "projectFiDate signature LOCKED: { seedDollars, target:Money, contributionFor(month):Dec, factor:Dec, equityFor?(month):Dec, maxHorizonMonths } — equityFor optional (buy path A5 = liquid + liquidated equity; renter omits it)"
  - "The oracle's C<=0 branch uses the GENERAL closed form (A/B<=0 => unreachable) rather than an unconditional Infinity — seed-only growth IS reachable; only a genuinely-diverging (negative) contribution is unreachable, which is the honest don't-buy case the test exercises"
  - "A1 LOCKED: owner perpetual housing at year-0 basis (assessedValueAt(...,0)/homeValueAt(...,0), flat insurance); documented inline; appreciated-at-FI-year deferred (L7)"
  - "Division in Dec only (Money has no div); (spend+housing)/swr crosses to Money once via Money.of(d.toFixed()) — Money API NOT widened (Phase 2/3 precedent)"
  - "projection.ts production code finalized in the Task 1 GREEN commit (signature locked there); Task 2's commit adds the dedicated behavioral suite (the impl already satisfied it)"

patterns-established:
  - "Oracle reconciliation harness: an in-test oracleFiMonths(seed,contribution,target,realAnnual) closed-form + an engineFiMonths adapter, asserting engine === oracle EXACTLY across 0%/compounding/Fisher/unreachable"
  - "Grep-gated correctness invariants: projection.ts has 0 'Infinity', 0 'while', 0 'toReal'; oracle.test.ts has >=1 'toReal' and 0 'toBeCloseTo'"

requirements-completed: [FI-01, FI-02, FI-05, FI-06]

# Metrics
duration: ~12min
completed: 2026-06-26
---

# Phase 4 Plan 02: FI Projection Loop, Asymmetric Targets & Independent Oracle Summary

**The two load-bearing pure-calc pieces of the FI engine — the termination-guaranteed monthly net-worth projection (`projectFiDate` with a first-class `unreached` verdict and the A5 liquid+equity composition) and the asymmetric renter/owner FI targets (`fiTargets`, all four Money fields surfaced) — gated by an INDEPENDENT closed-form FV-of-annuity oracle that agrees EXACTLY with the engine at 0%, under compounding, through Fisher, and on unreachability.**

## Performance

- **Duration:** ~12 min
- **Completed:** 2026-06-26
- **Tasks:** 3 (all auto, TDD RED→GREEN each)
- **Files:** 5 created (2 production, 3 test), 0 modified

## Accomplishments
- **Independent oracle (FI-05 / D-09/D-10):** `oracle.test.ts` implements `oracleFiMonths` as a closed-form FV-of-annuity solve-for-n (`n = ceil(ln(A/B)/ln(f))` via `Dec.ln`), NOT a copy of the engine loop. It asserts EXACT `===` whole-month agreement with the engine for the 0%-return linear anchor (`ceil((T-S)/C)`), for 5% and 3% compounding cases, and for a high-inflation case that routes a NOMINAL return + inflation through `toReal` (Fisher, D-11 — the case is non-vacuous precisely because it exercises that conversion). The unreachable case asserts the oracle's `Infinity` and the engine's `kind:'unreached'` agree.
- **`projectFiDate` (D-03/D-07, FI-02/FI-06):** the contribute-then-compound monthly loop through the SHARED `monthlyGrowthFactor` (L1), returning the first month NW ≥ target as `kind:'reached'` (with `years = month/12` as a Dec decimal string) or — at the stored cap — a first-class `kind:'unreached'` with `cappedAtMonth === maxHorizonYears*12` (720). No `Infinity`/`-1` sentinel, no unbounded loop.
- **Buy-path NW = liquid + liquidated equity (A5):** the optional `equityFor` closure (the caller composes `(homeValueAt - schedule balance) * (1 - sellCostPct)` with the index-clamp, verbatim from `rentVsBuy`) is ADDED to the comparison NW; the test proves it reaches STRICTLY earlier than a liquid-only projection.
- **Asymmetric FI targets (D-01/D-02, A1):** `fiTargets` surfaces `renterTarget`, `ownerTarget`, `renterHousingAnnual`, `ownerHousingAnnual` — all `Money`. Renter housing = `currentRent*12`; owner housing = year-0 (A1) `tax + insurance + maintenance` reusing the appreciating-value helpers + the captured mill rate. Division lives in `Dec`; the SWR knob is proven live (higher swr → lower target) so the Plan-04 tornado can sweep it.

## Task Commits

1. **Task 1 RED: failing oracle + 0% convention anchor** — `0fa8e54` (test)
2. **Task 1 GREEN: projectFiDate matching the oracle convention** — `f53a5e2` (feat)
3. **Task 2: projection termination, unreached verdict, A5 equity composition** — `1715445` (test)
4. **Task 3 RED: failing asymmetric FI targets** — `e71469b` (test)
5. **Task 3 GREEN: asymmetric FI targets fiTargets** — `4ab1b9b` (feat)

**Plan metadata:** final docs commit below.

## Files Created/Modified
- `packages/core/src/fi/projection.ts` — NEW: `projectFiDate(opts): FiOutcome` + the `FiOutcome` discriminated union + `ProjectFiDateOptions` (locked signature). Contribute-then-compound loop, optional `equityFor` (A5), bounded `for` to `maxHorizonMonths`.
- `packages/core/src/fi/projection.test.ts` — NEW: reached / unreached-at-cap / liquid-vs-liquid+equity-earlier / determinism (6 tests).
- `packages/core/src/fi/oracle.test.ts` — NEW: the independent FV-of-annuity oracle, 0% exact + 5%/3% exact + high-inflation-via-Fisher + unreachable agreement (6 tests).
- `packages/core/src/fi/fi-target.ts` — NEW: `fiTargets(input, tco): FiTargets` (D-01/D-02), `ownerHousingAt(fiYear)` (A1 year-0), `divideBySwr` (Dec-then-Money).
- `packages/core/src/fi/fi-target.test.ts` — NEW: four-field visibility, renter/owner asymmetry, year-0 owner basis, SWR-knob liveness, household guard (7 tests).

## Decisions Made
See `key-decisions` frontmatter. Headline: the unreached verdict is a discriminated variant (never a sentinel); the oracle is a genuinely independent closed form asserting EXACT agreement; the owner target uses the year-0 (A1) basis to avoid the FI-year fixed point; division stays in `Dec`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Oracle C<=0 branch corrected to the general closed form**
- **Found during:** Task 1 GREEN (oracle reconciliation)
- **Issue:** The RESEARCH §1 sketch returned `Infinity` whenever `C <= 0`. But with a positive real rate `r>0`, a non-negative seed compounding alone CAN reach the target (`S*f^n >= T`), so an unconditional `Infinity` for `C=0` disagreed with the engine (which reached $500k from a $10k seed at 5% in ~963 months under the 100-yr oracle cap). The `C<=0`/`Infinity` test as originally drafted was therefore not a true unreachable case.
- **Fix:** Replaced the special-cased `C<=0 => Infinity` branch with the GENERAL `A/B` closed form (`A/B <= 0` OR `n <= 0` ⇒ unreachable), which correctly handles seed-only growth, and changed the unreachable test to use a genuinely-diverging NEGATIVE contribution (`-1000`, premium > savings) — the honest "FI not reached / don't-buy" case (FI-06). Engine and oracle now agree.
- **Files modified:** `packages/core/src/fi/oracle.test.ts` (test-only; in the same RED→GREEN cycle, no production code affected)
- **Commit:** `f53a5e2` (Task 1 GREEN)

**Total deviations:** 1 auto-fixed (Rule 1 — corrected an oracle-derivation edge so the independent check is actually correct). No scope creep; the engine convention was untouched.

## Issues Encountered
None beyond the oracle edge above. The mechanical grep gates (projection.ts: 0 `Infinity`, 0 `while`, 0 `toReal`; oracle.test.ts: ≥1 `toReal`, 0 `toBeCloseTo`) drove two comment rewordings in `projection.ts` so the invariants are greppable, not just intentional.

## User Setup Required
None — no external service configuration. No packages installed this plan (pure composition over `@house/core` internals + Plan-01's V3 foundation).

## Next Phase Readiness
- **04-03 (fiImpact orchestrator) unblocked:** it composes `fiTargets` (the renter/owner targets) and `projectFiDate` (each path's FI date) — building the buy-path seed (net of DP+closing), the `contributionFor` (savings − ownership premium via `buyMonthlyOutflowAt`), and the `equityFor` closure — then computes the FI delta (owner − renter) in months and years.
- **04-04 (tornado) unblocked:** `projectFiDate` is a pure function re-runnable per perturbed driver; the six V3 bands + `maxHorizonYears` are already stored data.
- The public barrel (`index.ts`) is intentionally NOT modified here (out of this plan's `files_modified` scope) — Plan 03/04 export the public FI surface (`fiTargets`, `projectFiDate`, `FiOutcome`, `FiTargets`) when the orchestrator lands.
- No blockers.

## Self-Check: PASSED

- All five task commits present in git history (`0fa8e54`, `f53a5e2`, `1715445`, `e71469b`, `4ab1b9b`).
- `fi/projection.ts`, `fi/fi-target.ts`, `fi/oracle.test.ts`, `fi/projection.test.ts`, `fi/fi-target.test.ts` all exist on disk.
- `npx vitest run packages/core/src/fi` green (19 tests); `npm test` green (311 passed, was 292); `npx tsc -b` exit 0; `npx eslint packages/core/src/fi` exit 0.
- Grep gates: `projection.ts` has 0 `Infinity`, 0 `while`, 0 `toReal`, ≥1 `kind: 'unreached'`; `oracle.test.ts` has 0 `toBeCloseTo`, ≥1 `toReal`.
- `04-PATTERNS.md` left untracked (NOT committed).

---
*Phase: 04-fi-impact-engine-sensitivity-flagship*
*Completed: 2026-06-26*
