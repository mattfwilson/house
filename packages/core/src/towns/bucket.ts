// bucket — the budget overlay: realistic / stretch / fantasy via integer-cent compare (TOWN-02, D-12).
//
// PURE. The SECOND, SEPARATE scoring channel (D-12 two-channel separation): a town's median price is
// bucketed against the user's budget, INDEPENDENT of the composite — `bucketOf` never reads the score.
// Comparison is EXACT integer cents via `Money.toCents()` bigint (`money.ts:77`), never `Number()` on a
// dollar value (Pitfall 6 — float re-entry); so the boundary cents are unambiguous. The stretch ceiling
// is `budget × stretchFactor` via `Money.mul` (the only sanctioned dollar×rate primitive, `money.ts:63`).
// Lower boundaries are INCLUSIVE (≤): a price exactly at budget is realistic, exactly at the stretch
// ceiling is stretch.
//
// Missing-price handling lives in the CALLER (Plan 05-04 surfaces `bucket: Bucket | null`, null = no
// median-price data → the UI-SPEC hatched "No data" state). `bucketOf` itself always takes a present
// `Money` price and returns one of the three locked enum values — no copy, no color (Phase 7 owns those).
import { Money } from '../money/money.js';

/** The three locked affordability buckets (enum identifiers only — no UI copy, D-05 precedent). */
export type Bucket = 'realistic' | 'stretch' | 'fantasy';

/**
 * Bucket a town's `medianPrice` against `budget` (realistic ceiling) and `budget × stretchFactor`
 * (stretch ceiling). Compares EXACT integer cents (`toCents()` bigint), so the boundary cents never
 * suffer float/epsilon ambiguity. Lower boundaries inclusive (≤). Independent of the composite (D-12).
 */
export function bucketOf(medianPrice: Money, budget: Money, stretchFactor: string): Bucket {
  const price = medianPrice.toCents();
  const realisticCeil = budget.toCents();
  const stretchCeil = budget.mul(stretchFactor).toCents();
  if (price <= realisticCeil) return 'realistic';
  if (price <= stretchCeil) return 'stretch';
  return 'fantasy';
}
