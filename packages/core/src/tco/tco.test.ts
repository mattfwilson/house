// computeTco aggregator tests (TCO-06 / SC4) — the single composition point that assembles
// every TCO line into a closed monthly + annualized breakdown.
//
// These are EXACT-EQUALITY proofs — never `toBeCloseTo`. The aggregator's existential
// correctness properties are:
//   - it returns all seven lines (P+I, property tax, insurance, maintenance, HOA, PMI,
//     amortized closing) PLUS a `total`, each a `TcoLine { monthly, annualized }` Money;
//   - the documented monthly<->annual convention holds for every line: the annualized
//     figure is the source of truth and `monthly === annualized / 12` (in Dec, rounded at
//     the Money boundary) — re-deriving the same way reproduces the exact cents;
//   - `total.monthly` is the EXACT sum of the seven line monthlies and `total.annualized`
//     the EXACT sum of the seven line annualizeds (bigint cents);
//   - down payment >= 20% (LTV <= 80%) yields `pmi.monthly === $0.00`;
//   - the result CAPTURES the resolved mill rate + FY for the scenario's town (snapshot
//     self-containment, Pitfall 11) and carries the qualitative Prop 2½ flag.
// Dollar assertions go through the public Money surface (toCents bigint / toDecimalString),
// matching the canary/amortization/property-tax precedent.
import { describe, test, expect } from 'vitest';
import { computeTco } from './tco.js';
import { Money } from '../money/money.js';
import { engineInput } from '../engine/engine-input.js';
import { DEFAULT_ASSUMPTIONS } from '../assumptions/defaults.js';
import { calendarDate } from '../time/calendar-date.js';
import { resolveMillRate } from '../towns/town-table.js';
import { PROP_2_5_FLAG } from './property-tax.js';
import { Dec } from '../money/decimal-config.js';
import type { ScenarioInputs } from '../engine/engine-input.js';

// The exact 1/12 rate string the aggregator uses to derive monthly = annualized / 12. Computed
// the same way (in the frozen Dec clone) so the convention check below reproduces it exactly.
const ONE_TWELFTH = new Dec(1).div(12).toFixed();

// A fully-specified scenario: $400k, 20% down (-> loan $320,000, LTV 80% so NO PMI), 30yr at
// 6.375%, 10-year hold, Newton (FY2024 mill 9.86), $1,800/yr insurance, no HOA. The assumptions
// supply assessmentRatio 1.0, appreciation 0.0075, maintenance 0.01, closing 0.025 (DEFAULTs).
const SCENARIO_20PCT: ScenarioInputs = {
  label: '123 Main St, Newton — 20% down',
  price: '400000',
  downPaymentPct: '0.20',
  annualRate: '0.06375',
  termMonths: 360,
  holdingYears: 10,
  town: 'Newton',
  insuranceAnnual: '1800',
  hoaMonthly: '0',
  monthlyRent: '3000',
};

// Same house at 10% down -> loan $360,000, LTV 90% so PMI APPLIES.
const SCENARIO_10PCT: ScenarioInputs = {
  ...SCENARIO_20PCT,
  label: '123 Main St, Newton — 10% down (PMI)',
  downPaymentPct: '0.10',
};

const inputFor = (scenario: ScenarioInputs) =>
  engineInput({
    asOf: calendarDate('2026-01-01'),
    assumptions: DEFAULT_ASSUMPTIONS,
    scenario,
  });

