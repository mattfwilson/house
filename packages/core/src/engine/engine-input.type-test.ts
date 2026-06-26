// TYPE-LEVEL regression guard for EngineInput (D-11 / D-13).
//
// NOT a *.test.ts (so it stays in the `tsc -b` graph and out of Vitest, which strips types
// and ignores @ts-expect-error). Each `@ts-expect-error` ASSERTS a misuse is a compile
// error; if EngineInput's asOf brand or readonly-ness ever weakens, the suppression goes
// UNUSED and `tsc -b` FAILS (TS2578). Mirrors money.type-test.ts / calendar-date.type-test.ts.
import { calendarDate } from '../time/calendar-date.js';
import { DEFAULT_ASSUMPTIONS } from '../assumptions/defaults.js';
import {
  engineInput,
  type EngineInput,
  type ScenarioInputs,
  type Household,
} from './engine-input.js';

// A full, valid house scenario (the widened ScenarioInputs contract). Dollars/rates are
// canonical decimal strings; only the counts are bare numbers.
const SCENARIO: ScenarioInputs = {
  label: 'canary',
  price: '750000',
  downPaymentPct: '0.2',
  annualRate: '0.06375',
  termMonths: 360,
  holdingYears: 10,
  town: 'Cambridge',
  insuranceAnnual: '1800',
  hoaMonthly: '0',
  monthlyRent: '3200',
};

const input: EngineInput = engineInput({
  asOf: calendarDate('2026-06-23'),
  assumptions: DEFAULT_ASSUMPTIONS,
  scenario: SCENARIO,
});

// (1) asOf is a CalendarDate — a plain string is NOT assignable.
const _badAsOf: EngineInput = engineInput({
  // @ts-expect-error -- asOf must be a CalendarDate, never a bare string (D-13).
  asOf: '2026-06-23',
  assumptions: DEFAULT_ASSUMPTIONS,
  scenario: SCENARIO,
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

// (4) Household dollar leaves are canonical decimal STRINGS, never bare numbers (CORE-02 /
//     D-06). A bare `number` cannot be assigned where the string field is expected.
declare const h: Household;
// @ts-expect-error -- grossAnnualIncome is a decimal STRING, never a bare number (Pitfall 2).
const _badGross: Household = { ...h, grossAnnualIncome: 200000 };
void _badGross;
// @ts-expect-error -- currentAnnualSavings is a decimal STRING, never a bare number (D-17).
const _badSavings: Household = { ...h, currentAnnualSavings: 60000 };
void _badSavings;
// Reading a household string field INTO a number must error (no bare-number dollar leak).
// @ts-expect-error -- a household dollar leaf is a string, not a number.
const _grossNum: number = h.grossAnnualIncome;
void _grossNum;

// (5) EngineInput.household is OPTIONAL — assigning `undefined` (omitting it) is allowed.
const _noHousehold: EngineInput = engineInput({
  asOf: calendarDate('2026-06-23'),
  assumptions: DEFAULT_ASSUMPTIONS,
  scenario: SCENARIO,
});
void _noHousehold;
const _withHousehold: EngineInput = engineInput({
  asOf: calendarDate('2026-06-23'),
  assumptions: DEFAULT_ASSUMPTIONS,
  scenario: SCENARIO,
  household: h,
});
void _withHousehold;
