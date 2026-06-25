// Closing-costs correctness tests (TCO-05, D-11/D-12/D-13).
//
// EXACT-EQUALITY proofs — never `toBeCloseTo`. The closing-cost core's properties:
//   - closingCosts = price × rateOfPrice, unless a per-scenario dollar override is supplied,
//     in which case the override WINS (D-12);
//   - amortizeOverHold divides the lump over the holding horizon → { annual, monthly }, the
//     division done in `Dec` (Money has no div), each result rounded at its Money boundary;
//   - amortized monthly × (holdingYears × 12) reconciles back to the lump within cent rounding
//     (the documented reconciliation — D-11).
// Closing + other one-time costs are a t=0 lump in the net-worth model (Plan 05) regardless of
// this amortization, which is purely for the per-month/per-year breakdown (D-13).
import { describe, test, expect } from 'vitest';
import { Money } from '../money/money.js';
import { closingCosts, amortizeOverHold } from './closing-costs.js';

describe('closingCosts = price × rateOfPrice, override wins', () => {
  test('$500,000 × 0.025 === $12,500.00 (no override)', () => {
    const c = closingCosts('500000', '0.025', undefined);
    expect(c).toBeInstanceOf(Money);
    expect(c.toCents()).toBe(1250000n); // $12,500.00
  });

  test('override "10000" wins over the %-of-price rate', () => {
    expect(closingCosts('500000', '0.025', '10000').toCents()).toBe(1000000n); // $10,000.00
  });

  test('a different rate yields a proportional bill (no clamp)', () => {
    expect(closingCosts('500000', '0.05').toCents()).toBe(2500000n); // $25,000.00
  });
});

describe('amortizeOverHold spreads the lump over the holding horizon', () => {
  test('$12,000 over 10 years -> annual $1,200.00, monthly $100.00', () => {
    const a = amortizeOverHold(Money.of('12000'), 10);
    expect(a.annual).toBeInstanceOf(Money);
    expect(a.monthly).toBeInstanceOf(Money);
    expect(a.annual.toCents()).toBe(120000n); // $1,200.00
    expect(a.monthly.toCents()).toBe(10000n); // $100.00
  });

  test('annual === monthly × 12 for an even split', () => {
    const a = amortizeOverHold(Money.of('12000'), 10);
    expect(a.annual.toCents()).toBe(a.monthly.toCents() * 12n);
  });

  test('amortized monthly × (holdingYears × 12) reconciles to the lump within cent rounding', () => {
    const lump = Money.of('13337'); // a non-evenly-divisible lump
    const holdingYears = 7;
    const a = amortizeOverHold(lump, holdingYears);
    const reconstructedCents = a.monthly.toCents() * BigInt(holdingYears * 12);
    const lumpCents = lump.toCents();
    // Within one penny per month of rounding drift over the full horizon.
    const driftCents = lumpCents - reconstructedCents;
    const maxDrift = BigInt(holdingYears * 12);
    expect(driftCents <= maxDrift && driftCents >= -maxDrift).toBe(true);
  });
});
