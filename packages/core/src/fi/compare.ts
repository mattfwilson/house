// compareScenarios — N-scenario FI-date ranking (FI-04 / FI-06), the side-by-side decision table.
// It composes `fiImpact` over a batch of buy scenarios against ONE keep-renting baseline and ranks
// them so the user reads the table top-to-bottom: best-for-FI first, the honest "don't buy" outcome
// LAST. This is the anti-funnel surface — the tool ranks renting and don't-buy as first-class
// outcomes, never burying them below the buy options (FI-06).
//
// THE LOCKED RANKING (D-08):
//   - row 0 is ALWAYS the keep-renting baseline (`isBaseline: true`, `fiDeltaMonths: 0` by
//     definition — the baseline is the zero point every buy is measured against);
//   - buy rows are ranked by FI-date delay ASCENDING — a buy that BEATS renting (negative delta)
//     sorts ABOVE one that DELAYS FI (positive delta);
//   - every `reached` buy row sorts BEFORE every `unreached` buy row; two `unreached` rows sort by
//     `cappedAtMonth` ascending — so the don't-buy rows sort WORST (FI-06);
//   - ties break STABLY by input order (a secondary index key).
//
// LANDMINE L3 — NO NON-FINITE/SENTINEL SORT KEY EVER MATERIALIZED. `canonicalJson` throws on
// non-finite numbers, so the ranking CANNOT inject a `+∞` sort key for an unreached row. Instead the
// comparator BRANCHES on the `FiOutcome.kind` discriminant: it never produces a non-finite value, and
// an unreached row's `fiDeltaMonths`/`fiDeltaYears` stay `null` (a delta needs two reached dates). The
// grep gate (zero literal non-finite tokens in compare.ts) makes this a CI invariant, not a hope.
//
// Dec/Money discipline: this module does NO new dollar math — it composes `fiImpact` results and
// orders them on the integer `month`/`cappedAtMonth` counts already on each `FiOutcome`. `Dec` is
// not touched here. Determinism (D-13): the sort is stable on the input order; no clock, no random.
import type { EngineInput } from '../engine/engine-input.js';
import { fiImpact } from './fi-impact.js';
import type { FiOutcome } from './projection.js';

/**
 * One ranked row in the comparison table. `outcome` is the path's FI outcome (the baseline carries
 * the renter outcome; a buy row carries its buy outcome). `fiDeltaMonths`/`fiDeltaYears` are `0` on
 * the baseline, the owner−renter delta on a reached buy, and `null` on an unreached buy (a delta
 * needs two reached dates — L3, never a non-finite number). All `readonly`.
 */
export interface CompareRow {
  /** The scenario label (the baseline row's label is the baseline scenario's label). */
  readonly label: string;
  /** The path's FI outcome (discriminated reached/unreached — never a numeric sentinel). */
  readonly outcome: FiOutcome;
  /** `0` (baseline), the owner−renter delay (reached buy), or `null` (unreached buy). */
  readonly fiDeltaMonths: number | null;
  /** The same delta in years as a decimal STRING; `0` (baseline) crosses as "0", `null` otherwise. */
  readonly fiDeltaYears: string | null;
  /** True only for row 0 (the keep-renting baseline — the zero point). */
  readonly isBaseline: boolean;
}

/** The closed ranking result (D-08): the baseline at row 0, ranked buys after, unreached last. */
export interface CompareResult {
  readonly rows: readonly CompareRow[];
}

/**
 * The LOCKED ranking comparator (D-08 / L3). Branches on `FiOutcome.kind` — NEVER materializes a
 * non-finite (`+∞`) sort key:
 *   - both `reached`     → compare `fiDeltaMonths` ascending (a reached buy always has a numeric
 *                          delta; the smaller/more-negative delay sorts first);
 *   - one `reached`, one `unreached` → the `reached` row sorts FIRST;
 *   - both `unreached`   → compare `cappedAtMonth` ascending.
 * Returns 0 on a tie; the stable wrapper (`indexedSort`) preserves input order on a 0.
 */
function compareBuyRows(a: CompareRow, b: CompareRow): number {
  const ak = a.outcome.kind;
  const bk = b.outcome.kind;

  if (ak === 'reached' && bk === 'reached') {
    // Both reached → numeric delta is non-null on both; ascending (negative beats positive).
    return a.fiDeltaMonths! - b.fiDeltaMonths!;
  }
  if (ak === 'reached' && bk === 'unreached') return -1; // reached sorts before unreached.
  if (ak === 'unreached' && bk === 'reached') return 1;
  // Both unreached → order by the cap month ascending (a finite count; no non-finite sort key).
  if (a.outcome.kind === 'unreached' && b.outcome.kind === 'unreached') {
    return a.outcome.cappedAtMonth - b.outcome.cappedAtMonth;
  }
  /* c8 ignore next */
  return 0;
}

/**
 * A STABLE sort: order by the comparator, breaking ties by the original input index so the ranking
 * is deterministic and input-order-preserving on a tie (D-08). (Array.prototype.sort is spec-stable
 * in modern engines, but the explicit index tie-break makes the guarantee local and reviewable.)
 */
function stableSort(rows: readonly CompareRow[]): CompareRow[] {
  return rows
    .map((row, index) => ({ row, index }))
    .sort((x, y) => {
      const byRank = compareBuyRows(x.row, y.row);
      return byRank !== 0 ? byRank : x.index - y.index;
    })
    .map((entry) => entry.row);
}

/**
 * Rank N buy scenarios against ONE keep-renting baseline (FI-04 / FI-06, D-08). The baseline is
 * always row 0 (`isBaseline: true`, delta 0, carrying the renter FI outcome from `fiImpact`); each
 * scenario contributes a buy row carrying its buy `FiOutcome` + the owner−renter delta. Buy rows are
 * ranked by FI-date delay ascending, `unreached` rows last (the don't-buy signal) — via a
 * `kind`-branching comparator that NEVER materializes a non-finite sort key (L3).
 */
export function compareScenarios(
  baselineInput: EngineInput,
  scenarios: readonly EngineInput[],
): CompareResult {
  // The baseline FI outcome = the renter (baseline) outcome from fiImpact(baselineInput). It is row
  // 0 with delta 0 by definition — the zero point every buy is measured against.
  const baselineImpact = fiImpact(baselineInput);
  const baselineRow: CompareRow = {
    label: baselineInput.scenario.label,
    outcome: baselineImpact.baseline,
    fiDeltaMonths: 0,
    fiDeltaYears: '0',
    isBaseline: true,
  };

  // Each scenario → a buy row carrying its buy outcome + the owner−renter delta (null if unreached).
  const buyRows: CompareRow[] = scenarios.map((input) => {
    const impact = fiImpact(input);
    return {
      label: input.scenario.label,
      outcome: impact.buy,
      fiDeltaMonths: impact.fiDeltaMonths,
      fiDeltaYears: impact.fiDeltaYears,
      isBaseline: false,
    };
  });

  // Baseline first, ranked buys after (best-for-FI first, unreached "don't buy" last).
  return { rows: [baselineRow, ...stableSort(buyRows)] };
}
