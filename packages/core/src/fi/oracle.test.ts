// oracle.test.ts — the INDEPENDENT FV-of-annuity oracle (D-09 / D-10 / FI-05).
//
// FI-05 is reframed (D-09): no usable external retirement model exists, so the oracle is an
// INDEPENDENT closed-form derivation living in this test — NOT the engine validating itself.
// `oracleFiMonths` solves the future-value-of-annuity identity for n analytically (via Dec.ln);
// it does NOT import or replay `projectFiDate`'s loop. The two agreeing EXACTLY is the signal.
//
// THE CONVENTION (Pitfall 1 / Landmine L1 — the flagship landmine): the engine's loop is
// contribute-then-compound:  nw = (nw + C) * f   each month, with f = (1+r)^(1/12). Unrolled,
// after n months:  NW_n = S*f^n + C*(f^n + ... + f^1) = S*f^n + C*f*(f^n - 1)/(f - 1).
// Solving NW_n >= T for the smallest integer n gives  n = ceil( ln(A/B) / ln(f) )  with
// A = T*(f-1) + C*f  and  B = S*(f-1) + C*f. The closed form below is derived for THAT exact
// order; the 0%-return case degenerates to the linear n = ceil((T - S)/C) — implemented first
// as the convention anchor (no compounding ambiguity, hand-checkable).
//
// The high-inflation case (D-11 / L2) supplies a NOMINAL return + high inflation and routes it
// through `toReal` (Fisher) to get the real rate the all-real engine actually consumes. A
// high-inflation case that bypassed `toReal` would be vacuous — inflation never enters the
// all-real engine directly. That `toReal` call is the whole point of the case.
import { describe, test, expect } from 'vitest';
import { Dec } from '../money/decimal-config.js';
import { toReal } from '../tco/rent-vs-buy.js';
import { monthlyGrowthFactor } from '../tco/compounding.js';
import { projectFiDate } from './projection.js';
import { Money } from '../money/money.js';

/**
 * The INDEPENDENT closed-form FV-of-annuity solve-for-n (D-10). Returns the smallest whole
 * number of months n with `seed*f^n + C*f*(f^n - 1)/(f - 1) >= target`, where f = (1+r)^(1/12);
 * `Infinity` when the target is unreachable (non-positive contribution or A/B <= 0).
 *
 * This is an analytic identity, NOT an iterative copy of the engine loop — that independence is
 * exactly what D-10 demands (an iterative oracle would pass even if both shared a convention bug).
 */
function oracleFiMonths(seed: string, contribution: string, target: string, realAnnual: string): number {
  const f = new Dec(1).plus(new Dec(realAnnual)).pow(new Dec(1).div(12));
  const C = new Dec(contribution);
  const S = new Dec(seed);
  const T = new Dec(target);

  // Already at/above the target with no months needed.
  if (S.greaterThanOrEqualTo(T)) return 0;

  if (f.equals(1)) {
    // 0%-return degenerate -> linear: NW_n = S + n*C, solve S + n*C >= T.
    if (C.lessThanOrEqualTo(0)) return Infinity; // unreachable
    return Math.ceil(Number(T.minus(S).div(C).toFixed()));
  }

  // General closed form (handles C <= 0 too): NW_n = S*f^n + C*f*(f^n - 1)/(f - 1) >= T
  //   => f^n >= (T*(f-1) + C*f) / (S*(f-1) + C*f) = A / B.
  // If A/B <= 0 the inequality can never be satisfied (the contribution overwhelms growth and NW
  // diverges away from T) -> unreachable. Otherwise n = ceil(ln(A/B)/ln(f)). When that n is
  // non-positive the target is met immediately (already guarded by S >= T above).
  const fm1 = f.minus(1);
  const A = T.times(fm1).plus(C.times(f));
  const B = S.times(fm1).plus(C.times(f));
  const ratio = A.dividedBy(B);
  if (ratio.lessThanOrEqualTo(0)) return Infinity;
  const n = ratio.ln().dividedBy(f.ln());
  if (n.lessThanOrEqualTo(0)) return Infinity; // NW already diverging below T with negative C
  return Math.ceil(Number(n.toFixed()));
}

/** Run the engine for a flat monthly contribution + seed; return its FI month (or Infinity). */
function engineFiMonths(seed: string, contribution: string, target: string, realAnnual: string): number {
  const factor = monthlyGrowthFactor(realAnnual);
  const c = new Dec(contribution);
  const outcome = projectFiDate({
    seedDollars: seed,
    target: Money.of(target),
    contributionFor: () => c,
    factor,
    maxHorizonMonths: 100 * 12, // generous cap for the oracle reconciliation
  });
  return outcome.kind === 'reached' ? outcome.month : Infinity;
}

