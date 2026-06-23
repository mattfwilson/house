// Public surface of @house/core.
// Re-exports are added by later plans (the reproducibility harness). Wave 0 (Plan 01-01)
// established the package boundary + build enforcement; Plan 01-02 added the
// money/time/determinism primitives; Plan 01-03 adds the AssumptionSet + EngineInput.
export { Money } from './money/money.js';
export { Dec, type DecimalInstance } from './money/decimal-config.js';
export { calendarDate, type CalendarDate } from './time/calendar-date.js';

// Assumptions-as-first-class-data (ASMP-01): versioned, nested, decimal-string-serialized.
export {
  AssumptionSetSchema,
  AssumptionsV1,
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
  type EngineInput,
  type ScenarioInputs,
} from './engine/engine-input.js';
