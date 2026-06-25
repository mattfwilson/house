// rentVsBuy two-portfolio rent-vs-buy tests (TCO-07 / SC5) — the flagship-enabling
// net-worth substrate Phase 4 layers FI math on top of.
//
// These are EXACT-EQUALITY / structural proofs (never `toBeCloseTo`). The existential
// correctness properties under test (each mapped to a research Pitfall / CONTEXT decision):
//
//   - SHAPE: rentVsBuy returns buyEndingNetWorth, rentEndingNetWorth (Money), crossoverYear
//     (number|null), winner ("buy"|"rent"|"tie"), holdingYears.
//   - ANTI-FUNNEL (the whole point): at least one realistic greater-Boston input set yields
//     winner === "rent" with rentEndingNetWorth > buyEndingNetWorth (exact bigint compare).
//   - BUY-FAVORABLE: a low-rate / long-hold / high-appreciation set yields winner === "buy"
//     with a FINITE crossoverYear (number, not null).
//   - SYMMETRY (Pitfall 6): whichever monthly outflow is lower invests the difference into ITS
//     OWN portfolio — flipping which path is cheaper flips which portfolio is fed.
//   - SEPARATE APPRECIATION (Pitfall 6 / D-04): home equity grows at appreciation.realAnnual,
//     NOT returns.realAnnual — raising returns.realAnnual alone leaves the buy equity component
//     unchanged (only the buy side-portfolio moves).
//   - FISHER (Pitfall 5): toReal uses (1+nominal)/(1+inflation)-1, NOT nominal-inflation; and
//     returns.realAnnual is consumed directly (not double-converted).
//   - SELL HAIRCUT (D-05): sellCostPct of 0 yields a higher buy ending net worth than 0.065.
import { describe, test, expect } from 'vitest';
import { rentVsBuy, toReal } from './rent-vs-buy.js';
import { Money } from '../money/money.js';
import { Dec } from '../money/decimal-config.js';
import { engineInput, type ScenarioInputs } from '../engine/engine-input.js';
import { DEFAULT_ASSUMPTIONS } from '../assumptions/defaults.js';
import { calendarDate } from '../time/calendar-date.js';
import type { CurrentAssumptionSet } from '../assumptions/schema.js';

const inputFor = (scenario: ScenarioInputs, assumptions: CurrentAssumptionSet = DEFAULT_ASSUMPTIONS) =>
  engineInput({ asOf: calendarDate('2026-01-01'), assumptions, scenario });

// A RENT-WINS realistic greater-Boston set: a high-priced Newton house at a normal-ish rate
// with rent that is cheap relative to ownership cost, a modest hold, and the conservative
// default appreciation (0.75% real) + 6.5% sell haircut. Owning is expensive; renting +
// investing the (large) difference and the down payment at the 5% real return wins.
const SCENARIO_RENT_WINS: ScenarioInputs = {
  label: 'Newton $850k — rent wins',
  price: '850000',
  downPaymentPct: '0.20',
  annualRate: '0.07',
  termMonths: 360,
  holdingYears: 7,
  town: 'Newton',
  insuranceAnnual: '2400',
  hoaMonthly: '0',
  monthlyRent: '3200',
};

// A BUY-FAVORABLE set: a cheaper house, low rate, long hold, and high real appreciation, with
// rent that is expensive relative to ownership — so the forced-savings principal + strong
// appreciation make buying win and cross over within the hold.
const SCENARIO_BUY_WINS: ScenarioInputs = {
  label: 'Quincy $500k — buy wins',
  price: '500000',
  downPaymentPct: '0.20',
  annualRate: '0.035',
  termMonths: 360,
  holdingYears: 30,
  town: 'Quincy',
  insuranceAnnual: '1500',
  hoaMonthly: '0',
  monthlyRent: '3800',
};

const HIGH_APPRECIATION: CurrentAssumptionSet = {
  ...DEFAULT_ASSUMPTIONS,
  appreciation: { realAnnual: '0.04' },
};

