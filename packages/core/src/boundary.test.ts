// Pitfall-1 negative test: proves the lint boundary actually FAILS the build on a
// framework import (CORE-01). A convention is a hope; this test makes it a guarantee.
//
// We shell out to the real eslint CLI against the react-importing fixture and assert
// a NON-zero exit. Written portably with Node `execSync` (NOT a POSIX `test $?` idiom)
// so it runs the same on Windows/PowerShell and POSIX.
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { test, expect, describe } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
// repo root is two levels up from packages/core/src
const repoRoot = resolve(here, '..', '..', '..');
const fixtureDir = resolve(here, '_lint-fixtures');
const fixture = resolve(fixtureDir, 'framework-import.fixture.ts');

/** Run eslint on a single file; return { code, output }. Never throws. */
function runEslint(targetFile: string): { code: number; output: string } {
  try {
    // --no-ignore: the fixture is in the repo-wide ignore list (so `eslint .` stays
    // green for real code); we lint it explicitly here to prove the guard trips.
    const out = execSync(
      `npx eslint --no-ignore "${targetFile}"`,
      { cwd: repoRoot, stdio: 'pipe', encoding: 'utf8' },
    );
    return { code: 0, output: out };
  } catch (err: unknown) {
    const e = err as { status?: number; stdout?: Buffer | string; stderr?: Buffer | string };
    const output = `${e.stdout?.toString() ?? ''}${e.stderr?.toString() ?? ''}`;
    return { code: e.status ?? 1, output };
  }
}

test('lint REJECTS a framework import in core (CORE-01)', () => {
  const { code, output } = runEslint(fixture);

  // The throw/non-zero path is the PASS path. A clean (zero) exit FAILS the test.
  expect(code).not.toBe(0);
  // And the failure must be attributable to a boundary/framework guard, not some
  // unrelated lint error.
  expect(output).toMatch(/boundaries\/external|no-restricted-imports|react/i);
});

// WR-04: prove deny-by-default covers ARBITRARY externals, not just framework names. The
// `boundaries/external` rule is deprecated; this test (plus the exact version pin in
// package.json) is the safety net — if the rule is ever removed/disabled, an arbitrary
// disallowed external import stops failing and THIS test goes red, surfacing the silent
// un-guarding of the core loudly.
test('lint REJECTS an arbitrary non-allowlisted external import in core (CORE-01, WR-04)', () => {
  const externalFixture = resolve(fixtureDir, 'external-import.fixture.ts');
  const { code, output } = runEslint(externalFixture);

  // Non-zero exit is the PASS path; a clean exit means deny-by-default regressed.
  expect(code).not.toBe(0);
  // Attributable to the deny-by-default external guard (mentions the module or the rule).
  expect(output).toMatch(/boundaries\/external|node:fs|no rule allowing/i);
});

// WR-05: the determinism rules (D-12/D-13) are the phase's headline deliverable, so the
// *absence* of enforcement tests was itself the defect. Each fixture exercises both the
// direct and the globalThis-qualified evasion form (WR-03); we assert lint trips on each
// and that the failure is attributable to the intended determinism rule (not noise).
describe('lint REJECTS each determinism hazard in core (D-12/D-13, WR-05)', () => {
  const cases: ReadonlyArray<{ name: string; file: string; rule: RegExp }> = [
    {
      name: 'Date.now (direct + globalThis-qualified)',
      file: 'determinism-date-now.fixture.ts',
      rule: /no-restricted-syntax|Date\.now/i,
    },
    {
      name: 'Math.random (direct + globalThis-qualified)',
      file: 'determinism-math-random.fixture.ts',
      rule: /no-restricted-syntax|Math\.random/i,
    },
    {
      name: 'new Date (bare + globalThis.Date)',
      file: 'determinism-new-date.fixture.ts',
      rule: /no-restricted-syntax|CalendarDate|D-13/i,
    },
    {
      name: 'performance.now (direct + globalThis-qualified)',
      file: 'determinism-performance-now.fixture.ts',
      rule: /no-restricted-syntax|no-restricted-globals|performance/i,
    },
    {
      name: 'crypto.getRandomValues (direct + globalThis-qualified)',
      file: 'determinism-crypto-random.fixture.ts',
      rule: /no-restricted-syntax|no-restricted-globals|crypto/i,
    },
  ];

  test.each(cases)('rejects $name', ({ file, rule }) => {
    const { code, output } = runEslint(resolve(fixtureDir, file));
    // Non-zero exit is the PASS path; a clean exit means the guard regressed.
    expect(code).not.toBe(0);
    // The failure must be attributable to the intended determinism rule, not noise.
    expect(output).toMatch(rule);
  });
});
