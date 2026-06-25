// Property-tax correctness tests (TCO-02 / SC2, Pitfall 9).
//
// These are EXACT-EQUALITY proofs — never `toBeCloseTo`. The property-tax core's
// existential correctness properties are:
//   - the annual bill is assessed value × mill rate (per $1,000), NOT a flat % and NOT a
//     2.5%-clamped bill (Prop 2½ caps the town LEVY, not your individual bill — Pitfall 9);
//   - assessed value defaults to price × assessmentRatio and grows at appreciation under a
//     HELD-CONSTANT mill rate (only assessed grows — D-10), so the per-year bill grows;
//   - doubling the mill rate doubles the bill (mill-rate-sensitive, never clamped);
//   - the schedule result carries the qualitative Prop 2½ flag string.
// Dollar assertions go through the public Money surface (toCents bigint / toDecimalString),
// matching the canary/amortization precedent.
import { describe, test, expect } from 'vitest';
import { Money } from '../money/money.js';
import {
  annualPropertyTax,
  assessedValueAt,
  propertyTaxSchedule,
  PROP_2_5_FLAG,
} from './property-tax.js';

describe('annualPropertyTax = assessed value × mill rate (per $1,000)', () => {
  test('$500,000 assessed × 12.5/$1,000 === $6,250.00 (no flat %, no clamp)', () => {
    const tax = annualPropertyTax(Money.of('500000'), '12.5');
    expect(tax).toBeInstanceOf(Money);
    expect(tax.toCents()).toBe(625000n); // $6,250.00
    expect(tax.toDecimalString()).toBe('6250');
  });

  test('doubling the mill rate doubles the bill — mill-rate-sensitive, no 2.5% clamp', () => {
    const base = annualPropertyTax(Money.of('500000'), '12.5');
    const doubled = annualPropertyTax(Money.of('500000'), '25');
    expect(doubled.toCents()).toBe(base.toCents() * 2n);
  });

  test('a higher-mill-rate town yields a proportionally higher bill (no cap)', () => {
    const low = annualPropertyTax(Money.of('500000'), '5.86'); // Cambridge-like
    const high = annualPropertyTax(Money.of('500000'), '12.86'); // Lexington-like
    expect(high.toCents()).toBeGreaterThan(low.toCents());
  });
});

describe('assessedValueAt = price × assessmentRatio, grown at appreciation', () => {
  test('year 0 with ratio 1.0 === price exactly', () => {
    expect(assessedValueAt('500000', '1.0', '0.0075', 0).toCents()).toBe(50000000n);
  });

  test('year 0 with assessmentRatio 0.9 === $450,000.00 exact', () => {
    expect(assessedValueAt('500000', '0.9', '0.0075', 0).toCents()).toBe(45000000n);
  });

  test('year 1 === base assessed × (1 + appreciation)', () => {
    // 500000 × 1.0075 === 503750.00
    expect(assessedValueAt('500000', '1.0', '0.0075', 1).toCents()).toBe(50375000n);
  });

  test('assessed grows year over year', () => {
    const y0 = assessedValueAt('500000', '1.0', '0.0075', 0);
    const y1 = assessedValueAt('500000', '1.0', '0.0075', 1);
    expect(y1.toCents()).toBeGreaterThan(y0.toCents());
  });
});

describe('propertyTaxSchedule — tax grows because assessed grows at constant mill rate', () => {
  const schedule = propertyTaxSchedule({
    price: '500000',
    assessmentRatio: '1.0',
    appreciationRealAnnual: '0.0075',
    millRatePerThousand: '12.5',
    holdingYears: 10,
  });

  test('one Money-valued tax row per holding year', () => {
    expect(schedule.perYear.length).toBe(10);
    for (const row of schedule.perYear) {
      expect(row.tax).toBeInstanceOf(Money);
      expect(row.assessedValue).toBeInstanceOf(Money);
    }
  });

  test('year 0 tax === $6,250.00 (assessed 500k × 12.5/1000)', () => {
    expect(schedule.perYear[0].tax.toCents()).toBe(625000n);
  });

  test('year-1 tax > year-0 tax (assessed grew; constant mill rate — D-10)', () => {
    expect(schedule.perYear[1].tax.toCents()).toBeGreaterThan(schedule.perYear[0].tax.toCents());
  });

  test('the schedule carries the qualitative Prop 2½ flag', () => {
    expect(schedule.prop25Flag).toBe(PROP_2_5_FLAG);
    expect(PROP_2_5_FLAG).toContain('Prop 2');
  });
});
