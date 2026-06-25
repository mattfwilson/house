// Carrying-costs correctness tests (TCO-03, D-15).
//
// EXACT-EQUALITY proofs — never `toBeCloseTo`. The carrying-cost core's properties:
//   - maintenance = annualPctOfValue × the home value, and it tracks the APPRECIATING home
//     value (year-1 maintenance > year-0 maintenance);
//   - insurance is flat $/yr in today's dollars (year 0 === year N);
//   - HOA is flat $/mo → annual = monthly × 12 exactly, flat across the hold.
// Dollar assertions go through the public Money surface (toCents bigint / toDecimalString).
import { describe, test, expect } from 'vitest';
import { Money } from '../money/money.js';
import {
  maintenanceAnnual,
  insuranceAnnual,
  hoaAnnual,
  carryingCostsForYear,
} from './carrying-costs.js';

describe('maintenanceAnnual = annualPctOfValue × home value', () => {
  test('$500,000 × 0.01 === $5,000.00 exact', () => {
    const m = maintenanceAnnual(Money.of('500000'), '0.01');
    expect(m).toBeInstanceOf(Money);
    expect(m.toCents()).toBe(500000n); // $5,000.00
  });
});

describe('insuranceAnnual is flat in today\'s dollars', () => {
  test('returns the input as Money', () => {
    expect(insuranceAnnual('2400').toCents()).toBe(240000n); // $2,400.00
  });
});

describe('hoaAnnual = hoaMonthly × 12', () => {
  test('$250/mo × 12 === $3,000.00 exact', () => {
    expect(hoaAnnual('250').toCents()).toBe(300000n); // $3,000.00
  });

  test('$0/mo === $0.00', () => {
    expect(hoaAnnual('0').toCents()).toBe(0n);
  });
});

describe('carryingCostsForYear — maintenance appreciates, insurance + HOA hold flat', () => {
  const common = {
    price: '500000',
    maintenancePctOfValue: '0.01',
    appreciationRealAnnual: '0.0075',
    insuranceAnnualInput: '2400',
    hoaMonthly: '250',
  };
  const y0 = carryingCostsForYear({ ...common, year: 0 });
  const y5 = carryingCostsForYear({ ...common, year: 5 });

  test('all three lines are Money', () => {
    for (const line of [y0.maintenance, y0.insurance, y0.hoa]) {
      expect(line).toBeInstanceOf(Money);
    }
  });

  test('year-0 maintenance === $5,000.00 (0.01 × 500k)', () => {
    expect(y0.maintenance.toCents()).toBe(500000n);
  });

  test('maintenance tracks the APPRECIATING home value (year 5 > year 0)', () => {
    expect(y5.maintenance.toCents()).toBeGreaterThan(y0.maintenance.toCents());
  });

  test('insurance holds flat across the hold (year 0 === year 5)', () => {
    expect(y0.insurance.toCents()).toBe(y5.insurance.toCents());
    expect(y0.insurance.toCents()).toBe(240000n);
  });

  test('HOA holds flat across the hold (year 0 === year 5 === $3,000.00)', () => {
    expect(y0.hoa.toCents()).toBe(y5.hoa.toCents());
    expect(y0.hoa.toCents()).toBe(300000n);
  });
});
