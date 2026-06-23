// CalendarDate — a branded ISO `YYYY-MM-DD` string (D-13).
//
// The core NEVER constructs a JS `Date`: `new Date(isoString)` introduces timezone /
// locale parsing nondeterminism (and the lint rule bans `new Date` in core anyway).
// `asOf` and every date in the engine is a pure, validated string. The brand (a
// unique symbol) makes it non-interchangeable with a plain string — you must go
// through `calendarDate()` to obtain one.
declare const CalDateBrand: unique symbol;

export type CalendarDate = string & { readonly [CalDateBrand]: never };

// YYYY-MM-DD with valid month (01-12) and day (01-31) RANGES. Note: this is a shape/range
// check, not a full calendar validation — e.g. it permits 2026-02-30. Real calendar-day
// validation is intentionally out of scope here (no JS Date allowed); downstream code that
// needs day-of-month correctness can layer it on without reintroducing Date into the core.
const ISO_DATE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

/** Validate a string as a CalendarDate; throws on any non-`YYYY-MM-DD` input. */
export function calendarDate(s: string): CalendarDate {
  if (!ISO_DATE.test(s)) {
    throw new Error(`Invalid CalendarDate: ${JSON.stringify(s)} (expected YYYY-MM-DD)`);
  }
  return s as CalendarDate; // pure string downstream — no Date object EVER (D-13).
}