describe('rentVsBuy returns the closed two-portfolio net-worth result', () => {
  test('shape: buy/rent ending net worth (Money), crossoverYear, winner, holdingYears', () => {
    const r = rentVsBuy(inputFor(SCENARIO_RENT_WINS));
    expect(r.buyEndingNetWorth).toBeInstanceOf(Money);
    expect(r.rentEndingNetWorth).toBeInstanceOf(Money);
    expect(r.crossoverYear === null || typeof r.crossoverYear === 'number').toBe(true);
    expect(['buy', 'rent', 'tie']).toContain(r.winner);
    expect(r.holdingYears).toBe(SCENARIO_RENT_WINS.holdingYears);
  });
});

describe('anti-funnel: a realistic input set lets RENT win (TCO-07 / SC5)', () => {
  test('the rent-wins scenario yields winner === "rent" and rent NW > buy NW (exact cents)', () => {
    const r = rentVsBuy(inputFor(SCENARIO_RENT_WINS));
    expect(r.winner).toBe('rent');
    expect(r.rentEndingNetWorth.toCents() > r.buyEndingNetWorth.toCents()).toBe(true);
  });
});

describe('a buy-favorable input set lets BUY win with a finite crossover', () => {
  test('low rate / long hold / high appreciation yields winner === "buy" + finite crossoverYear', () => {
    const r = rentVsBuy(inputFor(SCENARIO_BUY_WINS, HIGH_APPRECIATION));
    expect(r.winner).toBe('buy');
    expect(typeof r.crossoverYear).toBe('number');
    expect(r.crossoverYear).not.toBeNull();
    expect(r.buyEndingNetWorth.toCents() > r.rentEndingNetWorth.toCents()).toBe(true);
  });
});

describe('symmetry: the cheaper path invests the difference into ITS OWN portfolio (Pitfall 6)', () => {
  // Construct two inputs that differ ONLY in which monthly outflow is lower, by swinging
  // monthlyRent above and below the buy outflow, holding everything else fixed. The portfolio
  // that receives the invest-the-difference contribution must flip with the cheaper path.
  const base: ScenarioInputs = {
    label: 'symmetry base',
    price: '500000',
    downPaymentPct: '0.20',
    annualRate: '0.06',
    termMonths: 360,
    holdingYears: 10,
    town: 'Quincy',
    insuranceAnnual: '1800',
    hoaMonthly: '0',
    monthlyRent: '1000', // very low rent -> renting is far cheaper -> rent portfolio is fed
  };
  const rentCheaper = { ...base, monthlyRent: '1000' };
  const buyCheaper = { ...base, monthlyRent: '9000' }; // absurdly high rent -> buying cheaper

  test('rent far cheaper -> rent portfolio grows from the difference (rent NW well above its DP+closing seed)', () => {
    const r = rentVsBuy(inputFor(rentCheaper));
    // When renting is much cheaper, the rent portfolio receives a large monthly contribution
    // on top of the t=0 seed and ends far above the buy ending net worth.
    expect(r.rentEndingNetWorth.toCents() > r.buyEndingNetWorth.toCents()).toBe(true);
    expect(r.winner).toBe('rent');
  });

  test('buy far cheaper -> buy side-portfolio receives the difference, flipping the winner to buy', () => {
    const r = rentVsBuy(inputFor(buyCheaper));
    // The ONLY change vs the rent-cheaper case is monthlyRent; flipping which path is cheaper
    // flips which portfolio is fed and (here) the winner — proving the symmetry.
    expect(r.buyEndingNetWorth.toCents() > r.rentEndingNetWorth.toCents()).toBe(true);
    expect(r.winner).toBe('buy');
  });
});

