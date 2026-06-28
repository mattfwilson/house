// fi-trajectory.ts — the pure month-by-month net-worth SERIES entry (SC-2, RESEARCH Open Q1).
//
// `projectFiDate` already projects net worth month by month for both the buy path and the
// keep-renting baseline, but it DISCARDS every point except the FI crossing. The D-07 hero chart
// needs the whole series: a net-worth-over-time line for THIS scenario overlaid against the
// no-purchase baseline, with the FI-threshold line and the two crossover markers. `fiTrajectory`
// surfaces that discarded series in the CORE (never hand-rolled in the web layer — CORE-01/02).
//
// AGREE BY CONSTRUCTION (the whole correctness claim): `fiTrajectory` reuses
//   - the SAME two `PathBundle`s `fiImpact` builds — via the shared `buildFiPaths` (no re-derived
//     seed/premium/equity math), and
//   - the SAME locked contribute-then-compound intra-month order as `projectFiDate`
//     (`nw = nw.plus(contributionFor(month)); nw = nw.times(factor)` — projection.ts lines 89-99), and
//   - the SAME `comparisonNw` (liquid + liquidated equity for buy; liquid-only for rent) to test the
//     FI target.
// So the emitted series and the recorded `buyFiMonth`/`rentFiMonth` cannot disagree with
// `projectFiDate` on the same input — proven by the reconciliation test.
//
// SAMPLING (D-07 is a ~30-60yr line chart): the FI-CROSSOVER months are computed in the FULL monthly
// loop (EXACT, regardless of stride), but the emitted `points` are YEAR-SAMPLED (month 0 + every
// 12th month through the cap) to keep the series light for the chart. The crossover markers are
// exact even when they fall between sampled points.
//
// Dec/Money discipline (CORE-02, the fi-impact precedent): all compounding/comparison happen in the
// frozen `Dec` clone; each emitted dollar crosses OUT as `Money` via `Money.of(dec.toFixed())`;
// `Dec` is NOT re-exported. Determinism (D-13): no `Date.now`/`Math.random`; the cap comes from
// `input.assumptions.projection.maxHorizonYears` (Number() only at the loop bound, inside buildFiPaths).
import { Dec } from '../money/decimal-config.js';
import { Money } from '../money/money.js';
import type { EngineInput } from '../engine/engine-input.js';
import { comparisonNw } from './projection.js';
import { buildFiPaths, type PathBundle } from './fi-paths.js';

/** One sampled point on the trajectory: the hold `month` + both paths' comparison net worth (Money). */
interface TrajectoryPoint {
  readonly month: number;
  readonly buyNetWorth: Money;
  readonly rentNetWorth: Money;
}

/**
 * The closed FI-trajectory result (SC-2, D-07) — mirrors `FiImpactResult`'s discipline. Every dollar
 * crosses as `Money`; the FI-month markers are `number | null` (null = the path never reached within
 * the horizon — the anti-funnel "don't buy" series). ALL closed + `readonly`.
 */
export interface FiTrajectoryResult {
  /** The year-sampled net-worth series for both paths (month 0 + every 12th month through the cap). */
  readonly points: readonly TrajectoryPoint[];
  /** The FI-threshold line for the chart: the owner FI target (D-07). */
  readonly fiThreshold: Money;
  /** The buy path's FI crossover month (EXACT), or `null` if it never reaches within the horizon. */
  readonly buyFiMonth: number | null;
  /** The renter baseline's FI crossover month (EXACT), or `null` if it never reaches. */
  readonly rentFiMonth: number | null;
}

/** A single path's evolving Dec state as the monthly loop advances. */
interface PathState {
  nw: InstanceType<typeof Dec>;
  readonly targetDec: InstanceType<typeof Dec>;
  fiMonth: number | null;
}

/** Seed a path's loop state from its bundle, and pre-check the month-0 crossing (projectFiDate's seed check). */
function seedState(bundle: PathBundle): PathState {
  const nw = new Dec(bundle.seedDollars);
  const targetDec = new Dec(bundle.target.toDecimalString());
  // The seed alone may already meet the target at month 0 (degenerate but honest — matches
  // projection.ts:85, which seeds the month-0 check with equityFor(0)).
  const fiMonth = comparisonNw(nw, bundle.equityFor, 0).greaterThanOrEqualTo(targetDec) ? 0 : null;
  return { nw, targetDec, fiMonth };
}

/**
 * Advance a path one month under the LOCKED convention (contribute at month start, THEN compound),
 * record the FIRST month its comparison NW crosses the target, and return that month's comparison
 * NW (the value the chart plots — liquid + liquidated equity for buy; liquid-only for rent).
 */
function stepMonth(state: PathState, bundle: PathBundle, month: number): InstanceType<typeof Dec> {
  // LOCKED convention (L1): contribute at month start, THEN compound one month.
  state.nw = state.nw.plus(bundle.contributionFor(month)).times(bundle.factor);
  const comparison = comparisonNw(state.nw, bundle.equityFor, month);
  if (state.fiMonth === null && comparison.greaterThanOrEqualTo(state.targetDec)) {
    state.fiMonth = month;
  }
  return comparison;
}

/**
 * Emit the month-by-month net-worth trajectory for both the buy path and the keep-renting baseline
 * (SC-2). Reuses the shared `buildFiPaths` bundles + the locked projection loop + `comparisonNw`, so
 * the series and the FI-month markers agree by construction with `projectFiDate` / `fiImpact`.
 * Requires `input.household` (enforced inside `buildFiPaths`); pure + deterministic.
 */
export function fiTrajectory(input: EngineInput): FiTrajectoryResult {
  const { buy, baseline, targets, maxHorizonMonths } = buildFiPaths(input);

  const buyState = seedState(buy);
  const rentState = seedState(baseline);

  const points: TrajectoryPoint[] = [];

  // The month-0 point (today's seed NW) anchors the chart's left edge.
  points.push({
    month: 0,
    buyNetWorth: Money.of(comparisonNw(buyState.nw, buy.equityFor, 0).toFixed()),
    rentNetWorth: Money.of(comparisonNw(rentState.nw, baseline.equityFor, 0).toFixed()),
  });

  for (let month = 1; month <= maxHorizonMonths; month++) {
    const buyComparison = stepMonth(buyState, buy, month);
    const rentComparison = stepMonth(rentState, baseline, month);

    // Year-sample the emitted series (the crossover months above stay EXACT regardless of stride).
    if (month % 12 === 0) {
      points.push({
        month,
        buyNetWorth: Money.of(buyComparison.toFixed()),
        rentNetWorth: Money.of(rentComparison.toFixed()),
      });
    }
  }

  return {
    points,
    fiThreshold: targets.ownerTarget,
    buyFiMonth: buyState.fiMonth,
    rentFiMonth: rentState.fiMonth,
  };
}
