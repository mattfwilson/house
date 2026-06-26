// projection.ts — the monthly net-worth FI-date projection loop (D-03 / D-07, FI-02 / FI-06).
//
// This is the termination-guaranteed core of the FI engine. It projects net worth month by
// month from a seed, compounding through the SHARED `monthlyGrowthFactor` (the ONE within-package
// compounding definition `rentVsBuy` also uses — Landmine L1), in the SAME contribute-then-compound
// intra-month order as `rentVsBuy` (lines 220-256). It returns the first month projected NW >= the
// path's FI target, or a FIRST-CLASS discriminated "unreached" verdict at the max-horizon cap.
//
// THE LOCKED INTRA-MONTH CONVENTION (Pitfall 1 / L1): contribute at month START, THEN compound:
//   nw = nw.plus(contributionFor(month));   // invest-the-difference FIRST
//   nw = nw.times(factor);                  // THEN compound one month
// The closed-form oracle (oracle.test.ts) is derived for EXACTLY this order; the 0%-return linear
// case anchors it (n = ceil((T - S)/C)). Any divergence is a real convention bug, not a tolerance.
//
// A5 LOCKED — BUY-PATH NW = LIQUID + LIQUIDATED HOME EQUITY. When `equityFor` is supplied (the buy
// path), the month's liquidated home equity is ADDED to the liquid side-portfolio for the target
// comparison — matching `rentVsBuy`'s own ending-net-worth definition (`buyEndingNetWorth =
// liquidatedEquity + buyPortfolio`, rent-vs-buy.ts lines 252-253/271). Rationale: the renter has
// no house to sell, so comparing total LIQUIDATABLE net worth is apples-to-apples; a liquid-only
// definition understates owner NW and biases toward "don't buy". The renter (baseline) path omits
// `equityFor` (its seed is current NW, it owns no home). The equity composition + the schedule
// index-clamp are computed by the CALLER (Plan 03) and threaded in as `equityFor` — this loop does
// not re-derive `(1+appr)^year` or a second amortization (Don't-Hand-Roll).
//
// L4 — `returns.realAnnual` is ALREADY real and is fed DIRECTLY into `monthlyGrowthFactor` by the
// caller; it is NEVER passed through the Fisher conversion here (Fisher is ONLY for the oracle's
// high-inflation case). This module imports no nominal->real conversion at all.
//
// L3 — the unreached verdict is a DISCRIMINATED `kind: 'unreached'` variant, NEVER a non-finite or
// `-1` sentinel: `canonicalJson` throws on non-finite numbers, so the discriminated variant is the
// only serializable encoding (T-04-04). `years` is a decimal STRING (months/12 in Dec), not a float.
//
// Dec/Money discipline (CORE-02): all compounding/comparison happen in the frozen `Dec` clone;
// dollars cross in as `Money` (the `target`) and the seed as a canonical decimal STRING. `Dec` is
// not re-exported. Determinism (D-13): no `Date.now`/`Math.random`; the loop bound and every rate
// come from the caller (ultimately `EngineInput`).
import { Dec } from '../money/decimal-config.js';
import type { Money } from '../money/money.js';

/**
 * The first-class FI-date outcome (D-07 / L3). A DISCRIMINATED union on `kind` — never a numeric
 * sentinel:
 *   - `reached`: the 1-based `month` of the first projected NW >= target, plus `years` (= month/12
 *     as a decimal STRING, computed in Dec — no non-finite float).
 *   - `unreached`: NW stayed below target through the whole horizon; `cappedAtMonth` is the cap
 *     (= maxHorizonYears * 12). This is the anti-funnel "don't buy" signal (FI-06), sorts worst.
 */
export type FiOutcome =
  | { readonly kind: 'reached'; readonly month: number; readonly years: string }
  | { readonly kind: 'unreached'; readonly cappedAtMonth: number };

/** The locked `projectFiDate` options (signature pinned here for Plans 03/04 to compose). */
export interface ProjectFiDateOptions {
  /** The starting net worth as a canonical decimal STRING (buy path: already net of DP+closing). */
  readonly seedDollars: string;
  /** The path's FI target (renter or owner), as `Money` (D-02). */
  readonly target: Money;
  /** The contribution to add at the START of a given 1-based month (Dec). Buy: savings - premium. */
  readonly contributionFor: (month: number) => InstanceType<typeof Dec>;
  /** The monthly real compounding factor `(1+r)^(1/12)` from the SHARED `monthlyGrowthFactor` (L1). */
  readonly factor: InstanceType<typeof Dec>;
  /**
   * OPTIONAL buy-path liquidated home equity for a given 1-based month (A5). When supplied, it is
   * ADDED to the liquid NW for the target comparison (liquid + liquidated equity). Omitted on the
   * renter (baseline) path (no house to sell).
   */
  readonly equityFor?: (month: number) => InstanceType<typeof Dec>;
  /** The hard termination cap in MONTHS (= maxHorizonYears * 12), read from V3 data by the caller. */
  readonly maxHorizonMonths: number;
}

/**
 * Project net worth month by month and return the FI date (D-03), or the first-class unreached
 * verdict at the cap (D-07). Contribute-then-compound (the locked convention, L1); for the buy
 * path, the comparison NW includes `equityFor(month)` (A5, liquid + liquidated equity). Guaranteed
 * to terminate at `maxHorizonMonths` — a bounded `for`, never an unbounded loop or a sentinel.
 */
export function projectFiDate(opts: ProjectFiDateOptions): FiOutcome {
  const { seedDollars, target, contributionFor, factor, equityFor, maxHorizonMonths } = opts;
  const targetDec = new Dec(target.toDecimalString());

  let nw = new Dec(seedDollars);

  // The seed alone may already meet the target at month 0 (degenerate, but honest).
  if (comparisonNw(nw, equityFor, 0).greaterThanOrEqualTo(targetDec)) {
    return reached(0);
  }

  for (let month = 1; month <= maxHorizonMonths; month++) {
    // LOCKED convention (L1): contribute at month start, THEN compound one month.
    nw = nw.plus(contributionFor(month));
    nw = nw.times(factor);

    // A5: the buy path's NW toward its target = liquid side-portfolio + this month's liquidated
    // home equity. The renter path omits `equityFor`, so the comparison NW is the liquid NW alone.
    if (comparisonNw(nw, equityFor, month).greaterThanOrEqualTo(targetDec)) {
      return reached(month);
    }
  }

  return { kind: 'unreached', cappedAtMonth: maxHorizonMonths };
}

/** The NW used for the target comparison: liquid NW plus this month's liquidated equity (A5). */
function comparisonNw(
  liquid: InstanceType<typeof Dec>,
  equityFor: ((month: number) => InstanceType<typeof Dec>) | undefined,
  month: number,
): InstanceType<typeof Dec> {
  return equityFor ? liquid.plus(equityFor(month)) : liquid;
}

/** Build a `reached` outcome with `years` = month/12 as a decimal STRING (Dec — no float, L3). */
function reached(month: number): FiOutcome {
  return { kind: 'reached', month, years: new Dec(month).div(12).toFixed() };
}
