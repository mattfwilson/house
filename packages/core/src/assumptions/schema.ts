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
 * AssumptionsV3 — schemaVersion 3. KEEPS every V2 slice verbatim and adds the Phase-4
 * FI-Impact + sensitivity tunables (ASMP-02 / D-07/D-12/D-13). Built by copying the V2 shape,
 * bumping the discriminant literal, and appending two new `group({...})` slices — every leaf a
 * `decStr` (never `z.number()`, T-04-01):
 *   - `sensitivity` (D-12/D-13): the six tornado driver bands. FIVE are ABSOLUTE ± perturbations
 *     on a rate (`returnBand`/`inflationBand`/`appreciationBand`/`maintenanceBand`/`swrBand` —
 *     e.g. `returnBand: '0.015'` means ±1.5 percentage points on `returns.realAnnual`). The
 *     SIXTH, `taxBandRelative`, is a RELATIVE ±fraction of the tax figure (L6 — e.g. `'0.15'`
 *     means ±15% of the property-tax line), NOT an absolute rate band.
 *   - `projection` (D-07): `maxHorizonYears`, the FI-projection termination cap. Conceptually an
 *     INTEGER year crossing, stored as a `decStr` (no `z.number()` at the boundary — T-04-02);
 *     calc converts it via `Number()` ONLY at the loop bound (the `downPaymentPct` `.refine`
 *     Number-comparison precedent), never re-entering as a bare number across the boundary.
 */
export const AssumptionsV3 = z
  .object({
    schemaVersion: z.literal(3),
    // --- V2 slices, copied verbatim (every leaf a decStr). ---
    tax: group({
      effectiveIncomeRate: decStr, // blended marginal-ish income tax rate
      propertyRateAnnual: decStr, // placeholder statewide property tax rate (of value) — INERT (kept for migrate stability; property tax flows through the resolved mill rate)
      assessmentRatio: decStr, // assessed value ÷ market value (e.g. "1.0")
      // The published residential mill rate per $1,000, OVERRIDING the town-table resolution;
      // absent = resolve from the town table. Consumed by computeTco and perturbed RELATIVELY by
      // the sensitivity tax driver (L6). Optional so it stays absent-by-default (goldens untouched).
      millRateOverride: decStr.optional(),
    }),
    dti: group({
      frontEnd: decStr,
      backEnd: decStr,
    }),
    returns: group({
      realAnnual: decStr,
    }),
    inflation: group({
      annual: decStr,
    }),
    maintenance: group({
      annualPctOfValue: decStr,
    }),
    swr: group({
      // CR-01: the FI number is annualNeed / swr.rate, so a zero rate crashes via Money.of('Infinity')
      // and a negative rate yields a negative FI target read as "reached at month 0". A positivity
      // refine (mirroring the targetSavingsRate/downPaymentPct Number-comparison precedent) rejects
      // both at the boundary. Tightens validation only — no serialized value changes (defaults stay
      // positive), so the goldens remain byte-identical.
      rate: decStr.refine((s) => Number(s) > 0, {
        message: 'swr.rate must be > 0 (the FI number is spend / swr.rate)',
      }),
    }),
    pmi: group({
      annualRateOfLoan: decStr,
      dropOffLtv: decStr,
    }),
    appreciation: group({
      realAnnual: decStr,
    }),
    transaction: group({
      sellCostPct: decStr,
    }),
    rent: group({
      realGrowthAnnual: decStr,
    }),
    closing: group({
      rateOfPrice: decStr,
    }),
    // --- NEW V3 slices (Phase 4). ---
    // The six tornado sensitivity driver bands (D-12/D-13). Five are ABSOLUTE ± on a rate;
    // `taxBandRelative` is a RELATIVE ±fraction of the tax figure (L6).
    sensitivity: group({
      returnBand: decStr, // ± absolute on returns.realAnnual
      inflationBand: decStr, // ± absolute on inflation.annual
      appreciationBand: decStr, // ± absolute on appreciation.realAnnual
      maintenanceBand: decStr, // ± absolute on maintenance.annualPctOfValue
      taxBandRelative: decStr, // RELATIVE ± fraction of the property-tax figure (L6), NOT absolute
      swrBand: decStr, // ± absolute on swr.rate
    }),
    // FI-projection termination cap (D-07). A conceptual INTEGER year count stored as a decStr
    // (no z.number()); converted via Number() only at the loop bound inside calc.
    projection: group({
      maxHorizonYears: decStr,
    }),
  })
  .strict();

/**
 * AssumptionsV4 — schemaVersion 4. KEEPS every V3 slice verbatim and adds the Phase-5
 * Town-Scoring tunables (TOWN-01 / TOWN-02 / ASMP-01 / D-06/D-08/D-09). Built by copying the
 * V3 shape, bumping the discriminant literal, and appending ONE new `group({...})` slice,
 * `townScoring` — every leaf a `decStr` (never `z.number()`, T-05-06). STRICTLY ADDITIVE: not
 * one V3 leaf is touched, so the four existing result goldens stay byte-identical (Pitfall 7 /
 * A10 — proven in migrate/schema tests by running the golden suite WITHOUT regeneration).
 *
 * The `townScoring` slice supplies the composite-score configuration the Plan 05-03 scoring math
 * reads as stored data (never hardcoded — the `sensitivity` precedent):
 *   - `weights` (D-06): the five top-level metric weights for the weighted composite
 *     (medianPrice / commute / school / millRate / amenities).
 *   - `amenityWeights` (D-07): the per-sub-metric weights inside the amenities composite
 *     (walkability / transit / dining / parks).
 *   - `ranges` (D-09): the FIXED normalization reference ranges (min/max) per metric, so a
 *     town's raw figure normalizes to [0,1] against a stored band rather than the live dataset
 *     (medianPrice / commute / school / millRate / amenity).
 *   - `bucket.stretchFactor` (D-08): the budget multiplier that bounds the "stretch" bucket
 *     (e.g. `'1.25'` — a town priced at or below `budget × stretchFactor` is a stretch).
 */
