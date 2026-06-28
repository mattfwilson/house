// Public surface of @house/core — the stable import boundary every downstream phase
// builds on. Wave 0 (Plan 01-01) established the package boundary + build enforcement;
// Plan 01-02 added the money/time/determinism primitives; Plan 01-03 added the
// AssumptionSet + EngineInput; Plan 01-04 closes the reproducibility loop (canary +
// canonical serializer).
//
// Deliberately NOT exported: the raw `Dec`/`Decimal` constructor and its raw API.
// Dollars cross this boundary only as `Money` (a closed, decimal-precise API), so no
// downstream code can re-open the bare-float hole by reaching for raw decimal.js.
export { Money } from './money/money.js';
export { calendarDate, type CalendarDate } from './time/calendar-date.js';

// Assumptions-as-first-class-data (ASMP-01): versioned, nested, decimal-string-serialized.
export {
  AssumptionSetSchema,
  AssumptionsV1,
  AssumptionsV2,
  AssumptionsV3,
  AssumptionsV4,
  decStr,
  CURRENT_VERSION,
  type AnyAssumptionSet,
  type CurrentAssumptionSet,
} from './assumptions/schema.js';
export {
  parseAssumptionSet,
  serializeAssumptionSet,
  type AssumptionSet,
} from './assumptions/assumption-set.js';
export { DEFAULT_ASSUMPTIONS } from './assumptions/defaults.js';
export { migrate } from './assumptions/migrate.js';

// The immutable snapshot/input unit (D-11) threading asOf + assumptions explicitly, plus the
// household (profile) trust boundary (D-09): the person-vs-house side of an affordability solve.
// `Household` crosses only through `parseHousehold` (mirroring `ScenarioInputs`); raw JSON never
// enters the calc.
export {
  engineInput,
  ScenarioInputsSchema,
  parseScenarioInputs,
  HouseholdSchema,
  parseHousehold,
  type EngineInput,
  type ScenarioInputs,
  type Household,
} from './engine/engine-input.js';

// Reproducibility loop (PROF-04): the deterministic canary + the canonical serializer the
// golden master is compared against.
export { runCanary, type CanaryResult } from './engine/canary.js';
export { canonicalJson } from './serialize/canonical-json.js';

// Town mill-rate table (TCO-02 data half): the resolver + its row/result types + the curated
// town NAMES (a UI selector source). The raw data array stays internal; downstream code resolves
// by town name through this boundary (rate via resolveMillRate, never by reading the rows).
export { resolveMillRate, TOWN_NAMES, type ResolvedMillRate } from './towns/town-table.js';
export { type TownRateRow } from './towns/town-table.schema.js';

// TCO engine (Phase 2): the top-level aggregator + the closed result types, plus the
// building-block calculators/types Phase 3 (Affordability: PITI+HOA+PMI for DTI) and the
// rent-vs-buy model reuse. Raw `Dec`/`Decimal` remain UNEXPORTED — dollars cross this
// boundary only as `Money`, so no downstream code can re-open the bare-float hole.
export { computeTco, type TcoBreakdown, type TcoLine } from './tco/tco.js';
export { rentVsBuy, type RentVsBuyResult } from './tco/rent-vs-buy.js';
export {
  scheduledPayment,
  amortizationSchedule,
  type AmortizationSchedule,
  type AmortizationRow,
} from './tco/amortization.js';
export { computePmi, type PmiResult } from './tco/pmi.js';
export { annualPropertyTax } from './tco/property-tax.js';
export { closingCosts } from './tco/closing-costs.js';

// Affordability engine (Phase 3): the four entry points — the BANK ceiling (AFF-01), the TRUE
// ceiling (AFF-02), the GAP composer (AFF-03), and the per-scenario evaluate REPORT (D-06) — plus
// their closed result types, the directional verdict enum, the binding-constraint enums, and the
// two shared D-14 numerator derivations (`lenderDtiCarryingCost` / `cashSavingsDrain`). Raw
// `Dec`/`Decimal` remain UNEXPORTED — every dollar crosses as `Money`.
export {
  bankAffordability,
  type BankAffordabilityResult,
  type BindingRatio,
} from './affordability/bank-affordability.js';
export {
  trueAffordability,
  cashSavingsDrain,
  type TrueAffordabilityResult,
  type BindingConstraint,
} from './affordability/true-affordability.js';
export {
  affordabilityGap,
  ALIGNED_TOLERANCE_CENTS,
  type AffordabilityGapResult,
  type AffordabilityVerdict,
} from './affordability/gap.js';
export {
  evaluateScenario,
  type EvaluateScenarioResult,
} from './affordability/evaluate-scenario.js';
// `lenderDtiCarryingCost` returns a `Money` (the D-14 lender numerator) — safe to expose. The
// `frontEndRatio`/`backEndRatio` derivations return the internal `Dec` (DecimalInstance) and are
// deliberately NOT re-exported here: exposing them would leak the raw decimal.js type across the
// boundary that exists precisely to keep `Dec` internal (the L6-9 omission). The ratios reach
// downstream code as decimal STRINGS through `evaluateScenario`'s result instead.
export { lenderDtiCarryingCost } from './affordability/dti.js';

