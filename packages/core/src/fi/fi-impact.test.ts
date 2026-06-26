// fi-impact.test.ts — the top-level FI-impact orchestrator (FI-01 / FI-03, D-04 / D-05).
//
// `fiImpact` answers the product's headline question: "what does buying this house do to our
// early-retirement timeline?" It builds the TWO honest paths and projects each to its FI date:
//   - BUY (D-04): the down payment + closing is FOREGONE investment (seed reduced at t=0); the
//     monthly ownership premium (buyMonthlyOutflowAt − grown rent) is a FOREGONE contribution; the
//     buy NW counts liquid + liquidated home equity (A5). Projected against the OWNER target.
//   - RENTER BASELINE (D-05): keep renting at currentRent and invest every dollar the buy path sank
//     — the same DP+closing seed (kept liquid) and the same monthly premium (invested). Projected
//     against the RENTER target.
//
// The result reports the FI-date DELTA = owner FI month − renter FI month, in BOTH months and years
// (FI-03; positive ⇒ buying DELAYS FI, the common anti-funnel direction). It surfaces both per-path
// FiOutcomes AND both targets (D-02 visibility). When either path is unreached, the delta is `null`.
//
// THE ANTI-FUNNEL ACCEPTANCE CHECK (FI-06): a realistic high-premium scenario MUST be allowed to
// yield buy:unreached + baseline:reached — the honest "don't buy" outcome. The tool is a decision
// tool, not a purchase funnel; it must be able to conclude "rent and invest the difference".
import { describe, test, expect } from 'vitest';
import { Dec } from '../money/decimal-config.js';
import {
  engineInput,
  type EngineInput,
  type ScenarioInputs,
  type Household,
} from '../engine/engine-input.js';
import { DEFAULT_ASSUMPTIONS } from '../assumptions/defaults.js';
import { calendarDate } from '../time/calendar-date.js';
import { fiImpact } from './fi-impact.js';

const ASOF = calendarDate('2026-01-01');

