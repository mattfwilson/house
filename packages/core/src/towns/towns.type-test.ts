// TYPE-LEVEL regression guard for the Town-Scoring result shapes (CORE-02 / T-05-16), mirroring
// fi/fi.type-test.ts. It covers every decimal-string / enum field across the scoreboard result types:
//   - TownScore.composite           — a [0,1] decimal STRING | null, NOT a bare number
//   - MetricContribution.normalizedValue — a decimal STRING | null, NOT a bare number
//   - MetricContribution.weightedContribution — a decimal STRING | null, NOT a bare number
//   - MetricContribution.weight     — the CONFIGURED weight, a decimal STRING, NOT a bare number
//   - TownScore.bucket              — the `Bucket | null` ENUM, NOT a numeric sentinel
//
// This file is NOT a *.test.ts (so it is NOT excluded from `tsc -b` and NOT collected by Vitest). It
// is part of the type-check graph: each `@ts-expect-error` ASSERTS that a misuse is a compile error,
// and the `void _x` discharge means an UNUSED suppression (a guarantee that silently regressed) fails
// `tsc -b` with TS2578 — turning "the composite/normalized/weight fields are decimal strings and the
// bucket is the enum, never a bare number/sentinel" into a build-time guarantee, not a hope.
import type { TownScore, MetricContribution } from './score-towns.js';

// Typed handles WITHOUT running anything (the guards are purely type-level).
declare const score: TownScore;
declare const contribution: MetricContribution;

// ── (1) composite is a decimal STRING | null, NOT a bare number. ──
// @ts-expect-error -- TownScore.composite is a decimal STRING | null, not a number.
const _compositeNum: number = score.composite;
void _compositeNum;

// ── (2) normalizedValue is a decimal STRING | null, NOT a bare number. ──
// @ts-expect-error -- MetricContribution.normalizedValue is a decimal STRING | null, not a number.
const _normalizedNum: number = score.metrics[0]!.normalizedValue!;
void _normalizedNum;

// ── (3) weightedContribution is a decimal STRING | null, NOT a bare number. ──
// @ts-expect-error -- MetricContribution.weightedContribution is a decimal STRING | null, not a number.
const _weightedNum: number = score.metrics[0]!.weightedContribution!;
void _weightedNum;

// ── (4) weight is the CONFIGURED weight — a decimal STRING, NOT a bare number. ──
// @ts-expect-error -- MetricContribution.weight is a decimal STRING, not a number.
const _weightNum: number = contribution.weight;
void _weightNum;

// ── (5) bucket is the `Bucket | null` ENUM, NOT a numeric sentinel (e.g. a `-1` "no data" code). ──
// @ts-expect-error -- TownScore.bucket is the Bucket | null enum, not a numeric sentinel.
const _bucketNum: number = score.bucket;
void _bucketNum;
// @ts-expect-error -- a bare number is not assignable to the Bucket | null enum (no sentinel ingress).
const _bucketFromNum: TownScore['bucket'] = 0;
void _bucketFromNum;
