// MockListingsProvider — the ONLY `ListingsProvider` implementation this build ships (LIST-02).
// It makes the walled-off, highest-risk dependency CONCRETE behind the core port: an in-memory
// filter over a static `readonly Listing[]` fixture set. A future `RealListingsProvider` (live
// MLS/IDX) swaps in with a one-line container change (06-06) — consumers only ever see the
// `ListingsProvider` port (D-03), never this class.
//
// Money discipline (CORE-02 / D-09 / T-06-09): price-range filtering compares amounts through the
// `Money` decimal boundary (`Money.of(s).toCents()` -> exact `bigint` cents), NEVER a bare-number
// coercion. A float parse would re-open the float hole the whole engine exists to close.
import { Money, type Listing, type ListingsProvider, type ListingsQuery } from '@house/core';

/**
 * Compare two canonical decimal dollar strings as exact integer cents, with NO float re-entry:
 * both strings cross the `Money` boundary and reduce to `bigint` cents (`toCents()`), which
 * compare exactly. Returns negative / zero / positive like a standard comparator.
 */
function compareDollarStrings(a: string, b: string): number {
  const aCents = Money.of(a).toCents();
  const bCents = Money.of(b).toCents();
  if (aCents < bCents) return -1;
  if (aCents > bCents) return 1;
  return 0;
}

export class MockListingsProvider implements ListingsProvider {
  constructor(private readonly fixtures: readonly Listing[]) {}

  /**
   * Return every fixture matching the query. Filters are ANDed: `town` is an exact name match
   * (when present); `minPrice` / `maxPrice` bound the `listPrice` INCLUSIVELY, compared via the
   * decimal `Money` boundary (never a bare float coercion). An empty query returns all fixtures.
   */
  getListings(query: ListingsQuery): Listing[] {
    return this.fixtures.filter((listing) => {
      if (query.town !== undefined && listing.town !== query.town) {
        return false;
      }
      if (query.minPrice !== undefined && compareDollarStrings(listing.listPrice, query.minPrice) < 0) {
        return false;
      }
      if (query.maxPrice !== undefined && compareDollarStrings(listing.listPrice, query.maxPrice) > 0) {
        return false;
      }
      return true;
    });
  }

  /** Return the listing with this id, or `null` when absent (port contract — D-08). */
  getListingById(id: string): Listing | null {
    return this.fixtures.find((listing) => listing.id === id) ?? null;
  }
}
