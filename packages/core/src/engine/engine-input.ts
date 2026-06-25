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
 * The per-scenario house inputs the TCO engine reads. Every field is `readonly` (a scenario
 * cannot mutate mid-computation); dollar amounts cross this boundary as canonical decimal
 * STRINGS — the same convention `Money.of` consumes — and rates as decStr-shaped strings, so
 * a bare JS float never enters the calc (CORE-02 / D-06). Only `termMonths` and `holdingYears`
 * are bare `number`s (they are counts, not money).
 *
 * Phase 2 models a FIXED-RATE loan only (D-16): `annualRate` is a single constant nominal
 * rate; ARMs / rate-step schedules are deliberately out of scope here.
 */
export interface ScenarioInputs {
  /** Human label for the scenario (e.g. "123 Main St, $750k"). */
  readonly label: string;
  /** Purchase price, dollar string (e.g. "750000"). */
  readonly price: string;
  /** Down payment as a fraction of price (D-14): loan = price * (1 - downPaymentPct). */
  readonly downPaymentPct: string;
  /** Nominal annual mortgage rate, decStr (e.g. "0.06375"). Fixed for the whole term (D-16). */
  readonly annualRate: string;
  /** Loan term in months (e.g. 360 for a 30-year). */
  readonly termMonths: number;
  /** How many years the scenario assumes the house is held before sale (D-03). */
  readonly holdingYears: number;
  /** Town name, resolved against the seeded mill-rate table for property tax (D-08). */
  readonly town: string;
  /** Homeowners insurance, flat dollars per year (D-15). */
  readonly insuranceAnnual: string;
  /** HOA / condo fee, flat dollars per month (D-15). */
  readonly hoaMonthly: string;
  /** Market rent for the rent-vs-buy path, dollars per month (D-01 / D-06). */
  readonly monthlyRent: string;
  /** Optional explicit one-time closing cost (dollar string) overriding closing.rateOfPrice (D-12). */
  readonly closingCostsOverride?: string;
  /** Optional generic one-time lump (dollar string) — moving, immediate repairs, etc. (D-13). */
  readonly otherOneTimeCosts?: string;
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
