---
phase: 04-fi-impact-engine-sensitivity-flagship
plan: 01
subsystem: core
tags: [zod, decimal, assumptions, schema-migration, golden-master, compounding]

# Dependency graph
requires:
  - phase: 01-foundations-determinism-core
    provides: versioned AssumptionSet (Zod discriminatedUnion), decStr boundary, migrate switch, gated golden-master harness
  - phase: 02-tco-engine
    provides: monthlyGrowthFactor (file-private in rent-vs-buy.ts), AssumptionsV2, tco/rent-vs-buy goldens
  - phase: 03-affordability-engine
    provides: Household contract, affordability goldens, parseHousehold trust boundary
provides:
  - "AssumptionsV3 — current schema (CURRENT_VERSION=3) with a sensitivity slice (six driver bands) + a projection slice (maxHorizonYears), all decStr"
  - "v2ToV3 migrate arm + chained v1ToV2→V3 (every prior version lands a complete V3)"
  - "Household.targetAnnualRetirementSpend — required decStr annual-dollar leaf (FI-number input)"
  - "tco/compounding.ts — single shared monthlyGrowthFactor definition (L1 closed)"
  - "Three existing goldens regenerated and proven byte-stable under V3 (no computed-money movement)"
affects: [04-02 (FI projection loop), 04-03 (fiImpact orchestrator), 04-04 (tornado/sensitivity)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Versioned schema bump: copy prior slices verbatim, append new decStr slices, chain migrate arms through the new current version"
    - "decStr-only stored tunables — conceptual integers (maxHorizonYears) stored as decimal strings, Number() only at the calc loop bound"
    - "Gated UPDATE_GOLDEN=1 regen behind a blocking human diff-review (L5 forcing function against silent drift), never toMatchSnapshot"

key-files:
  created:
    - packages/core/src/tco/compounding.ts
  modified:
    - packages/core/src/tco/rent-vs-buy.ts
    - packages/core/src/assumptions/schema.ts
    - packages/core/src/assumptions/defaults.ts
    - packages/core/src/assumptions/migrate.ts
    - packages/core/src/assumptions/migrate.test.ts
    - packages/core/src/engine/engine-input.ts
    - packages/core/src/index.ts
    - packages/core/src/golden.test.ts

key-decisions:
  - "AssumptionsV3 is current (CURRENT_VERSION=3): six sensitivity bands + maxHorizonYears as first-class decStr stored data; v1ToV2 chains through v2ToV3 so the V1 path lands a complete V3 (ASMP-02)"
  - "LOCKED band seeds (RESEARCH A4 / D-12): returnBand 0.015, inflationBand 0.01, appreciationBand 0.01, maintenanceBand 0.005, taxBandRelative 0.15 (RELATIVE ±15%, L6), swrBand 0.005; projection.maxHorizonYears 60 (720 months, D-07)"
  - "targetAnnualRetirementSpend is a REQUIRED decStr Household leaf (no .refine, unbounded positive dollars) — a missing spend has no honest default; FI number = spend ÷ swr.rate (D-01, FI-01/FI-02)"
  - "monthlyGrowthFactor promoted to tco/compounding.ts as the ONE within-package definition (L1/A6 LOCKED); NOT exported from index.ts (returns unexported Dec, keeps the money boundary closed)"
  - "The three goldens serialize only computed results, not the assumption set — V3 slices did not change any fixture; the regen produced byte-identical files, proving zero computed-money coupling (L5 confirmed via zero diff)"

patterns-established:
  - "Schema version bump checklist: schema.ts (object + union member + CURRENT_VERSION + AnyAssumptionSet explicit union + CurrentAssumptionSet) → defaults.ts seed → migrate.ts arm + chain → migrate.test.ts distinct-valued fixture → index.ts re-export"
  - "L5 golden discipline: gated regen + blocking human diff-review confirming computed money is unchanged before commit"

requirements-completed: [ASMP-02, FI-01, FI-02]

# Metrics
duration: ~25min (across original session + continuation)
completed: 2026-06-26
---

# Phase 4 Plan 01: FI-Impact Foundations Summary

**AssumptionsV3 (six sensitivity bands + maxHorizonYears as decStr stored data) + the required targetAnnualRetirementSpend Household leaf + a single shared monthlyGrowthFactor helper, with all three existing goldens regenerated and proven byte-identical under V3.**

## Performance

- **Duration:** ~25 min (original session through Task 3 + continuation for Task 4 + close-out)
- **Completed:** 2026-06-26
- **Tasks:** 4 (3 auto + 1 blocking human-verify checkpoint, approved)
- **Files modified:** 9 (1 created, 8 modified) across the two sessions

## Accomplishments
- **AssumptionsV3 is current** (`CURRENT_VERSION=3`): a `sensitivity` slice with the six LOCKED driver bands and a `projection` slice with `maxHorizonYears`, every leaf a `decStr` inside a `.strict()` group (ASMP-02 foundation for the Wave-4 tornado).
- **v2ToV3 migrate arm + chained v1ToV2→V3** so every prior persisted version migrates to a complete V3, seeded from `DEFAULT_ASSUMPTIONS`; proven by distinct-valued fixtures in `migrate.test.ts`.
- **`targetAnnualRetirementSpend`** added as a required `decStr` Household leaf (the FI-number input: spend ÷ swr.rate) — non-canonical/missing values rejected by `parseHousehold`.
- **`monthlyGrowthFactor` promoted** to `tco/compounding.ts` as the single within-package definition (L1 closed); `rent-vs-buy.ts` imports it (zero local copies); not leaked through `index.ts`.
- **Three goldens regenerated** via the gated `UPDATE_GOLDEN=1` path and reviewed at a blocking human checkpoint — they came out **byte-identical** (the fixtures serialize only computed results, not the assumption set), provably demonstrating the V3 slices introduce no computed-money movement.

## Task Commits

1. **Task 1: Promote monthlyGrowthFactor to shared compounding helper** — `61011b4` (refactor)
2. **Task 2: Bump to AssumptionsV3 + v2ToV3 migrate + defaults + migrate.test** — `34af256` (feat)
3. **Task 3: Add targetAnnualRetirementSpend household leaf** — `d107b42` (feat)
4. **Task 4: Regen goldens + bump version assertions + add spend leaf to fixtures (L5 review approved)** — `fa05e5a` (test)

**Plan metadata:** (final docs commit below)

## Files Created/Modified
- `packages/core/src/tco/compounding.ts` — NEW: the single `monthlyGrowthFactor(annualReal)` definition `(1+r)^(1/12)`.
- `packages/core/src/tco/rent-vs-buy.ts` — imports `monthlyGrowthFactor` from `./compounding.js`; local copy deleted.
- `packages/core/src/assumptions/schema.ts` — `AssumptionsV3` object + union member; `CURRENT_VERSION=3`; explicit `AnyAssumptionSet` union; `CurrentAssumptionSet`.
- `packages/core/src/assumptions/defaults.ts` — `schemaVersion: 3` + seeded `sensitivity` + `projection` LOCKED literals.
- `packages/core/src/assumptions/migrate.ts` — `v2ToV3` arm + chained `v1ToV2`→V3; `case 3: return set`.
- `packages/core/src/assumptions/migrate.test.ts` — V2→V3 (slices seeded, V2 leaves preserved) + V1→complete-V3 cases.
- `packages/core/src/engine/engine-input.ts` — `Household.targetAnnualRetirementSpend` + `HouseholdSchema` `decStr` leaf (no `.refine`).
- `packages/core/src/index.ts` — re-exports `AssumptionsV3` alongside V1/V2.
- `packages/core/src/golden.test.ts` — `FIXED_HOUSEHOLD.targetAnnualRetirementSpend = '60000'`.
- Affordability/assumptions test fixtures (`bank-affordability`, `evaluate-scenario`, `gap`, `true-affordability`, `assumption-set`, `schema`) — stale-assertion fixes: schemaVersion/CURRENT_VERSION 2→3 and the new required spend leaf added so `parseHousehold` accepts the fixtures.

## Decisions Made
See `key-decisions` frontmatter. Headline: V3 is current with the six bands + max-horizon as `decStr`; the spend leaf is required (no honest default); `monthlyGrowthFactor` has one definition; the goldens are byte-stable under V3 (zero computed-money coupling, provable via empty fixture diff).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Updated stale version assertions in non-fixture test files**
- **Found during:** Task 4 (golden regen + suite green-up)
- **Issue:** Beyond the planned `golden.test.ts` change, the V3 bump and the new required `targetAnnualRetirementSpend` leaf broke assertions in six existing test files (`schema.test.ts` / `assumption-set.test.ts` asserted `CURRENT_VERSION`/`schemaVersion === 2`; four affordability test files built `Household` fixtures lacking the now-required leaf, so `parseHousehold` rejected them). The plan enumerated `golden.test.ts` but not these adjacent stale assertions.
- **Fix:** Bumped the two version assertions 2→3 and added `targetAnnualRetirementSpend` to the affordability `Household` test fixtures so they parse. Pure test-fixture maintenance — no production code or computed-money change.
- **Files modified:** `schema.test.ts`, `assumption-set.test.ts`, `bank-affordability.test.ts`, `evaluate-scenario.test.ts`, `gap.test.ts`, `true-affordability.test.ts`
- **Verification:** `npm test` green (292 passed); fixture JSON byte-identical after gated regen.
- **Committed in:** `fa05e5a` (Task 4 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking — test-fixture green-up).
**Impact on plan:** Necessary mechanical follow-through of the required-leaf + version bump. No scope creep, no production-code deviation. The intended L5 outcome (byte-stable goldens, no computed-money movement) held exactly.

## Issues Encountered
None beyond the test-fixture green-up above. The Task 4 blocking human-verify checkpoint paused execution as designed; the user reviewed the diff (goldens byte-identical, version + spend-leaf changes only) and approved, after which this continuation finished the commit + close-out.

## User Setup Required
None - no external service configuration required. No packages installed this plan (composition over existing `@house/core` internals).

## Next Phase Readiness
- **Wave 2 (04-02) unblocked:** the FI projection loop can now read `swr.rate` for targets, `returns.realAnnual` through the shared `monthlyGrowthFactor`, the six sensitivity bands for the tornado (04-04), `projection.maxHorizonYears` for loop termination, and `targetAnnualRetirementSpend` for the FI number. Waves 2-4 are pure composition over this V3 foundation.
- No blockers or concerns.

## Self-Check: PASSED

- All four task commits present in git history (`61011b4`, `34af256`, `d107b42`, `fa05e5a`).
- `tco/compounding.ts`, `schema.ts`, `migrate.ts`, `engine-input.ts` all exist on disk.
- `grep -c 'function monthlyGrowthFactor' rent-vs-buy.ts` == 0 (helper promoted, not duplicated).
- `grep -c 'AssumptionsV3' schema.ts` >= 3.
- Fixtures byte-identical after gated `UPDATE_GOLDEN=1` regen; `npm test` green (292 passed).

---
*Phase: 04-fi-impact-engine-sensitivity-flagship*
*Completed: 2026-06-26*
