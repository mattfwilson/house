// D-03 negative test: proves the app dependency-inversion boundary actually FAILS the build when a
// `services/**` file imports a CONCRETE adapter. A convention is a hope; this lint-as-test makes it
// a guarantee (mirrors packages/core/src/boundary.test.ts).
//
// We shell out to the real eslint CLI against the services->adapter fixture and assert a NON-zero
// exit. Written portably with Node `execSync` (NOT a POSIX `test $?` idiom) so it runs the same on
// Windows/PowerShell and POSIX.
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { describe, test, expect } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
// repo root is three levels up from packages/app/src
const repoRoot = resolve(here, '..', '..', '..');
const fixture = resolve(
  here,
  'services',
  '_lint-fixtures',
  'services-imports-adapter.fixture.ts',
);

/** Run eslint on a single file; return { code, output }. Never throws. */
function runEslint(targetFile: string): { code: number; output: string } {
  try {
    // --no-ignore: the fixture is in the repo-wide ignore list (so `eslint .` stays green for real
    // code); we lint it explicitly here to prove the D-03 guard trips.
    const out = execSync(`npx eslint --no-ignore "${targetFile}"`, {
      cwd: repoRoot,
      stdio: 'pipe',
      encoding: 'utf8',
    });
    return { code: 0, output: out };
  } catch (err: unknown) {
    const e = err as { status?: number; stdout?: Buffer | string; stderr?: Buffer | string };
    const output = `${e.stdout?.toString() ?? ''}${e.stderr?.toString() ?? ''}`;
    return { code: e.status ?? 1, output };
  }
}

describe('app D-03 boundary (lint-as-test)', () => {
  test('lint REJECTS a services -> concrete-adapter import (D-03)', () => {
    const { code, output } = runEslint(fixture);

    // The throw/non-zero path is the PASS path. A clean (zero) exit FAILS the test — it would mean
    // a services file could import a concrete adapter without the build failing.
    expect(code).not.toBe(0);
    // And the failure must be attributable to the app boundary guard, not some unrelated lint error.
    expect(output).toMatch(/boundaries\/element-types|services.*adapters/i);
  });
});
