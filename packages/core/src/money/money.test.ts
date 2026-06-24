// Money: immutable, decimal-precise, banker's-rounding-at-the-boundary (CORE-02).
//
// Runtime behavior is asserted here (Vitest, esbuild — types stripped, so
// `@ts-expect-error` is NOT load-bearing in this file). The type-level rejection of
// bare-number dollar math is proven in `money.type-test.ts`, which is part of the
// `tsc -b` graph (see that file).
import { describe, test, expect } from 'vitest';
import { Money } from './money.js';

describe('Money construction', () => {
  test('Money.of parses a decimal string', () => {
    expect(Money.of('0.035').toDecimalString()).toBe('0.035');
  });

  test('Money.zero is 0', () => {
    expect(Money.zero().toDecimalString()).toBe('0');
    expect(Money.zero().toCents()).toBe(0n);
  });

  test('Money.of preserves full precision (no float corruption)', () => {
    // 0.1 + 0.2 would be 0.30000000000000004 as a float; via strings it is exact.
    const sum = Money.of('0.1').add(Money.of('0.2'));
    expect(sum.toDecimalString()).toBe('0.3');
  });
});

describe('Money.of rejects non-canonical / non-finite input (CR-01, CORE-02)', () => {
  // decimal.js would otherwise silently accept these — re-opening the float/non-finite hole
  // the whole API exists to seal. Validation happens at the constructor boundary, the same
  // canonical rule the serialization boundary (decStr) enforces.
  test.each([
    'Infinity',
    '-Infinity',
    'NaN',
    '1e3', // exponent form is rejected everywhere else; reject it here too
    '1E3',
    '', // empty
    ' 1', // leading whitespace
    '1 ', // trailing whitespace
    '1,000', // thousands separator
    '0x10', // hex
    '--1',
    '1.', // dangling decimal point
    '.5', // missing integer part
    'abc',
    '+1', // explicit plus sign not canonical
  ])('Money.of(%j) throws a meaningful invalid-Money error', (bad) => {
    expect(() => Money.of(bad)).toThrow(/Invalid Money string/);
  });

  test('the thrown error includes the offending value', () => {
    expect(() => Money.of('Infinity')).toThrow(/"Infinity"/);
  });

  test('valid canonical strings still construct', () => {
    expect(Money.of('1234.56').toDecimalString()).toBe('1234.56');
    expect(Money.of('-0.001').toDecimalString()).toBe('-0.001');
    expect(Money.of('0').toDecimalString()).toBe('0');
  });
});

describe('Money.mul rejects non-canonical / non-finite rate input (CR-01)', () => {
  test.each(['Infinity', 'NaN', '1e3', '', 'abc', '1.05x'])(
    'mul(%j) throws a meaningful invalid-rate error',
    (bad) => {
      expect(() => Money.of('100').mul(bad)).toThrow(/Invalid rate string/);
    },
  );

  test('valid rate still multiplies', () => {
    expect(Money.of('100').mul('1.05').toDecimalString()).toBe('105');
  });
});

describe('Money arithmetic is immutable and full-precision', () => {
  test('add returns a new Money, leaving operands unchanged', () => {
    const a = Money.of('10.00');
    const b = Money.of('5.25');
    const c = a.add(b);
    expect(c.toDecimalString()).toBe('15.25');
    // operands untouched
    expect(a.toDecimalString()).toBe('10');
    expect(b.toDecimalString()).toBe('5.25');
    expect(c).not.toBe(a);
  });

  test('sub returns a new Money', () => {
    expect(Money.of('10').sub(Money.of('2.50')).toDecimalString()).toBe('7.5');
  });

  test('mul by a dimensionless rate string retains full precision (no per-op rounding)', () => {
    // 100.555 * 1.05 = 105.58275 — kept in full, NOT rounded to cents mid-math (D-03).
    expect(Money.of('100.555').mul('1.05').toDecimalString()).toBe('105.58275');
  });

  test('percentOf is multiplication by a rate string', () => {
    expect(Money.of('200').percentOf('0.035').toDecimalString()).toBe('7');
  });
});

describe('toCents rounds at the boundary using banker’s rounding (HALF_EVEN, D-02)', () => {
  test('rounds half to even: 2.005 -> 200 (down to even)', () => {
    expect(Money.of('2.005').toCents()).toBe(200n);
  });

  test('rounds half to even: 2.015 -> 202 (up to even)', () => {
    expect(Money.of('2.015').toCents()).toBe(202n);
  });

  test('rounds half to even: 2.025 -> 202 (down to even)', () => {
    expect(Money.of('2.025').toCents()).toBe(202n);
  });

  test('non-half values round normally', () => {
    expect(Money.of('2.014').toCents()).toBe(201n);
    expect(Money.of('2.016').toCents()).toBe(202n);
  });

  test('negative values round half-to-even toward even cent', () => {
    expect(Money.of('-2.005').toCents()).toBe(-200n);
    expect(Money.of('-2.015').toCents()).toBe(-202n);
  });
});

describe('round-at-boundary-only invariant (D-03 + D-04 HALF_EVEN avoids HALF_UP drift)', () => {
  test('summing 1000 values via Money then toCents == full-precision sum rounded once', () => {
    // Each value is 0.005 (a perfect half-cent). Summed at full precision: 1000 * 0.005 = 5.00.
    // 5.00 in cents is exactly 500 — proving no per-op rounding happened (had we rounded each
    // 0.005 to a cent per-op, HALF_UP would give 1000 cents = $10.00, HALF_EVEN 0 cents = $0).
    let acc = Money.zero();
    for (let i = 0; i < 1000; i++) acc = acc.add(Money.of('0.005'));
    expect(acc.toDecimalString()).toBe('5');
    expect(acc.toCents()).toBe(500n);
  });

  test('mixed values: boundary rounding once equals full-precision sum rounded once', () => {
    const values = ['1.005', '2.005', '3.005', '4.005']; // full-precision sum = 10.02 -> 1002 cents
    let acc = Money.zero();
    for (const v of values) acc = acc.add(Money.of(v));
    expect(acc.toDecimalString()).toBe('10.02');
    expect(acc.toCents()).toBe(1002n);
  });
});

describe('Money output formatting', () => {
  test('toDecimalString preserves full precision', () => {
    expect(Money.of('105.58275').toDecimalString()).toBe('105.58275');
  });

  test('toString yields a 2dp display string (banker’s rounding)', () => {
    expect(Money.of('105.58275').toString()).toBe('105.58');
    expect(Money.of('2.005').toString()).toBe('2.00');
    expect(Money.of('1').toString()).toBe('1.00');
  });

  test('Money does not expose a number-returning valueOf or toJSON', () => {
    const m = Money.of('5');
    // Closed API: no valueOf/toJSON that re-opens the bare-number hole (CORE-02).
    expect(Object.prototype.hasOwnProperty.call(Money.prototype, 'valueOf')).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(Money.prototype, 'toJSON')).toBe(false);
    // valueOf falls back to Object.prototype.valueOf, which returns the object itself
    // (NOT a number) — so JS arithmetic coercion would yield NaN, never a silent float.
    expect(typeof (m as unknown as { valueOf: () => unknown }).valueOf()).toBe('object');
  });
});
