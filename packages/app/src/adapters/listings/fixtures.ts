// LISTING_FIXTURES — the hand-seeded static listing set the only `ListingsProvider`
// implementation (`MockListingsProvider`) serves (LIST-01/LIST-02). Live MLS/IDX data is
// deliberately out of scope, so these literals ARE the listings data for this build.
//
// This is the exact `TOWN_RATE_TABLE` idiom (towns/town-table.ts:50): a `readonly Listing[]`
// LITERAL array — pure data, no ambient state, no `Date`, no computation (the determinism guard
// would throw otherwise). Discipline enforced:
//   - Every `listPrice` / `baths` is a canonical decimal STRING literal (D-09 / CORE-02), never a
//     bare JS number — the same convention `Money.of` / `parseListing` consume.
//   - `town` is drawn from the curated greater-Boston mill-rate table (town-table.ts) where
//     sensible (D-09), so a listing resolves to a real seeded mill rate downstream.
//   - Prices are chosen to straddle the price-range filter BOUNDARIES exercised by the contract
//     test (e.g. 700000 / 875000 sit exactly on a [min,max] edge).
import type { Listing } from '@house/core';

/**
 * Ten hand-seeded greater-Boston listings spanning several curated towns and all four property
 * types, with varied beds/baths/livingSqft and a price spread from ~$625k to ~$1.45M. Typed
 * `readonly Listing[]` so any shape drift from the `Listing` contract is a compile error, and
 * every entry survives `parseListing` (asserted in mock-provider.test.ts).
 */
const RAW_LISTING_FIXTURES: readonly Listing[] = [
  {
    id: 'lst-boston-001',
    address: '120 Tremont St, Unit 4B',
    town: 'Boston',
    listPrice: '749000',
    beds: 2,
    baths: '2',
    livingSqft: 1180,
    propertyType: 'condo',
  },
  {
    id: 'lst-cambridge-001',
    address: '88 Kirkland St',
    town: 'Cambridge',
    listPrice: '1250000',
    beds: 3,
    baths: '2.5',
    livingSqft: 1640,
    propertyType: 'condo',
  },
  {
    id: 'lst-newton-001',
    address: '24 Commonwealth Ave',
    town: 'Newton',
    listPrice: '1450000',
    beds: 4,
    baths: '3.5',
    livingSqft: 2980,
    propertyType: 'single-family',
  },
  {
    id: 'lst-newton-002',
    address: '57 Walnut St',
    town: 'Newton',
    listPrice: '875000',
    beds: 3,
    baths: '2.5',
    livingSqft: 1820,
    propertyType: 'townhouse',
  },
  {
    id: 'lst-brookline-001',
    address: '410 Harvard St, Unit 2',
    town: 'Brookline',
    listPrice: '1100000',
    beds: 3,
    baths: '2',
    livingSqft: 1560,
    propertyType: 'condo',
  },
  {
    id: 'lst-quincy-001',
    address: '15 Hancock St',
    town: 'Quincy',
    listPrice: '625000',
    beds: 3,
    baths: '1.5',
    livingSqft: 1440,
    propertyType: 'single-family',
  },
  {
    id: 'lst-medford-001',
    address: '203 Salem St',
    town: 'Medford',
    listPrice: '925000',
    beds: 5,
    baths: '3',
    livingSqft: 2400,
    propertyType: 'multi-family',
  },
  {
    id: 'lst-arlington-001',
    address: '9 Jason St',
    town: 'Arlington',
    listPrice: '850000',
    beds: 3,
    baths: '2',
    livingSqft: 1700,
    propertyType: 'single-family',
  },
  {
    id: 'lst-belmont-001',
    address: '31 Common St',
    town: 'Belmont',
    listPrice: '1150000',
    beds: 4,
    baths: '2.5',
    livingSqft: 2200,
    propertyType: 'single-family',
  },
  {
    id: 'lst-melrose-001',
    address: '46 Vinton St',
    town: 'Melrose',
    listPrice: '700000',
    beds: 3,
    baths: '1.5',
    livingSqft: 1500,
    propertyType: 'single-family',
  },
];

/**
 * The exported fixture set, each listing `Object.freeze`d at module load. `MockListingsProvider`
 * returns these objects BY REFERENCE, so without freezing a consumer that mutates a returned
 * listing (slipping past the `readonly` types via a cast or plain JS) would corrupt the shared
 * singleton for every subsequent query in the process. Freezing matches the runtime-immutability
 * discipline the calc core enforces on `EngineInput`, and keeps behavior consistent with a future
 * `RealListingsProvider` that would return fresh per-call objects. Listings are flat (string/number
 * leaves), so a shallow freeze fully seals each record.
 */
export const LISTING_FIXTURES: readonly Listing[] = RAW_LISTING_FIXTURES.map((listing) =>
  Object.freeze(listing),
);
