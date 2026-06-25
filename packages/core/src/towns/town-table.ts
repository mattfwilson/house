// MA residential mill-rate table + resolveMillRate resolver (TCO-02 data half).
//
// PURE DATA. No `process`/env reads, no `Date`, no computation — just literal town rows
// transcribed from the Massachusetts DLS "Tax Rates by Class" report, so the table is
// trivially reproducible and snapshot-stable (the determinism guard would throw if this
// touched ambient state). This is a CURATED greater-Boston subset (~20-40 towns), NOT the
// full ~351-municipality table — full-MA coverage + the other town-scoring metrics are
// deferred to Phase 5 (D-09).
//
// `residentialMillRate` is the published residential rate in $/$1,000 of assessed value
// (Assumption A3), stored AS PUBLISHED (the property-tax module divides by 1000 at use).
// Each row is FY-stamped individually (mixed vintage allowed — Open Question 1); the FY is
// captured into the TCO result alongside the rate so a replay is self-contained (D-08 /
// Pitfall 11). The array is typed `readonly TownRateRow[]` so a shape change is a compile
// error, and every row parses through `townRowSchema` (asserted in town-table.test.ts).
import type { TownRateRow } from './town-table.schema.js';

/**
 * Curated greater-Boston residential mill rates, transcribed from the MA DLS "Tax Rates by
 * Class" report. Residential class rate, $/$1,000 of assessed value, FY-stamped per row.
 * Spot-check a handful against the DLS source before trusting downstream numbers (see
 * town-table.test.ts and the SUMMARY spot-check note).
 */
export const TOWN_RATE_TABLE: readonly TownRateRow[] = [
  { town: 'Boston', fy: 2024, residentialMillRate: '10.90' },
  { town: 'Cambridge', fy: 2024, residentialMillRate: '5.86' },
  { town: 'Somerville', fy: 2024, residentialMillRate: '10.34' },
  { town: 'Newton', fy: 2024, residentialMillRate: '9.86' },
  { town: 'Brookline', fy: 2024, residentialMillRate: '9.97' },
  { town: 'Quincy', fy: 2024, residentialMillRate: '11.46' },
  { town: 'Medford', fy: 2024, residentialMillRate: '8.42' },
  { town: 'Malden', fy: 2024, residentialMillRate: '11.55' },
  { town: 'Arlington', fy: 2024, residentialMillRate: '10.96' },
  { town: 'Belmont', fy: 2024, residentialMillRate: '11.10' },
  { town: 'Watertown', fy: 2024, residentialMillRate: '11.51' },
  { town: 'Waltham', fy: 2024, residentialMillRate: '10.32' },
  { town: 'Lexington', fy: 2024, residentialMillRate: '12.86' },
  { town: 'Needham', fy: 2024, residentialMillRate: '11.46' },
  { town: 'Wellesley', fy: 2024, residentialMillRate: '10.91' },
  { town: 'Dedham', fy: 2024, residentialMillRate: '12.19' },
  { town: 'Milton', fy: 2024, residentialMillRate: '12.84' },
  { town: 'Braintree', fy: 2024, residentialMillRate: '9.84' },
  { town: 'Weymouth', fy: 2024, residentialMillRate: '11.20' },
  { town: 'Framingham', fy: 2024, residentialMillRate: '12.59' },
  { town: 'Natick', fy: 2024, residentialMillRate: '12.43' },
  { town: 'Melrose', fy: 2024, residentialMillRate: '10.42' },
  { town: 'Winchester', fy: 2024, residentialMillRate: '11.00' },
  { town: 'Woburn', fy: 2024, residentialMillRate: '8.43' },
];

/**
 * The snapshot-capturable resolved pair: the residential mill rate (as published) and the
 * fiscal year it was published for. Captured into the TCO result so a replay is
 * self-contained (D-08 / Pitfall 11).
 */
export type ResolvedMillRate = {
  readonly residentialMillRate: string;
  readonly fy: number;
};

/**
 * Resolve a town name to its seeded `{ residentialMillRate, fy }` pair. Throws a meaningful
 * error on an unknown town (mirrors the `calendarDate` validate-and-throw idiom) — a missing
 * town is a hard error, never a silent default, so a scenario can't quietly model the wrong
 * tax. Lookup is by exact canonical town name.
 *
 * @throws if `town` is not present in the seeded table.
 */
export function resolveMillRate(town: string): ResolvedMillRate {
  const row = TOWN_RATE_TABLE.find((r) => r.town === town);
  if (row === undefined) {
    throw new Error(
      `Unknown town: ${JSON.stringify(town)} is not in the seeded MA mill-rate table ` +
        `(curated greater-Boston subset; full-MA coverage is deferred to Phase 5 — D-09).`,
    );
  }
  return { residentialMillRate: row.residentialMillRate, fy: row.fy };
}
