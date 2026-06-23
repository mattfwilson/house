// Runtime determinism guard (D-12 runtime half): after install, the ambient
// nondeterminism hazards (Date.now / Math.random) must THROW if ever reached.
//
// NOTE: the core Vitest setupFile (guard.setup.ts) already installs the guard for the
// whole test run. These tests save/restore the globals around an explicit install so
// they assert the guard's behavior in isolation without depending on setup order, and
// without poisoning other test files.
import { describe, test, expect, afterEach } from 'vitest';
import { installDeterminismGuard } from './guard.js';

const realDateNow = Date.now;
const realRandom = Math.random;

afterEach(() => {
  // Restore the genuine implementations so this file leaves globals as it found them.
  Date.now = realDateNow;
  Math.random = realRandom;
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
});
