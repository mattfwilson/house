// runCanary — a deterministic, representative compounding computation (D-08).
//
// The canary is the proof-of-machinery the golden harness (and the future FI oracle)
// trusts: it does REAL Decimal compounding over multiple periods, reads at least one
// AssumptionSet slice (returns.realAnnual), rounds Money only at the boundary, and takes
// `asOf` from the EngineInput — never a clock. So: same input in → same result out.
import { describe, test, expect } from 'vitest';
import { runCanary } from './canary.js';
import { engineInput } from './engine-input.js';
import { DEFAULT_ASSUMPTIONS } from '../assumptions/defaults.js';
import { calendarDate } from '../time/calendar-date.js';
import { Money } from '../money/money.js';

const fixedInput = () =>
  engineInput({
    asOf: calendarDate('2026-01-01'),
    assumptions: DEFAULT_ASSUMPTIONS,
    scenario: { label: 'canary' },
  });

describe('runCanary is deterministic', () => {
  test('two runs on the same frozen EngineInput produce deep-equal results', () => {
    const a = runCanary(fixedInput());
    const b = runCanary(fixedInput());
    // Compare via the public Money surface (decimal strings) — deep-equal cent-identical.
    expect(a.final.toDecimalString()).toBe(b.final.toDecimalString());
    expect(a.principal.toDecimalString()).toBe(b.principal.toDecimalString());
    expect(a.gain.toDecimalString()).toBe(b.gain.toDecimalString());
    expect(a.asOf).toBe(b.asOf);
    expect(a.periods).toBe(b.periods);
    expect(a.realAnnual).toBe(b.realAnnual);
  });
});

describe('runCanary reads an AssumptionSet slice and threads asOf from input', () => {
  test('the result echoes the realAnnual assumption it compounded with', () => {
    const result = runCanary(fixedInput());
    expect(result.realAnnual).toBe(DEFAULT_ASSUMPTIONS.returns.realAnnual);
  });

  test('asOf comes from the EngineInput, not a clock', () => {
    const result = runCanary(fixedInput());
    expect(result.asOf).toBe('2026-01-01');
  });
});

describe('runCanary does real multi-period compounding rounded at the boundary', () => {
  test('output contains Money values', () => {
    const result = runCanary(fixedInput());
    expect(result.final).toBeInstanceOf(Money);
    expect(result.principal).toBeInstanceOf(Money);
    expect(result.gain).toBeInstanceOf(Money);
  });

  test('compounding grows the principal (final > principal at a positive return)', () => {
    const result = runCanary(fixedInput());
    // gain = final - principal must be positive for realAnnual = 0.05 over N>0 periods.
    expect(result.gain.toCents() > 0n).toBe(true);
    expect(result.final.toCents() > result.principal.toCents()).toBe(true);
  });

  test('a different realAnnual produces a different final (the slice is load-bearing)', () => {
    const base = runCanary(fixedInput());
    const altered = runCanary(
      engineInput({
        asOf: calendarDate('2026-01-01'),
        assumptions: { ...DEFAULT_ASSUMPTIONS, returns: { realAnnual: '0.10' } },
        scenario: { label: 'canary' },
      }),
    );
    expect(altered.final.toDecimalString()).not.toBe(base.final.toDecimalString());
    expect(altered.final.toCents() > base.final.toCents()).toBe(true);
  });
});
