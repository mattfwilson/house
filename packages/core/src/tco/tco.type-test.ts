// TYPE-LEVEL regression guard for the TcoBreakdown result shape (T-04-11, mirrors
// money.type-test.ts).
//
// This file is NOT a *.test.ts (so it is NOT excluded from `tsc -b` and NOT picked up by
// Vitest). It is part of the type-check graph: each `@ts-expect-error` ASSERTS that a misuse
// is a compile error. If the TCO result ever grows a bare-number dollar field (or a `TcoLine`
// money becomes assignable from/to a `number`), these suppressions become UNUSED and `tsc -b`
// FAILS (TS2578) — turning "every dollar field on the TCO result is a Money, never a bare
// number" into a build-time guarantee, not a hope.
//
// Mirrors the established Money closed-API guard (money.type-test.ts).
import type { TcoBreakdown, TcoLine } from './tco.js';
import { computeTco } from './tco.js';
import type { EngineInput } from '../engine/engine-input.js';
import { Money } from '../money/money.js';

// A typed handle to a breakdown WITHOUT running it (the guards are purely type-level). Cast an
// empty object through `unknown` so we get a `TcoBreakdown`-typed binding to probe.
declare const breakdown: TcoBreakdown;
declare const line: TcoLine;

// computeTco's signature consumes an EngineInput and returns a TcoBreakdown — pin the shape so
// a drift in either end is caught here too.
declare const input: EngineInput;
const _result: TcoBreakdown = computeTco(input);
void _result;

// (1) A TcoLine's `monthly`/`annualized` are `Money`, NOT bare numbers — a `Money` is not
//     assignable to `number` (no number-valued valueOf), so reading one INTO a number errors.
// @ts-expect-error -- a TcoLine money is a Money, not a number (no bare-number dollar leak).
const _monthlyNum: number = line.monthly;
void _monthlyNum;
// @ts-expect-error -- a TcoLine money is a Money, not a number.
const _annualNum: number = breakdown.principalAndInterest.annualized;
void _annualNum;

// (2) There is NO bare-number dollar entry point on the result: a line money cannot be SET
//     from a bare number (the field is a branded Money).
// @ts-expect-error -- cannot assign a bare number where a Money is expected.
const _badLine: TcoLine = { monthly: 5, annualized: 10 };
void _badLine;

// (3) A plain object is not assignable where a `TcoLine` Money is expected (the Money brand
//     blocks structural typing — duck-typing a Money into the breakdown is rejected).
// @ts-expect-error -- branded nominal Money; a plain object is not a Money.
const _fakeMoney: Money = { v: 1 } as { v: unknown };
void _fakeMoney;

// (4) The captured mill rate is a STRING (decStr) and the FY a number — assigning the rate to
//     a number must error (it is a canonical decimal string, never a bare float).
// @ts-expect-error -- resolvedMillRate is a decimal STRING, not a number.
const _rateNum: number = breakdown.resolvedMillRate;
void _rateNum;
