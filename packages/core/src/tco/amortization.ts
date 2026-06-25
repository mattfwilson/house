// Fixed-rate amortization schedule (TCO-01) — the first existential correctness core of
// the TCO engine (Pitfall 2).
//
// DESIGN INVARIANTS (proven by exact-equality tests, never `toBeCloseTo`):
//   - The principal split over every period sums to the original loan EXACTLY.
//   - The final balance lands on EXACTLY $0.00, forced by a RECONCILED final payment
//     (the last period's principal IS the remaining balance, so any accumulated penny of
//     per-period rounding drift is absorbed there — the textbook amortization fix).
//   - The scheduled payment agrees with an external oracle on a non-round rate.
//
// MONEY/Dec DISCIPLINE (the canary.ts precedent, D-03 / CORE-02):
//   - All rate / power / division math happens in the frozen `Dec` clone (34-digit,
//     HALF_EVEN). The monthly rate is kept at FULL precision — it is NEVER rounded.
//   - Dollars cross into `Money` only via `Money.of(d.toFixed())` — `.toFixed()` (NOT
//     `.toString()`, which can emit exponent form that `CANONICAL_DECIMAL_RE` rejects).
//   - The closed `Money` API is not widened. `Money` rounds only at `toCents()`, so to
//     pin each period's dollar split to whole cents we round in `Dec` (HALF_EVEN, 2dp)
//     and reconstruct the `Money` from that 2-decimal string — the per-period rounding
//     cadence (Open Question 2): RATE full-precision, each period's split rounded to cents.
import { Dec } from '../money/decimal-config.js';
import { Money } from '../money/money.js';

/** One amortization period: the interest/principal split and the balance after it. */
export interface AmortizationRow {
  readonly period: number;
  readonly interest: Money;
  readonly principal: Money;
  readonly balance: Money;
}

/** A full fixed-rate amortization schedule: the scheduled payment + one row per period. */
export interface AmortizationSchedule {
  readonly payment: Money;
  readonly rows: readonly AmortizationRow[];
}

/**
 * The monthly periodic rate under the US-standard nominal-annual / 12 convention
 * (NOT an effective-rate de-compounding). Kept at FULL `Dec` precision — the caller must
 * never round it; rounding the rate is the classic source of cent drift over 360 periods.
 */
function monthlyRate(annualRate: string): InstanceType<typeof Dec> {
  return new Dec(annualRate).div(12);
}

/** Round a `Dec` to whole cents (2dp) using the clone's banker's rounding (HALF_EVEN). */
function toCentsDec(d: InstanceType<typeof Dec>): InstanceType<typeof Dec> {
  return d.toDecimalPlaces(2, Dec.ROUND_HALF_EVEN);
}

/**
 * The scheduled (level) monthly payment for a fully-amortizing fixed-rate loan, via the
 * closed form M = P·r·(1+r)^n / ((1+r)^n − 1), computed entirely in `Dec` and surfaced as
 * `Money`. Full precision is retained through the whole expression; the result is the
 * un-rounded payment (its cents are pinned by the caller / `toCents()` at the boundary).
 */
export function scheduledPayment(loan: string, annualRate: string, termMonths: number): Money {
  const r = monthlyRate(annualRate);
  const pow = new Dec(1).plus(r).pow(termMonths);
  const m = new Dec(loan).times(r).times(pow).div(pow.minus(1));
  return Money.of(m.toFixed());
}

/**
 * Build the full amortization schedule. Each period:
 *   - interest = balance · monthlyRate (FULL-precision rate), rounded to cents;
 *   - principal = payment − interest, rounded to cents;
 *   - balance  = balance − principal, rounded to cents.
 * The FINAL period is reconciled: its principal is exactly the remaining balance, its
 * interest is computed on that balance, and the resulting balance is exactly $0.00 —
 * absorbing any accumulated rounding drift (Pitfall 2). The scheduled `payment` is the
 * un-reconciled level payment; the final row's effective payment therefore differs.
 */
export function amortizationSchedule(
  loan: string,
  annualRate: string,
  termMonths: number,
): AmortizationSchedule {
  const r = monthlyRate(annualRate);
  // Pin the level payment to cents once, so the per-period split uses the same cents the
  // borrower actually pays (and the reconciled tail is the only deviation).
  const paymentDec = toCentsDec(
    new Dec(loan)
      .times(r)
      .times(new Dec(1).plus(r).pow(termMonths))
      .div(new Dec(1).plus(r).pow(termMonths).minus(1)),
  );
  const payment = Money.of(paymentDec.toFixed());

  const rows: AmortizationRow[] = [];
  let balance = toCentsDec(new Dec(loan));

  for (let period = 1; period <= termMonths; period++) {
    if (period < termMonths) {
      const interest = toCentsDec(balance.times(r));
      const principal = toCentsDec(paymentDec.minus(interest));
      balance = toCentsDec(balance.minus(principal));
      rows.push({
        period,
        interest: Money.of(interest.toFixed()),
        principal: Money.of(principal.toFixed()),
        balance: Money.of(balance.toFixed()),
      });
    } else {
      // RECONCILED final period: principal IS the remaining balance → balance hits $0.00.
      const interest = toCentsDec(balance.times(r));
      const principal = balance; // already cents-pinned
      rows.push({
        period,
        interest: Money.of(interest.toFixed()),
        principal: Money.of(principal.toFixed()),
        balance: Money.zero(),
      });
      balance = new Dec(0);
    }
  }

  return { payment, rows };
}