// A comfortable scenario: a high income + large net worth + a moderate house, where BOTH paths can
// reach FI within the horizon — so the delta is a real number and its sign is meaningful.
const COMFORTABLE_SCENARIO: ScenarioInputs = {
  label: 'fi-impact comfortable',
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

const COMFORTABLE_HOUSEHOLD: Household = {
  grossAnnualIncome: '300000',
  existingMonthlyDebt: '300',
  targetSavingsRate: '0.35',
  availableNetWorth: '800000',
  currentRent: '3000', // $36k/yr — the renter baseline housing
  downPaymentCash: '120000',
  reserve: '50000',
  currentAnnualSavings: '120000', // $10k/mo savings — comfortably above any ownership premium
  targetAnnualRetirementSpend: '80000',
};

// A strained scenario: a pricey house against a thinner household, where the ownership premium is
// large enough that the BUY path never reaches FI while the renter baseline does (the don't-buy row).
const STRAINED_SCENARIO: ScenarioInputs = {
  label: 'fi-impact strained',
  price: '1400000',
  downPaymentPct: '0.20',
  annualRate: '0.07',
  termMonths: 360,
  town: 'Newton',
  holdingYears: 30,
  insuranceAnnual: '4000',
  hoaMonthly: '0',
  monthlyRent: '3000',
};

const STRAINED_HOUSEHOLD: Household = {
  grossAnnualIncome: '180000',
  existingMonthlyDebt: '500',
  targetSavingsRate: '0.20',
  availableNetWorth: '300000',
  currentRent: '3000', // a $36k/yr renter housing vs a ~$1.4M owner carry — a big premium
  downPaymentCash: '280000',
  reserve: '40000',
  currentAnnualSavings: '36000', // $3k/mo — the ownership premium swamps it (negative net contribution)
  targetAnnualRetirementSpend: '70000',
};

const inputFor = (scenario: ScenarioInputs, household?: Household): EngineInput =>
  engineInput({ asOf: ASOF, assumptions: DEFAULT_ASSUMPTIONS, scenario, household });

describe('fiImpact — both paths + FI-date delta (FI-01 / FI-03, D-04 / D-05)', () => {
  test('surfaces both per-path FiOutcomes AND both targets (D-02 visibility)', () => {
    const r = fiImpact(inputFor(COMFORTABLE_SCENARIO, COMFORTABLE_HOUSEHOLD));
    expect(r.baseline.kind === 'reached' || r.baseline.kind === 'unreached').toBe(true);
    expect(r.buy.kind === 'reached' || r.buy.kind === 'unreached').toBe(true);
    // All four FI targets surface as Money (the fairness fulcrum is never buried, D-02).
    expect(typeof r.targets.renterTarget.toDecimalString()).toBe('string');
    expect(typeof r.targets.ownerTarget.toDecimalString()).toBe('string');
    expect(typeof r.targets.renterHousingAnnual.toDecimalString()).toBe('string');
    expect(typeof r.targets.ownerHousingAnnual.toDecimalString()).toBe('string');
  });

  test('when both paths reach, the delta = owner FI month − renter FI month (months AND years)', () => {
    const r = fiImpact(inputFor(COMFORTABLE_SCENARIO, COMFORTABLE_HOUSEHOLD));
    // The comfortable fixture is constructed so both paths reach within the horizon.
    expect(r.baseline.kind).toBe('reached');
    expect(r.buy.kind).toBe('reached');
    if (r.baseline.kind === 'reached' && r.buy.kind === 'reached') {
      const expectedMonths = r.buy.month - r.baseline.month;
      expect(r.fiDeltaMonths).toBe(expectedMonths);
      // years = months / 12 as a decimal STRING (Dec — never a float).
      expect(r.fiDeltaYears).toBe(new Dec(expectedMonths).div(12).toFixed());
    }
  });

  test('a higher-priced house delays the owner FI date (the premium decomposition bites)', () => {
    const cheaper = fiImpact(inputFor(COMFORTABLE_SCENARIO, COMFORTABLE_HOUSEHOLD));
    const pricier = fiImpact(
      inputFor({ ...COMFORTABLE_SCENARIO, price: '900000' }, COMFORTABLE_HOUSEHOLD),
    );
    // Both reach (comfortable household), and the pricier owner FI month is no earlier — a bigger
    // premium + a higher owner target can only push the owner FI date later (or no earlier).
    expect(cheaper.buy.kind).toBe('reached');
    expect(pricier.buy.kind).toBe('reached');
    if (cheaper.buy.kind === 'reached' && pricier.buy.kind === 'reached') {
      expect(pricier.buy.month).toBeGreaterThanOrEqual(cheaper.buy.month);
    }
  });

  test('the renter baseline is unchanged by the house price (it never buys)', () => {
    const a = fiImpact(inputFor(COMFORTABLE_SCENARIO, COMFORTABLE_HOUSEHOLD));
    const b = fiImpact(
      inputFor({ ...COMFORTABLE_SCENARIO, price: '900000' }, COMFORTABLE_HOUSEHOLD),
    );
    // The renter baseline depends only on currentRent + savings + NW (D-05), not the house price.
    expect(a.baseline).toEqual(b.baseline);
  });
});

describe('fiImpact — the anti-funnel "don\'t buy" outcome (FI-06)', () => {
  test('a realistic strained scenario yields buy:unreached while baseline:reached', () => {
    const r = fiImpact(inputFor(STRAINED_SCENARIO, STRAINED_HOUSEHOLD));
    // The honest don't-buy signal: buying never reaches FI within the horizon, renting does.
    expect(r.buy.kind).toBe('unreached');
    expect(r.baseline.kind).toBe('reached');
  });

  test('when either path is unreached, BOTH deltas are null (a delta needs two reached dates)', () => {
    const r = fiImpact(inputFor(STRAINED_SCENARIO, STRAINED_HOUSEHOLD));
    expect(r.fiDeltaMonths).toBeNull();
    expect(r.fiDeltaYears).toBeNull();
  });
});

describe('fiImpact — requires household (the FI number lives on the household)', () => {
  test('throws a clear error when household is absent', () => {
    expect(() => fiImpact(inputFor(COMFORTABLE_SCENARIO, undefined))).toThrow(/household/i);
  });
});

describe('fiImpact — determinism (no Date.now / Math.random)', () => {
  test('same input => same result', () => {
    const a = fiImpact(inputFor(COMFORTABLE_SCENARIO, COMFORTABLE_HOUSEHOLD));
    const b = fiImpact(inputFor(COMFORTABLE_SCENARIO, COMFORTABLE_HOUSEHOLD));
    expect(a).toEqual(b);
  });
});
