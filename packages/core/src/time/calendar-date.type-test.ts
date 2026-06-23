// TYPE-LEVEL regression guard for the CalendarDate brand (D-13).
//
// NOT a *.test.ts (so it stays in the `tsc -b` graph and out of Vitest). Each
// `@ts-expect-error` ASSERTS that a misuse is a compile error; if the brand is ever
// weakened (e.g. CalendarDate becomes a plain `string`), the suppression goes UNUSED
// and `tsc -b` FAILS (TS2578).
import { calendarDate, type CalendarDate } from './calendar-date.js';

// A validated value IS a CalendarDate.
const ok: CalendarDate = calendarDate('2026-06-23');
void ok;

// A plain string is NOT assignable to CalendarDate without going through calendarDate().
// @ts-expect-error -- branded type: a bare string is not a CalendarDate (D-13).
const bad: CalendarDate = '2026-06-23';
void bad;

// And a CalendarDate is still usable wherever a string is wanted (it widens to string).
const widened: string = calendarDate('2026-06-23');
void widened;
