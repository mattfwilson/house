// DTI numerator + ratio tests (AFF-01, D-14) — the single highest-correctness-risk split in
// the affordability engine. These are EXACT-EQUALITY proofs against HAND-VERIFIED worked
// examples (Pitfall 4), never `toBeCloseTo`.
//
// The existential property under proof is the D-14 lender-DTI numerator split:
//   - `lenderDtiCarryingCost` = P+I + propertyTax + insurance + pmi + hoa  (PITI + HOA + PMI)
//   - it EXCLUDES `maintenance` (not a lender input) AND `amortizedClosing` (a t=0 lump)
//   - it is therefore STRICTLY LESS than `tco.total.monthly` by exactly maintenance +
//     amortizedClosing — asserted directly (the D-14 exclusion assertion).
//
// Both ratios use the GROSS-monthly denominator (gross income / 12), NEVER net (Pitfall 2,
// D-04): no `× (1 − taxRate)` anywhere near the denominator. The back-end adds the single
// monthly minimum-obligations total (`existingMonthlyDebt`, D-10) to the numerator.
//
// The worked figures come from `computeTco` on a fixed Newton scenario (the same fixture the
// TCO aggregator tests pin), so the numerator is reconciled against the engine's own breakdown
// rather than a re-derived payment formula.
import { describe, test, expect } from 'vitest';
import { lenderDtiCarryingCost, frontEndRatio, backEndRatio } from './dti.js';
import { computeTco } from '../tco/tco.js';
import { engineInput } from '../engine/engine-input.js';
import { DEFAULT_ASSUMPTIONS } from '../assumptions/defaults.js';
import { calendarDate } from '../time/calendar-date.js';
import type { ScenarioInputs } from '../engine/engine-input.js';

// $400k Newton, 30yr at 6.375%, 10-year hold, $1,800/yr insurance, no HOA — the SAME fixture
// the computeTco aggregator tests pin. Year-0 line monthlies (cents, from the breakdown):
//   20% down (NO PMI): P+I 199638, tax 32867, ins 15000, maint 33333, hoa 0, pmi 0, amClose 8333
//   10% down (PMI):    P+I 224593, tax 32867, ins 15000, maint 33333, hoa 0, pmi 20250, amClose 8333
const BASE: Omit<ScenarioInputs, 'downPaymentPct' | 'label'> = {
  price: '400000',
  annualRate: '0.06375',
  termMonths: 360,
  holdingYears: 10,
  town: 'Newton',
  insuranceAnnual: '1800',
  hoaMonthly: '0',
  monthlyRent: '3000',
};

const tcoFor = (downPaymentPct: string) =>
  computeTco(
    engineInput({
      asOf: calendarDate('2026-01-01'),
      assumptions: DEFAULT_ASSUMPTIONS,
      scenario: { ...BASE, label: `Newton ${downPaymentPct}`, downPaymentPct },
    }),
  );

describe('lenderDtiCarryingCost — the D-14 numerator (PITI + HOA + PMI)', () => {
  test('20% down: numerator = P+I + tax + insurance + pmi + hoa (hand-verified cents)', () => {
    const tco = tcoFor('0.20');
    // 199638 + 32867 + 15000 + 0(pmi) + 0(hoa) = 247505 cents == $2,475.05
    expect(lenderDtiCarryingCost(tco).toCents()).toBe(247505n);
    expect(lenderDtiCarryingCost(tco).toDecimalString()).toBe('2475.05');
  });

  test('D-14 EXCLUSION: numerator excludes maintenance + amortizedClosing (< tco.total.monthly)', () => {
    const tco = tcoFor('0.20');
    const numerator = lenderDtiCarryingCost(tco).toCents();
    const total = tco.total.monthly.toCents();
    // The numerator is STRICTLY less than the TCO total monthly...
    expect(numerator).toBeLessThan(total);
    // ...by EXACTLY maintenance + amortizedClosing (the two excluded lines, D-14).
    const excluded = tco.maintenance.monthly.toCents() + tco.amortizedClosing.monthly.toCents();
    expect(total - numerator).toBe(excluded);
    expect(excluded).toBe(33333n + 8333n); // 41666 cents excluded
    // Direct guard: the numerator is NOT tco.total.monthly (Pitfall 1 — never use tco.total).
    expect(numerator).not.toBe(total);
  });

  test('PMI ON (10% down): the pmi line is a NON-ZERO contribution to the numerator', () => {
    const tco = tcoFor('0.10');
    expect(tco.pmi.monthly.toCents()).toBe(20250n); // PMI applies, non-zero
    // 224593 + 32867 + 15000 + 20250(pmi) + 0(hoa) = 292710 cents == $2,927.10
    expect(lenderDtiCarryingCost(tco).toCents()).toBe(292710n);
    // Dropping the pmi line would change the numerator -> proves pmi is genuinely included.
    const withoutPmi = lenderDtiCarryingCost(tco).sub(tco.pmi.monthly);
    expect(withoutPmi.toCents()).toBe(272460n);
    expect(withoutPmi.toCents()).not.toBe(lenderDtiCarryingCost(tco).toCents());
  });
});

describe('frontEndRatio / backEndRatio — GROSS-monthly denominator (Pitfall 2, D-04)', () => {
  test('20% down: front-end = numerator / (grossAnnual/12), hand-verified to a documented decimal', () => {
    const tco = tcoFor('0.20');
    // grossAnnual $120,000 -> grossMonthly $10,000. front = 2475.05 / 10000 = 0.247505.
    expect(frontEndRatio(tco, '120000').toFixed()).toBe('0.247505');
  });

  test('20% down: back-end = (numerator + existingMonthlyDebt) / grossMonthly, hand-verified', () => {
    const tco = tcoFor('0.20');
    // (2475.05 + 500) / 10000 = 2975.05 / 10000 = 0.297505.
    expect(backEndRatio(tco, '120000', '500').toFixed()).toBe('0.297505');
  });

  test('back-end >= front-end by exactly existingMonthlyDebt/grossMonthly (debt only in back-end)', () => {
    const tco = tcoFor('0.20');
    const front = frontEndRatio(tco, '120000');
    const back = backEndRatio(tco, '120000', '500');
    expect(back.greaterThan(front)).toBe(true);
    // back - front === 500 / 10000 === 0.05
    expect(back.minus(front).toFixed()).toBe('0.05');
  });

  test('PMI-ON (10% down): front/back ratios reflect the PMI-inclusive numerator', () => {
    const tco = tcoFor('0.10');
    // grossAnnual $150,000 -> grossMonthly $12,500. front = 2927.10 / 12500 = 0.234168.
    expect(frontEndRatio(tco, '150000').toFixed()).toBe('0.234168');
    // (2927.10 + 750) / 12500 = 3677.10 / 12500 = 0.294168.
    expect(backEndRatio(tco, '150000', '750').toFixed()).toBe('0.294168');
  });

  test('GROSS, never net: passing a smaller (net-looking) income RAISES the ratio (no tax haircut hidden inside)', () => {
    const tco = tcoFor('0.20');
    // The function divides by the income GIVEN as-is; a net-style smaller income yields a larger
    // ratio. This locks that there is no internal × (1 − taxRate) on the denominator (Pitfall 2).
    const gross = frontEndRatio(tco, '120000');
    const smaller = frontEndRatio(tco, '90000'); // 2475.05 / 7500 = 0.330006666...
    expect(smaller.greaterThan(gross)).toBe(true);
  });
});
