// evaluateScenario — the per-scenario REPORT path (D-06). Unlike the bank/true SOLVERS (which
// search for a max price), this REPORTS the affordability picture at a FIXED, already-priced
// scenario: "for THIS house at THIS price, where do our DTI ratios land, do they pass, and what
// does it do to our savings rate?"
//
// It runs `computeTco` ONCE on `input.scenario` (D-06 — no solving, no bisection) and REUSES the
// established derivations rather than re-deriving any ratio math:
//   - `frontEndRatio` / `backEndRatio` from `dti.ts` (the D-14 lender numerator over GROSS-monthly
//     income, Pitfall 1/2).
//   - `cashSavingsDrain` from `true-affordability.ts` (the SECOND D-14 numerator, keeps maintenance)
//     for the post-purchase savings-rate impact (the same D-03/D-04/D-17 derivation the
//     true-affordability savings floor uses — incremental over `currentRent`, `currentAnnualSavings`
//     baseline, GROSS denominator).
//
// REPORTED FIELDS:
//   - frontEndRatio / backEndRatio — decimal strings (the dti.ts Dec ratios, `.toFixed()`).
//   - frontEndPass / backEndPass   — ratio <= the matching `assumptions.dti.*` threshold (Shared P4
//     — thresholds READ from the assumptions, never hardcoded).
//   - savingsRateImpact            — the post-purchase savings rate (decimal string).
//   - headroom                     — the Dec margin (decimal string) below the BINDING DTI ceiling
//     (the ceiling NEAREST its threshold; front-end wins ties — the bank-affordability binding
//     convention). >= 0 ⇔ the scenario passes the binding ceiling; < 0 ⇔ it fails.
//
// Dec/Money discipline: ratios and headroom are computed in the frozen `Dec` clone and returned as
// decimal strings; no bare-number dollar field is produced. `Dec` is not re-exported. CORE-02 holds.
import { Dec } from '../money/decimal-config.js';
import type { EngineInput, Household } from '../engine/engine-input.js';
import { computeTco, type TcoBreakdown } from '../tco/tco.js';
import { frontEndRatio, backEndRatio } from './dti.js';
import { cashSavingsDrain } from './true-affordability.js';

/** The closed per-scenario evaluate result (D-06). Ratios/impact/headroom are decimal strings. */
export interface EvaluateScenarioResult {
  /** Front-end (housing) DTI ratio at the scenario price, decimal string. */
  readonly frontEndRatio: string;
  /** Back-end (total-debt) DTI ratio at the scenario price, decimal string. */
  readonly backEndRatio: string;
  /** `frontEndRatio <= assumptions.dti.frontEnd`. */
  readonly frontEndPass: boolean;
  /** `backEndRatio <= assumptions.dti.backEnd`. */
  readonly backEndPass: boolean;
  /** The post-purchase savings RATE (D-03/D-04/D-17), decimal string — the savings impact. */
  readonly savingsRateImpact: string;
  /** Dec margin below the BINDING DTI ceiling, decimal string. >= 0 ⇔ passes; < 0 ⇔ fails. */
  readonly headroom: string;
}

/**
 * The post-purchase savings RATE at the priced scenario (the SAME D-03/D-04/D-17 derivation the
 * true-affordability savings floor uses):
 *   premium = (cashSavingsDrain − currentRent) × 12   (incremental over rent, D-03)
 *   post    = currentAnnualSavings − premium          (currentAnnualSavings baseline, D-17)
 *   rate    = post / grossAnnualIncome                (GROSS denominator, D-04)
 */
function savingsRateAt(tco: TcoBreakdown, household: Household): InstanceType<typeof Dec> {
  const drain = new Dec(cashSavingsDrain(tco).toDecimalString());
  const premium = drain.minus(new Dec(household.currentRent)).times(12);
  const post = new Dec(household.currentAnnualSavings).minus(premium);
  return post.div(new Dec(household.grossAnnualIncome));
}

/**
 * Evaluate an already-priced scenario for a household (D-06): report the DTI ratios, pass/fail
 * flags, savings-rate impact, and headroom below the binding DTI ceiling. Runs `computeTco` ONCE.
 *
 * Requires `input.household` — an evaluation qualifies a borrower against a house, not a bare house.
 */
export function evaluateScenario(input: EngineInput): EvaluateScenarioResult {
  const household = input.household;
  if (household === undefined) {
    throw new Error(
      'evaluateScenario requires input.household — a per-scenario evaluation measures a priced ' +
        'house against the household income, debt, and savings goal. Build the EngineInput with a ' +
        'household block.',
    );
  }

  // ONE TCO pass on the already-priced scenario (D-06 — this path reports, it does NOT solve).
  const tco = computeTco(input);

  const frontThreshold = new Dec(input.assumptions.dti.frontEnd);
  const backThreshold = new Dec(input.assumptions.dti.backEnd);
  const front = frontEndRatio(tco, household.grossAnnualIncome);
  const back = backEndRatio(tco, household.grossAnnualIncome, household.existingMonthlyDebt);

  const frontEndPass = front.lessThanOrEqualTo(frontThreshold);
  const backEndPass = back.lessThanOrEqualTo(backThreshold);

  // Headroom below the BINDING ceiling (the one NEAREST its threshold — smallest remaining margin;
  // front-end wins ties, the bank-affordability binding convention). A negative headroom means the
  // binding ceiling is exceeded (the scenario fails).
  const frontGap = frontThreshold.minus(front);
  const backGap = backThreshold.minus(back);
  const headroom = frontGap.lessThanOrEqualTo(backGap) ? frontGap : backGap;

  const savingsRateImpact = savingsRateAt(tco, household);

  return {
    frontEndRatio: front.toFixed(),
    backEndRatio: back.toFixed(),
    frontEndPass,
    backEndPass,
    savingsRateImpact: savingsRateImpact.toFixed(),
    headroom: headroom.toFixed(),
  };
}
