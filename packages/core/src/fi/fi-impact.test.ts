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
import { fiImpact, buyEquityAt } from './fi-impact.js';
import { homeValueAt } from '../tco/carrying-costs.js';
import { amortizationSchedule } from '../tco/amortization.js';

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

// WR-01 / IN-02 / IN-04 — the buy-path liquidated-equity YEAR convention is RECONCILED with
// rentVsBuy's year-boundary equity snapshot (rent-vs-buy.ts:242-245) and pinned here so the two
// instruments cannot be silently re-desynced later in a way that shifts FI dates (T-04-G4).
//
// The reconciled convention: `year = Math.max(0, Math.floor(month / 12))`, so
//   - month 12 → year 1 (one year of appreciation) — AGREES with rentVsBuy's `month/12` at the boundary
//   - month 0 → year 0 (NOT a negative year) — closes IN-02 (projection.ts:85 seeds with equityFor(0))
//   - months 1-11 → year 0 (a sensible per-month value between boundaries)
// The schedule-BALANCE index stays `month - 1` (it already agreed with rentVsBuy — must not regress).
describe('buyEquityAt — the reconciled equity-year convention (WR-01 / IN-02 / IN-04)', () => {
  // A fixed buy scenario whose primitives we can recompute from the public helpers below.
  const PRICE = '600000';
  const APPR = DEFAULT_ASSUMPTIONS.appreciation.realAnnual;
  const SELL_COST = DEFAULT_ASSUMPTIONS.transaction.sellCostPct;
  const DOWN_PCT = '0.20';
  const ANNUAL_RATE = '0.06375';
  const TERM_MONTHS = 360;
  const loan = new Dec(PRICE).times(new Dec(1).minus(new Dec(DOWN_PCT))).toFixed();
  const schedule = amortizationSchedule(loan, ANNUAL_RATE, TERM_MONTHS);
  const sellRetain = new Dec(1).minus(new Dec(SELL_COST));

  const equityAt = (month: number) =>
    buyEquityAt({ price: PRICE, appreciationRealAnnual: APPR, schedule, sellRetain, month });

  test('month 12 values the home at YEAR 1 — genuinely AGREES with rentVsBuy at the year boundary', () => {
    // rentVsBuy snapshots month-12 equity at year = 12/12 = 1 (one year of appreciation). The FI
    // buy path MUST value the same hold-month-12 home at the SAME year, not year 0 (the old bug).
    const homeValueY1 = new Dec(homeValueAt(PRICE, APPR, 1).toDecimalString());
    const balance12 = new Dec(schedule.rows[11]!.balance.toDecimalString());
    const expected = homeValueY1.minus(balance12).times(sellRetain);
    expect(equityAt(12).toFixed()).toBe(expected.toFixed());

    // And it is STRICTLY different from the old (year-0, no-appreciation) basis — proving the
    // reconciliation actually bit (year 1 > year 0 home value ⇒ more equity).
    const homeValueY0 = new Dec(homeValueAt(PRICE, APPR, 0).toDecimalString());
    const oldBasis = homeValueY0.minus(balance12).times(sellRetain);
    expect(equityAt(12).greaterThan(oldBasis)).toBe(true);
  });

  test('month 0 uses YEAR 0 — never a NEGATIVE year (closes IN-02)', () => {
    // projection.ts seeds the month-0 check with equityFor(0). The old `floor((0-1)/12) = -1`
    // would have valued the home at a NEGATIVE year. The clamp pins month 0 → year 0.
    const homeValueY0 = new Dec(homeValueAt(PRICE, APPR, 0).toDecimalString());
    // At month 0 there is no schedule row (index -1) → balance 0 (today's full equity, liquidated).
    const expected = homeValueY0.times(sellRetain);
    expect(equityAt(0).toFixed()).toBe(expected.toFixed());
  });

  test('the schedule-balance index stays month-1 at the year boundary (must not regress)', () => {
    // The balance component already AGREED with rentVsBuy (rent-vs-buy.ts:249 uses rows[month-1]).
    // Month 12 must still read rows[11].balance — only the appreciation YEAR was reconciled.
    const homeValueY1 = new Dec(homeValueAt(PRICE, APPR, 1).toDecimalString());
    const balanceRow11 = new Dec(schedule.rows[11]!.balance.toDecimalString());
    const expected = homeValueY1.minus(balanceRow11).times(sellRetain);
    expect(equityAt(12).toFixed()).toBe(expected.toFixed());
  });
});

describe('fiImpact — determinism (no Date.now / Math.random)', () => {
  test('same input => same result', () => {
    const a = fiImpact(inputFor(COMFORTABLE_SCENARIO, COMFORTABLE_HOUSEHOLD));
    const b = fiImpact(inputFor(COMFORTABLE_SCENARIO, COMFORTABLE_HOUSEHOLD));
    expect(a).toEqual(b);
  });
});
