// score-towns — the top-level Town-Scoring engine entry (TOWN-01..TOWN-04, the integrated Phase-5 output).
//
// PURE. The single engine entry that assembles the UI-SPEC heatmap contract: for every row in the
// canonical 24-town table it extracts the five raw scoring metrics (mill rate from the row; median
// price / school / commute-by-anchor / amenity sub-metrics from the per-metric stamped fields — Plan
// 05-01), normalizes + weighted-sums them via `computeComposite` (Plan 05-03) into an explainable
// `[0,1]` composite STRING + per-metric breakdown, buckets the town's median price against the budget
// via `bucketOf` (Plan 05-03, the SEPARATE budget channel — D-12), and attaches the MA-reality flags
// (`prop25` injected UNIVERSALLY + the curated row flags). The result is the closed `TownScoreboard`
// that Phase 7 renders directly — no financial logic re-derived in the UI.
//
// ALL configuration is STORED DATA, never hardcoded (ASMP-01 / T-05-13 — the `sensitivity` precedent):
// weights, amenity sub-weights, fixed normalization ranges, and the bucket stretchFactor are read off
// `input.assumptions.townScoring`. There is no literal weight / range / stretchFactor in this file.
//
// TWO-CHANNEL SEPARATION (D-12): the composite (qualitative fit) and the bucket (budget overlay) are
// independent — `bucketOf` never reads the score. FLAGS are appended metadata ONLY (T-05-14): they
// never touch composite or bucket. MISSING DATA is honest (D-03/D-04): a town missing its median price
// gets `bucket: null` (the UI-SPEC hatched "No data" state); a commute anchor a town lacks yields a
// `missing:true` commute contribution — never imputed, never zero-filled.
//
// Pattern source: fi/sensitivity.ts (read stored bands off `input.assumptions`, map over a fixed set,
// assemble a CLOSED readonly result), composite.ts (the per-metric breakdown discipline).
import { Money } from '../money/money.js';
import type { CurrentAssumptionSet } from '../assumptions/schema.js';
import { TOWN_RATE_TABLE } from './town-table.js';
import type { CommuteAnchor } from './town-table.schema.js';
import { computeComposite, type MetricContribution, type MetricInput } from './composite.js';
import { bucketOf, type Bucket } from './bucket.js';

// Re-export the enums the scoreboard surfaces, so a renderer imports them from the engine entry.
export type { Bucket } from './bucket.js';
export type { CommuteAnchor } from './town-table.schema.js';
export type { MetricContribution } from './composite.js';
export type { MetricDirection } from './normalize.js';

/**
 * The closed MA-reality flag set the scoreboard surfaces (TOWN-04). `prop25` is the engine-injected
 * universal flag (NEVER a stored row value — D-05); the other three are the curated `MaStoredFlag`
 * row tags. Plain string-literal identifiers — NO UI copy (Phase 7 owns the chip wording).
 */
export type MaFlag = 'prop25' | 'betterment' | 'title5' | '40b';

/**
 * One town's scored row — the UI-SPEC heatmap-cell contract, field-for-field. `composite` is a
 * dimensionless `[0,1]` decimal STRING (or `null` when the town is data-less) — NEVER a bare number.
 * `metrics` is the itemized, explainable per-metric breakdown (the tooltip/expander data). `bucket`
 * is the budget-overlay enum (or `null` when the median price is missing — the hatched "No data"
 * state). `flags` is the universal-prop25-plus-curated MA-flag list (qualitative; never alters
 * composite/bucket).
 */
export interface TownScore {
  readonly town: string;
  readonly composite: string | null;
  readonly metrics: readonly MetricContribution[];
  readonly bucket: Bucket | null;
  readonly flags: readonly MaFlag[];
}

/**
 * The closed scoreboard (the whole Phase-5 engine output). Echoes the `anchor` (so the renderer can
 * label "commute to anchor" generically — no hardcoded default town), the `budget` and `stretchFactor`
 * as decimal STRINGS (the bucket inputs, for display), and the per-town `towns` matrix. ALL `readonly`.
 */
export interface TownScoreboard {
  readonly anchor: CommuteAnchor;
  readonly budget: string;
  readonly stretchFactor: string;
  readonly towns: readonly TownScore[];
}

/**
 * The single engine input (D-11 — Town Scoring stays DECOUPLED from the Affordability/FI chain): the
 * parsed AssumptionsV4 `assumptions` (carrying the stored `townScoring` config), the caller-supplied
 * `budget` as a `Money` (the bucket numerator), and the `anchor` commute enum to score against.
 */
