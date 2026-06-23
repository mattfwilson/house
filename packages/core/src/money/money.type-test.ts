// TYPE-LEVEL regression guard for Money's closed API (CORE-02).
//
// This file is NOT a *.test.ts (so it is NOT excluded from `tsc -b` and NOT picked
// up by Vitest). It is part of the type-check graph: each `@ts-expect-error` ASSERTS
// that a misuse is a compile error. If Money ever gains a number-accepting dollar
// entry point or a number-returning valueOf/toJSON, these suppressions become UNUSED
// and `tsc -b` FAILS (TS2578) — turning "bare-number math is impossible" into a
// build-time guarantee, not a hope.
//
// Mirrors the established `_lint-fixtures/dom-global.fixture.ts` regression pattern.
import { Money } from './money.js';

const m = Money.of('10');

// (1) add/sub take a Money, never a bare number.
// @ts-expect-error -- bare number is not a Money (CORE-02: no bare-number dollar math).
m.add(5);
// @ts-expect-error -- bare number is not a Money.
m.sub(5);

// (2) mul/percentOf take a rate STRING, never a number and never a Money.
// @ts-expect-error -- rate must be a string, not a number.
m.mul(1.05);
// @ts-expect-error -- rate must be a string, not a Money.
m.percentOf(m);

// (3) There is no public/number-accepting constructor.
// @ts-expect-error -- Money's constructor is private; cannot `new Money(...)`.
new Money('10');
// @ts-expect-error -- there is no number-accepting dollar factory.
Money.of(10);

// (4) Money instances do not participate in JS arithmetic as numbers.
//     `m * 1.05` requires Money to have a number-valued valueOf — it must not.
// @ts-expect-error -- Money is not a number; arithmetic operators are disallowed.
const _bad = m * 1.05;
void _bad;

// (5) A plain object is not assignable to Money (the brand blocks structural typing).
// @ts-expect-error -- branded nominal type; duck-typing a Money is rejected.
const _fake: Money = {} as { v: unknown };
void _fake;
