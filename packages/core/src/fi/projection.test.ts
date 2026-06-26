// projection.test.ts — the monthly FI-date loop (D-03 / D-07 / A5, FI-02 / FI-06).
//
// Proves the three load-bearing behaviors with EXACT assertions (never `toBeCloseTo` on a
// whole-month FI date — Pitfall 1 warning sign):
//   1. REACHED: a reachable path returns kind:'reached' with the 1-based month and years = month/12
//      (decimal STRING, Dec).
//   2. UNREACHED (D-07): a path that never reaches target within the horizon returns
//      kind:'unreached' with cappedAtMonth === maxHorizonYears*12 — first-class verdict, no Infinity,
//      no -1, no unbounded loop (the anti-funnel "don't buy" signal, FI-06).
//   3. BUY-PATH NW = LIQUID + LIQUIDATED EQUITY (A5): adding the month's liquidated home equity
//      (homeValueAt - schedule balance) * (1 - sellCostPct) moves the FI date EARLIER (or no later)
//      than a liquid-only projection — the equity inclusion is honest, not buried.
//
// The loop reads the cap from V3 data (`DEFAULT_ASSUMPTIONS.projection.maxHorizonYears`) via
// Number() at the bound only (decStr stays a string until the loop boundary). The equityFor closure
// reuses `homeValueAt` + `amortizationSchedule` + the schedule index-clamp verbatim from
// rent-vs-buy.ts 246-253 — it does NOT re-derive appreciation or a second amortization (L4 / DRY).
import { describe, test, expect } from 'vitest';
import { Dec } from '../money/decimal-config.js';
import { Money } from '../money/money.js';
import { monthlyGrowthFactor } from '../tco/compounding.js';
import { homeValueAt } from '../tco/carrying-costs.js';
import { amortizationSchedule } from '../tco/amortization.js';
import { DEFAULT_ASSUMPTIONS } from '../assumptions/defaults.js';
import { projectFiDate } from './projection.js';

// The cap from V3 stored data (decStr -> Number at the loop bound only — the documented boundary).
const MAX_HORIZON_MONTHS = Number(DEFAULT_ASSUMPTIONS.projection.maxHorizonYears) * 12;

describe('projectFiDate — reached (D-03): first month NW >= target', () => {
  test('returns kind:"reached" with the 1-based month and years = month/12 (decimal string)', () => {
    const seed = '10000';
    const contribution = new Dec('1000');
    const target = Money.of('130000');
    const factor = monthlyGrowthFactor('0'); // 0% -> linear, hand-checkable: 120 months

    const outcome = projectFiDate({
      seedDollars: seed,
      target,
      contributionFor: () => contribution,
      factor,
      maxHorizonMonths: MAX_HORIZON_MONTHS,
    });

    expect(outcome.kind).toBe('reached');
    if (outcome.kind === 'reached') {
      expect(outcome.month).toBe(120);
      // years = 120 / 12 = "10" exactly (decimal string in Dec).
      expect(outcome.years).toBe(new Dec(120).div(12).toFixed());
      expect(outcome.years).toBe('10');
    }
  });

  test('a seed already >= target reaches at month 0', () => {
    const outcome = projectFiDate({
      seedDollars: '500000',
      target: Money.of('100000'),
      contributionFor: () => new Dec('0'),
      factor: monthlyGrowthFactor('0.05'),
      maxHorizonMonths: MAX_HORIZON_MONTHS,
    });
    expect(outcome.kind).toBe('reached');
    if (outcome.kind === 'reached') expect(outcome.month).toBe(0);
  });
});

