// Golden-master reproducibility harness (PROF-04, D-08/D-09/D-10).
//
// This is the substrate the future FI oracle (FI-05) will trust: it proves the engine
// machinery (real Decimal compounding + banker's rounding + an AssumptionSet read) is
// DETERMINISTIC and REPRODUCIBLE before any persistence exists.
//
// Two assertions:
//   1. GOLDEN COMPARE: build a FIXED EngineInput, run the canary, serialize with
//      canonicalJson, and deep-equal it against a committed frozen fixture. Mutating a
//      single cent in the fixture makes this fail (cent-identical enforcement, D-10).
//   2. ROUND-TRIP: serialize the EngineInput to canonical JSON, parse it back THROUGH the
//      Zod boundary (parseAssumptionSet) + calendarDate, re-run the canary, and assert the
//      recomputed canonical result equals the first — proving serialize->deserialize->
//      recompute is lossless (D-08 data reproducibility) before persistence exists.
//
// Regeneration is EXPLICIT and REVIEWABLE: only `UPDATE_GOLDEN=1` (via `npm run update-golden`)
// rewrites the fixture, producing a git diff a human reviews. We deliberately do NOT use
// Vitest `toMatchSnapshot` — `-u` / first-run auto-write would silently re-bless drift,
// which is exactly the tampering threat (T-04-01) this harness defends against.
//
// ESLint note: this file reads `process.env.UPDATE_GOLDEN` — the ONLY env read permitted,
// scoped to this file by a documented override in eslint.config.ts (test harness, not core
// runtime). See the `golden.test.ts` override block there (T-04-04).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { describe, test, expect } from 'vitest';
import { engineInput, type EngineInput } from './engine/engine-input.js';
import { runCanary, type CanaryResult } from './engine/canary.js';
import { canonicalJson } from './serialize/canonical-json.js';
import { DEFAULT_ASSUMPTIONS } from './assumptions/defaults.js';
import { parseAssumptionSet } from './assumptions/assumption-set.js';
import { calendarDate } from './time/calendar-date.js';
import type { CurrentAssumptionSet } from './assumptions/schema.js';

const here = dirname(fileURLToPath(import.meta.url));
const GOLDEN_PATH = resolve(here, '__fixtures__', 'golden-snapshot.json');

/**
 * THE frozen input the golden master is computed from. Fixed `asOf` (never a clock) +
 * DEFAULT_ASSUMPTIONS. Identical on every run, on every machine.
 */
function fixedInput(): EngineInput {
  return engineInput({
    asOf: calendarDate('2026-01-01'),
    assumptions: DEFAULT_ASSUMPTIONS,
    scenario: { label: 'golden-canary' },
  });
}

/** Canonical-JSON form of a canary result (the comparable golden artifact). */
function canonicalResult(result: CanaryResult): string {
  return canonicalJson({
    asOf: result.asOf,
    periods: result.periods,
    realAnnual: result.realAnnual,
    principal: result.principal,
    final: result.final,
    gain: result.gain,
  });
}

describe('golden master: the canary recomputes cent-identically (PROF-04)', () => {
  test('produced canonical result deep-equals the committed golden fixture', () => {
    const produced = canonicalResult(runCanary(fixedInput()));

    // Gated regeneration ONLY (reviewable git diff). NOT toMatchSnapshot (auto-blesses).
    if (process.env.UPDATE_GOLDEN === '1') {
      mkdirSync(dirname(GOLDEN_PATH), { recursive: true });
      writeFileSync(GOLDEN_PATH, produced + '\n', 'utf8');
      return;
    }

    const golden = readFileSync(GOLDEN_PATH, 'utf8').trim();
    expect(produced).toBe(golden);
  });
});

describe('snapshot round-trip is lossless (D-08 data reproducibility)', () => {
  test('serialize -> deserialize -> recompute yields the identical canonical result', () => {
    const original = fixedInput();
    const first = canonicalResult(runCanary(original));

    // Serialize the EngineInput to canonical JSON (the snapshot a persistence layer would
    // store), then rebuild it THROUGH the boundary validators — never trusting raw JSON.
    const snapshot = JSON.parse(
      canonicalJson({
        asOf: original.asOf,
        assumptions: original.assumptions,
        scenario: original.scenario,
      }),
    ) as { asOf: string; assumptions: unknown; scenario: { label: string } };

    const rebuilt = engineInput({
      asOf: calendarDate(snapshot.asOf),
      assumptions: parseAssumptionSet(snapshot.assumptions) as CurrentAssumptionSet,
      scenario: { label: snapshot.scenario.label },
    });

    const second = canonicalResult(runCanary(rebuilt));
    expect(second).toBe(first);
  });
});
