// Pitfall-1 negative test: proves the lint boundary actually FAILS the build on a
// framework import (CORE-01). A convention is a hope; this test makes it a guarantee.
//
// We shell out to the real eslint CLI against the react-importing fixture and assert
// a NON-zero exit. Written portably with Node `execSync` (NOT a POSIX `test $?` idiom)
// so it runs the same on Windows/PowerShell and POSIX.
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { test, expect } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
// repo root is two levels up from packages/core/src
const repoRoot = resolve(here, '..', '..', '..');
const fixture = resolve(here, '_lint-fixtures', 'framework-import.fixture.ts');

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
