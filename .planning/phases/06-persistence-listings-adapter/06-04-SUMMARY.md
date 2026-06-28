---
phase: 06-persistence-listings-adapter
plan: 04
subsystem: listings-adapter
tags: [listings-provider, mock-adapter, fixtures, decimal-money, ports-and-adapters, dependency-inversion]

# Dependency graph
requires:
  - phase: 06-persistence-listings-adapter
    provides: "ListingsProvider + ListingsQuery sync port, Listing type + parseListing (06-01)"
  - phase: 01-foundation
    provides: "Money (decimal-precise, toCents bigint) for float-free price comparison"
provides:
  - "MockListingsProvider — the only ListingsProvider implementation (LIST-02), an in-memory filter over static fixtures"
  - "LISTING_FIXTURES — readonly Listing[], 10 hand-seeded greater-Boston listings (canonical decimal-string money)"
  - "Full ListingsProvider contract test (filter hits/misses, inclusive price boundary, id hit/miss, parseListing sweep)"
affects: [06-06]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Concrete adapter behind the core port: MockListingsProvider implements ListingsProvider; consumers see only the port (D-03), swap to RealListingsProvider is a one-line container change"
    - "Static fixtures as the TOWN_RATE_TABLE idiom: readonly Listing[] literal, pure data, money as canonical decimal-string literals (D-09)"
    - "Decimal-safe filtering: price-range comparison via Money.of(s).toCents() bigint, never a bare-number coercion (CORE-02 / T-06-09)"

key-files:
  created:
    - packages/app/src/adapters/listings/fixtures.ts
    - packages/app/src/adapters/listings/mock-provider.ts
    - packages/app/src/adapters/listings/mock-provider.test.ts
  modified: []

key-decisions:
  - "Price-range filtering compares via Money.toCents() bigints (Money exposes no lessThan/greaterThan), keeping it cent-exact and float-free — verified by a one-cent-below exclusion test"
  - "10 fixtures across 9 curated towns + all four property types, with prices chosen to land exactly on the [min,max] filter boundaries the test asserts (Melrose 700000 = min, Newton-002 875000 = max)"
  - "Comments reworded to avoid the literal `Number(` token so the grep source-grounding gate (0 hits in mock-provider.ts) holds against prose as well as code"

requirements-completed: [LIST-01, LIST-02]

# Metrics
duration: 3min
completed: 2026-06-28
---

# Phase 6 Plan 04: MockListingsProvider over Hand-Seeded Fixtures Summary

**The only `ListingsProvider` implementation this build ships — `MockListingsProvider`, an in-memory filter over 10 hand-seeded greater-Boston `LISTING_FIXTURES` — exercised end to end through the core port: town + inclusive price-range filtering (compared cent-exact via `Money.toCents()`, never a float) and `getListingById` hit/null-miss, with every fixture proven contract-valid through `parseListing`.**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-06-28T03:01:58Z
- **Completed:** 2026-06-28T03:04Z
- **Tasks:** 2
- **Files modified:** 3 (3 created)

## Accomplishments
- `fixtures.ts`: `LISTING_FIXTURES: readonly Listing[]` — 10 listings spanning 9 curated towns (Boston, Cambridge, Newton ×2, Brookline, Quincy, Medford, Arlington, Belmont, Melrose) and all four property types, every `listPrice`/`baths` a canonical decimal STRING literal (the `TOWN_RATE_TABLE` pure-data idiom). Prices straddle the price-range filter boundaries.
- `mock-provider.ts`: `MockListingsProvider implements ListingsProvider` over a `readonly Listing[]` ctor arg. `getListings` ANDs an exact `town` match with INCLUSIVE `minPrice`/`maxPrice` bounds, comparing through `Money.of(s).toCents()` bigints — no bare-number coercion (CORE-02 / T-06-09). `getListingById` returns the hit or `null`.
- `mock-provider.test.ts`: 9 contract tests — no-filter pass-through, town filter (+empty-town case), inclusive price boundary (exact min Melrose / exact max Newton-002 both included, below-min Quincy excluded), a one-cent-below exclusion proving cent-precise comparison, ANDed town+price, `getListingById` hit + null miss, and a `parseListing` sweep over all fixtures (T-06-10).
- App suite green at 11 tests (9 new + 2 prior migration tests); `tsc -b` clean.

## Task Commits

1. **Task 1: Hand-seeded fixtures + MockListingsProvider** — `dc77364` (feat)
2. **Task 2: MockListingsProvider contract test** — `5f33fcd` (test)

## Files Created/Modified
- `packages/app/src/adapters/listings/fixtures.ts` — `LISTING_FIXTURES` readonly literal array
- `packages/app/src/adapters/listings/mock-provider.ts` — `MockListingsProvider` (implements `ListingsProvider`, decimal-safe filtering)
- `packages/app/src/adapters/listings/mock-provider.test.ts` — full port contract test (9 tests)

## Decisions Made
- **Price comparison via `Money.toCents()` bigints.** `Money` exposes no `lessThan`/`greaterThan`, so the comparator reduces both dollar strings to exact integer cents and compares those — cent-exact and provably float-free (a `minPrice: '700000.01'` test drops a `700000` fixture).
- **Fixture prices engineered to sit on the filter boundaries.** Melrose `700000` is an exact `minPrice` edge and Newton-002 `875000` an exact `maxPrice` edge, so the inclusive-boundary acceptance criterion is asserted against real data, not contrived.
- **Comment wording avoids the literal `Number(` token.** The plan's source-grounding gate greps `Number(` to 0 in `mock-provider.ts`; explanatory prose was phrased as "bare-number coercion" / "float coercion" so the gate holds (same housekeeping discipline as 06-01).

## Deviations from Plan
None — plan executed as written. The only adjustment was rewording two doc comments to keep the literal `Number(` token out of `mock-provider.ts` (the grep source-grounding gate is literal); no behavior, type, or export changed. Task 2 carries `tdd="true"`; because Task 1 deliberately builds the implementation first (the plan splits impl/test across tasks), the contract test was authored against the existing provider and passed green on first run rather than starting from a RED failure — appropriate for an after-the-fact contract test, and config `tdd_mode` is `false` (no plan-level RED/GREEN gate).

## Threat Surface
- T-06-09 (float re-entry at the price filter) — mitigated: comparison goes through `Money.toCents()`, asserted by a cent-precise exclusion test and the 0-hit `Number(` grep gate.
- T-06-10 (forged/invalid fixture served silently) — mitigated: the `parseListing` sweep proves every fixture honors the core Zod boundary.
- No new threat surface introduced: the provider returns static in-memory fixtures with zero I/O or network (T-06-11 accept).

## Issues Encountered
The grep source-grounding gate flagged 2 `Number(` hits — both inside explanatory comments, not code. Reworded the prose; gate now 0. No functional impact.

## User Setup Required
None.

## Next Phase Readiness
- `MockListingsProvider` is ready to be wired into the DI container in 06-06 (the only other file permitted to name the concrete class — D-03); consumers depend on the `ListingsProvider` port.
- No blockers. LIST-01/LIST-02 satisfied: the listings port is proven adapter-agnostic and exercised end to end over static fixtures.

---
*Phase: 06-persistence-listings-adapter*
*Completed: 2026-06-28*

## Self-Check: PASSED

All 3 created files verified present on disk; both task commits (dc77364, 5f33fcd) verified in git history.
