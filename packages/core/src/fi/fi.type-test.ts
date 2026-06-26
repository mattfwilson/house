// TYPE-LEVEL regression guard for the FI result shapes (CORE-02), mirroring
// affordability.type-test.ts / tco.type-test.ts. It covers every dollar / decimal-string /
// discriminant field across ALL FI result types:
//   - FiTargets       (renterTarget, ownerTarget, renterHousingAnnual, ownerHousingAnnual) — Money
//   - FiImpactResult  (targets: FiTargets dollars; fiDeltaYears decimal-string; baseline/buy: FiOutcome)
//   - CompareRow      (fiDeltaYears decimal-string; outcome: FiOutcome — never a bare number)
//   - TornadoRow      (low/base/high: FiOutcome — the FI date is a discriminated outcome, no sentinel)
//   - FiOutcome       (the `kind`-discriminated union: `years` is a decimal STRING; a bare number is
//                      NOT assignable where a FiOutcome is expected — the no-`-1`-sentinel guarantee)
//
// This file is NOT a *.test.ts (so it is NOT excluded from `tsc -b` and NOT picked up by Vitest). It
// is part of the type-check graph: each `@ts-expect-error` ASSERTS that a misuse is a compile error.
// If any FI result ever grows a bare-number dollar field — or a `Money` field becomes assignable
// from/to a `number`, or the FI date regresses to a numeric sentinel — these suppressions become
// UNUSED and `tsc -b` FAILS (TS2578), turning "no bare-number dollars + no sentinel FI date on any FI
// result" into a build-time guarantee, not a hope.
import type { FiTargets } from './fi-target.js';
import type { FiImpactResult } from './fi-impact.js';
import type { CompareRow } from './compare.js';
import type { TornadoRow } from './sensitivity.js';
import type { FiOutcome } from './projection.js';
import { Money } from '../money/money.js';

// Typed handles to each result WITHOUT running anything (the guards are purely type-level).
declare const targets: FiTargets;
declare const impact: FiImpactResult;
declare const row: CompareRow;
declare const tornadoRow: TornadoRow;
declare const outcome: FiOutcome;

// ── (1) Every dollar field is a `Money`, NOT a bare number — a `Money` is not assignable to
//        `number` (no number-valued valueOf), so reading one INTO a number errors. ──

// FiTargets (the four surfaced D-02 dollar fields)
// @ts-expect-error -- renterTarget is a Money, not a number (no bare-number dollar leak).
const _renterTargetNum: number = targets.renterTarget;
void _renterTargetNum;
// @ts-expect-error -- ownerTarget is a Money, not a number.
const _ownerTargetNum: number = targets.ownerTarget;
void _ownerTargetNum;
// @ts-expect-error -- renterHousingAnnual is a Money, not a number.
const _renterHousingNum: number = targets.renterHousingAnnual;
void _renterHousingNum;
// @ts-expect-error -- ownerHousingAnnual is a Money, not a number.
const _ownerHousingNum: number = targets.ownerHousingAnnual;
void _ownerHousingNum;

// FiImpactResult.targets (the same dollars, reached through the headline result)
// @ts-expect-error -- impact.targets.ownerTarget is a Money, not a number.
const _impactOwnerNum: number = impact.targets.ownerTarget;
void _impactOwnerNum;

// ── (2) There is NO bare-number dollar entry point: a dollar field cannot be SET from a bare
//        number (the field is a branded Money). ──
const _badTargets: Pick<FiTargets, 'renterTarget' | 'ownerTarget'> = {
  // @ts-expect-error -- cannot set renterTarget from a bare number (the field is a branded Money).
  renterTarget: 5,
  // @ts-expect-error -- cannot set ownerTarget from a bare number (the field is a branded Money).
  ownerTarget: 10,
};
void _badTargets;
// @ts-expect-error -- cannot build a FiTargets housing field from a bare number.
const _badHousing: Pick<FiTargets, 'ownerHousingAnnual'> = { ownerHousingAnnual: 5 };
void _badHousing;

// ── (3) A plain object is not assignable where a `Money` is expected (the brand blocks structural
//        typing — duck-typing a Money into a result is rejected). ──
// @ts-expect-error -- branded nominal Money; a plain object is not a Money.
const _fakeMoney: Money = { v: 1 } as { v: unknown };
void _fakeMoney;

// ── (4) Decimal-STRING fields (the years deltas / FiOutcome.years) assigned to `number` must error
//        — they are canonical decimal strings (months/12 in Dec), never bare floats. ──
// @ts-expect-error -- fiDeltaYears is a decimal STRING (or null), not a number.
const _impactDeltaYearsNum: number = impact.fiDeltaYears;
void _impactDeltaYearsNum;
// @ts-expect-error -- CompareRow.fiDeltaYears is a decimal STRING (or null), not a number.
const _rowDeltaYearsNum: number = row.fiDeltaYears;
void _rowDeltaYearsNum;

// ── (5) The FiOutcome discriminant is `kind`-based — NOT a numeric sentinel. A bare `number` (e.g. a
//        `-1` "not reached" sentinel) is NOT assignable where a `FiOutcome` is expected, and the FI
//        outcomes on every result are the discriminated union, never a bare month number. ──
// @ts-expect-error -- a FiOutcome is a discriminated union, not a bare number (no -1 sentinel date).
const _outcomeFromNumber: FiOutcome = -1;
void _outcomeFromNumber;
// @ts-expect-error -- the buy FI outcome is a FiOutcome, not a bare number.
const _impactBuyNum: number = impact.buy;
void _impactBuyNum;
// @ts-expect-error -- a CompareRow.outcome is a FiOutcome, not a bare number.
const _rowOutcomeNum: number = row.outcome;
void _rowOutcomeNum;
// @ts-expect-error -- a TornadoRow.base is a FiOutcome, not a bare number.
const _tornadoBaseNum: number = tornadoRow.base;
void _tornadoBaseNum;

// FiOutcome.years is a decimal STRING on the `reached` arm — narrow then assert it is NOT a number.
if (outcome.kind === 'reached') {
  // @ts-expect-error -- FiOutcome.years is a decimal STRING (month/12 in Dec), not a number.
  const _yearsNum: number = outcome.years;
  void _yearsNum;
}
