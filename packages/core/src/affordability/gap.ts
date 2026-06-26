// affordabilityGap — the GAP composer (AFF-03), the product's HEADLINE instrument. It answers the
// question the whole tool exists for: "the bank will lend us $X BEYOND what our FI tolerance
// actually allows." It composes the two ceilings produced by Plans 02 and 03:
//
//   - `bankAffordability` (AFF-01): the largest PRICE the bank approves under the lower DTI ceiling.
//   - `trueAffordability` (AFF-02): the largest PRICE our savings goal + cash on hand actually allow.
//
// and reports their SIGNED gap and a DIRECTIONAL verdict (D-12/D-13):
//
//   signedGap = bankMaxPrice − trueMaxPrice   (Money; positive ⇒ the bank over-lends, the anti-
//                                               funnel direction this tool exists to surface)
//
//   verdict ∈ { 'bankExceedsTrue' | 'trueExceedsBank' | 'aligned' }   (a STRUCTURED enum — NO UI
//                                               copy; Phase 7 owns the wording, D-13)
//
// THE VERDICT RULE (cent-exact, mirroring rent-vs-buy's `winner` derivation — both maxima compared
// on `toCents()` bigints, never float dollars):
//   - |bankCents − trueCents| <= ALIGNED_TOLERANCE_CENTS  ⇒  'aligned'
//   - bankCents − trueCents  >  ALIGNED_TOLERANCE_CENTS    ⇒  'bankExceedsTrue'  (anti-funnel)
//   - otherwise                                            ⇒  'trueExceedsBank'  (cash-rich)
//
// The `aligned` band is an absolute $1,000 tolerance (A2): two ceilings within $1k of each other
// are not a meaningful divergence to act on. The tolerance is a DOCUMENTED, exported constant so a
// test can pin it and a reviewer can see the rule (it is NOT a hidden magic number).
//
// Dec/Money discipline: this composer does NO new dollar math beyond the `Money.sub` for the
// signedGap and the `Money.toCents()` bigint comparison for the verdict — both sub-results are
// already cent-pinned Money from their solvers. `Dec` is not touched here. CORE-02 holds: every
// dollar field on the result is `Money`.
import { Money } from '../money/money.js';
import type { EngineInput } from '../engine/engine-input.js';
import { bankAffordability, type BindingRatio } from './bank-affordability.js';
import { trueAffordability, type BindingConstraint } from './true-affordability.js';

/**
 * The directional gap verdict (D-13), compared on max PRICE:
 *   - `bankExceedsTrue` — the bank approves a price ABOVE the FI-tolerance ceiling (the anti-funnel
 *     direction; the common, headline case this tool exists to surface, Pitfall 6).
 *   - `trueExceedsBank` — the household can truly afford MORE than the bank will lend (cash-rich).
 *   - `aligned` — the two ceilings are within the documented absolute tolerance of each other.
 * A structured enum, NEVER UI copy — Phase 7 owns the wording (D-13).
 */
export type AffordabilityVerdict = 'bankExceedsTrue' | 'trueExceedsBank' | 'aligned';

/**
 * The `aligned` tolerance (A2): an absolute $1,000, expressed in INTEGER CENTS so the verdict is
 * decided entirely on `Money.toCents()` bigints (cent-exact, float-free — the rent-vs-buy `winner`
 * precedent). Two ceilings whose max prices sit within $1,000 of each other are reported as
 * `aligned` rather than a directional divergence. Exported so a test pins it and the rule is
 * reviewable (T-03-07 — the tolerance is documented data, not a buried constant).
 */
export const ALIGNED_TOLERANCE_CENTS = 100000n;

/** The closed GAP result (AFF-03). All dollars are `Money`; the verdict + binding fields are enums. */
export interface AffordabilityGapResult {
  /** The bank's max approvable price (AFF-01) — the reference ceiling. */
  readonly bankMaxPrice: Money;
  /** The TRUE max price (AFF-02) — the honest ceiling the product leads with. */
  readonly trueMaxPrice: Money;
  /** `bankMaxPrice − trueMaxPrice` (Money). Positive ⇒ the bank over-lends (anti-funnel). */
  readonly signedGap: Money;
  /** Which DTI ceiling bound the BANK solve (carried from the bank result, D-12). */
  readonly bankBindingRatio: BindingRatio;
  /** Which ceiling bound the TRUE solve (carried from the true result, D-12). */
  readonly trueBindingConstraint: BindingConstraint;
  /** The directional verdict, decided cent-exactly on max price against the aligned tolerance. */
  readonly verdict: AffordabilityVerdict;
}

/**
 * Compose the bank + true ceilings into the directional GAP (AFF-03).
 *
 * Requires `input.household` — a gap qualifies a borrower against their own FI goals, not a bare
 * house (throws a clear error if absent; the underlying solvers also require it, so this guards the
 * message at the headline entry point). Runs `bankAffordability` and `trueAffordability` ONCE each,
 * computes `signedGap = bankMaxPrice − trueMaxPrice`, and picks the verdict by comparing the two
 * max PRICES on `toCents()` bigints against `ALIGNED_TOLERANCE_CENTS`.
 */
export function affordabilityGap(input: EngineInput): AffordabilityGapResult {
  if (input.household === undefined) {
    throw new Error(
      'affordabilityGap requires input.household — the gap measures what the bank will lend ' +
        'against what your FI tolerance allows, both of which qualify a borrower. Build the ' +
        'EngineInput with a household block.',
    );
  }

  const bank = bankAffordability(input);
  const tru = trueAffordability(input);

  const signedGap = bank.bankMaxPrice.sub(tru.trueMaxPrice);

  // Verdict on max PRICE, cent-exact (mirrors rent-vs-buy's bigint-cent `winner`). The difference
  // is taken on the two ceilings' integer cents so float dollars never decide the direction.
  const diffCents = bank.bankMaxPrice.toCents() - tru.trueMaxPrice.toCents();
  const verdict: AffordabilityVerdict =
    diffCents > ALIGNED_TOLERANCE_CENTS
      ? 'bankExceedsTrue'
      : diffCents < -ALIGNED_TOLERANCE_CENTS
        ? 'trueExceedsBank'
        : 'aligned';

  return {
    bankMaxPrice: bank.bankMaxPrice,
    trueMaxPrice: tru.trueMaxPrice,
    signedGap,
    bankBindingRatio: bank.bindingRatio,
    trueBindingConstraint: tru.bindingConstraint,
    verdict,
  };
}
