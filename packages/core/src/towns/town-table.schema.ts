// Town mill-rate row — the Zod boundary for a single seeded MA town rate (TCO-02 data half).
//
// This mirrors the AssumptionSet boundary discipline: the SAME canonical-decimal `decStr`
// validator from assumptions/schema.ts is reused (one definition of "canonical decimal
// string" across the codebase — a rate cannot be canonical at one door and a float at
// another), and `.strict()` rejects any unknown key so a row can't smuggle extra fields.
//
// `residentialMillRate` is stored AS PUBLISHED by the MA DLS "Tax Rates by Class" report —
// dollars of tax per $1,000 of assessed value (Assumption A3) — NOT pre-divided. The
// property-tax calc module divides by 1000 at use; storing the published figure keeps the
// table directly auditable against the DLS source.
import { z } from 'zod';
import { decStr } from '../assumptions/schema.js';

/**
 * A single per-metric vintage/source stamp (D-02). The SAME `decStr` validator carries the
 * value, so a town-scoring metric cannot be a float at one door and canonical at another.
 * `.strict()` locks the stamp to exactly `{ value, asOf, source }`. There is NO default and
 * NO `.nullable()`: a genuinely-unknown metric is expressed by OMITTING the stamp key
 * entirely (absent = missing — D-03), never by zero-filling or null-stamping. `asOf` is the
 * vintage year the value reflects; `source` is a provenance label (e.g. a public-source name
 * or `'hand-seeded estimate'`).
 */
export const stampedMetric = z
  .object({
    value: decStr, // canonical decimal string — the metric magnitude (float rejected, T-05-01)
    asOf: z.number().int(), // vintage year (D-02)
    source: z.string(), // provenance label (D-02)
  })
  .strict();

/** A validated per-metric stamp (Zod-inferred — single source of truth). */
export type MetricStamp = z.infer<typeof stampedMetric>;

/**
 * The three seeded commute anchors (A8 / D-04 — "small fixed set"). Each town's `commute`
 * map keys against these; a per-anchor stamp may be absent (missing = D-03).
 */
export type CommuteAnchor = 'downtownBoston' | 'kendallCambridge' | 'route128Burlington';

/** The curated MA-flag enum element (stored per row). NOTE: `prop25` is NOT here — the engine
 * injects Prop 2½ universally per D-05, so it is never a stored row value. */
const maStoredFlagSchema = z.enum(['betterment', 'title5', '40b']);

/** A single curated MA flag stored on a row (Zod-inferred). */
export type MaStoredFlag = z.infer<typeof maStoredFlagSchema>;

/**
 * A single town's row, FY-stamped, behind the `.strict()` + `decStr` boundary. Carries the
 * residential mill rate (scoring metric #1, AS PUBLISHED — A3) plus the Phase-5 town-scoring
 * metrics: `medianPrice` ($), `school` (GreatSchools 1–10), `commute` (drive-time minutes per
 * anchor), and `amenities` (Walk-Score-family 0–100 sub-metrics — D-07). Every scoring metric
 * is an OPTIONAL per-metric `stampedMetric` so an unknown value is an absent key (D-03), never
 * imputed. `flags` is the curated MA-reality enum array (betterment/title5/40b — D-05; prop25
 * is engine-injected, not stored). `.strict()` rejects unknown keys (T-05-02); `decStr` rejects
 * floats (T-05-01).
 */
export const townRowSchema = z
  .object({
    town: z.string(),
    fy: z.number().int(),
    residentialMillRate: decStr, // $/$1,000 of assessed value, AS PUBLISHED (A3) — scoring metric #1
    // --- Phase-5 town-scoring metrics (each optional; absent = missing, D-03). ---
    medianPrice: stampedMetric.optional(), // median home price in dollars ($), stamped
    school: stampedMetric.optional(), // GreatSchools 1–10 rating, stamped
    // Drive-time minutes to each seeded anchor (A8); each anchor independently optional.
    commute: z
      .object({
        downtownBoston: stampedMetric.optional(),
        kendallCambridge: stampedMetric.optional(),
        route128Burlington: stampedMetric.optional(),
      })
      .strict()
      .optional(),
    // Walk-Score-family 0–100 amenity sub-metrics (D-07); each sub-metric independently optional.
    amenities: z
      .object({
        walkability: stampedMetric.optional(),
        transit: stampedMetric.optional(),
        dining: stampedMetric.optional(),
        parks: stampedMetric.optional(),
      })
      .strict()
      .optional(),
    // Curated MA-reality flags (D-05). prop25 is NOT storable — the engine injects it universally.
    flags: z.array(maStoredFlagSchema).optional(),
  })
  .strict();

/** A validated town rate row (Zod-inferred — single source of truth with the runtime schema). */
export type TownRateRow = z.infer<typeof townRowSchema>;
