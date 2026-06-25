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
import { z } from 'zod';
import type { CalendarDate } from '../time/calendar-date.js';
import type { CurrentAssumptionSet } from '../assumptions/assumption-set.js';
import { decStr } from '../assumptions/schema.js';

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
 * ScenarioInputsSchema — the Zod 4 runtime mirror of the `ScenarioInputs` interface and the
 * SCENARIO half of the snapshot trust boundary (CR-03 / T-07-*). The assumptions half is
 * `AssumptionSetSchema`; together they are the single point where a persisted-or-forged
 * snapshot JSON becomes a trusted in-memory `EngineInput`. Three properties are enforced HERE,
 * not by convention (mirroring `assumptions/schema.ts`):
 *   - T-07-01: every dollar/rate field is a canonical decimal STRING (`decStr`, the SAME
 *     validator `Money.of` and the AssumptionSet boundary use) — a JS float, thousands
 *     separator, or exponent form can never enter the calc (D-06).
 *   - T-07-02: `downPaymentPct` is constrained to the half-open interval [0,1) so a forged
 *     value can never produce a negative loan in `computeTco` (loan = price * (1 - pct), D-14).
 *     The canonical-string contract is already enforced by `decStr`; the `.refine` here is a
 *     pure BOUNDARY guard (range check on the already-canonical value), not money math, so a
 *     plain `Number(s)` comparison is acceptable.
 *   - T-07-03: `.strict()` rejects unknown keys, so a forged snapshot can't smuggle extra
 *     fields past the boundary (mirrors `AssumptionsV2.strict()`).
 * `termMonths` / `holdingYears` are positive integers (they are counts, not money).
 */
export const ScenarioInputsSchema = z
  .object({
    label: z.string().min(1),
    price: decStr,
    downPaymentPct: decStr.refine(
      (s) => {
        const n = Number(s);
        return n >= 0 && n < 1;
      },
      { message: 'downPaymentPct must be in [0,1)' },
    ),
    annualRate: decStr,
    termMonths: z.number().int().positive(),
    holdingYears: z.number().int().positive(),
    town: z.string().min(1),
    insuranceAnnual: decStr,
    hoaMonthly: decStr,
    monthlyRent: decStr,
    closingCostsOverride: decStr.optional(),
    otherOneTimeCosts: decStr.optional(),
  })
  .strict();

/**
 * Validate untrusted data into a trusted `ScenarioInputs`. Throws (with a Zod error) on any
 * forged/corrupt scenario — a negative or zero count, a `downPaymentPct` outside [0,1), a
 * non-canonical decimal string, an unknown extra key, or a missing required field. The
 * snapshot loader and `engineInput()` MUST go through this; never spread raw JSON into the
 * calc (mirrors `parseAssumptionSet`, T-07-01..03).
 */
export function parseScenarioInputs(input: unknown): ScenarioInputs {
  return ScenarioInputsSchema.parse(input) as ScenarioInputs;
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
    // Validate the scenario at assembly — a forged snapshot is rejected here, not silently
    // computed (CR-03). `assumptions` is already parsed at its own boundary (parseAssumptionSet).
    scenario: Object.freeze(parseScenarioInputs(parts.scenario)),
  });
}
