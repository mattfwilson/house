// CalendarDate — a branded YYYY-MM-DD string the core never converts to a JS Date (D-13).
//
// Runtime validation is asserted here; the brand's non-assignability (a plain string is
// NOT a CalendarDate without going through calendarDate()) is proven at the type level in
// `calendar-date.type-test.ts`, which is part of the `tsc -b` graph.
import { describe, test, expect } from 'vitest';
import { calendarDate, type CalendarDate } from './calendar-date.js';

describe('calendarDate parses valid ISO YYYY-MM-DD', () => {
  test('returns the same string value (pure string op, no Date object)', () => {
    const d: CalendarDate = calendarDate('2026-06-23');
    expect(d).toBe('2026-06-23');
    expect(typeof d).toBe('string');
  });

  test('accepts boundary days/months', () => {
    expect(calendarDate('2000-01-01')).toBe('2000-01-01');
    expect(calendarDate('1999-12-31')).toBe('1999-12-31');
    expect(calendarDate('2024-02-29')).toBe('2024-02-29'); // regex permits 29; calendar-leap not validated
  });
});

describe('calendarDate rejects malformed input', () => {
  test('throws on an invalid month', () => {
    expect(() => calendarDate('2026-13-01')).toThrow(/Invalid CalendarDate/);
  });

  test('throws on an invalid day', () => {
    expect(() => calendarDate('2026-06-32')).toThrow(/Invalid CalendarDate/);
    expect(() => calendarDate('2026-06-00')).toThrow(/Invalid CalendarDate/);
  });

  test('throws on non-zero-padded fields', () => {
    expect(() => calendarDate('2026-6-3')).toThrow(/Invalid CalendarDate/);
  });

  test('throws on non-date strings', () => {
    expect(() => calendarDate('not-a-date')).toThrow(/Invalid CalendarDate/);
    expect(() => calendarDate('')).toThrow(/Invalid CalendarDate/);
    expect(() => calendarDate('2026/06/23')).toThrow(/Invalid CalendarDate/);
    expect(() => calendarDate('2026-06-23T00:00:00Z')).toThrow(/Invalid CalendarDate/);
  });
});
