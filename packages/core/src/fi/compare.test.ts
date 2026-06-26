// compare.test.ts — N-scenario FI-date ranking (FI-04 / FI-06, D-08).
//
// `compareScenarios` ranks a batch of buy scenarios against ONE keep-renting baseline and produces a
// table the user reads top-to-bottom: best-for-FI first, the don't-buy outcome last. The LOCKED
// shape (D-08):
//   - the keep-renting baseline is ALWAYS row 0 (`isBaseline: true`, `fiDeltaMonths: 0` by definition);
//   - buy rows are ranked by FI-date delay ASCENDING — a buy that BEATS renting (negative delta) sorts
//     ABOVE one that DELAYS FI (positive delta);
//   - `unreached` buy rows sort AFTER every `reached` row, then by `cappedAtMonth` ascending — the
//     anti-funnel "don't buy" row sorts WORST (FI-06).
//
// LANDMINE L3 (the load-bearing invariant): the ordering uses a `kind`-branching comparator, NEVER an
// injected `Infinity`/sentinel — `canonicalJson` throws on non-finite, so no Infinity may appear in
// any serialized field. `fiDeltaMonths` is `null` (not NaN/Infinity) for an unreached row; the row
// still sorts via the comparator. The grep gate (`0 Infinity in compare.ts`) is asserted in the plan.
import { describe, test, expect } from 'vitest';
import {
  engineInput,
  type EngineInput,
  type ScenarioInputs,
  type Household,
} from '../engine/engine-input.js';
import { DEFAULT_ASSUMPTIONS } from '../assumptions/defaults.js';
import { calendarDate } from '../time/calendar-date.js';
import { fiImpact } from './fi-impact.js';
import { compareScenarios } from './compare.js';

const ASOF = calendarDate('2026-01-01');

// A comfortable household: high savings + NW, so a cheap house can BEAT renting (the buyer keeps
// nearly all their savings AND builds equity), while a pricey house DELAYS FI, and a brutal house is
// unreachable — a mixed batch that exercises every ordering branch in one test.
const HOUSEHOLD: Household = {
  grossAnnualIncome: '320000',
  existingMonthlyDebt: '300',
  targetSavingsRate: '0.40',
  availableNetWorth: '900000',
  currentRent: '4500', // $54k/yr renter housing — a high rent makes buying relatively attractive
  downPaymentCash: '150000',
  reserve: '50000',
  currentAnnualSavings: '140000',
  targetAnnualRetirementSpend: '90000',
};

const baseScenario = (label: string, overrides: Partial<ScenarioInputs>): ScenarioInputs => ({
  label,
  price: '600000',
  downPaymentPct: '0.20',
  annualRate: '0.06375',
  termMonths: 360,
  holdingYears: 30,
  town: 'Newton',
  insuranceAnnual: '1800',
  hoaMonthly: '0',
  monthlyRent: '4500',
  ...overrides,
});

const inputFor = (scenario: ScenarioInputs): EngineInput =>
  engineInput({ asOf: ASOF, assumptions: DEFAULT_ASSUMPTIONS, scenario, household: HOUSEHOLD });

// Three DISTINCT scenarios built via separate engineInput calls (the plan's "distinct scenarios"
// requirement). A modest house (beats renting — the buyer keeps most savings AND builds equity), a
// pricey house (delays FI — the premium outweighs the equity), and a brutal high-leverage house
// (unreachable — the premium swamps savings AND the thin equity never closes the gap, the don't-buy
// row). Prices/leverage are tuned so each scenario lands cleanly in its ordering band (the A5 equity
// inclusion makes a high-but-low-leverage house reach via its equity windfall, so the unreachable
// case must be BOTH expensive AND high-leverage).
const MODEST = inputFor(baseScenario('modest — beats renting', { price: '550000' }));
const PRICEY = inputFor(baseScenario('pricey — delays FI', { price: '2200000', insuranceAnnual: '6000' }));
const BRUTAL = inputFor(
  baseScenario('brutal — unreachable (don\'t buy)', {
    price: '4000000',
    downPaymentPct: '0.10',
    insuranceAnnual: '12000',
  }),
);