describe('oracle — 0% convention anchor (Pitfall 1: lock contribute-then-compound EXACTLY)', () => {
  test('0% return: engine FI month === ceil((T - S)/C), EXACT whole months', () => {
    const seed = '10000';
    const contribution = '1000';
    const target = '130000';
    const realAnnual = '0';

    // Hand-checkable: (130000 - 10000) / 1000 = 120 months exactly.
    const expected = Math.ceil((130000 - 10000) / 1000);
    expect(expected).toBe(120);

    expect(oracleFiMonths(seed, contribution, target, realAnnual)).toBe(expected);
    expect(engineFiMonths(seed, contribution, target, realAnnual)).toBe(expected);
    // The agreement is the FI-05 signal — EXACT, no tolerance.
    expect(engineFiMonths(seed, contribution, target, realAnnual)).toBe(
      oracleFiMonths(seed, contribution, target, realAnnual),
    );
  });

  test('0% return: a non-divisible gap ceils up to the first month NW >= target', () => {
    const seed = '0';
    const contribution = '1000';
    const target = '12500'; // 12.5 months -> 13
    const realAnnual = '0';
    expect(oracleFiMonths(seed, contribution, target, realAnnual)).toBe(13);
    expect(engineFiMonths(seed, contribution, target, realAnnual)).toBe(13);
  });
});

describe('oracle — compounding case (r > 0): engine === closed-form, EXACT month agreement', () => {
  test('5% real return: engine FI month === oracleFiMonths (shared convention => zero gap)', () => {
    const seed = '50000';
    const contribution = '2000';
    const target = '1000000';
    const realAnnual = '0.05';

    const oracle = oracleFiMonths(seed, contribution, target, realAnnual);
    const engine = engineFiMonths(seed, contribution, target, realAnnual);
    expect(engine).toBe(oracle);
  });

  test('a different (3%) rate also agrees exactly', () => {
    const seed = '25000';
    const contribution = '3000';
    const target = '750000';
    const realAnnual = '0.03';
    expect(engineFiMonths(seed, contribution, target, realAnnual)).toBe(
      oracleFiMonths(seed, contribution, target, realAnnual),
    );
  });
});

describe('oracle — high-inflation edge MUST route through Fisher (D-11 / L2)', () => {
  test('nominal return + high inflation: feed toReal(nominal, inflation) to BOTH oracle and engine', () => {
    // The whole purpose of this case is exercising the Fisher path. A version with no `toReal`
    // call would be vacuous: the all-real engine never sees inflation directly (D-11).
    const nominal = '0.08';
    const inflation = '0.06';
    const realRate = toReal(nominal, inflation).toFixed(); // (1.08/1.06) - 1 ~= 0.01887

    // Sanity: the Fisher real rate is well below the naive nominal - inflation = 0.02.
    expect(new Dec(realRate).lessThan(new Dec('0.02'))).toBe(true);
    expect(new Dec(realRate).greaterThan(0)).toBe(true);

    const seed = '40000';
    const contribution = '2500';
    const target = '900000';

    const oracle = oracleFiMonths(seed, contribution, target, realRate);
    const engine = engineFiMonths(seed, contribution, target, realRate);
    expect(engine).toBe(oracle);
  });
});

describe('oracle — unreachable agreement (premium swallows savings => oracle Infinity, engine unreached)', () => {
  test('negative contribution (premium > savings): oracle Infinity, engine kind: "unreached"', () => {
    // The ownership premium drives the monthly contribution NEGATIVE: NW is eroded faster than it
    // compounds, so it diverges AWAY from the target — the honest "FI not reached" / don't-buy case
    // (FI-06). Both the oracle (A/B <= 0 => Infinity) and the engine (cap => unreached) must agree.
    const seed = '10000';
    const contribution = '-1000'; // each month withdraws more than growth adds
    const target = '500000';
    const realAnnual = '0.05';

    expect(oracleFiMonths(seed, contribution, target, realAnnual)).toBe(Infinity);

    const factor = monthlyGrowthFactor(realAnnual);
    const outcome = projectFiDate({
      seedDollars: seed,
      target: Money.of(target),
      contributionFor: () => new Dec(contribution),
      factor,
      maxHorizonMonths: 60 * 12,
    });
    expect(outcome.kind).toBe('unreached');
    if (outcome.kind === 'unreached') {
      expect(outcome.cappedAtMonth).toBe(60 * 12);
    }
    // Both agree on unreachability: oracle === Infinity, engine (same cap) === a discriminated
    // 'unreached', surfaced here as Infinity by the engineFiMonths adapter.
    expect(engineFiMonths(seed, contribution, target, realAnnual)).toBe(Infinity);
  });
});