export interface TownScoringInput {
  readonly assumptions: CurrentAssumptionSet;
  readonly budget: Money;
  readonly anchor: CommuteAnchor;
}

/**
 * Score every town in the canonical table against the stored `townScoring` config + the caller's
 * budget/anchor, returning the closed `TownScoreboard` (the UI-SPEC heatmap contract).
 *
 * Reads `weights` / `amenityWeights` / `ranges` / `bucket.stretchFactor` off
 * `input.assumptions.townScoring` (NEVER hardcoded — T-05-13). Per town: builds the five metric
 * inputs (mill rate, median price, commute-by-anchor, school, and the amenities sub-composite),
 * computes the explainable composite, buckets the median price (or `null` when absent — D-03), and
 * attaches `['prop25', ...curated]` flags (prop25 universal; flags never touch the score — T-05-14).
 */
export function scoreTowns(input: TownScoringInput): TownScoreboard {
  const { weights, amenityWeights, ranges, bucket } = input.assumptions.townScoring;
  const stretchFactor = bucket.stretchFactor;

  const towns: readonly TownScore[] = TOWN_RATE_TABLE.map((row) => {
    // The five top-level metric inputs. Each raw value is the stamped magnitude (a decimal STRING)
    // or `null` when the metric/anchor is absent (D-03 — never imputed). Direction folds in via
    // `computeComposite`→`normalize`: lower mill rate / price / commute = better; higher school /
    // amenity = better (the LOCKED UI-SPEC direction map).
    const metricInputs: readonly MetricInput[] = [
      {
        metric: 'millRate',
        rawValue: row.residentialMillRate,
        direction: 'lowerBetter',
        range: ranges.millRate,
        weight: weights.millRate,
      },
      {
        metric: 'medianPrice',
        rawValue: row.medianPrice?.value ?? null,
        direction: 'lowerBetter',
        range: ranges.medianPrice,
        weight: weights.medianPrice,
      },
      {
        metric: 'commute',
        // A missing anchor value = missing, NEVER imputed (D-04 / S6).
        rawValue: row.commute?.[input.anchor]?.value ?? null,
        direction: 'lowerBetter',
        range: ranges.commute,
        weight: weights.commute,
      },
      {
        metric: 'school',
        rawValue: row.school?.value ?? null,
        direction: 'higherBetter',
        range: ranges.school,
        weight: weights.school,
      },
      {
        // Amenities is a SUB-COMPOSITE: its normalized value is the renormalized sub-composite over
        // the four present sub-metrics (each higherBetter, shared `ranges.amenity`). An all-missing
        // amenities block drops from the top-level renormalization (Plan 05-03). `rawValue`/`range`
        // are ignored for a composite metric but supplied to satisfy the leaf-discipline type.
        metric: 'amenities',
        rawValue: null,
        direction: 'higherBetter',
        range: ranges.amenity,
        weight: weights.amenities,
        subMetrics: [
          {
            metric: 'walkability',
            rawValue: row.amenities?.walkability?.value ?? null,
            direction: 'higherBetter',
            range: ranges.amenity,
            weight: amenityWeights.walkability,
          },
          {
            metric: 'transit',
            rawValue: row.amenities?.transit?.value ?? null,
            direction: 'higherBetter',
            range: ranges.amenity,
            weight: amenityWeights.transit,
          },
          {
            metric: 'dining',
            rawValue: row.amenities?.dining?.value ?? null,
            direction: 'higherBetter',
            range: ranges.amenity,
            weight: amenityWeights.dining,
          },
          {
            metric: 'parks',
            rawValue: row.amenities?.parks?.value ?? null,
            direction: 'higherBetter',
            range: ranges.amenity,
            weight: amenityWeights.parks,
          },
        ],
      },
    ];

    const { composite, metrics } = computeComposite(metricInputs);

    // The SEPARATE budget channel (D-12): bucket the median price against budget + budget×stretch.
    // Missing median price → `null` (the UI-SPEC hatched "No data" state — never a default bucket).
    const townBucket: Bucket | null =
      row.medianPrice !== undefined
        ? bucketOf(Money.of(row.medianPrice.value), input.budget, stretchFactor)
        : null;

    // prop25 is injected UNIVERSALLY (every town), then the curated row flags follow (T-05-14: flags
    // are appended metadata — they never altered composite or bucket above).
    const flags: readonly MaFlag[] = ['prop25', ...(row.flags ?? [])];

    return { town: row.town, composite, metrics, bucket: townBucket, flags };
  });

  return {
    anchor: input.anchor,
    budget: input.budget.toDecimalString(),
    stretchFactor,
    towns,
  };
}