describe('compareScenarios — the ranking shape (D-08, FI-04)', () => {
  test('the keep-renting baseline is ALWAYS row 0 with isBaseline + delta 0', () => {
    const result = compareScenarios(MODEST, [MODEST, PRICEY, BRUTAL]);
    expect(result.rows[0]!.isBaseline).toBe(true);
    expect(result.rows[0]!.fiDeltaMonths).toBe(0);
    // The baseline row carries the renter (baseline) FI outcome from fiImpact.
    const expectedBaseline = fiImpact(MODEST).baseline;
    expect(result.rows[0]!.outcome).toEqual(expectedBaseline);
  });

  test('every buy scenario appears as a row (baseline + N buys)', () => {
    const result = compareScenarios(MODEST, [MODEST, PRICEY, BRUTAL]);
    expect(result.rows.length).toBe(4); // baseline + 3 buys
    expect(result.rows.filter((r) => r.isBaseline).length).toBe(1);
  });
});

describe('compareScenarios — ordering: best first, unreached last (FI-06)', () => {
  test('a realistic mixed batch ranks beats-renting < delays < unreached (the don\'t-buy row last)', () => {
    const result = compareScenarios(MODEST, [PRICEY, MODEST, BRUTAL]);

    // Row 0 is the baseline; the three buy rows follow in ranked order.
    const buyRows = result.rows.slice(1);
    expect(buyRows.map((r) => r.label)).toEqual([
      'modest — beats renting',
      'pricey — delays FI',
      'brutal — unreachable (don\'t buy)',
    ]);
    // The labels above are a STRUCTURAL ranking assertion (beats < delays < unreached), independent
    // of the human copy — the don't-buy row is last by its `unreached` kind, not by its label.

    // The modest buy reaches and BEATS renting (negative delta); the pricey buy reaches but DELAYS
    // (positive delta); the brutal buy is unreached (the don't-buy row, sorted worst).
    expect(buyRows[0]!.outcome.kind).toBe('reached');
    expect(buyRows[0]!.fiDeltaMonths!).toBeLessThan(0);
    expect(buyRows[1]!.outcome.kind).toBe('reached');
    expect(buyRows[1]!.fiDeltaMonths!).toBeGreaterThan(0);
    expect(buyRows[2]!.outcome.kind).toBe('unreached');
    expect(buyRows[2]!.fiDeltaMonths).toBeNull();
  });

  test('the unreached row sorts AFTER every reached row regardless of input order', () => {
    // Feed the unreachable scenario FIRST — it must still sort last.
    const result = compareScenarios(MODEST, [BRUTAL, PRICEY, MODEST]);
    const buyRows = result.rows.slice(1);
    expect(buyRows[buyRows.length - 1]!.outcome.kind).toBe('unreached');
    // And the two reached rows are ordered by ascending delta among themselves.
    expect(buyRows[0]!.outcome.kind).toBe('reached');
    expect(buyRows[1]!.outcome.kind).toBe('reached');
    expect(buyRows[0]!.fiDeltaMonths!).toBeLessThanOrEqual(buyRows[1]!.fiDeltaMonths!);
  });

  test('NO Infinity in any serialized field (L3 — ordering via comparator, not a sentinel)', () => {
    const result = compareScenarios(MODEST, [PRICEY, MODEST, BRUTAL]);
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain('Infinity');
    // The unreached row's delta is null (not a non-finite number).
    const unreachedRow = result.rows.find((r) => r.outcome.kind === 'unreached')!;
    expect(unreachedRow.fiDeltaMonths).toBeNull();
    expect(unreachedRow.fiDeltaYears).toBeNull();
  });
});

describe('compareScenarios — stable tie-break by input order', () => {
  test('two scenarios with identical FI dates preserve input order', () => {
    // Two byte-identical scenarios (other than label) reach at the same month -> stable by input order.
    const a = inputFor(baseScenario('tie-A', { price: '600000' }));
    const b = inputFor(baseScenario('tie-B', { price: '600000' }));
    const result = compareScenarios(MODEST, [a, b]);
    const buyRows = result.rows.slice(1);
    expect(buyRows.map((r) => r.label)).toEqual(['tie-A', 'tie-B']);
  });
});

describe('compareScenarios — determinism', () => {
  test('same inputs => same ranking', () => {
    const x = compareScenarios(MODEST, [PRICEY, MODEST, BRUTAL]);
    const y = compareScenarios(MODEST, [PRICEY, MODEST, BRUTAL]);
    expect(x).toEqual(y);
  });
});
