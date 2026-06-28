// fiImpact — the top-level FI-IMPACT orchestrator (FI-01 / FI-03), the flagship instrument. It
// answers the one question the whole tool exists for: "what does buying THIS house do to our
// early-retirement timeline?" — and it is allowed to answer "don't buy" (FI-06). It composes the
// Wave-2 primitives (`fiTargets`, `projectFiDate`) over the Phase-2 substrate by way of the SHARED
// `buildFiPaths` builder (fi-paths.ts) — it does NOT rebuild trajectory math, and it now shares the
// exact buy/renter `PathBundle`s with `fiTrajectory` so the FI date and the emitted series agree.
//
// THE TWO HONEST PATHS (the opportunity-cost symmetry that is the product's correctness core) live
// in `fi-paths.ts` (`buildFiPaths`): the buy seed = investable NW − (DP+closing), contribution =
// savings − ownership premium, NW = liquid + liquidated equity (A5), owner target; the renter
// baseline keeps the full NW liquid + the full savings, renter target, price-independent (D-04/D-05).
//
// THE FI-DATE DELTA (FI-03): `fiDeltaMonths = ownerFiMonth − renterFiMonth` when BOTH paths reach
// (positive ⇒ buying DELAYS FI — the common anti-funnel direction; negative ⇒ buying beats renting).
// `fiDeltaYears = fiDeltaMonths / 12` as a decimal STRING (Dec — never a float). When EITHER path is
// `unreached`, BOTH deltas are `null`: a delta is only defined between two reached dates; the
// unreached row still sorts (unreached-last) in `compareScenarios` via the `kind` branch, not a
// numeric delta (L3 — no Infinity/sentinel ever materialized).
//
// D-02 VISIBILITY: the result surfaces both per-path `FiOutcome`s AND both `FiTargets` (renter/owner
// target + both housing components) — the fairness fulcrum is never buried.
//
// Dec/Money discipline (the gap.ts composer precedent, CORE-02): the seed/premium/equity math lives
// in `buildFiPaths`'s frozen `Dec` clone; dollars enter as `Money` and cross to the projection as
// canonical decimal STRINGS; the years delta crosses as a decimal STRING. `Dec` is NOT re-exported.
// Determinism (D-13): no `Date.now`/`Math.random`; every rate + the loop bound come from the input.
import { Dec } from '../money/decimal-config.js';
import type { EngineInput } from '../engine/engine-input.js';
import { type FiTargets } from './fi-target.js';
import { projectFiDate, type FiOutcome } from './projection.js';
import { buildFiPaths } from './fi-paths.js';

// Re-exported from the shared path builder so the existing fi-impact.test.ts import (and the
// equity-year convention pin, T-04-G4) keeps resolving from here. `buyEquityAt` returns the
// internal `Dec` and is NOT re-exported from the barrel.
export { buyEquityAt } from './fi-paths.js';

/**
 * The closed FI-impact result (FI-01 / FI-03, D-02). Every dollar field crosses as `Money`; the
 * FI dates are discriminated `FiOutcome`s (never a numeric sentinel); the deltas are `null` when a
 * delta is undefined (either path unreached) and otherwise a `number` of months + a decimal STRING
 * of years. ALL closed + `readonly`.
 */
export interface FiImpactResult {
  /** The keep-renting baseline FI outcome (D-05) — projected against the renter target. */
  readonly baseline: FiOutcome;
  /** The buy-path FI outcome (D-04) — projected against the owner target, NW = liquid + equity (A5). */
  readonly buy: FiOutcome;
  /**
   * `ownerFiMonth − renterFiMonth` when BOTH paths reach (positive ⇒ buying DELAYS FI); `null` when
   * either path is `unreached` (a delta needs two reached dates — L3, never Infinity/NaN).
   */
  readonly fiDeltaMonths: number | null;
  /** The same delta in years = `fiDeltaMonths / 12` as a decimal STRING (Dec); `null` when undefined. */
  readonly fiDeltaYears: string | null;
  /** Both FI targets + both housing components (D-02 visibility — the fairness fulcrum, surfaced). */
  readonly targets: FiTargets;
}

/**
 * Compose the FI-impact result for a household + scenario (FI-01 / FI-03). Builds the buy +
 * renter-baseline paths via the SHARED `buildFiPaths` (which requires `input.household` and throws
 * a clear error if absent), projects each ONCE against its target, and computes the FI-date delta
 * (owner − renter) in months AND years, `null` when either is unreached.
 */
export function fiImpact(input: EngineInput): FiImpactResult {
  const { buy: buyBundle, baseline: baselineBundle, targets } = buildFiPaths(input);

  const buy = projectFiDate(buyBundle);
  const baseline = projectFiDate(baselineBundle);

  // FI-date delta (FI-03): defined ONLY when both paths reach (a delta needs two reached dates).
  // owner − renter (positive ⇒ buying delays FI). Years = months / 12 as a decimal STRING (Dec).
  let fiDeltaMonths: number | null = null;
  let fiDeltaYears: string | null = null;
  if (buy.kind === 'reached' && baseline.kind === 'reached') {
    fiDeltaMonths = buy.month - baseline.month;
    fiDeltaYears = new Dec(fiDeltaMonths).div(12).toFixed();
  }

  return { baseline, buy, fiDeltaMonths, fiDeltaYears, targets };
}
