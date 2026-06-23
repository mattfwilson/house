// EngineInput — the single immutable input object threaded into top-level engine functions,
// and the EXACT shape a snapshot captures (D-11). The function signature and the
// reproducibility unit are the same thing: freeze an EngineInput, replay it, get cent-
// identical output (the property Plan 04's golden harness will assert).
//
// Determinism is structural here:
//   - `asOf` is a branded `CalendarDate` (D-13) threaded EXPLICITLY — never derived from
//     `Date.now()` (which the determinism guard makes throw inside core). Time is data.
//   - `assumptions` is the current-version AssumptionSet — every tunable comes from here,
//     nothing hardcoded (ASMP-01).
//   - The whole object is `readonly` at the type level and `Object.freeze`d at runtime, so
//     a scenario cannot be mutated mid-computation.
import type { CalendarDate } from '../time/calendar-date.js';
import type { CurrentAssumptionSet } from '../assumptions/assumption-set.js';

/**
 * Minimal placeholder scenario inputs. Later phases (TCO, Affordability, FI-Impact) widen
 * this with the real per-scenario fields (price, down payment, income, etc.). For Phase 1
 * it carries just enough for the reproducibility canary.
 */
export interface ScenarioInputs {
  readonly label: string;
}

/**
 * The immutable snapshot unit: `asOf` + `assumptions` + scenario inputs, all readonly.
 * This is what a top-level engine function receives AND what a snapshot serializes.
 */
export interface EngineInput {
  readonly asOf: CalendarDate;
  readonly assumptions: CurrentAssumptionSet;
  readonly scenario: ScenarioInputs;
}

/**
 * Assemble a frozen EngineInput. `asOf` is supplied explicitly by the caller (D-11) — this
 * factory NEVER consults a clock. The returned object is `Object.freeze`d so it is immutable
 * at runtime as well as in the type system.
 */
export function engineInput(parts: {
  readonly asOf: CalendarDate;
  readonly assumptions: CurrentAssumptionSet;
  readonly scenario: ScenarioInputs;
}): EngineInput {
  return Object.freeze({
    asOf: parts.asOf,
    assumptions: parts.assumptions,
    scenario: Object.freeze({ ...parts.scenario }),
  });
}
