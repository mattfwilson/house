// PMI — private mortgage insurance (TCO-04), the second existential correctness core of the
// TCO engine (Pitfall 3).
//
// THREE properties this module enforces (proven by exact-equality tests):
//   - PMI APPLIES iff the origination loan-to-value exceeds 80% (down payment < 20%).
//   - The monthly premium is (loan · annualRateOfLoan) / 12, carried as `Money`.
//   - Drop-off is measured against the CONSTANT ORIGINAL value and the SCHEDULED amortized
//     balance — NOT an appreciated value. The basis toggles the threshold: "auto-78" is the
//     78% LTV automatic-termination point; "requested-80" is the 80% LTV borrower-requested
//     point (which is reached earlier). Appreciation-based removal is OUT of scope, so this
//     function deliberately exposes no appreciated-value input.
//
// Dec/Money discipline (the shared TCO pattern): LTV comparisons are done in `Dec`
// (`.gt`/`.lte`) — `Money` has no comparison API and dollars must never be compared as
// numbers. The /12 for the premium is done in `Dec` and fed to `Money.mul` as a rate
// string, never a bare-number division.
import { Dec } from '../money/decimal-config.js';
import { Money } from '../money/money.js';
import type { AmortizationSchedule } from './amortization.js';

/** Which LTV threshold the drop-off is measured against. */
export type PmiBasis = 'auto-78' | 'requested-80';

/** The outcome of a PMI computation for a single loan. */
export interface PmiResult {
  /** True iff PMI is charged (origination LTV > 80% / down payment < 20%). */
  readonly applies: boolean;
  /** The monthly premium ($0.00 when PMI does not apply). */
  readonly monthlyPremium: Money;
  /** 1-based first month the scheduled balance falls to/under the basis threshold, or null. */
  readonly dropOffMonth: number | null;
  /** Which LTV threshold was applied. */
  readonly basis: PmiBasis;
}

/** Origination-LTV threshold above which PMI is required (down payment < 20%). */
const ORIGINATION_LTV_THRESHOLD = new Dec('0.80');

/** The drop-off LTV threshold for each basis (measured against the ORIGINAL value). */
function dropOffThreshold(basis: PmiBasis): InstanceType<typeof Dec> {
  return basis === 'auto-78' ? new Dec('0.78') : new Dec('0.80');
}

/**
 * Compute PMI for a loan against its amortization schedule.
 *
 * PMI applies iff `loan / originalValue > 0.80` (the comparison is done in `Dec`). When it
 * applies, the monthly premium is `(loan · annualRateOfLoan) / 12` (the /12 done in `Dec`,
 * surfaced via `Money.mul`), and `dropOffMonth` is the FIRST period whose scheduled balance
 * is at/under the basis threshold of the CONSTANT original value. When it does not apply,
 * the result is the zero/null outcome.
 */
export function computePmi(opts: {
  originalValue: string;
  loan: string;
  schedule: AmortizationSchedule;
  annualRateOfLoan: string;
  basis: PmiBasis;
}): PmiResult {
  const { originalValue, loan, schedule, annualRateOfLoan, basis } = opts;

  const originalValueDec = new Dec(originalValue);
  const originationLtv = new Dec(loan).div(originalValueDec);

  // Down payment >= 20% (LTV <= 80% at origination): no PMI.
  if (!originationLtv.gt(ORIGINATION_LTV_THRESHOLD)) {
    return { applies: false, monthlyPremium: Money.zero(), dropOffMonth: null, basis };
  }

  // Monthly premium = (loan · annualRateOfLoan) / 12. Do the /12 in Dec, feed Money.mul.
  const monthlyRate = new Dec(annualRateOfLoan).div(12);
  const monthlyPremium = Money.of(loan).mul(monthlyRate.toFixed());

  // Drop-off: first month whose scheduled balance / ORIGINAL value <= the basis threshold.
  // Comparison in Dec against the CONSTANT original value (never an appreciated value).
  const threshold = dropOffThreshold(basis);
  let dropOffMonth: number | null = null;
  for (const row of schedule.rows) {
    const ltv = new Dec(row.balance.toDecimalString()).div(originalValueDec);
    if (ltv.lte(threshold)) {
      dropOffMonth = row.period;
      break;
    }
  }

  return { applies: true, monthlyPremium, dropOffMonth, basis };
}
