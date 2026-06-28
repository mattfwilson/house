// Listing — the Boston-home model the `ListingsProvider` port returns (LIST-01). This is the
// only domain type crossing the walled-off listings boundary: a persisted/forged listing blob
// becomes a trusted `Listing` ONLY through `parseListing` (T-06-01/T-06-02). It mirrors the
// `ScenarioInputs` interface + Schema + parse triad (engine-input.ts:28-105):
//   - every MONEY field (`listPrice`, `baths`) is a canonical decimal STRING (`decStr`), never
//     `z.number()` — a JS float can never enter at this boundary (D-09 / CORE-02).
//   - `beds` / `livingSqft` are bare integers (they are COUNTS, not money).
//   - `.strict()` rejects unknown keys, so a forged listing can't smuggle extra fields.
import { z } from 'zod';
import { decStr } from '../assumptions/schema.js';

/**
 * The closed set of Boston-home property types. A closed union (not a free string) so a forged
 * `propertyType` is rejected at the boundary and downstream UI can switch exhaustively.
 */
const PROPERTY_TYPES = ['single-family', 'condo', 'multi-family', 'townhouse'] as const;

/**
 * A single listing — the Boston-home shape (D-09). Dollar fields cross as canonical decimal
 * strings (the same convention `Money.of` consumes); `town` aligns with the curated
 * mill-rate town table where sensible (resolved by name downstream).
 */
export interface Listing {
  /** Stable listing id. */
  readonly id: string;
  /** Street address (e.g. "12 Walnut St"). */
  readonly address: string;
  /** Town name — aligned with the seeded mill-rate town table where sensible (D-09). */
  readonly town: string;
  /** List price, dollar string (e.g. "850000") — `decStr`, never a bare number (D-09). */
  readonly listPrice: string;
  /** Bedroom count (a count, bare integer). */
  readonly beds: number;
  /** Bathroom count incl. half-baths (e.g. "2.5"), so a decimal STRING — `decStr`, not a number. */
  readonly baths: string;
  /** Living area in square feet (a count, positive integer). */
  readonly livingSqft: number;
  /** Property type (closed Boston-home set). */
  readonly propertyType: (typeof PROPERTY_TYPES)[number];
}

/**
 * ListingSchema — the Zod 4 runtime mirror of `Listing` and the listings trust boundary
 * (T-06-01/02), mirroring `ScenarioInputsSchema`: money leaves are `decStr` (never `z.number()`),
 * counts are positive/non-negative integers, `propertyType` is the closed enum, and `.strict()`
 * rejects unknown keys.
 */
export const ListingSchema = z
  .object({
    id: z.string().min(1),
    address: z.string().min(1),
    town: z.string().min(1),
    listPrice: decStr,
    beds: z.number().int().nonnegative(),
    baths: decStr,
    livingSqft: z.number().int().positive(),
    propertyType: z.enum(PROPERTY_TYPES),
  })
  .strict();

/**
 * Validate untrusted data into a trusted `Listing`. Throws (with a Zod error) on any
 * forged/corrupt listing — a bare-number or non-canonical money string, a non-integer count, an
 * unknown property type, an unknown extra key, or a missing required field. The
 * `ListingsProvider` adapter MUST go through this; never spread raw JSON into the calc (mirrors
 * `parseScenarioInputs`).
 */
export function parseListing(input: unknown): Listing {
  return ListingSchema.parse(input) as Listing;
}
