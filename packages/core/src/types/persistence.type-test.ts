// TYPE-LEVEL regression guard for the Phase-6 persistence contracts (D-09 / D-08 / T-06-02).
//
// NOT a *.test.ts (so it stays in the `tsc -b` graph and out of Vitest, which strips types and
// ignores @ts-expect-error). Each `@ts-expect-error` ASSERTS a misuse is a compile error; if the
// money discipline (decimal STRING leaves, never bare number) or the synchronous port signatures
// ever weaken, the suppression goes UNUSED and `tsc -b` FAILS (TS2578). Mirrors
// engine-input.type-test.ts / fi.type-test.ts.
import type { Listing } from './listing.js';
import type { Profile } from './profile.js';
import type { ListingsProvider, ListingsQuery } from '../ports/listings.js';
import type { ProfileRepository } from '../ports/repositories.js';

declare const listing: Listing;
declare const profile: Profile;

// (1) Listing money leaves are canonical decimal STRINGS, never bare numbers (D-09 / CORE-02).
//     A bare `number` cannot be assigned where the string field is expected.
// @ts-expect-error -- listPrice is a decimal STRING, never a bare number (D-09).
const _badListPrice: Listing = { ...listing, listPrice: 850000 };
void _badListPrice;
// @ts-expect-error -- baths is a decimal STRING (half-baths), never a bare number.
const _badBaths: Listing = { ...listing, baths: 2.5 };
void _badBaths;
// Reading a money string leaf INTO a number must error (no bare-number dollar leak).
// @ts-expect-error -- listPrice is a string, not a number.
const _listPriceNum: number = listing.listPrice;
void _listPriceNum;

// (2) Profile money leaves are decimal STRINGS too — a bare-number availableNetWorth (PROF-01
//     "net worth") is NOT assignable (T-06-02).
// @ts-expect-error -- availableNetWorth is a decimal STRING, never a bare number (PROF-01).
const _badNetWorth: Profile = { ...profile, availableNetWorth: 350000 };
void _badNetWorth;
// @ts-expect-error -- a profile money leaf is a string, not a number.
const _netWorthNum: number = profile.availableNetWorth;
void _netWorthNum;

// (3) The counts ARE bare numbers (the complement: this must NOT error, proving the guard is
//     specific to money, not blanket-rejecting numbers).
const _okBeds: Listing = { ...listing, beds: 4 };
void _okBeds;

// (4) The ListingsProvider port is SYNCHRONOUS (D-08): an implementation whose methods return a
//     `Promise` is NOT assignable to the port. This pins the sync contract at the type level.
const _asyncProvider: ListingsProvider = {
  // @ts-expect-error -- getListings must return Listing[] synchronously, not a Promise (D-08).
  getListings: (_q: ListingsQuery): Promise<Listing[]> => Promise.resolve([]),
  // @ts-expect-error -- getListingById must return Listing | null synchronously, not a Promise.
  getListingById: (_id: string): Promise<Listing | null> => Promise.resolve(null),
};
void _asyncProvider;

// (5) The repository ports are SYNCHRONOUS too — a Promise-returning load is NOT assignable.
const _asyncRepo: ProfileRepository = {
  save: (_p: Profile): void => {},
  // @ts-expect-error -- load must return Profile | null synchronously, not a Promise (D-08).
  load: (_id: string): Promise<Profile | null> => Promise.resolve(null),
  list: (): Profile[] => [],
  count: (): number => 0,
};
void _asyncRepo;

// (6) A valid synchronous provider IS assignable (the positive control — must NOT error).
const _syncProvider: ListingsProvider = {
  getListings: (_q: ListingsQuery): Listing[] => [],
  getListingById: (_id: string): Listing | null => null,
};
void _syncProvider;
