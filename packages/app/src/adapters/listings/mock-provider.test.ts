// MockListingsProvider contract test — exercises the FULL `ListingsProvider` port end to end
// (LIST-01/LIST-02) against the hand-seeded `LISTING_FIXTURES`: the no-filter pass-through, the
// town filter, the INCLUSIVE price-range boundary, the ANDed town+price filter, and the
// id hit/miss. Plus a `parseListing` sweep proving every fixture is contract-valid (T-06-10).
//
// Plain `expect(...)` assertions only (the project's golden discipline) — never `toMatchSnapshot`.
// The describe/test names include "listings" so `npx vitest run -t listings` selects them.
import { describe, it, expect } from 'vitest';
import { parseListing } from '@house/core';
import { LISTING_FIXTURES } from './fixtures.js';
import { MockListingsProvider } from './mock-provider.js';

const provider = new MockListingsProvider(LISTING_FIXTURES);

describe('MockListingsProvider — listings port contract', () => {
  it('getListings({}) returns ALL fixtures (empty query = no filter)', () => {
    expect(provider.getListings({})).toHaveLength(LISTING_FIXTURES.length);
    expect(provider.getListings({})).toEqual(LISTING_FIXTURES);
  });

  it('getListings({ town }) returns only that town (Newton has exactly two)', () => {
    const newton = provider.getListings({ town: 'Newton' });
    expect(newton.map((l) => l.id).sort()).toEqual(['lst-newton-001', 'lst-newton-002']);
    expect(newton.every((l) => l.town === 'Newton')).toBe(true);
  });

  it('getListings({ town }) returns [] for a town with no listings', () => {
    expect(provider.getListings({ town: 'Wellesley' })).toEqual([]);
  });

  it('getListings({ minPrice, maxPrice }) is INCLUSIVE at both boundaries', () => {
    // Melrose sits EXACTLY on minPrice (700000); Newton-002 EXACTLY on maxPrice (875000).
    // Both must be INCLUDED; Quincy (625000, below) and everything above 875000 EXCLUDED.
    const ids = provider
      .getListings({ minPrice: '700000', maxPrice: '875000' })
      .map((l) => l.id)
      .sort();
    expect(ids).toEqual([
      'lst-arlington-001', // 850000
      'lst-boston-001', // 749000
      'lst-melrose-001', // 700000 — exact min boundary, INCLUDED
      'lst-newton-002', // 875000 — exact max boundary, INCLUDED
    ]);
    // Boundary fixtures explicitly present; below-min fixture explicitly absent.
    expect(ids).toContain('lst-melrose-001');
    expect(ids).toContain('lst-newton-002');
    expect(ids).not.toContain('lst-quincy-001');
  });

  it('getListings({ minPrice }) excludes a listing one cent below the bound (decimal-safe)', () => {
    // minPrice 700000.01 must DROP Melrose (700000.00) — proves cent-precise comparison.
    const ids = provider.getListings({ minPrice: '700000.01' }).map((l) => l.id);
    expect(ids).not.toContain('lst-melrose-001');
  });

  it('getListings({ town, minPrice }) applies BOTH filters (AND)', () => {
    // Newton + minPrice 1000000 keeps only Newton-001 (1450000), drops Newton-002 (875000).
    const ids = provider.getListings({ town: 'Newton', minPrice: '1000000' }).map((l) => l.id);
    expect(ids).toEqual(['lst-newton-001']);
  });

  it('getListingById returns the listing on a HIT', () => {
    const hit = provider.getListingById('lst-cambridge-001');
    expect(hit).not.toBeNull();
    expect(hit?.town).toBe('Cambridge');
    expect(hit?.listPrice).toBe('1250000');
  });

  it('getListingById returns null on a MISS', () => {
    expect(provider.getListingById('nope')).toBeNull();
  });

  it('every fixture is contract-valid (survives parseListing — T-06-10)', () => {
    for (const listing of LISTING_FIXTURES) {
      expect(() => parseListing(listing)).not.toThrow();
      expect(parseListing(listing)).toEqual(listing);
    }
  });

  it('returned listings are FROZEN — a mutation cannot corrupt the shared fixture singleton', () => {
    const [first] = provider.getListings({});
    expect(Object.isFrozen(first)).toBe(true);
    // A mutation must not silently take effect (frozen object); the singleton stays intact.
    expect(() => {
      (first as { town: string }).town = 'Mutated';
    }).toThrow(TypeError);
    expect(provider.getListings({})[0]!.town).toBe(first!.town);
  });
});
