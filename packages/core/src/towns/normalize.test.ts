// normalize — fixed-range scale + direction fold + clamp + zero-width guard (Vitest, types stripped).
//
// The first scoring-math primitive (TOWN-01): scale a raw metric to [0,1] against a FIXED
// reference range (D-09 — NOT min-max over the live set), folding direction so higher=better
// universally, clamped to [0,1] (Pitfall 14), and refusing a degenerate `max<=min` range
// (Pitfall 5 / T-05-09) rather than dividing by zero. Assert EXACT decimal strings (the Dec
// clone's 34-sig-digit HALF_EVEN output), never `toBeCloseTo` — float-free reproducibility is
// the product. Oracle strings were computed once against the real `Dec` clone.
import { describe, test, expect } from 'vitest';
import { normalize, type MetricDirection } from './normalize.js';

describe('normalize — fixed-range, direction-folded, clamped [0,1] scaling (TOWN-01, D-09)', () => {
  test('higherBetter: (raw-min)/(max-min) as the exact Dec toFixed string', () => {
    // (8-1)/(10-1) = 7/9 at 34 sig digits, HALF_EVEN.
    expect(normalize('8', '1', '10', 'higherBetter')).toBe(
      '0.7777777777777777777777777777777778',
    );
  });

  test('lowerBetter: (max-raw)/(max-min) folds direction (== 1 - higherBetter)', () => {
    // (16-6)/(16-4) = 10/12 = 5/6 at 34 sig digits.
    expect(normalize('6', '4', '16', 'lowerBetter')).toBe(
      '0.8333333333333333333333333333333333',
    );
  });

  test('lowerBetter of the MIN value scores 1 (best); of the MAX value scores 0 (worst)', () => {
    expect(normalize('4', '4', '16', 'lowerBetter')).toBe('1');
    expect(normalize('16', '4', '16', 'lowerBetter')).toBe('0');
  });

  test('higherBetter of the MAX value scores 1; of the MIN value scores 0', () => {
    expect(normalize('10', '1', '10', 'higherBetter')).toBe('1');
    expect(normalize('1', '1', '10', 'higherBetter')).toBe('0');
  });

  test('a value BELOW min clamps to 0 (never negative)', () => {
    expect(normalize('0', '1', '10', 'higherBetter')).toBe('0');
    // lowerBetter below min is the best end → clamps to 1.
    expect(normalize('2', '4', '16', 'lowerBetter')).toBe('1');
  });

  test('a value ABOVE max clamps to 1 (never > 1)', () => {
    expect(normalize('11', '1', '10', 'higherBetter')).toBe('1');
    // lowerBetter above max is the worst end → clamps to 0.
    expect(normalize('20', '4', '16', 'lowerBetter')).toBe('0');
  });

  test('a degenerate range (max == min) THROWS (no /0 Infinity/NaN — T-05-09)', () => {
    expect(() => normalize('5', '10', '10', 'higherBetter')).toThrow();
  });

  test('an inverted range (max < min) THROWS', () => {
    expect(() => normalize('5', '10', '5', 'higherBetter')).toThrow();
  });

  test('the return is ALWAYS a string, never a number', () => {
    const direction: MetricDirection = 'higherBetter';
    const out = normalize('5', '1', '10', direction);
    expect(typeof out).toBe('string');
  });
});
