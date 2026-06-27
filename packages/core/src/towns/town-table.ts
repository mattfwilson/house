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
import type { MetricStamp, TownRateRow } from './town-table.schema.js';

/**
 * Per-metric stamp constructor (D-02). Wraps a canonical-decimal `value` string with its
 * vintage year (`asOf`) and a provenance `source`. Defaults reflect this seed batch: vintage
 * 2025, hand-seeded. The `value` is ALWAYS a canonical decimal STRING (never a JS number), so
 * the float-rejecting `decStr` boundary is honored before the literal even reaches the schema.
 *
 * IMPORTANT — every scoring-metric value below is an `[ASSUMED]` hand-seeded estimate (A9),
 * NOT an authoritative table. Magnitudes are plausible greater-Boston reference ranges only
 * (median price in dollars; school on the GreatSchools 1–10 scale; commute as one-way drive
 * minutes per anchor; amenities on the Walk-Score-family 0–100 scale). They are user-tunable
 * seed data and MUST NOT be read as sourced facts (T-05-04, accepted).
 */
const stamp = (value: string, asOf = 2025, source = 'hand-seeded estimate'): MetricStamp => ({
  value,
  asOf,
  source,
});

/**
 * Curated greater-Boston town table — the single canonical 24-town registry (D-01). The
 * `residentialMillRate` leaves are transcribed from the MA DLS "Tax Rates by Class" report
 * (residential class rate, $/$1,000 assessed value, FY-stamped). Every OTHER metric is an
 * `[ASSUMED]` hand-seeded estimate (A9) carried behind a per-metric vintage/source stamp
 * (D-02) — see the `stamp()` note above. Missing data is honest (D-03): a genuinely-unknown
 * metric OMITS its key, never zero/null-fills. Two deliberate gaps exercise D-03:
 *   - `Winchester` omits `medianPrice` entirely (no median-price estimate seeded).
 *   - `Weymouth` omits `amenities.transit` (no transit estimate seeded).
 * Curated MA-reality flags (betterment/title5/40b — D-05) attach per town where plausible;
 * `prop25` is NEVER stored (the engine injects Prop 2½ universally). The array is typed
 * `readonly TownRateRow[]` so a shape change is a compile error, and every row parses through
 * `townRowSchema` (asserted in town-table.test.ts).
 */
