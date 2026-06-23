// canonicalJson — deterministic, float-free, order-independent serialization (D-10).
//
// Runtime behavior is asserted here (Vitest). The contract the golden harness depends on:
//   - a Money serializes to its decimal STRING (toDecimalString), never a JS number;
//   - object keys are sorted recursively, so two equivalent objects with differently
//     ordered keys produce byte-identical output;
//   - identical inputs always produce byte-identical output (determinism).
import { describe, test, expect } from 'vitest';
import { canonicalJson } from './canonical-json.js';
import { Money } from '../money/money.js';

describe('canonicalJson serializes Money as a decimal string (no float leak)', () => {
  test('a bare Money becomes its decimal string, not a number', () => {
    expect(canonicalJson(Money.of('105.58275'))).toBe('"105.58275"');
  });

  test('a Money nested in an object is its decimal string', () => {
    const out = canonicalJson({ total: Money.of('1000.50') });
    expect(out).toBe('{"total":"1000.5"}');
    // Hard guarantee: no JS-number form of the value leaks in.
    expect(out).not.toContain('1000.5,');
    expect(out).not.toMatch(/:\s*1000\.5[^"]/);
  });

  test('full-precision Money values keep all digits as a string', () => {
    const out = canonicalJson({ grown: Money.of('1.23456789012345678901') });
    expect(out).toBe('{"grown":"1.23456789012345678901"}');
  });
});

describe('canonicalJson sorts object keys recursively (order-independence)', () => {
  test('two differently-ordered equivalent objects produce identical output', () => {
    const a = { b: 1, a: 2, c: { z: 9, a: 8 } };
    const b = { c: { a: 8, z: 9 }, a: 2, b: 1 };
    expect(canonicalJson(a)).toBe(canonicalJson(b));
  });

  test('keys come out in sorted order', () => {
    expect(canonicalJson({ b: 1, a: 2 })).toBe('{"a":2,"b":1}');
  });

  test('nested objects are sorted at every depth', () => {
    expect(canonicalJson({ outer: { y: 1, x: 2 }, a: 0 })).toBe(
      '{"a":0,"outer":{"x":2,"y":1}}',
    );
  });

  test('arrays preserve element order but sort keys within elements', () => {
    expect(canonicalJson([{ b: 1, a: 2 }, { d: 3, c: 4 }])).toBe(
      '[{"a":2,"b":1},{"c":4,"d":3}]',
    );
  });
});

describe('canonicalJson is deterministic', () => {
  test('identical inputs produce byte-identical output across repeated calls', () => {
    const value = { total: Money.of('42.42'), label: 'x', nested: { a: 1, b: 2 } };
    expect(canonicalJson(value)).toBe(canonicalJson(value));
  });
});