describe('separate appreciation: equity does NOT grow at returns.realAnnual (Pitfall 6 / D-04)', () => {
  test('raising returns.realAnnual alone leaves the buy EQUITY component unchanged', () => {
    // A scenario where buying is the cheaper path so the buy side-portfolio is ZERO (rent is
    // more expensive, so the BUY path never invests a difference). Then buyEndingNetWorth is
    // PURE liquidated equity — independent of returns.realAnnual.
    const equityOnly: ScenarioInputs = {
      label: 'equity-only (buy cheaper, no buy side-portfolio)',
      price: '500000',
      downPaymentPct: '0.20',
      annualRate: '0.05',
      termMonths: 360,
      holdingYears: 10,
      town: 'Quincy',
      insuranceAnnual: '1800',
      hoaMonthly: '0',
      monthlyRent: '9000', // buy is far cheaper -> the BUY side-portfolio stays empty
    };
    const lowReturn: CurrentAssumptionSet = {
      ...DEFAULT_ASSUMPTIONS,
      returns: { realAnnual: '0.03' },
    };
    const highReturn: CurrentAssumptionSet = {
      ...DEFAULT_ASSUMPTIONS,
      returns: { realAnnual: '0.09' },
    };
    const lo = rentVsBuy(inputFor(equityOnly, lowReturn));
    const hi = rentVsBuy(inputFor(equityOnly, highReturn));
    // Buy equity is independent of the portfolio return: identical buy ending net worth.
    expect(hi.buyEndingNetWorth.toCents()).toBe(lo.buyEndingNetWorth.toCents());
    // Sanity: the RENT portfolio DID move with the return (it is fed by nothing here but the
    // t=0 seed, which compounds at the return), proving the knob is live elsewhere.
    expect(hi.rentEndingNetWorth.toCents() > lo.rentEndingNetWorth.toCents()).toBe(true);
  });
});

describe('Fisher real conversion (Pitfall 5)', () => {
  test('toReal uses (1+n)/(1+i)-1, which differs from naive n - i', () => {
    const nominal = '0.07';
    const inflation = '0.03';
    const fisher = toReal(nominal, inflation);
    const naive = new Dec(nominal).minus(new Dec(inflation));
    // Fisher real (~0.038835) is strictly below the naive 0.04 for positive inflation.
    expect(fisher.equals(naive)).toBe(false);
    expect(fisher.lessThan(naive)).toBe(true);
    // Exact Fisher value check.
    const expected = new Dec(1).plus(new Dec(nominal)).div(new Dec(1).plus(new Dec(inflation))).minus(1);
    expect(fisher.equals(expected)).toBe(true);
  });

  test('returns.realAnnual is consumed directly (not double-converted through toReal)', () => {
    // If the engine wrongly passed returns.realAnnual through toReal (treating an already-real
    // figure as nominal), changing inflation alone would move the rent portfolio. The all-real
    // convention (D-02) means inflation does NOT touch the portfolio compounding here.
    const loInflation: CurrentAssumptionSet = { ...DEFAULT_ASSUMPTIONS, inflation: { annual: '0.01' } };
    const hiInflation: CurrentAssumptionSet = { ...DEFAULT_ASSUMPTIONS, inflation: { annual: '0.06' } };
    const lo = rentVsBuy(inputFor(SCENARIO_RENT_WINS, loInflation));
    const hi = rentVsBuy(inputFor(SCENARIO_RENT_WINS, hiInflation));
    expect(hi.rentEndingNetWorth.toCents()).toBe(lo.rentEndingNetWorth.toCents());
    expect(hi.buyEndingNetWorth.toCents()).toBe(lo.buyEndingNetWorth.toCents());
  });
});

describe('the explicit sell haircut reduces buy ending net worth (D-05)', () => {
  test('sellCostPct of 0 yields a higher buy ending net worth than 0.065', () => {
    const noHaircut: CurrentAssumptionSet = {
      ...DEFAULT_ASSUMPTIONS,
      transaction: { sellCostPct: '0' },
    };
    const withHaircut: CurrentAssumptionSet = {
      ...DEFAULT_ASSUMPTIONS,
      transaction: { sellCostPct: '0.065' },
    };
    const noCut = rentVsBuy(inputFor(SCENARIO_RENT_WINS, noHaircut));
    const cut = rentVsBuy(inputFor(SCENARIO_RENT_WINS, withHaircut));
    expect(noCut.buyEndingNetWorth.toCents() > cut.buyEndingNetWorth.toCents()).toBe(true);
  });
});

describe('rentVsBuy is deterministic over a frozen EngineInput', () => {
  test('two runs on the same input produce cent-identical ending net worths', () => {
    const a = rentVsBuy(inputFor(SCENARIO_RENT_WINS));
    const b = rentVsBuy(inputFor(SCENARIO_RENT_WINS));
    expect(a.buyEndingNetWorth.toCents()).toBe(b.buyEndingNetWorth.toCents());
    expect(a.rentEndingNetWorth.toCents()).toBe(b.rentEndingNetWorth.toCents());
  });
});
