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
 * The household (profile) block — the person-vs-house side of an affordability solve (D-09).
 * This is the durable input the affordability solvers (Waves 2-3) consume and Phase 6 will
 * persist. Like `ScenarioInputs`, every dollar leaf crosses this boundary as a canonical
 * decimal STRING (never a bare float — CORE-02 / D-06) and the whole shape is `readonly`.
 *
 * `targetSavingsRate` is the only NON-dollar leaf: a fraction-of-gross savings target,
 * constrained to the half-open interval [0,1) at the schema boundary.
 */
export interface Household {
  /**
   * GROSS (pre-tax) annual household income, dollar string (D-02 / D-04). This is GROSS,
   * not net/take-home (Pitfall 2) — the savings-rate target is measured against gross.
   */
  readonly grossAnnualIncome: string;
  /**
   * Single MONTHLY minimum-obligations total (car/student/card minimums) — a monthly payment
   * total, NOT outstanding balances (D-10). Feeds the DTI back-end in the solvers.
   */
  readonly existingMonthlyDebt: string;
  /** Target savings rate as a fraction of GROSS income, in [0,1) (D-02 / D-04). */
  readonly targetSavingsRate: string;
  /** Investable net worth available for the cash-on-hand gate (D-05), dollar string. */
  readonly availableNetWorth: string;
  /**
   * Current household monthly rent (D-11). DISTINCT from `scenario.monthlyRent`, which is the
   * market rent of the rent-vs-buy COMPARISON unit; this is what the household pays today.
   */
  readonly currentRent: string;
  /** Fixed dollar down payment the household intends to put down (D-07), dollar string. */
  readonly downPaymentCash: string;
  /**
   * Cash buffer/reserve subtracted in the cash-on-hand gate (D-05), dollar string. Consumed
   * as-is — the engine applies NO default (A1).
   */
  readonly reserve: string;
  /**
   * Baseline ANNUAL savings while renting (D-17) — the savings-rate floor's denominator
   * baseline. Makes the savings-rate floor well-defined.
   */
  readonly currentAnnualSavings: string;
}

/**
 * HouseholdSchema — the Zod 4 runtime mirror of the `Household` interface and the HOUSEHOLD
 * half of the affordability trust boundary (T-03-01..02), mirroring `ScenarioInputsSchema`:
 *   - every dollar field is a canonical decimal STRING (`decStr`) — a JS float, thousands
 *     separator, or exponent form can never enter the calc (D-06).
 *   - `targetSavingsRate` is constrained to [0,1) so a forged value can never poison the
 *     savings-rate floor. As with `downPaymentPct`, the canonical-string contract is already
 *     enforced by `decStr`; the `.refine` is a pure BOUNDARY range guard (not money math),
 *     so a plain `Number(s)` comparison is acceptable.
 *   - `.strict()` rejects unknown keys, so a forged snapshot can't smuggle extra fields
 *     past the boundary (V5 / T-03-V5, mirrors `ScenarioInputsSchema.strict()`).
 */
export const HouseholdSchema = z
  .object({
    grossAnnualIncome: decStr,
    existingMonthlyDebt: decStr,
    targetSavingsRate: decStr.refine(
      (s) => {
        const n = Number(s);
        return n >= 0 && n < 1;
      },
      { message: 'targetSavingsRate must be in [0,1)' },
    ),
    availableNetWorth: decStr,
    currentRent: decStr,
    downPaymentCash: decStr,
    reserve: decStr,
    currentAnnualSavings: decStr,
  })
  .strict();

/**
 * Validate untrusted data into a trusted `Household`. Throws (with a Zod error) on any
 * forged/corrupt profile — a non-canonical decimal string, a `targetSavingsRate` outside
 * [0,1), an unknown extra key, or a missing required field. `engineInput()` goes through this
 * when a household is present; never spread raw JSON into the calc (mirrors
 * `parseScenarioInputs`, T-03-01..02).
 */
export function parseHousehold(input: unknown): Household {
  return HouseholdSchema.parse(input) as Household;
}

/**
 * The immutable snapshot unit: `asOf` + `assumptions` + scenario inputs, all readonly.
 * This is what a top-level engine function receives AND what a snapshot serializes.
 */
export interface EngineInput {
  readonly asOf: CalendarDate;
  readonly assumptions: CurrentAssumptionSet;
  readonly scenario: ScenarioInputs;
  /**
   * The household (profile) block (D-09). OPTIONAL on `EngineInput` (A3): TCO-only call sites
   * (`computeTco`, `rentVsBuy`) ignore it and need no change, and the existing TCO golden
   * snapshot stays byte-identical. The affordability solvers (Waves 2-3) require/validate its
   * presence at their own entry points.
   */
  readonly household?: Household;
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
  readonly household?: Household;
}): EngineInput {
  return Object.freeze({
    asOf: parts.asOf,
    assumptions: parts.assumptions,
    // Validate the scenario at assembly — a forged snapshot is rejected here, not silently
    // computed (CR-03). `assumptions` is already parsed at its own boundary (parseAssumptionSet).
    scenario: Object.freeze(parseScenarioInputs(parts.scenario)),
    // Validate the household ONLY when present (A3): TCO-only callers omit it and stay
    // untouched. The `household` KEY is OMITTED ENTIRELY when absent (not set to `undefined`)
    // so the serialized snapshot for a TCO-only input stays byte-identical — the existing
    // tco-golden-snapshot.json is unaffected. A forged household is rejected here, never
    // silently computed (T-03-01..02).
    ...(parts.household
      ? { household: Object.freeze(parseHousehold(parts.household)) }
      : {}),
  });
}