describe('computeTco returns a closed monthly + annualized breakdown', () => {
  test('every line and the total is a TcoLine with monthly + annualized Money', () => {
    const tco = computeTco(inputFor(SCENARIO_20PCT));
    const lines = [
      tco.principalAndInterest,
      tco.propertyTax,
      tco.insurance,
      tco.maintenance,
      tco.hoa,
      tco.pmi,
      tco.amortizedClosing,
      tco.total,
    ];
    for (const line of lines) {
      expect(line.monthly).toBeInstanceOf(Money);
      expect(line.annualized).toBeInstanceOf(Money);
    }
  });

  test('exact per-line oracle figures (year-0 snapshot, HALF_EVEN)', () => {
    const tco = computeTco(inputFor(SCENARIO_20PCT));
    // annualized cents (the source-of-truth figure for each line)
    expect(tco.principalAndInterest.annualized.toCents()).toBe(2395660n); // $1,996.38/mo x 12
    expect(tco.propertyTax.annualized.toCents()).toBe(394400n); // $400,000 x 9.86/$1,000
    expect(tco.insurance.annualized.toCents()).toBe(180000n); // flat $1,800/yr
    expect(tco.maintenance.annualized.toCents()).toBe(400000n); // 1% of $400,000
    expect(tco.hoa.annualized.toCents()).toBe(0n); // no HOA
    expect(tco.pmi.annualized.toCents()).toBe(0n); // 20% down -> no PMI
    expect(tco.amortizedClosing.annualized.toCents()).toBe(100000n); // $10,000 / 10yr
  });

  test('the monthly<->annual convention holds for every line: monthly === annualized / 12', () => {
    const tco = computeTco(inputFor(SCENARIO_20PCT));
    const lines = [
      tco.principalAndInterest,
      tco.propertyTax,
      tco.insurance,
      tco.maintenance,
      tco.hoa,
      tco.pmi,
      tco.amortizedClosing,
    ];
    for (const line of lines) {
      // Re-derive monthly from the annualized source the same way the aggregator does:
      // annualized * (1/12), rounded at the Money boundary. Exact cents match.
      const reDerived = line.annualized.mul(ONE_TWELFTH);
      expect(line.monthly.toCents()).toBe(reDerived.toCents());
    }
  });

  test('total.annualized === exact sum of the seven line annualizeds (bigint cents)', () => {
    const tco = computeTco(inputFor(SCENARIO_20PCT));
    const sum =
      tco.principalAndInterest.annualized.toCents() +
      tco.propertyTax.annualized.toCents() +
      tco.insurance.annualized.toCents() +
      tco.maintenance.annualized.toCents() +
      tco.hoa.annualized.toCents() +
      tco.pmi.annualized.toCents() +
      tco.amortizedClosing.annualized.toCents();
    expect(tco.total.annualized.toCents()).toBe(sum);
    expect(tco.total.annualized.toCents()).toBe(3470060n);
  });

  test('total.monthly === exact sum of the seven line monthlies (bigint cents)', () => {
    const tco = computeTco(inputFor(SCENARIO_20PCT));
    const sum =
      tco.principalAndInterest.monthly.toCents() +
      tco.propertyTax.monthly.toCents() +
      tco.insurance.monthly.toCents() +
      tco.maintenance.monthly.toCents() +
      tco.hoa.monthly.toCents() +
      tco.pmi.monthly.toCents() +
      tco.amortizedClosing.monthly.toCents();
    expect(tco.total.monthly.toCents()).toBe(sum);
    expect(tco.total.monthly.toCents()).toBe(289172n);
  });
});

describe('PMI gating by down payment', () => {
  test('down payment >= 20% (LTV <= 80%) -> pmi.monthly === $0.00', () => {
    const tco = computeTco(inputFor(SCENARIO_20PCT));
    expect(tco.pmi.monthly.toCents()).toBe(0n);
    expect(tco.pmi.annualized.toCents()).toBe(0n);
  });

  test('down payment < 20% (LTV 90%) -> PMI is charged', () => {
    const tco = computeTco(inputFor(SCENARIO_10PCT));
    // (loan $360,000 x 0.0075) / 12 = $225.00/mo; annualized = $2,700.00.
    expect(tco.pmi.monthly.toCents()).toBe(22500n);
    expect(tco.pmi.annualized.toCents()).toBe(270000n);
  });
});

describe('snapshot self-containment (Pitfall 11): resolved mill rate + FY captured', () => {
  test('result captures the resolved mill rate + FY for the scenario town', () => {
    const tco = computeTco(inputFor(SCENARIO_20PCT));
    const resolved = resolveMillRate('Newton');
    expect(tco.resolvedMillRate).toBe(resolved.residentialMillRate);
    expect(tco.millRateFy).toBe(resolved.fy);
    // Sanity: the captured rate is exactly the Newton FY2024 rate.
    expect(tco.resolvedMillRate).toBe('9.86');
    expect(tco.millRateFy).toBe(2024);
  });

  test('result carries the qualitative Prop 2½ flag', () => {
    const tco = computeTco(inputFor(SCENARIO_20PCT));
    expect(tco.propTwoAndHalfFlag).toBe(PROP_2_5_FLAG);
  });
});

describe('computeTco is deterministic over a frozen EngineInput', () => {
  test('two runs on the same input produce cent-identical totals', () => {
    const a = computeTco(inputFor(SCENARIO_20PCT));
    const b = computeTco(inputFor(SCENARIO_20PCT));
    expect(a.total.monthly.toCents()).toBe(b.total.monthly.toCents());
    expect(a.total.annualized.toCents()).toBe(b.total.annualized.toCents());
  });
});
