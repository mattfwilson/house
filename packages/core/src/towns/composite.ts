// composite — the explainable per-metric breakdown + missing-weight renormalization (TOWN-01/TOWN-03).
//
// PURE, runs entirely in the frozen `Dec` clone. Per town it builds the itemized breakdown the
// UI-SPEC matrix renders ({ rawValue, normalizedValue, direction, weight, weightedContribution,
// missing }), then weighted-sums the PRESENT normalized values into a single dimensionless composite
// STRING. The score is NOT `Money` — it is a [0,1] decimal string (using `Money` here would misuse the
// dollar type; RESEARCH Anti-Pattern). Pattern source: property-tax.ts (Dec→record breakdown
// discipline), sensitivity.ts:243-254 (map-over-a-set → accumulate → closed result shape).
//
// MISSING-DATA HANDLING (D-03/D-10 — the heart of the honesty contract): a missing metric is DROPPED,
// never imputed as 0 (0 would silently rank the town worst — T-05-12). The present metrics' weights
// are renormalized to sum 1 by dividing each by Σ(present weight); this is also why weights need not
// sum to 1 — they are RELATIVE. Two data-less edges yield `null` (NEVER 0 — T-05-10): (a) ALL metrics
// missing, and (b) Σ present weight == 0 (all present metrics weighted '0'). Both return composite
// `null` with the breakdown still fully itemized.
//
// AMENITIES is a SUB-COMPOSITE: a metric carrying `subMetrics` has its `normalizedValue` computed by
// recursively renormalizing the present sub-metrics (same rule). If ALL amenity sub-metrics are
// missing, the amenities metric itself is `missing:true` and drops from the top-level renormalization.
import { Dec } from '../money/decimal-config.js';
import { normalize, type MetricDirection } from './normalize.js';

/** A fixed normalization reference range (mirrors AssumptionsV4.townScoring.ranges leaves). */
export interface MetricRange {
  readonly min: string;
  readonly max: string;
}

/**
 * One metric's scoring input. A LEAF metric supplies a `rawValue` (null = missing) + `range`. A
 * COMPOSITE metric (amenities) supplies `subMetrics` instead; its own `rawValue` is ignored and its
 * normalized value is the renormalized sub-composite. `weight` is the CONFIGURED (relative) weight.
 */
export interface MetricInput {
  readonly metric: string;
  readonly rawValue: string | null;
  readonly direction: MetricDirection;
  readonly range: MetricRange;
  readonly weight: string;
  readonly subMetrics?: readonly MetricInput[];
}

/**
 * One itemized contribution row — the UI-SPEC breakdown contract, field-for-field. `weight` is the
 * CONFIGURED weight (so the UI can show "you weighted price 30%"); `weightedContribution` already
 * bakes in the missing-metric renormalization, so present contributions sum to the composite. All
 * value fields are decimal STRINGS or `null` (missing) — never a bare number, never 0-imputed.
 */
export interface MetricContribution {
  readonly metric: string;
  readonly rawValue: string | null;
  readonly normalizedValue: string | null;
  readonly direction: MetricDirection;
  readonly weight: string;
  readonly weightedContribution: string | null;
  readonly missing: boolean;
  readonly subMetrics?: readonly MetricContribution[];
}

/** The closed composite result: the dimensionless composite (`null` when data-less) + the breakdown. */
export interface CompositeResult {
  readonly composite: string | null;
  readonly metrics: readonly MetricContribution[];
}

/** A metric resolved to its normalized value + missing status, before top-level renormalization. */
interface ResolvedMetric {
  readonly metric: string;
  readonly rawValue: string | null;
  readonly normalizedValue: string | null;
  readonly direction: MetricDirection;
  readonly weight: string;
  readonly missing: boolean;
  readonly subMetrics?: readonly MetricContribution[];
}

/** Resolve one input to its normalized value (recursing into a sub-composite for amenities). */
function resolve(input: MetricInput): ResolvedMetric {
  if (input.subMetrics !== undefined) {
    // Composite metric (amenities): its normalized value IS the renormalized sub-composite.
    const sub = computeComposite(input.subMetrics);
    return {
      metric: input.metric,
      rawValue: null,
      normalizedValue: sub.composite, // null when all sub-metrics missing / Σsub == 0
      direction: input.direction,
      weight: input.weight,
      missing: sub.composite === null,
      subMetrics: sub.metrics,
    };
  }
  if (input.rawValue === null) {
    // Missing leaf: dropped, never imputed (D-03).
    return {
      metric: input.metric,
      rawValue: null,
      normalizedValue: null,
      direction: input.direction,
      weight: input.weight,
      missing: true,
    };
  }
  return {
    metric: input.metric,
    rawValue: input.rawValue,
    normalizedValue: normalize(input.rawValue, input.range.min, input.range.max, input.direction),
    direction: input.direction,
    weight: input.weight,
    missing: false,
  };
}

/**
 * Build the explainable breakdown + the present-weight-renormalized composite from per-metric inputs.
 * Drops missing metrics and renormalizes present weights; yields composite `null` (never 0) when no
 * metric is present OR Σ present weight is zero. Recurses for the amenities sub-composite. All math in
 * the `Dec` clone; the composite is a decimal STRING, never `Money`.
 */
export function computeComposite(inputs: readonly MetricInput[]): CompositeResult {
  const resolved = inputs.map(resolve);

  // Σ over the PRESENT metrics' configured weights (the renormalization denominator).
  const sigma = resolved.reduce(
    (acc, n) => (n.missing ? acc : acc.plus(new Dec(n.weight))),
    new Dec(0),
  );
  const anyPresent = resolved.some((n) => !n.missing);
  // Guard the two data-less edges: nothing present, or all present weights sum to 0 → composite null.
  const usable = anyPresent && sigma.greaterThan(0);

  let compositeAcc = new Dec(0);
  const metrics: MetricContribution[] = resolved.map((n) => {
    let weightedContribution: string | null = null;
    if (usable && !n.missing) {
      // norm · (weight / Σpresent); accumulate the ROUNDED strings so contributions sum EXACTLY.
      const wc = new Dec(n.normalizedValue as string).times(new Dec(n.weight).div(sigma));
      weightedContribution = wc.toFixed();
      compositeAcc = compositeAcc.plus(new Dec(weightedContribution));
    }
    const contribution: MetricContribution = {
      metric: n.metric,
      rawValue: n.rawValue,
      normalizedValue: n.normalizedValue,
      direction: n.direction,
      weight: n.weight,
      weightedContribution,
      missing: n.missing,
      ...(n.subMetrics !== undefined ? { subMetrics: n.subMetrics } : {}),
    };
    return contribution;
  });

  return { composite: usable ? compositeAcc.toFixed() : null, metrics };
}
