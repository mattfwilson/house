// Closing costs (TCO-05, D-11/D-12/D-13) — the one-time transaction costs at purchase, plus a
// generic other-one-time-costs line:
//   - CLOSING COSTS default to `price × closing.rateOfPrice`, but a per-scenario DOLLAR
//     override wins when supplied (D-12). The override is the actual figure from a Loan
//     Estimate / Closing Disclosure when the user has one.
//   - AMORTIZATION (`amortizeOverHold`) spreads a lump over the holding horizon for the
//     per-month / per-year BREAKDOWN only (D-11): annual = lump / holdingYears,
//     monthly = lump / (holdingYears × 12). The division happens in `Dec` (the closed `Money`
//     API has no div), with each result rounded at its own `Money` boundary via `.toFixed()`.
//   - SEMANTICS NOTE (D-13): in the two-portfolio net-worth model (Plan 05), closing costs and
//     any other one-time costs are a t=0 LUMP regardless of this amortization. The amortized
//     monthly/annual figures exist purely so the TCO breakdown can show a smoothed line; they
//     are NOT how the costs enter the FI-impact projection. `amortizeOverHold` is reversible to
//     the lump within cent rounding (monthly × holdingYears × 12 ≈ lump).
//
// Dec/Money discipline (the canary.ts precedent, D-03 / CORE-02): every division is in `Dec`,
// never a bare-number divide; dollars cross into `Money` only via `Money.of(d.toFixed())` and
// `Money.mul(rateStr)`.
import { Dec } from '../money/decimal-config.js';
import { Money } from '../money/money.js';

/** A lump amortized over the hold: the per-year and per-month smoothed figures (both Money). */
export interface AmortizedOverHold {
  readonly annual: Money;
  readonly monthly: Money;
}

/**
 * The one-time closing cost: a per-scenario dollar `override` when supplied, otherwise
 * `price × rateOfPrice` (D-12). The override is taken verbatim (the user's actual figure);
 * the %-of-price path is a `Money.mul` by the dimensionless rate string.
 */
export function closingCosts(price: string, rateOfPrice: string, override?: string): Money {
  if (override !== undefined) {
    return Money.of(override);
  }
  return Money.of(price).mul(rateOfPrice);
}

/**
 * Amortize a one-time lump over the holding horizon for the BREAKDOWN (D-11):
 *   - annual  = lump / holdingYears
 *   - monthly = lump / (holdingYears × 12)
 * The divisions are done in `Dec` (Money has no div), and each result is rounded at its own
 * `Money` boundary. This is purely a smoothed display figure: in the net-worth model the lump
 * stays a t=0 cost (D-13). Reversible within cent rounding: monthly × holdingYears × 12 ≈ lump.
 */
export function amortizeOverHold(amount: Money, holdingYears: number): AmortizedOverHold {
  const lump = new Dec(amount.toDecimalString());
  const annual = lump.div(holdingYears);
  const monthly = lump.div(holdingYears * 12);
  return {
    annual: Money.of(annual.toFixed()),
    monthly: Money.of(monthly.toFixed()),
  };
}

/**
 * A generic one-time cost (e.g. moving, immediate repairs) that the user supplies as a dollar
 * figure. Thin lift into `Money`. Plan 04 folds it into the breakdown (amortizable for display)
 * and Plan 05 treats it — like closing costs — as a t=0 lump in the net-worth model (D-13).
 */
export function otherOneTimeCosts(amount: string): Money {
  return Money.of(amount);
}
