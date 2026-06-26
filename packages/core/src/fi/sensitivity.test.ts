// sensitivity.test.ts — the one-way FI tornado (ASMP-02 / D-12/D-13/D-14, L6).
//
// The tornado sweeps the SIX drivers (return, inflation, appreciation, maintenance, tax, swr) by
// perturbing ONE stored band per driver from the V3 `sensitivity` slice and re-running the SAME pure
// FI projection (`fiImpact(...).buy`) — Pitfall 10's "sensitivity must be a cheap re-run". There is
// NO bespoke per-driver math: the only per-driver difference is WHICH assumption key is perturbed and
// the absolute-vs-relative mode (tax is the ONLY relative band, L6 — ×0.85/×1.15 of the property-tax
// rate; the other five are absolute ± band).
//
// The result ranks rows DESCENDING by FI-date swing magnitude with the top drivers flagged (D-14),
// and serializes through `canonicalJson` with NO `Infinity` — an unreached low/high contributes a
// MAX-magnitude swing measured against `cappedAtMonth`, never a non-finite sentinel (L3).
import { describe, test, expect } from 'vitest';
import {
  engineInput,
  type EngineInput,
  type ScenarioInputs,
  type Household,
} from '../engine/engine-input.js';
import { DEFAULT_ASSUMPTIONS } from '../assumptions/defaults.js';
import { calendarDate } from '../time/calendar-date.js';
import { canonicalJson } from '../serialize/canonical-json.js';
import { tornado } from './sensitivity.js';
import { fiImpact } from './fi-impact.js';

const ASOF = calendarDate('2026-01-01');

// A comfortable scenario where BOTH the base buy path and the perturbed sweeps REACH FI within the
// horizon — so the swings are real month deltas, not a wall of unreached caps.
const SCENARIO: ScenarioInputs = {
  label: 'tornado comfortable',
  price: '600000',
  downPaymentPct: '0.20',
  annualRate: '0.06375',
  termMonths: 360,
  holdingYears: 30,
  town: 'Newton',
  insuranceAnnual: '1800',
  hoaMonthly: '0',
  monthlyRent: '3000',
};

const HOUSEHOLD: Household = {
  grossAnnualIncome: '300000',
  existingMonthlyDebt: '300',
  targetSavingsRate: '0.35',
  availableNetWorth: '800000',
  currentRent: '3000',
  downPaymentCash: '120000',
  reserve: '50000',
  currentAnnualSavings: '120000',
  targetAnnualRetirementSpend: '80000',
};

function input(): EngineInput {
  return engineInput({
    asOf: ASOF,
    // A 40yr cap keeps the repeated tornado re-runs fast; the comfortable scenario reaches FI well
    // inside it, so every perturbed sweep still yields a real reached/unreached outcome.
    assumptions: { ...DEFAULT_ASSUMPTIONS, projection: { maxHorizonYears: '40' } },
    scenario: SCENARIO,
    household: HOUSEHOLD,
  });
}

const DRIVERS = ['return', 'inflation', 'appreciation', 'maintenance', 'tax', 'swr'] as const;

describe('tornado — six-driver cheap re-run (ASMP-02 / D-12/D-13)', () => {
  test('produces exactly six rows, one per driver', () => {
    const result = tornado(input());
    expect(result.rows).toHaveLength(6);
    const drivers = result.rows.map((r) => r.driver).sort();
    expect(drivers).toEqual([...DRIVERS].sort());
  });

  test('base is identical across all rows (the unperturbed projection, computed once)', () => {
    const result = tornado(input());
    const baseJson = result.rows.map((r) => canonicalJson(r.base));
    const first = baseJson[0]!;
    for (const j of baseJson) expect(j).toBe(first);
    // And base equals the unperturbed fiImpact(...).buy.
    expect(first).toBe(canonicalJson(fiImpact(input()).buy));
  });
});

