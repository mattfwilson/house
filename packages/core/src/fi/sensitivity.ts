// sensitivity.ts — the one-way FI tornado (ASMP-02 / D-12/D-13/D-14, L6), the "no headline number
// without a range" instrument. For each of the SIX drivers (return, inflation, appreciation,
// maintenance, tax, swr) it perturbs ONE stored band from the V3 `sensitivity` slice and re-runs the
// SAME pure FI projection (`fiImpact(...).buy`) — Pitfall 10's "sensitivity must be a cheap re-run".
//
// NO BESPOKE PER-DRIVER MATH (Pitfall 10): the only per-driver difference is WHICH assumption key is
// perturbed and the absolute-vs-relative mode. There is no `switch(driver)` with distinct projection
// math per arm — every arm calls the SAME `fiImpact` on a perturbed `EngineInput`.
//
// BAND SEMANTICS (D-12 / L6): FIVE drivers perturb their rate ABSOLUTELY (`rate ± band` in Dec). The
// SIXTH — `tax` — is the ONLY RELATIVE band (L6): it scales the property-tax rate multiplicatively by
// `× (1 − taxBandRelative)` / `× (1 + taxBandRelative)`. Each driver declares its mode explicitly in
// the DRIVER_SPECS table, so the perturbation is unambiguous and data-driven.
//
// RANKING (D-14): `swingMonths = |highMonth − lowMonth|`, where each endpoint's month is its
// `reached` month OR — when `unreached` — its `cappedAtMonth` bound. This makes an unreached endpoint
// contribute a MAX-magnitude swing measured against the horizon cap, with NO `Infinity` ever
// materialized (L3 — `canonicalJson` throws on non-finite; the discriminated `FiOutcome` never
// becomes a sentinel). Rows are sorted DESCENDING by `swingMonths`; `topDrivers` = the top 3.
//
// DETERMINISM (D-13): bands come from `input.assumptions.sensitivity` (V3 stored data), never
// hardcoded; every perturbation re-freezes through `engineInput` (re-validating the perturbed band at
// the Zod boundary, T-04-13) so a non-canonical value is rejected, not computed. All perturbation
// arithmetic is in the frozen `Dec` clone; `Dec` is not re-exported.
import { Dec } from '../money/decimal-config.js';
import { engineInput, type EngineInput } from '../engine/engine-input.js';
import type { CurrentAssumptionSet } from '../assumptions/schema.js';
import { resolveMillRate } from '../towns/town-table.js';
import { fiImpact } from './fi-impact.js';
import type { FiOutcome } from './projection.js';

/** The six swept tornado drivers (D-13). Data-driven (≥ the SC5 five + appreciation). */
const DRIVERS = ['return', 'inflation', 'appreciation', 'maintenance', 'tax', 'swr'] as const;

/** A driver name (a plain string literal — NO UI copy; Phase 7 owns wording). */
export type TornadoDriver = (typeof DRIVERS)[number];

/** The ± perturbation direction (low = `-`, high = `+`). */
type Direction = '-' | '+';

/**
 * One tornado row (D-14): the driver's low/base/high FI `FiOutcome` (the SAME unperturbed projection
 * for `base` across every row) plus the FI-date `swingMonths` (the |high − low| month spread,
 * measured against `cappedAtMonth` for an unreached endpoint — always finite, L3). ALL `readonly`.
 */
export interface TornadoRow {
  /** The perturbed driver name (a plain string literal — no UI copy). */
  readonly driver: TornadoDriver;
  /** The FI outcome with the driver perturbed DOWN (low band / × (1 − taxBandRelative) for tax). */
  readonly low: FiOutcome;
  /** The unperturbed FI outcome — IDENTICAL across all rows (computed once). */
  readonly base: FiOutcome;
  /** The FI outcome with the driver perturbed UP (high band / × (1 + taxBandRelative) for tax). */
  readonly high: FiOutcome;
  /** `|highMonth − lowMonth|` (each endpoint's month or its `cappedAtMonth`); finite (L3). */
  readonly swingMonths: number;
}

/**
 * The closed tornado result (D-14): the per-driver rows sorted DESCENDING by `swingMonths`, plus the
 * top-3 driver names flagged. ALL `readonly`. Serializes through `canonicalJson` with no `Infinity`.
 */
export interface TornadoResult {
  /** The six driver rows, sorted DESC by FI-date swing magnitude (the ready-to-render tornado). */
  readonly rows: readonly TornadoRow[];
  /** The top-3 highest-swing driver names (`rows.slice(0,3).map(r => r.driver)`). */
  readonly topDrivers: readonly TornadoDriver[];
}

