// PMI invariant + toggle tests (TCO-04 / SC3, Pitfall 3).
//
// PMI correctness rests on three things this suite proves by exact equality:
//   - it APPLIES only when the down payment is < 20% (origination LTV > 80%);
//   - the monthly premium is (loan · annualRateOfLoan) / 12 to the cent;
//   - drop-off is measured against the CONSTANT ORIGINAL value and the SCHEDULED balance,
//     with "auto-78" (78% LTV automatic) and "requested-80" (80% LTV borrower-requested)
//     producing DIFFERENT drop-off months on the same loan (requested earlier).
// Appreciation-based removal is explicitly OUT of scope — the function exposes no
// appreciated-value input, so there is no path to move drop-off off the original value.
import { describe, test, expect } from 'vitest';
import { Money } from '../money/money.js';
import { amortizationSchedule } from './amortization.js';
import { computePmi } from './pmi.js';

const ORIGINAL_VALUE = '400000';
const RATE = '0.06375';
const TERM = 360;
const ANNUAL_PMI_RATE = '0.0075';

// A < 20%-down loan (10% down → loan $360,000 of a $400,000 value).
const LOAN_LOW_DOWN = '360000';
const scheduleLowDown = amortizationSchedule(LOAN_LOW_DOWN, RATE, TERM);

// A >= 20%-down loan (20% down → loan $320,000 of a $400,000 value, LTV exactly 80%).
const LOAN_TWENTY_DOWN = '320000';
const scheduleTwentyDown = amortizationSchedule(LOAN_TWENTY_DOWN, RATE, TERM);

describe('PMI applies only when the down payment is < 20%', () => {
  test('down payment >= 20% (LTV <= 80% at origination): no PMI', () => {
    const result = computePmi({
      originalValue: ORIGINAL_VALUE,
      loan: LOAN_TWENTY_DOWN,
      schedule: scheduleTwentyDown,
      annualRateOfLoan: ANNUAL_PMI_RATE,
      basis: 'auto-78',
    });
    expect(result.applies).toBe(false);
    expect(result.monthlyPremium.toCents()).toBe(0n);
    expect(result.dropOffMonth).toBeNull();
  });

  test('down payment < 20%: PMI applies with the correct monthly premium', () => {
    const result = computePmi({
      originalValue: ORIGINAL_VALUE,
      loan: LOAN_LOW_DOWN,
      schedule: scheduleLowDown,
      annualRateOfLoan: ANNUAL_PMI_RATE,
      basis: 'auto-78',
    });
    expect(result.applies).toBe(true);
    expect(result.monthlyPremium).toBeInstanceOf(Money);
    // (360000 * 0.0075) / 12 = 225.00 → 22500 cents.
    expect(result.monthlyPremium.toCents()).toBe(22500n);
  });
});

describe('drop-off is measured against original value + scheduled balance with the 78/80 toggle', () => {
  const auto = computePmi({
    originalValue: ORIGINAL_VALUE,
    loan: LOAN_LOW_DOWN,
    schedule: scheduleLowDown,
    annualRateOfLoan: ANNUAL_PMI_RATE,
    basis: 'auto-78',
  });
  const requested = computePmi({
    originalValue: ORIGINAL_VALUE,
    loan: LOAN_LOW_DOWN,
    schedule: scheduleLowDown,
    annualRateOfLoan: ANNUAL_PMI_RATE,
    basis: 'requested-80',
  });

  test('auto-78 and requested-80 produce DIFFERENT drop-off months on the same loan', () => {
    expect(auto.dropOffMonth).not.toBe(requested.dropOffMonth);
  });

  test('requested-80 drops off EARLIER than auto-78', () => {
    expect(requested.dropOffMonth).not.toBeNull();
    expect(auto.dropOffMonth).not.toBeNull();
    expect(requested.dropOffMonth!).toBeLessThan(auto.dropOffMonth!);
  });

  test('the drop-off months are pinned to the derived oracle (78%→108, 80%→94)', () => {
    expect(auto.dropOffMonth).toBe(108);
    expect(requested.dropOffMonth).toBe(94);
  });

  test('the basis is echoed on the result', () => {
    expect(auto.basis).toBe('auto-78');
    expect(requested.basis).toBe('requested-80');
  });
});
