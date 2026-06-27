// normalize — the fixed-range, direction-folded, clamped [0,1] scaling primitive (TOWN-01, D-09).
//
// PURE, runs entirely in the frozen `Dec` clone (34-sig-digit, ROUND_HALF_EVEN — decimal-config.ts).
// Each metric's raw value is scaled to [0,1] against a FIXED `{min,max}` reference range stored in
// AssumptionsV4.townScoring.ranges (NOT min-max over the live town set — D-09: a min-max over the
// dataset reshuffles every town's score on a single edit, breaking reproducibility). Direction
// folds in so the output is ALWAYS "higher = better": a low mill rate / price / commute is good, so
// `lowerBetter` inverts to `(max - raw)/(max - min)`. CLAMPED to [0,1] (Pitfall 14) so a town whose
// figure falls outside the seeded band can never produce a negative or >1 score that would poison the
// weighted sum. Returns a canonical decimal STRING — never a bare `number` (CORE-02 / Pitfall 6).
//
// Direction map (LOCKED by UI-SPEC; documented here for Plan 05-04's caller):
//   - lowerBetter:  medianPrice, commute, millRate   (a smaller raw figure is more desirable)
//   - higherBetter: school, amenities (+ each amenity sub-metric)
//
// Pattern source: property-tax.ts:54 (Dec `.div`), sensitivity.ts:98 (Dec `absolute`), town-table.ts:515
// (`resolveMillRate` validate-and-throw idiom — the guard for a degenerate range).
import { Dec } from '../money/decimal-config.js';

/** Which direction is "better" for a metric — folded into `normalize` so output is higher=better. */
export type MetricDirection = 'higherBetter' | 'lowerBetter';

/**
 * Scale `raw` to [0,1] against a FIXED reference range, folding direction so higher=better.
 *  - higherBetter: (raw - min) / (max - min)
 *  - lowerBetter:  (max - raw) / (max - min)   ( == 1 - higherBetter )
 * CLAMPED to [0,1] (a value beyond the seeded band can never blow up or go negative — Pitfall 14).
 * All arithmetic is in the `Dec` clone; the result is a canonical decimal STRING (never a number).
 *
 * @throws if `max <= min` — a degenerate/zero-width (or inverted) range is invalid config; we guard
 *   and throw a meaningful error rather than divide by zero into Infinity/NaN (Pitfall 5 / T-05-09).
 */
export function normalize(raw: string, min: string, max: string, dir: MetricDirection): string {
  const lo = new Dec(min);
  const hi = new Dec(max);
  const r = new Dec(raw);
  if (hi.lessThanOrEqualTo(lo)) {
    throw new Error(`Invalid reference range: max (${max}) must exceed min (${min}).`);
  }
  const span = hi.minus(lo);
  const t = dir === 'higherBetter' ? r.minus(lo).div(span) : hi.minus(r).div(span);
  const clamped = Dec.max(new Dec(0), Dec.min(new Dec(1), t)); // clamp to [0,1]
  return clamped.toFixed();
}