// FI engine (Phase 4): the flagship FI-impact instrument. This block covers FI-01..FI-06 (the buy
// vs keep-renting FI-date impact, the asymmetric targets, the termination-guaranteed projection, and
// the N-scenario ranking with the anti-funnel "don't buy" row) + ASMP-02 (the sensitivity tornado
// lands in Plan 04). The four entry points — `fiImpact` (FI-01/FI-03), `compareScenarios`
// (FI-04/FI-06), `fiTargets` (D-01/D-02), and `projectFiDate` (FI-02) — cross with their CLOSED
// result types + the discriminated `FiOutcome`/`FiTargets`. Raw `Dec`/`Decimal` remain UNEXPORTED:
// every dollar crosses as `Money`, and `FiOutcome.years` / `fiDeltaYears` cross as decimal STRINGS,
// so no downstream code can re-open the bare-float hole. The within-package compounding /
// outflow helpers are deliberately NOT re-exported — they return / consume the internal decimal
// type, which must not leak across this boundary.
export { fiImpact, type FiImpactResult } from './fi/fi-impact.js';
export {
  compareScenarios,
  type CompareResult,
  type CompareRow,
} from './fi/compare.js';
export { fiTargets, type FiTargets } from './fi/fi-target.js';
export { projectFiDate, type FiOutcome } from './fi/projection.js';
// The net-worth-over-time SERIES (SC-2 / D-07 hero chart): the month-by-month trajectory for the
// buy path AND the keep-renting baseline that `projectFiDate` computes but discards. Reuses the
// shared `buildFiPaths` bundles + the locked projection loop, so the series reconciles with
// `projectFiDate` by construction. Closed `FiTrajectoryResult`: dollars cross as `Money`, the
// FI-month markers as `number | null`. The internal `buildFiPaths`/`PathBundle` (which consume/
// return the internal `Dec`) stay UNEXPORTED — only the closed result type crosses the boundary.
export { fiTrajectory, type FiTrajectoryResult } from './fi/fi-trajectory.js';
// The sensitivity tornado (ASMP-02 / D-12/D-13/D-14): the per-driver one-way FI-date swing, ranked
// with the top drivers flagged — the "no headline number without a range" instrument. Its closed
// `TornadoResult`/`TornadoRow` carry the discriminated `FiOutcome`s + a finite `swingMonths` (no
// Infinity, L3); the driver names are plain string literals (no UI copy). Raw `Dec` stays unexported.
export {
  tornado,
  type TornadoResult,
  type TornadoRow,
  type TornadoDriver,
} from './fi/sensitivity.js';

// Town scoring engine (Phase 5: TOWN-01..04): the integrated `scoreTowns` entry + the closed
// scoreboard result types satisfying the UI-SPEC heatmap contract (the towns×metrics matrix, the
// explainable per-metric breakdown, the bucket enum, the MA-flag enums). Reads all scoring config
// off `AssumptionsV4.townScoring` (stored data, never hardcoded). Raw `Dec`/`Decimal` remain
// UNEXPORTED — the composite + per-metric contributions cross this boundary as decimal STRINGS and
// the bucket as the `Bucket` enum (the documented boundary), so no downstream code can re-open the
// bare-float hole.
export {
  scoreTowns,
  type TownScore,
  type TownScoreboard,
  type TownScoringInput,
  type MetricContribution,
  type MetricDirection,
  type Bucket,
  type CommuteAnchor,
  type MaFlag,
} from './towns/score-towns.js';

// Phase 6 persistence + listings CONTRACTS (D-02 dependency inversion): the inward-facing ports
// every app adapter/service depends on, plus the persisted domain types. The core DEFINES these
// pure interfaces; the app supplies the concrete SQLite adapters / MockListingsProvider (NOT this
// boundary). Ports are SYNCHRONOUS (D-08, better-sqlite3 is sync) and framework-free (no
// better-sqlite3/drizzle import — the boundaries/external guard would fail the build). Raw `Dec`
// stays unexported: every dollar leaf crosses as a canonical decimal STRING (`decStr`), validated
// only through `parseProfile` / `parseListing` (T-06-01/02), so no float can re-enter here.
export {
  type ListingsProvider,
  type ListingsQuery,
} from './ports/listings.js';
export {
  type ScenarioRepository,
  type ProfileRepository,
} from './ports/repositories.js';
export {
  ListingSchema,
  parseListing,
  type Listing,
} from './types/listing.js';
export {
  ProfileSchema,
  parseProfile,
  type Profile,
} from './types/profile.js';
export {
  type SavedScenario,
  type SavedScenarioMeta,
} from './types/saved-scenario.js';
