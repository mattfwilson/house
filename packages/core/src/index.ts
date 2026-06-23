// Public surface of @house/core.
// Re-exports are added by later plans (AssumptionSet, EngineInput, and the
// reproducibility harness). Wave 0 (Plan 01-01) established the package boundary +
// build enforcement; Plan 01-02 adds the money/time/determinism primitives.
export { Money } from './money/money.js';
export { Dec, type DecimalInstance } from './money/decimal-config.js';
