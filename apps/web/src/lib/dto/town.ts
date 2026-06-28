// dto/town.ts — the town-heatmap DTO mapper (07-04 Task 2; 05-UI-SPEC Heatmap Encoding Contract). The
// core `TownScoreboard` is ALREADY the UI-SPEC contract field-for-field and carries NO `Money`: the
// `composite` is a `[0,1]` decimal STRING (or `null` when data-less), `budget`/`stretchFactor` are
// decimal strings, `bucket` is the `Bucket` enum (or `null` = the hatched "No data" cell), `flags` are
// `MaFlag` enums, and each `MetricContribution` is all decimal-strings/booleans (the explainable
// per-metric breakdown the tooltip renders verbatim). So this mapper is a faithful PASS-THROUGH that
// reconstructs plain objects to guarantee the server→client contract — it adds NO bucketing/composite
// arithmetic (every encoding value is a core output, D-12 two-channel separation) and preserves the
// EXPLICIT no-data markers (`composite: null`, `bucket: null`, `missing: true`) — never a silent 0 or
// blank (05-UI-SPEC Missing-data / D-03).
import type {
  TownScoreboard,
  TownScore,
  MetricContribution,
  MetricDirection,
  Bucket,
  MaFlag,
  CommuteAnchor,
} from '@house/core';

/**
 * One metric's explainable contribution (the tooltip/expander row). Mirrors the core `MetricContribution`
 * — every field a decimal STRING / boolean / enum — recursing into the amenities sub-composite via
 * `subMetrics`. `missing: true` + null values are the EXPLICIT no-data marker (never a silent 0).
 */
export interface MetricContributionDTO {
  readonly metric: string;
  readonly rawValue: string | null;
  readonly normalizedValue: string | null;
  readonly direction: MetricDirection;
  readonly weight: string;
  readonly weightedContribution: string | null;
  readonly missing: boolean;
  readonly subMetrics?: readonly MetricContributionDTO[];
}

/**
 * One town's heatmap-cell DTO: the `[0,1]` composite STRING (or `null` = data-less), the explainable
 * per-metric breakdown, the budget-overlay `bucket` enum (or `null` = the hatched "No data" cell), and
 * the MA-reality `flags`. Bucket/composite are INDEPENDENT channels (D-12) — both are core outputs.
 */
export interface TownScoreDTO {
  readonly town: string;
  readonly composite: string | null;
  readonly metrics: readonly MetricContributionDTO[];
  readonly bucket: Bucket | null;
  readonly flags: readonly MaFlag[];
}

/**
 * The scoreboard DTO — the echoed commute `anchor` (surfaced generically, no hardcoded town), the
 * `budget`/`stretchFactor` decimal strings (the bucket inputs, for display), and the per-town matrix.
 */
export interface ScoreboardDTO {
  readonly anchor: CommuteAnchor;
  readonly budget: string;
  readonly stretchFactor: string;
  readonly towns: readonly TownScoreDTO[];
}

/** Reconstruct a `MetricContribution` into a plain object, recursing into the amenities sub-composite. */
function mapMetric(metric: MetricContribution): MetricContributionDTO {
  return {
    metric: metric.metric,
    rawValue: metric.rawValue,
    normalizedValue: metric.normalizedValue,
    direction: metric.direction,
    weight: metric.weight,
    weightedContribution: metric.weightedContribution,
    missing: metric.missing,
    ...(metric.subMetrics ? { subMetrics: metric.subMetrics.map(mapMetric) } : {}),
  };
}

/** Reconstruct one `TownScore` row as a plain DTO, preserving its explicit no-data markers. */
function mapTown(town: TownScore): TownScoreDTO {
  return {
    town: town.town,
    composite: town.composite,
    metrics: town.metrics.map(mapMetric),
    bucket: town.bucket,
    flags: [...town.flags],
  };
}

/**
 * Map the core `TownScoreboard` to its serializable `ScoreboardDTO`. A structural pass-through (the
 * scoreboard carries no `Money`) that guarantees plain objects cross the boundary and preserves the
 * 05-UI-SPEC encoding (bucket/composite/flags/no-data) verbatim — no re-derivation of any score.
 */
export function toScoreboardDTO(result: TownScoreboard): ScoreboardDTO {
  return {
    anchor: result.anchor,
    budget: result.budget,
    stretchFactor: result.stretchFactor,
    towns: result.towns.map(mapTown),
  };
}