/**
 * A driver's perturbation spec: where its band lives on the `sensitivity` slice and how to apply it.
 * `relative: true` makes the band a MULTIPLICATIVE fraction of the target rate (tax, L6); otherwise
 * the band is ADDED/SUBTRACTED absolutely. `apply` returns the new assumptions with ONE rate moved —
 * the only per-driver difference is the key it touches and the absolute-vs-relative mode.
 */
interface DriverSpec {
  /** The `sensitivity` band key supplying this driver's perturbation magnitude. */
  readonly band: keyof CurrentAssumptionSet['sensitivity'];
  /** True only for `tax` (L6): the band is a relative ±fraction, not an absolute ± on the rate. */
  readonly relative: boolean;
  /**
   * Produce new assumptions with this driver's rate perturbed in `Dec` by `band` in `dir`. The
   * `baseRate` is the LIVE rate to perturb FROM — for every driver except `tax` it is the driver's
   * own assumption rate (read off `assumptions` inside `apply`); for `tax` it is the resolved town
   * mill rate (or an existing override), seeded by `perturb` since the town lives on the scenario,
   * not on `assumptions`. This is the only per-driver threading — there is NO `switch(driver)`
   * projection math (Pitfall 10); the projection is the SAME `fiImpact` re-run.
   */
  readonly apply: (
    assumptions: CurrentAssumptionSet,
    band: string,
    dir: Direction,
    baseRate: string,
  ) => CurrentAssumptionSet;
}

/** Perturb a rate ABSOLUTELY: `rate ± band` in Dec, re-emitted as a canonical decimal string. */
function absolute(rate: string, band: string, dir: Direction): string {
  const b = new Dec(band);
  return (dir === '+' ? new Dec(rate).plus(b) : new Dec(rate).minus(b)).toFixed();
}

/** Perturb a rate RELATIVELY (L6): `rate × (1 ± band)` in Dec, re-emitted as a decimal string. */
function relative(rate: string, band: string, dir: Direction): string {
  const factor = dir === '+' ? new Dec(1).plus(new Dec(band)) : new Dec(1).minus(new Dec(band));
  return new Dec(rate).times(factor).toFixed();
}

/**
 * CR-01 floor (GAP 2): the smallest positive swr.rate the swr low-band sweep is allowed to reach.
 * A band that meets/exceeds the SWR is degenerate input — `absolute(rate, band, '-')` would be
 * `<= 0`, which the now-stricter boundary refine REJECTS (throwing out of `tornado`). Flooring the
 * swept value to this tiny positive rate keeps the perturbed input valid so the tornado returns a
 * well-formed row instead of crashing. A canonical decimal string (never a bare number).
 */
const SWR_FLOOR = '0.0001';

/**
 * Perturb a rate ABSOLUTELY but CLAMP it to a small positive floor (CR-01). Used only by the swr
 * driver's low sweep, where a `rate − band <= 0` would be rejected at the boundary. Returns the
 * larger of the perturbed rate and `SWR_FLOOR`, as a canonical decimal string.
 */
function absoluteClampedPositive(rate: string, band: string, dir: Direction): string {
  const perturbed = new Dec(absolute(rate, band, dir));
  return perturbed.lessThanOrEqualTo(0) ? SWR_FLOOR : perturbed.toFixed();
}

/**
 * The driver → perturbation table (D-12 / L6). Five absolute, ONE relative (tax). Each `apply` moves
 * exactly one rate; no per-driver projection math — the projection is the SAME `fiImpact` re-run.
 */