describe('projectFiDate — unreached (D-07 / FI-06): first-class verdict at the cap', () => {
  test('a diverging path returns kind:"unreached" with cappedAtMonth === maxHorizonYears*12', () => {
    // Negative contribution (ownership premium > savings): NW erodes, never reaches target — the
    // honest "FI not reached within horizon" / don't-buy verdict. NO Infinity, NO -1, terminates.
    const outcome = projectFiDate({
      seedDollars: '10000',
      target: Money.of('500000'),
      contributionFor: () => new Dec('-1000'),
      factor: monthlyGrowthFactor('0.05'),
      maxHorizonMonths: MAX_HORIZON_MONTHS,
    });

    expect(outcome.kind).toBe('unreached');
    if (outcome.kind === 'unreached') {
      expect(outcome.cappedAtMonth).toBe(MAX_HORIZON_MONTHS);
      expect(outcome.cappedAtMonth).toBe(720); // 60 years * 12 (the V3 default)
    }
  });

  test('a tiny contribution that cannot reach a huge target within the cap is unreached', () => {
    const outcome = projectFiDate({
      seedDollars: '0',
      target: Money.of('999999999'),
      contributionFor: () => new Dec('1'),
      factor: monthlyGrowthFactor('0'),
      maxHorizonMonths: 12, // 12 * $1 = $12 << target
    });
    expect(outcome.kind).toBe('unreached');
    if (outcome.kind === 'unreached') expect(outcome.cappedAtMonth).toBe(12);
  });
});

describe('projectFiDate — buy-path NW = liquid + liquidated equity (A5): equity moves FI earlier', () => {
  test('including liquidated home equity reaches the target no LATER than liquid-only', () => {
    // Build the equityFor closure exactly as Plan 03's buy path will: liquidated home equity =
    // (homeValueAt(price, appr, year) - schedule.balance) * (1 - sellCostPct), with the schedule
    // index-clamp for holds past the amortization term (rent-vs-buy.ts 246-253 verbatim).
    const price = '600000';
    const downPaymentPct = '0.20';
    const annualRate = '0.06375';
    const termMonths = 360;
    const appreciationRealAnnual = DEFAULT_ASSUMPTIONS.appreciation.realAnnual;
    const sellCostPct = DEFAULT_ASSUMPTIONS.transaction.sellCostPct;
    const sellRetain = new Dec(1).minus(new Dec(sellCostPct));

    const loan = new Dec(price).times(new Dec(1).minus(new Dec(downPaymentPct))).toFixed();
    const schedule = amortizationSchedule(loan, annualRate, termMonths);

    const equityFor = (month: number): InstanceType<typeof Dec> => {
      const year = Math.floor((month - 1) / 12); // 0-based hold year for month 1..12 -> year 0
      const homeValue = new Dec(homeValueAt(price, appreciationRealAnnual, year).toDecimalString());
      const row = month - 1 < schedule.rows.length ? schedule.rows[month - 1]! : undefined;
      const remainingBalance = row ? new Dec(row.balance.toDecimalString()) : new Dec(0);
      const equity = homeValue.minus(remainingBalance);
      return equity.times(sellRetain);
    };

    const seed = '50000';
    const contribution = new Dec('2000');
    const target = Money.of('700000');
    const factor = monthlyGrowthFactor('0.05');

    const liquidOnly = projectFiDate({
      seedDollars: seed,
      target,
      contributionFor: () => contribution,
      factor,
      maxHorizonMonths: MAX_HORIZON_MONTHS,
    });
    const liquidPlusEquity = projectFiDate({
      seedDollars: seed,
      target,
      contributionFor: () => contribution,
      factor,
      equityFor,
      maxHorizonMonths: MAX_HORIZON_MONTHS,
    });

    // The equity inclusion can only ADD to NW each month, so the FI date is no later.
    expect(liquidPlusEquity.kind).toBe('reached');
    expect(liquidOnly.kind).toBe('reached');
    if (liquidPlusEquity.kind === 'reached' && liquidOnly.kind === 'reached') {
      expect(liquidPlusEquity.month).toBeLessThanOrEqual(liquidOnly.month);
      // And with a $600k home of mostly-equity, it is STRICTLY earlier here (a real difference,
      // not a vacuous equality) — the fairness fulcrum visibly bites.
      expect(liquidPlusEquity.month).toBeLessThan(liquidOnly.month);
    }
  });

  test('determinism: same inputs => same outcome (no Date.now / Math.random)', () => {
    const opts = {
      seedDollars: '50000',
      target: Money.of('1000000'),
      contributionFor: () => new Dec('2000'),
      factor: monthlyGrowthFactor('0.05'),
      maxHorizonMonths: MAX_HORIZON_MONTHS,
    };
    const a = projectFiDate(opts);
    const b = projectFiDate(opts);
    expect(a).toEqual(b);
  });
});
