// Golden-master reproducibility harness (PROF-04, D-08/D-09/D-10).
//
// This is the substrate the future FI oracle (FI-05) will trust: it proves the engine
// machinery (real Decimal compounding + banker's rounding + an AssumptionSet read) is
// DETERMINISTIC and REPRODUCIBLE before any persistence exists.
//
// TWO golden artifacts are compared here:
//   1. CANARY golden (`golden-snapshot.json`): the Plan 01-04 proof-of-machinery compounding.
//   2. TCO golden (`tco-golden-snapshot.json`): the FULL `computeTco` + `rentVsBuy` result for a
//      fixed greater-Boston scenario — the whole TCO engine recomputing cent-identically (the
//      reproducibility loop closed before persistence, Plan 02-05).
//
// And a ROUND-TRIP assertion: serialize the EngineInput, parse the assumptions back THROUGH the
// Zod boundary (parseAssumptionSet) + calendarDate, re-run, and assert the recomputed canonical
// result equals the first — proving serialize->deserialize->recompute is lossless (D-08).
//
// Regeneration is EXPLICIT and REVIEWABLE: only `UPDATE_GOLDEN=1` (via `npm run update-golden`)
// rewrites a fixture, producing a git diff a human reviews. We deliberately do NOT use Vitest
// `toMatchSnapshot` — `-u` / first-run auto-write would silently re-bless drift, which is
// exactly the tampering threat (T-04-01 / T-05-15) this harness defends against.
//
// ESLint note: this file reads `process.env.UPDATE_GOLDEN` — the ONLY env read permitted,
// scoped to this file by a documented override in eslint.config.ts (test harness, not core
// runtime). See the `golden.test.ts` override block there (T-04-04).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { describe, test, expect } from 'vitest';
import { engineInput, type EngineInput, type ScenarioInputs } from './engine/engine-input.js';
import { runCanary, type CanaryResult } from './engine/canary.js';
import { computeTco } from './tco/tco.js';
import { rentVsBuy } from './tco/rent-vs-buy.js';
import { canonicalJson } from './serialize/canonical-json.js';
import { DEFAULT_ASSUMPTIONS } from './assumptions/defaults.js';
import { parseAssumptionSet } from './assumptions/assumption-set.js';
import { calendarDate } from './time/calendar-date.js';
import type { CurrentAssumptionSet } from './assumptions/schema.js';

const here = dirname(fileURLToPath(import.meta.url));
const GOLDEN_PATH = resolve(here, '__fixtures__', 'golden-snapshot.json');
const TCO_GOLDEN_PATH = resolve(here, '__fixtures__', 'tco-golden-snapshot.json');

/**
 * THE fixed, deterministic house scenario the golden masters are computed from: a $450k Newton
 * (seeded FY2024 town) house, 20% down, 30yr at 6.5%, 10-year hold, $2,000/yr insurance, no HOA,
 * $2,800/mo market rent. Referencing a SEEDED town so `resolveMillRate` resolves deterministically.
 * Identical on every run, on every machine.
 */
const FIXED_SCENARIO: ScenarioInputs = {
  label: 'golden-fixed: Newton $450k',
  price: '450000',
  downPaymentPct: '0.20',
  annualRate: '0.065',
  termMonths: 360,
  holdingYears: 10,
  town: 'Newton',
  insuranceAnnual: '2000',
  hoaMonthly: '0',
  monthlyRent: '2800',
};

/**
 * THE frozen input the golden masters are computed from. Fixed `asOf` (never a clock) +
 * DEFAULT_ASSUMPTIONS + the full widened FIXED_SCENARIO. Identical on every run.
 */
function fixedInput(): EngineInput {
  return engineInput({
    asOf: calendarDate('2026-01-01'),
    assumptions: DEFAULT_ASSUMPTIONS,
    scenario: FIXED_SCENARIO,
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

/**
 * Canonical-JSON form of the FULL TCO result: the `computeTco` breakdown + the `rentVsBuy`
 * two-portfolio result, serialized together. `canonicalJson` emits every `Money` as a decimal
 * string (float-free) with recursively sorted keys, so equal results are byte-identical.
 */
function canonicalTcoResult(input: EngineInput): string {
  const tco = computeTco(input);
  const rvb = rentVsBuy(input);
  return canonicalJson({ tco, rentVsBuy: rvb });
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

describe('golden master: the full TCO + rent-vs-buy result recomputes cent-identically (Plan 02-05)', () => {
  test('produced canonical TCO result deep-equals the committed tco-golden fixture', () => {
    const produced = canonicalTcoResult(fixedInput());

    // Gated regeneration ONLY (reviewable git diff). NEVER toMatchSnapshot (T-05-15).
    if (process.env.UPDATE_GOLDEN === '1') {
      mkdirSync(dirname(TCO_GOLDEN_PATH), { recursive: true });
      writeFileSync(TCO_GOLDEN_PATH, produced + '\n', 'utf8');
      return;
    }

    const golden = readFileSync(TCO_GOLDEN_PATH, 'utf8').trim();
    expect(produced).toBe(golden);
  });
});

describe('snapshot round-trip is lossless (D-08 data reproducibility)', () => {
  test('serialize -> deserialize -> recompute yields the identical canonical canary result', () => {
    const original = fixedInput();
    const first = canonicalResult(runCanary(original));

    const rebuilt = roundTrip(original);
    const second = canonicalResult(runCanary(rebuilt));
    expect(second).toBe(first);
  });

  test('serialize -> deserialize -> recompute yields the identical canonical TCO result', () => {
    const original = fixedInput();
    const first = canonicalTcoResult(original);

    const rebuilt = roundTrip(original);
    const second = canonicalTcoResult(rebuilt);
    expect(second).toBe(first);
  });
});

/**
 * Serialize an EngineInput to canonical JSON (the snapshot a persistence layer would store),
 * then rebuild it THROUGH the boundary validators — never trusting raw JSON. The assumptions go
 * back through `parseAssumptionSet` (Zod) and `asOf` through `calendarDate`; the scenario is the
 * full widened shape.
 */
function roundTrip(original: EngineInput): EngineInput {
  const snapshot = JSON.parse(
    canonicalJson({
      asOf: original.asOf,
      assumptions: original.assumptions,
      scenario: original.scenario,
    }),
  ) as { asOf: string; assumptions: unknown; scenario: ScenarioInputs };

  return engineInput({
    asOf: calendarDate(snapshot.asOf),
    assumptions: parseAssumptionSet(snapshot.assumptions) as CurrentAssumptionSet,
    scenario: snapshot.scenario,
  });
}
