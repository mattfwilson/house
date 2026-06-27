// bucket — the budget overlay via Money.toCents() bigint compare (Vitest, types stripped).
//
// The SECOND, SEPARATE scoring channel (TOWN-02, D-12): a town's median price is bucketed against the
// user's budget into realistic / stretch / fantasy. This is INDEPENDENT of the composite (D-12
// two-channel separation — bucket never reads the score). Comparison is EXACT integer cents via
// `Money.toCents()` bigint — no `Number()`, no float epsilon (Pitfall 6), so the boundary cents are
// unambiguous. Lower boundaries are INCLUSIVE (≤). stretchFactor '1.25' throughout.
import { describe, test, expect } from 'vitest';
import { Money } from '../money/money.js';
import { bucketOf } from './bucket.js';

describe('bucketOf — exact integer-cent budget overlay (TOWN-02, D-12)', () => {
  test('price exactly AT budget is realistic (inclusive ≤)', () => {
    expect(bucketOf(Money.of('500000'), Money.of('500000'), '1.25')).toBe('realistic');
  });

  test('price exactly at budget×1.25 is stretch (inclusive ≤)', () => {
    expect(bucketOf(Money.of('625000'), Money.of('500000'), '1.25')).toBe('stretch');
  });

  test('one cent above the stretch ceiling is fantasy', () => {
    expect(bucketOf(Money.of('625000.01'), Money.of('500000'), '1.25')).toBe('fantasy');
  });

  test('a price BELOW budget is realistic', () => {
    expect(bucketOf(Money.of('400000'), Money.of('500000'), '1.25')).toBe('realistic');
  });

  test('a price BETWEEN budget and the stretch ceiling is stretch', () => {
    expect(bucketOf(Money.of('600000'), Money.of('500000'), '1.25')).toBe('stretch');
  });

  test('one cent above budget (still under the stretch ceiling) is stretch', () => {
    expect(bucketOf(Money.of('500000.01'), Money.of('500000'), '1.25')).toBe('stretch');
  });

  test('exactness at a FRACTIONAL stretch ceiling holds (integer cents, no float epsilon)', () => {
    // budget 100000 × 1.155 = 115500.00 → 11550000 cents exactly.
    expect(bucketOf(Money.of('115500'), Money.of('100000'), '1.155')).toBe('stretch'); // == ceiling
    expect(bucketOf(Money.of('115500.01'), Money.of('100000'), '1.155')).toBe('fantasy'); // one cent above
  });
});
