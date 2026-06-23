// runCanary — the deterministic "proof-of-machinery" computation (D-08).
//
// This is NOT a trivial echo. It exercises the real engine substrate the future FI oracle
// (FI-05) will trust:
//   - it READS an AssumptionSet slice (`returns.realAnnual`) instead of hardcoding a rate;
//   - it does REAL multi-period Decimal compounding — `(1 + r)^n` at full precision via the
//     frozen `Dec` clone (banker's rounding, 34-digit precision);
//   - it carries dollars as `Money` (decimal-precise), rounding to cents ONLY at the
//     `toCents()` boundary — never per-operation (D-03);
//   - it takes `asOf` from the `EngineInput`, never a clock (the determinism guard makes
//     `Date.now()` throw inside core anyway).
//
// Same EngineInput in -> byte-identical canonical result out. That property is what the
// golden-master harness freezes and replays.
import { Dec } from '../money/decimal-config.js';
import { Money } from '../money/money.js';
import type { EngineInput } from './engine-input.js';
import type { CalendarDate } from '../time/calendar-date.js';

/** Number of compounding periods the canary projects (fixed; part of the canary's shape). */
const CANARY_PERIODS = 30;

/** The starting principal the canary compounds (a fixed decimal string — no float). */
const CANARY_PRINCIPAL = '100000';

/**
 * The canary result: full-precision `Money` values (rounded only at their `toCents()`
 * boundary) plus the scalar inputs it compounded with, so the golden master records both
 * the computation AND the assumption slice it read.
 */
export interface CanaryResult {
  readonly asOf: CalendarDate;
  readonly periods: number;
  /** The realAnnual rate slice that was read and compounded (decimal string). */
  readonly realAnnual: string;
  /** The starting amount before compounding. */
  readonly principal: Money;
  /** principal * (1 + realAnnual)^periods, full precision (rounds only at toCents). */
  readonly final: Money;
  /** final - principal. */
  readonly gain: Money;
}

/**
 * Run the deterministic canary over a frozen EngineInput. Reads `returns.realAnnual`,
 * compounds the fixed principal over `CANARY_PERIODS`, and returns the growth — the
 * representative-of-FI computation the reproducibility loop is built on.
 */
export function runCanary(input: EngineInput): CanaryResult {
  const realAnnual = input.assumptions.returns.realAnnual;

  // Compounding FACTOR = (1 + r)^n, computed at full Dec precision (HALF_EVEN, 34 digits).
  // `.pow` on the frozen clone keeps every intermediate digit; we only flatten to a string
  // to feed Money.mul (which itself retains full precision through the multiply).
  const growthFactor = new Dec(1).plus(new Dec(realAnnual)).pow(CANARY_PERIODS);

  const principal = Money.of(CANARY_PRINCIPAL);
  const final = principal.mul(growthFactor.toFixed());
  const gain = final.sub(principal);

  return {
    asOf: input.asOf,
    periods: CANARY_PERIODS,
    realAnnual,
    principal,
    final,
    gain,
  };
}
