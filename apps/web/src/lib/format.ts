// format.ts — the CLIENT display edge. This is the ONLY place dollars become formatted strings and
// the ONLY place the FI-date delta becomes user copy. It holds ZERO financial logic: every input is
// already a finished value from a core entry point (a canonical decimal string from
// `Money.toDecimalString()`, or a `fiDeltaMonths` integer from `compareScenarios`/`fiImpact`).
//
// Number() discipline (Pitfall 5 / the 07-01 eslint rule): `lib/format.ts` is one of only two
// sanctioned `Number()` sites (alongside `components/charts/**`). The single `Number()` below is the
// LAST step — it feeds ONLY `Intl.NumberFormat` and never re-enters money math, so no float ever
// flows back into a calculation.
//
// Color honesty (07-UI-SPEC §Color, load-bearing anti-funnel rule): `fiDeltaLabel` returns a `tone`
// the UI maps to color. A *delay* (buying pushes FI later) is `'delay'` → amber emphasis; reaching FI
// *earlier* is `'earlier'` → NEUTRAL (slate-50 / muted-teal), NEVER success-green. The hero number's
// job is honest disclosure, not celebration. There is deliberately no 'good'/'green'/'success' tone.

/** Shared en-US USD formatter (2dp, banker-agnostic — the value is already cent-final from core). */
const USD = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

/**
 * Render a canonical decimal string (from `Money.toDecimalString()`) as a 2dp en-US currency string.
 * `Number(decimalString)` is the LAST step and feeds ONLY the formatter — it never re-enters math.
 */
export function formatUSD(decimalString: string): string {
  return USD.format(Number(decimalString));
}

/** The color-honest tone the UI maps to emphasis: amber delay, neutral earlier, no emphasis. */
export type FiDeltaTone = 'delay' | 'earlier' | 'none';

/** The rendered FI-date delta: the exact anti-funnel copy + its color-honest tone. */
export interface FiDeltaLabel {
  readonly text: string;
  readonly tone: FiDeltaTone;
}

/**
 * Turn a signed `fiDeltaMonths` (owner − renter; positive ⇒ buying DELAYS FI) into the locked
 * anti-funnel copy + a color-honest tone (07-UI-SPEC §Copywriting / §Color):
 *   - delay   → "+{Y} yr {M} mo later"   tone 'delay'   (amber emphasis)
 *   - earlier → "{Y} yr {M} mo earlier"  tone 'earlier' (NEUTRAL — never success-green)
 *   - zero    → "same FI date"           tone 'none'
 *   - null    → "—"                      tone 'none'    (either path never reached FI)
 */
export function fiDeltaLabel(months: number | null): FiDeltaLabel {
  if (months === null) return { text: '—', tone: 'none' };
  const y = Math.floor(Math.abs(months) / 12);
  const m = Math.abs(months) % 12;
  if (months > 0) return { text: `+${y} yr ${m} mo later`, tone: 'delay' };
  if (months < 0) return { text: `${y} yr ${m} mo earlier`, tone: 'earlier' };
  return { text: 'same FI date', tone: 'none' };
}
