// EngineInput — the immutable snapshot-unit type (D-11).
//
// Runtime behavior (Vitest, types stripped — the CalendarDate type constraint is proven
// separately in engine-input.type-test.ts, which is in the `tsc -b` graph). Here we assert
// that the factory freezes the object and that asOf is threaded explicitly, never derived
// from Date.now (the determinism guard would throw if it tried).
import { describe, test, expect } from 'vitest';
import { calendarDate } from '../time/calendar-date.js';
import { DEFAULT_ASSUMPTIONS } from '../assumptions/defaults.js';
import { engineInput } from './engine-input.js';

const baseParts = () => ({
  asOf: calendarDate('2026-06-23'),
  assumptions: DEFAULT_ASSUMPTIONS,
  scenario: { label: 'canary' },
});

describe('engineInput factory — the immutable snapshot unit (D-11)', () => {
  test('assembles an object with asOf + assumptions + scenario', () => {
    const input = engineInput(baseParts());
    expect(input.asOf).toBe('2026-06-23');
    expect(input.assumptions.schemaVersion).toBe(2);
    expect(input.scenario.label).toBe('canary');
  });

  test('returns a frozen object (immutable)', () => {
    const input = engineInput(baseParts());
    expect(Object.isFrozen(input)).toBe(true);
  });

  test('mutation attempts do not change the object', () => {
    const input = engineInput(baseParts());
    expect(() => {
      // @ts-expect-error -- readonly at compile time; this proves frozen at runtime too.
      input.asOf = calendarDate('2030-01-01');
    }).toThrow();
    expect(input.asOf).toBe('2026-06-23');
  });

  test('asOf is threaded explicitly — never derived from Date.now', () => {
    // The determinism guard makes Date.now throw inside core tests; engineInput must not
    // call it. We assert the asOf is exactly the value we passed in (no clock involved).
    const input = engineInput({ ...baseParts(), asOf: calendarDate('1999-12-31') });
    expect(input.asOf).toBe('1999-12-31');
  });

  test('the assembled object deep-equals its own re-serialization shape (snapshot unit)', () => {
    const input = engineInput(baseParts());
    const roundTripped = JSON.parse(JSON.stringify(input));
    expect(roundTripped).toStrictEqual({
      asOf: '2026-06-23',
      assumptions: DEFAULT_ASSUMPTIONS,
      scenario: { label: 'canary' },
    });
  });
});
