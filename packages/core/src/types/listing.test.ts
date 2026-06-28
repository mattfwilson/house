// Listing — the Boston-home model returned by the `ListingsProvider` port (LIST-01). It is the
// walled-off listings boundary's only domain type: an untrusted/forged listing blob becomes a
// trusted `Listing` ONLY through `parseListing` (T-06-01/T-06-02).
//
// Runtime behavior (Vitest, types stripped — the no-bare-number `listPrice` guarantee is proven
// separately in persistence.type-test.ts, which is in the `tsc -b` graph). Here we assert the
// listing mirrors the ScenarioInputs triad discipline: money (`listPrice`, `baths`) is a
// canonical decimal STRING (`decStr`, never `z.number()`), counts are positive ints, and
// `.strict()` rejects unknown keys.
import { describe, test, expect } from 'vitest';
import { parseListing, ListingSchema, type Listing } from './listing.js';

/**
 * A well-formed Boston-home listing: money fields (`listPrice`, `baths`) as canonical decimal
 * strings, counts as bare positive ints, a curated-town name, a known property type.
 */
const VALID_LISTING: Listing = {
  id: 'listing-1',
  address: '12 Walnut St',
  town: 'Newton',
  listPrice: '850000',
  beds: 3,
  baths: '2.5',
  livingSqft: 1800,
  propertyType: 'single-family',
};

describe('parseListing — the listings trust boundary (LIST-01, T-06-01/02)', () => {
  test('ACCEPTS a valid Boston-home fixture and returns it (deep-equals the input)', () => {
    expect(parseListing(VALID_LISTING)).toStrictEqual(VALID_LISTING);
  });

  test('REJECTS listPrice given as a bare JS number (decStr is string-only, D-09)', () => {
    expect(() =>
      parseListing({ ...VALID_LISTING, listPrice: 850000 as unknown as string }),
    ).toThrow();
  });

  test('REJECTS a non-canonical listPrice string (thousands separator)', () => {
    expect(() => parseListing({ ...VALID_LISTING, listPrice: '850,000' })).toThrow();
  });

  test('REJECTS a non-canonical baths string (half-baths are decStr too)', () => {
    expect(() => parseListing({ ...VALID_LISTING, baths: '2,5' })).toThrow();
  });

  describe('counts are positive/non-negative integers', () => {
    test('non-integer beds throws', () => {
      expect(() => parseListing({ ...VALID_LISTING, beds: 3.5 })).toThrow();
    });
    test('negative beds throws', () => {
      expect(() => parseListing({ ...VALID_LISTING, beds: -1 })).toThrow();
    });
    test('zero livingSqft throws (positive)', () => {
      expect(() => parseListing({ ...VALID_LISTING, livingSqft: 0 })).toThrow();
    });
  });

  test('REJECTS an unknown property type (closed enum)', () => {
    expect(() => parseListing({ ...VALID_LISTING, propertyType: 'castle' })).toThrow();
  });

  test('REJECTS an empty address / town (.min(1))', () => {
    expect(() => parseListing({ ...VALID_LISTING, address: '' })).toThrow();
    expect(() => parseListing({ ...VALID_LISTING, town: '' })).toThrow();
  });

  test('REJECTS an unknown extra key (.strict())', () => {
    expect(() => parseListing({ ...VALID_LISTING, smuggledField: 'evil' })).toThrow();
  });

  test('ListingSchema is .strict() (rejects unknown keys directly)', () => {
    expect(ListingSchema.safeParse({ ...VALID_LISTING, extra: 1 }).success).toBe(false);
  });

  test('REJECTS a missing required field', () => {
    const { listPrice, ...missing } = VALID_LISTING;
    void listPrice;
    expect(() => parseListing(missing)).toThrow();
  });
});
