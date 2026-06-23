// index.ts — the public @house/core surface (the stable import boundary for every
// downstream phase). This test asserts the phase's primitives are re-exported AND that
// the raw Decimal class / Dec's raw API are NOT leaked (downstream code goes through
// Money, never raw decimal.js).
import { describe, test, expect } from 'vitest';
import * as core from './index.js';

describe('@house/core public surface re-exports the phase primitives', () => {
  test('exposes the core value primitives', () => {
    expect(typeof core.Money).toBe('function'); // class
    expect(typeof core.calendarDate).toBe('function');
  });

  test('exposes the assumptions surface (types + defaults + migrate)', () => {
    expect(core.DEFAULT_ASSUMPTIONS).toBeDefined();
    expect(typeof core.parseAssumptionSet).toBe('function');
    expect(typeof core.serializeAssumptionSet).toBe('function');
    expect(typeof core.migrate).toBe('function');
    expect(core.AssumptionSetSchema).toBeDefined();
  });

  test('exposes the EngineInput factory', () => {
    expect(typeof core.engineInput).toBe('function');
  });

  test('exposes the canary and the canonical serializer', () => {
    expect(typeof core.runCanary).toBe('function');
    expect(typeof core.canonicalJson).toBe('function');
  });
});

describe('@house/core does NOT leak raw decimal.js', () => {
  test('Decimal is not exported', () => {
    expect('Decimal' in core).toBe(false);
  });

  test('the raw Dec constructor is not exported (downstream uses Money)', () => {
    expect('Dec' in core).toBe(false);
    expect('DecimalInstance' in core).toBe(false);
  });
});
