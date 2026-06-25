// AssumptionSet — the Zod 4 versioned schema at the serialization TRUST BOUNDARY
// (D-04 nested, D-05 versioned discriminated union, D-06 decimal-string values).
//
// This is the single point where untrusted-or-corrupt snapshot/assumptions JSON becomes a
// trusted in-memory AssumptionSet. Three properties are enforced HERE, not by convention:
//   - T-03-01: an unknown `schemaVersion` is rejected — `discriminatedUnion` only admits a
//     declared version literal, so a forged `schemaVersion: 99` has no branch and fails.
//   - T-03-02: every numeric tunable is a canonical decimal STRING (`decStr`), never
//     `z.number()` — a JS float can never re-enter at this boundary (Pitfall 7 / D-06).
//   - T-03-03: callers parse THROUGH this schema (safeParse), never spreading raw JSON.
//
// "Don't hand-roll": versioning is expressed as Zod's `discriminatedUnion`, not an ad-hoc
// switch — adding V2 is appending one object schema to the union.
import { z } from 'zod';

/**
 * The single canonical-decimal-string pattern (D-06). One definition of "canonical
 * decimal string" shared across the codebase: the `decStr` Zod validator at the
 * serialization boundary AND the `Money` constructor boundary (money.ts) both use this,
 * so a value cannot be canonical at one door and non-canonical at another.
 * Optional leading `-`, digits, optional single fractional part. NO exponent form, NO
 * thousands separators, NO `Infinity`/`NaN`, NO bare JS number.
 */
export const CANONICAL_DECIMAL_RE = /^-?\d+(\.\d+)?$/;

/**
 * The decimal-string boundary validator (D-06). A canonical base-10 numeric string:
 * optional leading `-`, digits, optional single fractional part. NO exponent form, NO
 * thousands separators, NO bare JS number. Lifts to `Dec` on use; keeps floats out of
 * the serialized form entirely (T-03-02).
 */
export const decStr = z
  .string()
  .regex(CANONICAL_DECIMAL_RE, 'must be a canonical decimal string (e.g. "0.035")');

/** A namespaced group whose every leaf is a decimal string (reused below). */
const group = <Shape extends z.ZodRawShape>(shape: Shape) => z.object(shape).strict();

/**
 * AssumptionsV1 — schemaVersion 1. Nested by domain (D-04). Every tunable is a `decStr`.
 * Shape is locked; seed values live in `defaults.ts` (D-07). `.strict()` rejects unknown
 * keys so a snapshot can't smuggle extra fields past the boundary.
 */
export const AssumptionsV1 = z
  .object({
    schemaVersion: z.literal(1),
    // Income/property tax-ish tunables (real mill-rate tables are a Phase-2 concern).
    tax: group({
      effectiveIncomeRate: decStr, // blended marginal-ish income tax rate
      propertyRateAnnual: decStr, // placeholder statewide property tax rate (of value)
    }),
    // Debt-to-income qualification ratios (front-end housing, back-end total debt).
    dti: group({
      frontEnd: decStr,
      backEnd: decStr,
    }),
    // Expected REAL (inflation-adjusted) investment return for the opportunity-cost engine.
    returns: group({
      realAnnual: decStr,
    }),
    inflation: group({
      annual: decStr,
    }),
    maintenance: group({
      annualPctOfValue: decStr,
    }),
    // Safe withdrawal rate — long-horizon default (~0.033), NOT the 4% rule (locked decision).
    swr: group({
      rate: decStr,
    }),
    // PMI: charged while LTV exceeds `dropOffLtv`, at `annualRateOfLoan` of the loan balance.
    pmi: group({
      annualRateOfLoan: decStr,
      dropOffLtv: decStr, // e.g. "0.8" — PMI removable at/under 80% LTV
    }),
  })
  .strict();