export const TOWN_RATE_TABLE: readonly TownRateRow[] = [
  {
    town: 'Boston',
    fy: 2024,
    residentialMillRate: '10.90',
    medianPrice: stamp('800000'),
    school: stamp('6', 2024),
    commute: {
      downtownBoston: stamp('15'),
      kendallCambridge: stamp('20'),
      route128Burlington: stamp('35'),
    },
    amenities: {
      walkability: stamp('88'),
      transit: stamp('75'),
      dining: stamp('90'),
      parks: stamp('70'),
    },
  },
  {
    town: 'Cambridge',
    fy: 2024,
    residentialMillRate: '5.86',
    medianPrice: stamp('1100000'),
    school: stamp('7', 2024),
    commute: {
      downtownBoston: stamp('20'),
      kendallCambridge: stamp('8'),
      route128Burlington: stamp('30'),
    },
    amenities: {
      walkability: stamp('90'),
      transit: stamp('80'),
      dining: stamp('88'),
      parks: stamp('72'),
    },
  },
  {
    town: 'Somerville',
    fy: 2024,
    residentialMillRate: '10.34',
    medianPrice: stamp('950000'),
    school: stamp('6', 2024),
    commute: {
      downtownBoston: stamp('22'),
      kendallCambridge: stamp('12'),
      route128Burlington: stamp('28'),
    },
    amenities: {
      walkability: stamp('86'),
      transit: stamp('72'),
      dining: stamp('82'),
      parks: stamp('65'),
    },
  },
  {
    town: 'Newton',
    fy: 2024,
    residentialMillRate: '9.86',
    medianPrice: stamp('1450000'),
    school: stamp('9', 2024),
    commute: {
      downtownBoston: stamp('30'),
      kendallCambridge: stamp('28'),
      route128Burlington: stamp('22'),
    },
    amenities: {
      walkability: stamp('70'),
      transit: stamp('55'),
      dining: stamp('72'),
      parks: stamp('80'),
    },
  },
  {
    town: 'Brookline',
    fy: 2024,
    residentialMillRate: '9.97',
    medianPrice: stamp('1300000'),
    school: stamp('9', 2024),
    commute: {
      downtownBoston: stamp('22'),
      kendallCambridge: stamp('24'),
      route128Burlington: stamp('28'),
    },
    amenities: {
      walkability: stamp('82'),
      transit: stamp('68'),
      dining: stamp('78'),
      parks: stamp('75'),
    },
  },
  {
    town: 'Quincy',
    fy: 2024,
    residentialMillRate: '11.46',
    medianPrice: stamp('650000'),
    school: stamp('6', 2024),
    commute: {
      downtownBoston: stamp('25'),
      kendallCambridge: stamp('35'),
      route128Burlington: stamp('40'),
    },
    amenities: {
      walkability: stamp('65'),
      transit: stamp('60'),
      dining: stamp('62'),
      parks: stamp('60'),
    },
    flags: ['40b'],
  },
  {
    town: 'Medford',
    fy: 2024,
    residentialMillRate: '8.42',
    medianPrice: stamp('750000'),
    school: stamp('6', 2024),
    commute: {
      downtownBoston: stamp('25'),
      kendallCambridge: stamp('18'),
      route128Burlington: stamp('25'),
    },
    amenities: {
      walkability: stamp('72'),
      transit: stamp('62'),
      dining: stamp('64'),
      parks: stamp('62'),
    },
  },
  {
    town: 'Malden',
    fy: 2024,
    residentialMillRate: '11.55',
    medianPrice: stamp('580000'),
    school: stamp('5', 2024),
    commute: {
      downtownBoston: stamp('28'),
      kendallCambridge: stamp('22'),
      route128Burlington: stamp('27'),
    },
    amenities: {
      walkability: stamp('74'),
      transit: stamp('64'),
      dining: stamp('60'),
      parks: stamp('55'),
    },
    flags: ['40b'],
  },
  {
    town: 'Arlington',
    fy: 2024,
    residentialMillRate: '10.96',
    medianPrice: stamp('850000'),
    school: stamp('8', 2024),
    commute: {
      downtownBoston: stamp('30'),
      kendallCambridge: stamp('22'),
      route128Burlington: stamp('22'),
    },
    amenities: {
      walkability: stamp('70'),
      transit: stamp('58'),
      dining: stamp('66'),
      parks: stamp('70'),
    },
  },
  {
    town: 'Belmont',
    fy: 2024,
    residentialMillRate: '11.10',
    medianPrice: stamp('1150000'),
    school: stamp('9', 2024),
    commute: {
      downtownBoston: stamp('28'),
      kendallCambridge: stamp('24'),
      route128Burlington: stamp('22'),
    },
    amenities: {
      walkability: stamp('64'),
      transit: stamp('52'),
      dining: stamp('58'),
      parks: stamp('72'),
    },
  },
  {
    town: 'Watertown',
    fy: 2024,
    residentialMillRate: '11.51',
    medianPrice: stamp('800000'),
    school: stamp('6', 2024),
    commute: {
      downtownBoston: stamp('26'),
      kendallCambridge: stamp('20'),
      route128Burlington: stamp('24'),
    },
    amenities: {
      walkability: stamp('72'),
      transit: stamp('56'),
      dining: stamp('64'),
      parks: stamp('60'),
    },
  },
  {
    town: 'Waltham',
    fy: 2024,
    residentialMillRate: '10.32',
    medianPrice: stamp('700000'),
    school: stamp('6', 2024),
    commute: {
      downtownBoston: stamp('32'),
      kendallCambridge: stamp('28'),
      route128Burlington: stamp('18'),
    },
    amenities: {
      walkability: stamp('66'),
      transit: stamp('52'),
      dining: stamp('68'),
      parks: stamp('62'),
    },
  },
  {
    town: 'Lexington',
    fy: 2024,
    residentialMillRate: '12.86',
    medianPrice: stamp('1400000'),
    school: stamp('10', 2024),
    commute: {
      downtownBoston: stamp('35'),
      kendallCambridge: stamp('30'),
      route128Burlington: stamp('18'),
    },
    amenities: {
      walkability: stamp('48'),
      transit: stamp('40'),
      dining: stamp('52'),
      parks: stamp('78'),
    },
    flags: ['betterment'],
  },
  {
    town: 'Needham',
    fy: 2024,
    residentialMillRate: '11.46',
    medianPrice: stamp('1100000'),
    school: stamp('9', 2024),
    commute: {
      downtownBoston: stamp('32'),
      kendallCambridge: stamp('35'),
      route128Burlington: stamp('22'),
    },
    amenities: {
      walkability: stamp('56'),
      transit: stamp('45'),
      dining: stamp('56'),
      parks: stamp('74'),
    },
    flags: ['title5'],
  },
  {
    town: 'Wellesley',
    fy: 2024,
    residentialMillRate: '10.91',
    medianPrice: stamp('1850000'),
    school: stamp('10', 2024),
    commute: {
      downtownBoston: stamp('35'),
      kendallCambridge: stamp('38'),
      route128Burlington: stamp('25'),
    },
    amenities: {
      walkability: stamp('52'),
      transit: stamp('42'),
      dining: stamp('58'),
      parks: stamp('80'),
    },
  },
  {
    town: 'Dedham',
    fy: 2024,
    residentialMillRate: '12.19',
    medianPrice: stamp('720000'),
    school: stamp('6', 2024),
    commute: {
      downtownBoston: stamp('28'),
      kendallCambridge: stamp('35'),
      route128Burlington: stamp('28'),
    },
    amenities: {
      walkability: stamp('60'),
      transit: stamp('48'),
      dining: stamp('56'),
      parks: stamp('64'),
    },
    flags: ['title5', '40b'],
  },
  {
    town: 'Milton',
    fy: 2024,
    residentialMillRate: '12.84',
    medianPrice: stamp('900000'),
    school: stamp('7', 2024),
    commute: {
      downtownBoston: stamp('25'),
      kendallCambridge: stamp('35'),
      route128Burlington: stamp('40'),
    },
    amenities: {
      walkability: stamp('50'),
      transit: stamp('45'),
      dining: stamp('48'),
      parks: stamp('76'),
    },
  },
  {
    town: 'Braintree',
    fy: 2024,
    residentialMillRate: '9.84',
    medianPrice: stamp('640000'),
    school: stamp('6', 2024),
    commute: {
      downtownBoston: stamp('28'),
      kendallCambridge: stamp('38'),
      route128Burlington: stamp('42'),
    },
    amenities: {
      walkability: stamp('62'),
      transit: stamp('55'),
      dining: stamp('58'),
      parks: stamp('60'),
    },
    flags: ['40b'],
  },
  {
    // DELIBERATE D-03 GAP: `amenities.transit` is OMITTED (no transit estimate seeded) — the
    // key is absent, never zero/null-filled, proving missing = absent at the data layer.
    town: 'Weymouth',
    fy: 2024,
    residentialMillRate: '11.20',
    medianPrice: stamp('560000'),
    school: stamp('5', 2024),
    commute: {
      downtownBoston: stamp('32'),
      kendallCambridge: stamp('42'),
      route128Burlington: stamp('45'),
    },
    amenities: {
      walkability: stamp('58'),
      dining: stamp('54'),
      parks: stamp('58'),
    },
    flags: ['title5'],
  },
  {
    town: 'Framingham',
    fy: 2024,
    residentialMillRate: '12.59',
    medianPrice: stamp('600000'),
    school: stamp('5', 2024),
    commute: {
      downtownBoston: stamp('45'),
      kendallCambridge: stamp('45'),
      route128Burlington: stamp('28'),
    },
    amenities: {
      walkability: stamp('60'),
      transit: stamp('50'),
      dining: stamp('60'),
      parks: stamp('62'),
    },
    flags: ['40b'],
  },
  {
    town: 'Natick',
    fy: 2024,
    residentialMillRate: '12.43',
    medianPrice: stamp('750000'),
    school: stamp('8', 2024),
    commute: {
      downtownBoston: stamp('42'),
      kendallCambridge: stamp('45'),
      route128Burlington: stamp('25'),
    },
    amenities: {
      walkability: stamp('58'),
      transit: stamp('48'),
      dining: stamp('62'),
      parks: stamp('66'),
    },
    flags: ['title5'],
  },
  {
    town: 'Melrose',
    fy: 2024,
    residentialMillRate: '10.42',
    medianPrice: stamp('720000'),
    school: stamp('7', 2024),
    commute: {
      downtownBoston: stamp('28'),
      kendallCambridge: stamp('24'),
      route128Burlington: stamp('25'),
    },
    amenities: {
      walkability: stamp('70'),
      transit: stamp('58'),
      dining: stamp('60'),
      parks: stamp('64'),
    },
  },
  {
    // DELIBERATE D-03 GAP: `medianPrice` is OMITTED entirely (no median-price estimate seeded)
    // — the key is absent, never zero/null-filled, proving missing = absent at the data layer.
    town: 'Winchester',
    fy: 2024,
    residentialMillRate: '11.00',
    school: stamp('9', 2024),
    commute: {
      downtownBoston: stamp('30'),
      kendallCambridge: stamp('26'),
      route128Burlington: stamp('20'),
    },
    amenities: {
      walkability: stamp('60'),
      transit: stamp('52'),
      dining: stamp('58'),
      parks: stamp('72'),
    },
    flags: ['betterment'],
  },
  {
    town: 'Woburn',
    fy: 2024,
    residentialMillRate: '8.43',
    medianPrice: stamp('700000'),
    school: stamp('6', 2024),
    commute: {
      downtownBoston: stamp('32'),
      kendallCambridge: stamp('28'),
      route128Burlington: stamp('15'),
    },
    amenities: {
      walkability: stamp('62'),
      transit: stamp('50'),
      dining: stamp('56'),
      parks: stamp('58'),
    },
  },
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