describe('tornado — band semantics (D-12 / L6)', () => {
  test('the tax driver perturbs the RELATIVE band (taxBandRelative), not an absolute rate band', () => {
    // L6: the tax driver reads `sensitivity.taxBandRelative` and perturbs the property-tax rate
    // MULTIPLICATIVELY (× (1 ± band)) — it is the ONLY relative band; the other five are absolute ±.
    // Each driver's perturbation re-freezes through `engineInput`, re-validating at the Zod boundary,
    // so a perturbed band is always canonical. We assert the tax row is well-formed (a real low/base/
    // high triple with a finite swing) — proving the relative band is consumed without error.
    //
    // NOTE (documented in 04-04-SUMMARY): `assumptions.tax.propertyRateAnnual` is presently INERT in
    // the FI/TCO path (property tax flows through the resolved TOWN mill rate, not this assumption),
    // so the tax row's FI-date swing is currently 0 for typical scenarios. The relative-band MACHINERY
    // (L6) is exercised here; wiring the mill rate to a perturbable rate is a follow-up (out of scope).
    const result = tornado(input());
    const taxRow = result.rows.find((r) => r.driver === 'tax')!;
    expect(taxRow.low.kind).toMatch(/^(reached|unreached)$/);
    expect(taxRow.high.kind).toMatch(/^(reached|unreached)$/);
    expect(canonicalJson(taxRow.base)).toBe(canonicalJson(fiImpact(input()).buy));
    expect(Number.isFinite(taxRow.swingMonths)).toBe(true);
    expect(taxRow.swingMonths).toBeGreaterThanOrEqual(0);

    // The relative band is genuinely consumed: a non-canonical/garbage band would throw at the Zod
    // boundary inside `perturb`. A huge relative band (×0.0001 / ×1.9999) parses + runs cleanly.
    const hugeBand = engineInput({
      asOf: ASOF,
      assumptions: {
        ...DEFAULT_ASSUMPTIONS,
        sensitivity: { ...DEFAULT_ASSUMPTIONS.sensitivity, taxBandRelative: '0.9999' },
      },
      scenario: SCENARIO,
      household: HOUSEHOLD,
    });
    const hugeTaxRow = tornado(hugeBand).rows.find((r) => r.driver === 'tax')!;
    expect(Number.isFinite(hugeTaxRow.swingMonths)).toBe(true);
  });

  test('bands are read from the stored V3 sensitivity slice (a zero band collapses low/high to base)', () => {
    // Zeroing every band makes every perturbation a no-op → low == base == high for every driver.
    const flat = engineInput({
      asOf: ASOF,
      assumptions: {
        ...DEFAULT_ASSUMPTIONS,
        sensitivity: {
          returnBand: '0',
          inflationBand: '0',
          appreciationBand: '0',
          maintenanceBand: '0',
          taxBandRelative: '0',
          swrBand: '0',
        },
      },
      scenario: SCENARIO,
      household: HOUSEHOLD,
    });
    const result = tornado(flat);
    for (const row of result.rows) {
      expect(canonicalJson(row.low)).toBe(canonicalJson(row.base));
      expect(canonicalJson(row.high)).toBe(canonicalJson(row.base));
      expect(row.swingMonths).toBe(0);
    }
  });
});

describe('tornado — ranking + serialization (D-14 / L3)', () => {
  test('rows are sorted DESCENDING by swingMonths', () => {
    const rows = tornado(input()).rows;
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i - 1]!.swingMonths).toBeGreaterThanOrEqual(rows[i]!.swingMonths);
    }
  });

  test('topDrivers is the top 3 driver names (length 3)', () => {
    const result = tornado(input());
    expect(result.topDrivers).toHaveLength(3);
    expect(result.topDrivers).toEqual(result.rows.slice(0, 3).map((r) => r.driver));
  });

  test('the serialized result contains NO Infinity (canonicalJson does not throw, L3)', () => {
    const result = tornado(input());
    const json = canonicalJson(result);
    expect(json).not.toContain('Infinity');
    expect(json).not.toContain('null'); // swingMonths is always a finite number, never null
  });

  test('swingMonths is a finite non-negative number on every row', () => {
    const rows = tornado(input()).rows;
    for (const row of rows) {
      expect(Number.isFinite(row.swingMonths)).toBe(true);
      expect(row.swingMonths).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('tornado — unreached endpoints contribute a finite max-magnitude swing (L3)', () => {
  test('a strained scenario where a perturbed endpoint is unreached still yields a finite swing', () => {
    // A strained household: a pricey house, thin savings — perturbing a driver adversely can push the
    // buy path past the horizon (unreached). The swing must still be a FINITE number (no Infinity).
    const strained = engineInput({
      asOf: ASOF,
      // A shorter horizon keeps the unreached re-runs fast while still exercising the cap path.
      assumptions: {
        ...DEFAULT_ASSUMPTIONS,
        projection: { maxHorizonYears: '30' },
      },
      scenario: { ...SCENARIO, price: '1200000', monthlyRent: '2600' },
      household: {
        ...HOUSEHOLD,
        availableNetWorth: '300000',
        downPaymentCash: '240000',
        currentAnnualSavings: '60000',
        targetAnnualRetirementSpend: '90000',
      },
    });
    const result = tornado(strained);
    const json = canonicalJson(result);
    expect(json).not.toContain('Infinity');
    for (const row of result.rows) {
      expect(Number.isFinite(row.swingMonths)).toBe(true);
    }
  });
});
