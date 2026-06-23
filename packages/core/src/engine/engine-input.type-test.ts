// TYPE-LEVEL regression guard for EngineInput (D-11 / D-13).
//
// NOT a *.test.ts (so it stays in the `tsc -b` graph and out of Vitest, which strips types
// and ignores @ts-expect-error). Each `@ts-expect-error` ASSERTS a misuse is a compile
// error; if EngineInput's asOf brand or readonly-ness ever weakens, the suppression goes
// UNUSED and `tsc -b` FAILS (TS2578). Mirrors money.type-test.ts / calendar-date.type-test.ts.
import { calendarDate } from '../time/calendar-date.js';
import { DEFAULT_ASSUMPTIONS } from '../assumptions/defaults.js';
import { engineInput, type EngineInput } from './engine-input.js';

const input: EngineInput = engineInput({
  asOf: calendarDate('2026-06-23'),
  assumptions: DEFAULT_ASSUMPTIONS,
  scenario: { label: 'canary' },
});

// (1) asOf is a CalendarDate — a plain string is NOT assignable.
const _badAsOf: EngineInput = engineInput({
  // @ts-expect-error -- asOf must be a CalendarDate, never a bare string (D-13).
  asOf: '2026-06-23',
  assumptions: DEFAULT_ASSUMPTIONS,
  scenario: { label: 'canary' },
});
void _badAsOf;

// (2) EngineInput is readonly — its fields cannot be reassigned (D-11 immutability).
// @ts-expect-error -- asOf is readonly.
input.asOf = calendarDate('2030-01-01');
// @ts-expect-error -- assumptions is readonly.
input.assumptions = DEFAULT_ASSUMPTIONS;

// (3) A validated EngineInput exposes the threaded fields.
const okAsOf: string = input.asOf; // CalendarDate widens to string
void okAsOf;
const okVersion: number = input.assumptions.schemaVersion;
void okVersion;