export const AssumptionsV4 = z
  .object({
    schemaVersion: z.literal(4),
    // --- V3 slices, copied verbatim (every leaf a decStr). ---
    tax: group({
      effectiveIncomeRate: decStr, // blended marginal-ish income tax rate
      propertyRateAnnual: decStr, // placeholder statewide property tax rate (of value) — INERT (kept for migrate stability; property tax flows through the resolved mill rate)
      assessmentRatio: decStr, // assessed value ÷ market value (e.g. "1.0")
      // The published residential mill rate per $1,000, OVERRIDING the town-table resolution;
      // absent = resolve from the town table. Consumed by computeTco and perturbed RELATIVELY by
      // the sensitivity tax driver (L6). Optional so it stays absent-by-default (goldens untouched).
      millRateOverride: decStr.optional(),
    }),
    dti: group({
      frontEnd: decStr,
      backEnd: decStr,
    }),
    returns: group({
      realAnnual: decStr,
    }),
    inflation: group({
      annual: decStr,
    }),
    maintenance: group({
      annualPctOfValue: decStr,
    }),
    swr: group({
      // CR-01: the FI number is annualNeed / swr.rate, so a zero rate crashes via Money.of('Infinity')
      // and a negative rate yields a negative FI target read as "reached at month 0". A positivity
      // refine (mirroring the targetSavingsRate/downPaymentPct Number-comparison precedent) rejects
      // both at the boundary. Tightens validation only — no serialized value changes (defaults stay
      // positive), so the goldens remain byte-identical.
      rate: decStr.refine((s) => Number(s) > 0, {
        message: 'swr.rate must be > 0 (the FI number is spend / swr.rate)',
      }),
    }),
    pmi: group({
      annualRateOfLoan: decStr,
      dropOffLtv: decStr,
    }),
    appreciation: group({
      realAnnual: decStr,
    }),
    transaction: group({
      sellCostPct: decStr,
    }),
    rent: group({
      realGrowthAnnual: decStr,
    }),
    closing: group({
      rateOfPrice: decStr,
    }),
    sensitivity: group({
      returnBand: decStr, // ± absolute on returns.realAnnual
      inflationBand: decStr, // ± absolute on inflation.annual
      appreciationBand: decStr, // ± absolute on appreciation.realAnnual
      maintenanceBand: decStr, // ± absolute on maintenance.annualPctOfValue
      taxBandRelative: decStr, // RELATIVE ± fraction of the property-tax figure (L6), NOT absolute
      swrBand: decStr, // ± absolute on swr.rate
    }),
    projection: group({
      maxHorizonYears: decStr,
    }),
    // --- NEW V4 slice (Phase 5 — Town Scoring & Heatmap). ---
    // The town-scoring composite configuration (TOWN-01/TOWN-02). Every leaf a decStr — a float
    // can never re-enter at this boundary (T-05-06). Strictly additive: NO V3 leaf changed.
    townScoring: group({
      // The five top-level metric weights for the weighted composite (D-06).
      weights: group({
        medianPrice: decStr,
        commute: decStr,
        school: decStr,
        millRate: decStr,
        amenities: decStr,
      }),
      // The per-sub-metric weights inside the amenities composite (D-07).
      amenityWeights: group({
        walkability: decStr,
        transit: decStr,
        dining: decStr,
        parks: decStr,
      }),
      // The FIXED normalization reference ranges (min/max) per metric (D-09).
      ranges: group({
        medianPrice: group({ min: decStr, max: decStr }),
        commute: group({ min: decStr, max: decStr }),
        school: group({ min: decStr, max: decStr }),
        millRate: group({ min: decStr, max: decStr }),
        amenity: group({ min: decStr, max: decStr }),
      }),
      // The budget multiplier bounding the "stretch" bucket (D-08).
      bucket: group({
        stretchFactor: decStr,
      }),
    }),
  })
  .strict();

/**
 * AssumptionSetSchema — the versioned discriminated union (D-05). Adding a version is a
 * one-line append: another object schema in the `z.discriminatedUnion` list.
 */
export const AssumptionSetSchema = z.discriminatedUnion('schemaVersion', [
  AssumptionsV1,
  AssumptionsV2,
  AssumptionsV3,
  AssumptionsV4,
]);

/** The current schema version (integer, monotonic). */
export const CURRENT_VERSION = 4 as const;

/**
 * Any accepted (parseable) AssumptionSet — the union across all known versions.
 *
 * Built as an explicit union of the per-version inferred types rather than
 * `z.infer<typeof AssumptionSetSchema>`: Zod 4's `discriminatedUnion` inference over two
 * large `.strict()` objects degrades to `any`, which would erase the discriminant narrowing
 * the `migrate` switch depends on. The members are the SAME schemas the union is built from,
 * so this stays a single source of truth (a member shape change still flows through).
 */
export type AnyAssumptionSet =
  | z.infer<typeof AssumptionsV1>
  | z.infer<typeof AssumptionsV2>
  | z.infer<typeof AssumptionsV3>
  | z.infer<typeof AssumptionsV4>;

/** The current-version AssumptionSet (what calc code consumes). */
export type CurrentAssumptionSet = z.infer<typeof AssumptionsV4>;
