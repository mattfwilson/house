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

// The immutable snapshot/input unit (D-11) threading asOf + assumptions explicitly.
export {
  engineInput,
  ScenarioInputsSchema,
  parseScenarioInputs,
  type EngineInput,
  type ScenarioInputs,
} from './engine/engine-input.js';

// Reproducibility loop (PROF-04): the deterministic canary + the canonical serializer the
// golden master is compared against.
export { runCanary, type CanaryResult } from './engine/canary.js';
export { canonicalJson } from './serialize/canonical-json.js';

// Town mill-rate table (TCO-02 data half): the resolver + its row/result types. The raw
// data array stays internal; downstream code resolves by town name through this boundary.
export { resolveMillRate, type ResolvedMillRate } from './towns/town-table.js';
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
