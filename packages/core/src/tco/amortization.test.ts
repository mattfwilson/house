// Amortization invariant + oracle tests (TCO-01 / SC1, Pitfall 2).
//
// These are EXACT-EQUALITY proofs — never `toBeCloseTo`. The amortization schedule's
// existential correctness properties are:
//   - the principal split over every period sums to the original loan EXACTLY,
//   - the final balance lands on EXACTLY $0.00 (forced via a reconciled final payment),
//   - the scheduled payment + month-1 split agree with an external oracle on a non-round
//     rate ($400k / 6.375% / 360mo), and
//   - the interest cross-check sum(interest) === sum(payment) - loan holds to the cent.
// Dollar assertions go through the public Money surface (toCents bigint / toDecimalString),
// matching the canary precedent.
import { describe, test, expect } from 'vitest';
import { Money } from '../money/money.js';
import { scheduledPayment, amortizationSchedule } from './amortization.js';

// The verified external-oracle case (RESEARCH §"External Oracle for SC1").
const LOAN = '400000';
const RATE = '0.06375';
const TERM = 360;

describe('scheduledPayment agrees with the external oracle on a non-round rate', () => {
  test('$400,000 / 6.375% / 360mo rounds to $2,495.48', () => {
    const m = scheduledPayment(LOAN, RATE, TERM);
    expect(m).toBeInstanceOf(Money);
    // Round to cents via toCents (exact integer bigint) — 2495.48 == 249548 cents.
    expect(m.toCents()).toBe(249548n);
  });
});

describe('amortizationSchedule produces a full, exactly-reconciled schedule', () => {
  const schedule = amortizationSchedule(LOAN, RATE, TERM);

  test('the schedule has one row per term month', () => {
    expect(schedule.rows.length).toBe(TERM);
  });

  test('every row carries Money values', () => {
    for (const row of schedule.rows) {
      expect(row.interest).toBeInstanceOf(Money);
      expect(row.principal).toBeInstanceOf(Money);
      expect(row.balance).toBeInstanceOf(Money);
    }
    expect(schedule.payment).toBeInstanceOf(Money);
  });

  test('month 1 agrees with the oracle: interest $2,125.00, principal $370.48', () => {
    const first = schedule.rows[0];
    expect(first.period).toBe(1);
    expect(first.interest.toCents()).toBe(212500n);
    expect(first.principal.toCents()).toBe(37048n);
  });

  test('the principal split sums to the original loan EXACTLY', () => {
    const sumCents = schedule.rows.reduce((acc, r) => acc + r.principal.toCents(), 0n);
    expect(sumCents).toBe(Money.of(LOAN).toCents());
  });

  test('the final balance is EXACTLY $0.00', () => {
    const last = schedule.rows[TERM - 1];
    expect(last.period).toBe(TERM);
    expect(last.balance.toCents()).toBe(0n);
  });

  test('the final payment is reconciled — it differs from a normal payment', () => {
    const last = schedule.rows[TERM - 1];
    const finalPaymentCents = last.interest.toCents() + last.principal.toCents();
    const normalCents = schedule.payment.toCents();
    expect(finalPaymentCents).not.toBe(normalCents);
    // Pin the exact reconciled final payment derived under the project's HALF_EVEN Dec.
    expect(finalPaymentCents).toBe(249485n); // $2,494.85
  });

  test('interest cross-check: sum(interest) === sum(payment) - loan (exact cents)', () => {
    const sumInterest = schedule.rows.reduce((acc, r) => acc + r.interest.toCents(), 0n);
    const sumPayment = schedule.rows.reduce(
      (acc, r) => acc + (r.interest.toCents() + r.principal.toCents()),
      0n,
    );
    expect(sumInterest).toBe(sumPayment - Money.of(LOAN).toCents());
  });
});

// CR-02 (BLOCKER): a zero nominal rate must amortize STRAIGHT-LINE, never divide by zero
// (the closed-form M = P·r·(1+r)^n / ((1+r)^n − 1) is 0/0 at r=0). The level payment degrades
// to loan/termMonths, each period's interest is $0.00, and the schedule still reconciles to a
// final balance of EXACTLY $0.00 with the principal sum EXACTLY the original loan.
describe('CR-02: zero-rate loans amortize straight-line (no divide-by-zero)', () => {
  test('scheduledPayment($400,000 / 0% / 360mo) === loan/termMonths straight-line $1,111.11', () => {
    const m = scheduledPayment('400000', '0', 360);
    expect(m).toBeInstanceOf(Money);
    // 400000 / 360 = 1111.1111... -> HALF_EVEN at the cent boundary = $1,111.11 = 111111 cents.
    expect(m.toCents()).toBe(111111n);
  });

  test('amortizationSchedule($360,000 / 0% / 360mo): $0.00 final balance, exact loan sum, $0 interest', () => {
    const schedule = amortizationSchedule('360000', '0', 360);
    expect(schedule.rows.length).toBe(360);
    // Final balance is EXACTLY $0.00 (reconciled).
    expect(schedule.rows[359]!.balance.toCents()).toBe(0n);
    // Principal split sums to the original loan EXACTLY.
    const sumCents = schedule.rows.reduce((acc, r) => acc + r.principal.toCents(), 0n);
    expect(sumCents).toBe(Money.of('360000').toCents());
    // Every period's interest is $0.00 (zero rate) — checked on the first and a mid period.
    expect(schedule.rows[0]!.interest.toCents()).toBe(0n);
    expect(schedule.rows[180]!.interest.toCents()).toBe(0n);
    // Straight-line principal: 360000/360 = $1,000.00 per period (non-final periods).
    expect(schedule.rows[0]!.principal.toCents()).toBe(100000n);
    expect(schedule.rows[180]!.principal.toCents()).toBe(100000n);
  });
});
