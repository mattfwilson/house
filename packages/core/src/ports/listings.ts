// ListingsProvider — the walled-off listings PORT (LIST-01 / D-02 dependency inversion). The
// core DEFINES the contract; the app supplies the implementation (a `MockListingsProvider` over
// static fixtures in this build — live MLS/IDX data is deliberately out of scope). This is a
// PURE-interface module: no Zod, no class, no `better-sqlite3`/`drizzle` import — the
// `boundaries/external` deny-by-default guard would fail the build otherwise (D-02).
//
// The methods are SYNCHRONOUS (D-08), overriding ARCHITECTURE's `Promise<…>` sketch: the only
// implementation is an in-memory fixture filter with no I/O, and the persistence driver
// (better-sqlite3) is itself synchronous — async here would be cosmetic ceremony.
import type { Listing } from '../types/listing.js';

/**
 * Filter criteria for `getListings`. All fields are optional (an empty query returns everything);
 * the monetary bounds are canonical decimal STRINGS (`decStr`-shaped), never bare numbers, so the
 * float-free money discipline holds at the query edge too.
 */
export interface ListingsQuery {
  /** Restrict to a single town (exact name match against the curated table). */
  readonly town?: string;
  /** Inclusive lower price bound, canonical decimal string. */
  readonly minPrice?: string;
  /** Inclusive upper price bound, canonical decimal string. */
  readonly maxPrice?: string;
}

/**
 * The listings data port. SYNCHRONOUS (D-08). `getListings` returns the matching listings (empty
 * array when none match); `getListingById` returns the listing or `null` when absent.
 */
export interface ListingsProvider {
  getListings(query: ListingsQuery): Listing[];
  getListingById(id: string): Listing | null;
}