const DRIVER_SPECS: Record<TornadoDriver, DriverSpec> = {
  return: {
    band: 'returnBand',
    relative: false,
    apply: (a, band, dir) => ({
      ...a,
      returns: { realAnnual: absolute(a.returns.realAnnual, band, dir) },
    }),
  },
  inflation: {
    band: 'inflationBand',
    relative: false,
    apply: (a, band, dir) => ({
      ...a,
      inflation: { annual: absolute(a.inflation.annual, band, dir) },
    }),
  },
  appreciation: {
    band: 'appreciationBand',
    relative: false,
    apply: (a, band, dir) => ({
      ...a,
      appreciation: { realAnnual: absolute(a.appreciation.realAnnual, band, dir) },
    }),
  },
  maintenance: {
    band: 'maintenanceBand',
    relative: false,
    apply: (a, band, dir) => ({
      ...a,
      maintenance: { annualPctOfValue: absolute(a.maintenance.annualPctOfValue, band, dir) },
    }),
  },
  tax: {
    // L6 — the ONLY relative band: scale the LIVE property-tax (mill) rate by × (1 ± taxBandRelative)
    // via the assumption-boundary override (GAP 1). `baseRate` is seeded by `perturb` from the
    // resolved town rate (or an existing override), so the perturbed mill rate flows through
    // computeTco → the owner perpetual-tax target AND the monthly ownership premium — a real swing.
    band: 'taxBandRelative',
    relative: true,
    apply: (a, band, dir, baseRate) => ({
      ...a,
      tax: { ...a.tax, millRateOverride: relative(baseRate, band, dir) },
    }),
  },
  swr: {
    band: 'swrBand',
    relative: false,
    // CR-01: the low sweep (`-`) is clamped to a positive floor so a band >= swr.rate cannot drive
    // the rate to <= 0 (which the boundary refine would reject, crashing the tornado). The high
    // sweep (`+`) is always positive, so it stays a plain absolute perturbation.
    apply: (a, band, dir) => ({
      ...a,
      swr: {
        rate: dir === '-' ? absoluteClampedPositive(a.swr.rate, band, dir) : absolute(a.swr.rate, band, dir),
      },
    }),
  },
};

/**
 * Build a NEW `EngineInput` with ONE driver's band applied in `dir`, re-frozen through `engineInput`
 * so the perturbed assumptions re-validate at the Zod boundary (T-04-13). Bands come from the stored
 * V3 `sensitivity` slice — never hardcoded.
 */
function perturb(input: EngineInput, driver: TornadoDriver, dir: Direction): EngineInput {
  const spec = DRIVER_SPECS[driver];
  const band = input.assumptions.sensitivity[spec.band];
  // For `tax`, seed the base rate from the LIVE mill rate the unperturbed projection used: an
  // existing override if present, else the resolved town rate (computeTco resolves it the same
  // way). The town lives on the scenario, not on `assumptions`, so the seed is computed HERE and
  // passed into `apply`. For the other five drivers the base rate is unused (each reads its own
  // assumption rate); '' is a harmless placeholder. NO per-driver projection math (Pitfall 10).
  const baseRate =
    driver === 'tax'
      ? (input.assumptions.tax.millRateOverride ??
        resolveMillRate(input.scenario.town).residentialMillRate)
      : '';
  const assumptions = spec.apply(input.assumptions, band, dir, baseRate);
  return engineInput({
    asOf: input.asOf,
    assumptions,
    scenario: input.scenario,
    ...(input.household ? { household: input.household } : {}),
  });
}

/**
 * The finite month bound of an FI outcome (L3): the reached `month`, or the `cappedAtMonth` for an
 * unreached outcome. NEVER `Infinity` — an unreached endpoint contributes the horizon cap as its
 * bound, so the swing measured from it is a max-magnitude (but finite) spread.
 */
function boundMonth(outcome: FiOutcome): number {
  return outcome.kind === 'reached' ? outcome.month : outcome.cappedAtMonth;
}

/** `|highBound − lowBound|` — the FI-date swing magnitude in months (always finite, L3). */
function swingMonths(low: FiOutcome, high: FiOutcome): number {
  return Math.abs(boundMonth(high) - boundMonth(low));
}

/**
 * Run the one-way FI tornado (ASMP-02 / D-12/D-13/D-14). Computes the unperturbed buy outcome ONCE
 * (the shared `base`), then for each driver re-runs `fiImpact(...).buy` with the band perturbed DOWN
 * and UP. Rows are sorted DESCENDING by `swingMonths`; `topDrivers` = the top-3 driver names. The
 * result serializes through `canonicalJson` with no `Infinity` (L3).
 */
export function tornado(input: EngineInput): TornadoResult {
  // Base = the unperturbed buy projection, computed ONCE and reused on every row (D-14).
  const base = fiImpact(input).buy;

  const rows: TornadoRow[] = DRIVERS.map((driver) => {
    const low = fiImpact(perturb(input, driver, '-')).buy;
    const high = fiImpact(perturb(input, driver, '+')).buy;
    return { driver, low, base, high, swingMonths: swingMonths(low, high) };
  });

  // Sort DESC by swing magnitude (D-14). Stable tie-break on the canonical driver order keeps the
  // ranking deterministic when two drivers swing equally (no clock, no random).
  const order = new Map(DRIVERS.map((d, i) => [d, i] as const));
  rows.sort((a, b) => b.swingMonths - a.swingMonths || order.get(a.driver)! - order.get(b.driver)!);

  return { rows, topDrivers: rows.slice(0, 3).map((r) => r.driver) };
}
