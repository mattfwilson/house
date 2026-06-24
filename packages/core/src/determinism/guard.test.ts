// Runtime determinism guard (D-12/D-13 runtime half): after install, the ambient
// nondeterminism hazards (Date.now / Math.random / new Date() / performance.now /
// crypto.getRandomValues) must THROW if ever reached, while deterministic construction
// (new Date(explicitArg)) must still work.
//
// NOTE: the core Vitest setupFile (guard.setup.ts) already installs the guard for the
// whole test run. These tests save/restore the globals around an explicit install so
// they assert the guard's behavior in isolation without depending on setup order, and
// without poisoning other test files.
import { describe, test, expect, afterEach } from 'vitest';
import { installDeterminismGuard } from './guard.js';

const realDate = globalThis.Date;
const realDateNow = Date.now;
const realRandom = Math.random;
const perf = (globalThis as { performance?: { now?: unknown } }).performance;
const realPerfNow = perf?.now;
const cryptoObj = (globalThis as { crypto?: { getRandomValues?: unknown } }).crypto;
const realGetRandomValues = cryptoObj?.getRandomValues;

afterEach(() => {
  // Restore the genuine implementations so this file leaves globals as it found them.
  globalThis.Date = realDate;
  Date.now = realDateNow;
  Math.random = realRandom;
  if (perf && realPerfNow !== undefined) perf.now = realPerfNow;
  if (cryptoObj && realGetRandomValues !== undefined) cryptoObj.getRandomValues = realGetRandomValues;
});

describe('installDeterminismGuard', () => {
  test('makes Date.now throw, naming Date.now', () => {
    installDeterminismGuard();
    expect(() => Date.now()).toThrow(/Date\.now/);
  });

  test('makes Math.random throw, naming Math.random', () => {
    installDeterminismGuard();
    expect(() => Math.random()).toThrow(/Math\.random/);
  });

  test('the thrown error identifies it as core nondeterminism', () => {
    installDeterminismGuard();
    expect(() => Date.now()).toThrow(/Nondeterminism in core/);
  });

  test('makes the zero-arg new Date() (clock read) throw (D-13)', () => {
    installDeterminismGuard();
    expect(() => new Date()).toThrow(/new Date\(\)/);
    expect(() => new Date()).toThrow(/Nondeterminism in core/);
  });

  test('still allows deterministic new Date(explicitArg)', () => {
    installDeterminismGuard();
    // Construction from an explicit, deterministic argument is permitted.
    const d = new Date(0);
    expect(d).toBeInstanceOf(Date);
    expect(d.getTime()).toBe(0);
    const iso = new Date('2020-01-02T03:04:05.000Z');
    expect(iso.toISOString()).toBe('2020-01-02T03:04:05.000Z');
  });

  test('makes performance.now throw (if performance is present)', () => {
    if (!perf || typeof realPerfNow !== 'function') return; // host has no performance.now
    installDeterminismGuard();
    expect(() => (perf as { now: () => number }).now()).toThrow(/performance\.now/);
  });

  test('makes crypto.getRandomValues throw (if crypto is present)', () => {
    if (!cryptoObj || typeof realGetRandomValues !== 'function') return; // host has no crypto
    installDeterminismGuard();
    expect(() =>
      (cryptoObj as { getRandomValues: (a: Uint8Array) => unknown }).getRandomValues(
        new Uint8Array(4),
      ),
    ).toThrow(/crypto\.getRandomValues/);
  });
});
