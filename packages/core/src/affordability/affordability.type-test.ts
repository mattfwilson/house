// TYPE-LEVEL regression guard for the AFFORDABILITY result shapes (CORE-02), mirroring
// tco.type-test.ts. It covers every dollar field across ALL FOUR affordability result types:
//   - BankAffordabilityResult   (bankMaxPrice, bankMaxLoan)
//   - TrueAffordabilityResult   (trueMaxPrice, savingsRateCeiling, cashOnHandCeiling)
//   - AffordabilityGapResult    (bankMaxPrice, trueMaxPrice, signedGap)
//   - EvaluateScenarioResult    (no dollar fields — its money is reported as decimal strings;
//                                covered for completeness via the ratio/headroom string guard)
//
// This file is NOT a *.test.ts (so it is NOT excluded from `tsc -b` and NOT picked up by Vitest).
// It is part of the type-check graph: each `@ts-expect-error` ASSERTS that a misuse is a compile
// error. If any affordability result ever grows a bare-number dollar field — or a `Money` field
// becomes assignable from/to a `number` — these suppressions become UNUSED and `tsc -b` FAILS
// (TS2578), turning "no bare-number dollars on any affordability result" into a build-time
// guarantee, not a hope.
import type { BankAffordabilityResult } from './bank-affordability.js';
import type { TrueAffordabilityResult } from './true-affordability.js';
import type { AffordabilityGapResult } from './gap.js';
import type { EvaluateScenarioResult } from './evaluate-scenario.js';
import { Money } from '../money/money.js';

// Typed handles to each result WITHOUT running anything (the guards are purely type-level).
declare const bank: BankAffordabilityResult;
declare const tru: TrueAffordabilityResult;
declare const gap: AffordabilityGapResult;
declare const evaluate: EvaluateScenarioResult;

// ── (1) Every dollar field is a `Money`, NOT a bare number — a `Money` is not assignable to
//        `number` (no number-valued valueOf), so reading one INTO a number errors. ──

// BankAffordabilityResult
// @ts-expect-error -- bankMaxPrice is a Money, not a number (no bare-number dollar leak).
const _bankMaxPriceNum: number = bank.bankMaxPrice;
void _bankMaxPriceNum;
// @ts-expect-error -- bankMaxLoan is a Money, not a number.
const _bankMaxLoanNum: number = bank.bankMaxLoan;
void _bankMaxLoanNum;

// TrueAffordabilityResult
// @ts-expect-error -- trueMaxPrice is a Money, not a number.
const _trueMaxPriceNum: number = tru.trueMaxPrice;
void _trueMaxPriceNum;
// @ts-expect-error -- savingsRateCeiling is a Money, not a number.
const _savingsCeilNum: number = tru.savingsRateCeiling;
void _savingsCeilNum;
// @ts-expect-error -- cashOnHandCeiling is a Money, not a number.
const _cashCeilNum: number = tru.cashOnHandCeiling;
void _cashCeilNum;

// AffordabilityGapResult
// @ts-expect-error -- gap.bankMaxPrice is a Money, not a number.
const _gapBankNum: number = gap.bankMaxPrice;
void _gapBankNum;
// @ts-expect-error -- gap.trueMaxPrice is a Money, not a number.
const _gapTrueNum: number = gap.trueMaxPrice;
void _gapTrueNum;
// @ts-expect-error -- signedGap is a Money, not a number.
const _signedGapNum: number = gap.signedGap;
void _signedGapNum;

// ── (2) There is NO bare-number dollar entry point: a dollar field cannot be SET from a bare
//        number (the field is a branded Money). ──

const _badBank: Pick<BankAffordabilityResult, 'bankMaxPrice' | 'bankMaxLoan'> = {
  // @ts-expect-error -- cannot set bankMaxPrice from a bare number (the field is a branded Money).
  bankMaxPrice: 5,
  // @ts-expect-error -- cannot set bankMaxLoan from a bare number (the field is a branded Money).
  bankMaxLoan: 10,
};
void _badBank;
// @ts-expect-error -- cannot build a TrueAffordabilityResult dollar field from a bare number.
const _badTrue: Pick<TrueAffordabilityResult, 'trueMaxPrice'> = { trueMaxPrice: 5 };
void _badTrue;
// @ts-expect-error -- cannot build the gap signedGap from a bare number.
const _badGap: Pick<AffordabilityGapResult, 'signedGap'> = { signedGap: 5 };
void _badGap;

// ── (3) A plain object is not assignable where a `Money` is expected (the brand blocks structural
//        typing — duck-typing a Money into a result is rejected). ──
// @ts-expect-error -- branded nominal Money; a plain object is not a Money.
const _fakeMoney: Money = { v: 1 } as { v: unknown };
void _fakeMoney;

// ── (4) The EvaluateScenarioResult reports its money as decimal STRINGS (ratios/impact/headroom),
//        never bare numbers — assigning a ratio string to a number must error. ──
// @ts-expect-error -- frontEndRatio is a decimal STRING, not a number.
const _frontRatioNum: number = evaluate.frontEndRatio;
void _frontRatioNum;
// @ts-expect-error -- savingsRateImpact is a decimal STRING, not a number.
const _savingsImpactNum: number = evaluate.savingsRateImpact;
void _savingsImpactNum;
// @ts-expect-error -- headroom is a decimal STRING, not a number.
const _headroomNum: number = evaluate.headroom;
void _headroomNum;