/**
 * AssumptionsV2 — schemaVersion 2. KEEPS every V1 slice and adds the TCO-engine tunables
 * (D-04/D-05/D-06). Built by copying the V1 shape, bumping the discriminant literal, and
 * appending new `group({...})` slices — every leaf a `decStr` (never `z.number()`, T-03-02).
 * The new slices feed the Phase-2 TCO calc modules:
 *   - `appreciation.realAnnual` (D-04): expected REAL annual home-value appreciation.
 *   - `transaction.sellCostPct` (D-05): sale-side cost haircut applied at the holding horizon.
 *   - `rent.realGrowthAnnual` (D-06): real annual rent growth for the rent-vs-buy path.
 *   - `closing.rateOfPrice` (D-12): default one-time closing cost as a fraction of price.
 *   - `tax.assessmentRatio` (D-07, RESEARCH Open Question 3): assessed value ÷ market value,
 *     added under the existing `tax` group so the property-tax module reads one slice.
 */
export const AssumptionsV2 = z
  .object({
    schemaVersion: z.literal(2),
    // V1 `tax` group PLUS the new `assessmentRatio` (D-07) — assessed/market value ratio.
    tax: group({
      effectiveIncomeRate: decStr, // blended marginal-ish income tax rate
      propertyRateAnnual: decStr, // placeholder statewide property tax rate (of value)
      assessmentRatio: decStr, // assessed value ÷ market value (e.g. "1.0")
    }),
    // Debt-to-income qualification ratios (front-end housing, back-end total debt).
    dti: group({
      frontEnd: decStr,
      backEnd: decStr,
    }),
    // Expected REAL (inflation-adjusted) investment return for the opportunity-cost engine.
    returns: group({
      realAnnual: decStr,
    }),
    inflation: group({
      annual: decStr,
    }),
    maintenance: group({
      annualPctOfValue: decStr,
    }),
    // Safe withdrawal rate — long-horizon default (~0.033), NOT the 4% rule (locked decision).
    swr: group({
      rate: decStr,
    }),
    // PMI: charged while LTV exceeds `dropOffLtv`, at `annualRateOfLoan` of the loan balance.
    pmi: group({
      annualRateOfLoan: decStr,
      dropOffLtv: decStr, // e.g. "0.8" — PMI removable at/under 80% LTV
    }),
    // Expected REAL annual home-value appreciation (D-04).
    appreciation: group({
      realAnnual: decStr,
    }),
    // Sale-side transaction cost as a fraction of sale price, applied at horizon end (D-05).
    transaction: group({
      sellCostPct: decStr,
    }),
    // Real annual rent growth for the rent-vs-buy path (D-06).
    rent: group({
      realGrowthAnnual: decStr,
    }),
    // Default one-time closing cost as a fraction of purchase price (D-12).
    closing: group({
      rateOfPrice: decStr,
    }),
  })
  .strict();

/**
 * AssumptionSetSchema — the versioned discriminated union (D-05). Adding a version is a
 * one-line append: another object schema in the `z.discriminatedUnion` list.
 */
export const AssumptionSetSchema = z.discriminatedUnion('schemaVersion', [AssumptionsV1, AssumptionsV2]);

/** The current schema version (integer, monotonic). */
export const CURRENT_VERSION = 2 as const;

/**
 * Any accepted (parseable) AssumptionSet — the union across all known versions.
 *
 * Built as an explicit union of the per-version inferred types rather than
 * `z.infer<typeof AssumptionSetSchema>`: Zod 4's `discriminatedUnion` inference over two
 * large `.strict()` objects degrades to `any`, which would erase the discriminant narrowing
 * the `migrate` switch depends on. The members are the SAME schemas the union is built from,
 * so this stays a single source of truth (a member shape change still flows through).
 */
export type AnyAssumptionSet = z.infer<typeof AssumptionsV1> | z.infer<typeof AssumptionsV2>;

/** The current-version AssumptionSet (what calc code consumes). */
export type CurrentAssumptionSet = z.infer<typeof AssumptionsV2>;
