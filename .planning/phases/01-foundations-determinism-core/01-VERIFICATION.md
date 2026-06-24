---
phase: 01-foundations-determinism-core
verified: 2026-06-23T21:35:00Z
status: passed
score: 5/5 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: human_needed
  previous_score: 4/5
  gaps_closed:
    - "SC-2: Money.of/mul now validate input against CANONICAL_DECIMAL_RE — Infinity/NaN/1e3 throw 'Invalid Money string'"
    - "SC-2 (WR-06): canonicalJson now throws on non-finite numbers instead of silently coercing to null"
    - "SC-3 (WR-02): runtime guard now also poisons new Date() (zero-arg), performance.now(), and crypto.getRandomValues()"
    - "SC-3 (WR-03): no-restricted-syntax selectors now match globalThis.Date.now(), globalThis.Math.random(), globalThis.performance.now(), globalThis.crypto.getRandomValues(), and new globalThis.Date()"
    - "SC-3 (WR-05): boundary.test.ts now has negative lint fixtures for every determinism hazard (Date.now, Math.random, new Date, performance.now, crypto.getRandomValues) — both direct and globalThis-qualified forms"
    - "WR-01: serializeAssumptionSet now routes through canonicalJson() instead of raw JSON.stringify"
    - "WR-04: eslint-plugin-boundaries pinned to exact version 6.0.2 (not ^); external-import.fixture.ts + boundary test provide a safety net if the deprecated rule is silently removed"
  gaps_remaining: []
  regressions: []
---

# Phase 1: Foundations, Determinism & Core Verification Report

**Phase Goal:** Lock the existential, expensive-to-retrofit foundations — a pure framework-agnostic calculation core with decimal-precise money, deterministic functions, assumptions stored as first-class data, and a reproducibility harness that proves a snapshot replays exactly. Nothing computes a real engine result yet; everything downstream imports these.

**Verified:** 2026-06-23T21:35:00Z
**Status:** passed
**Re-verification:** Yes — after gap closure (7 commits e07e09d..94a849f)

---

## Gate Results: All Three Build Gates Pass

| Gate | Command | Result |
|------|---------|--------|
| Tests | `npm test` | **116 tests, 12 files, 0 failures** (was 75 before gap-closure) |
| Lint | `npm run lint` | 0 errors (2 non-fatal deprecation warnings for deprecated `boundaries/external` — same as before; explicitly accepted, pin + safety-net in place) |
| Typecheck | `npm run typecheck` | 0 errors (`tsc -b`) |

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | The `core` package has zero React/Next/DB dependencies and a lint boundary rule fails the build if a framework import appears inside it | VERIFIED | Unchanged from initial: `packages/core/package.json` has only `decimal.js` + `zod`; `boundaries/external` deny-by-default + `no-restricted-imports` confirmed active; `boundary.test.ts` asserts framework and arbitrary external imports fail; `eslint-plugin-boundaries` pinned to exact `6.0.2` (WR-04 hardened) |
| 2 | Money arithmetic uses a decimal-precise representation with a documented rounding policy; bare-number dollar math is rejected by tests; `Money.of`/`mul` must reject non-canonical strings like Infinity/NaN/1e3 | VERIFIED | `assertCanonicalDecimal()` added inside `money.ts`, importing `CANONICAL_DECIMAL_RE` from `schema.ts` — the SAME regex the serialization boundary uses; `Money.of('Infinity')`, `Money.of('NaN')`, `Money.of('1e3')` all throw `"Invalid Money string: ..."` (confirmed by 16 new test cases in `money.test.ts` CR-01 describe block); `canonicalJson` throws on non-finite numbers (WR-06; 4 new tests in `canonical-json.test.ts`) |
| 3 | Core functions are deterministic — no Date.now(), Math.random(), env reads, or module-level mutable defaults; asOf and assumptions are explicit; runtime guard and lint cover new Date(), performance.now, crypto, and globalThis-qualified evasion forms | VERIFIED | Runtime guard extended to poison `new Date()` (zero-arg via Proxy), `performance.now()`, `crypto.getRandomValues()` (WR-02); `no-restricted-syntax` selectors extended to match `globalThis.Date.now()`, `globalThis.Math.random()`, `globalThis.performance.now()`, `globalThis.crypto.getRandomValues()`, `new globalThis.Date()` (WR-03); 7 new lint fixtures (`_lint-fixtures/determinism-*.fixture.ts`) each cover direct + globalThis-qualified form; `boundary.test.ts` extended with `describe('lint REJECTS each determinism hazard')` asserting non-zero exit for each (WR-05); guard.test.ts extended with tests for `new Date()`, `performance.now`, `crypto.getRandomValues` |
| 4 | An AssumptionSet type holds every tunable as versioned, serializable data — nothing is hardcoded | VERIFIED | Unchanged from initial: `schema.ts` defines `AssumptionsV1` with all seven strict groups; `decStr` regex rejects floats/exponents; `discriminatedUnion` rejects unknown versions; `migrate.ts` uses `assertNever`; 26 assumption tests pass |
| 5 | A reproducibility golden test exists: recomputing a frozen snapshot deep-equals the stored result (cent-identical) | VERIFIED | Unchanged from initial: `golden-snapshot.json` committed; `golden.test.ts` uses `expect(produced).toBe(golden)` (gated regen); round-trip asserted; WR-01 fix means `serializeAssumptionSet` now routes through the real `canonicalJson()`, removing the future key-ordering inconsistency risk |

**Score:** 5/5 truths verified

---

### Deferred Items

None.

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/core/src/money/money.ts` | Immutable Money class with input validation | VERIFIED | `assertCanonicalDecimal()` added; uses shared `CANONICAL_DECIMAL_RE` from schema.ts |
| `packages/core/src/serialize/canonical-json.ts` | Float-free, sorted-key serializer that rejects non-finite numbers | VERIFIED | `typeof value === 'number' && !Number.isFinite(value)` guard added; throws with clear error |
| `packages/core/src/determinism/guard.ts` | Runtime guard covering Date.now, Math.random, new Date(), performance.now, crypto | VERIFIED | All five hazards covered; `new Date(explicitArg)` still allowed (Proxy construct trap with `args.length === 0` check) |
| `eslint.config.ts` | Flat config with globalThis/member-expression evasion forms covered | VERIFIED | Six `no-restricted-syntax` selectors cover all direct + `globalThis.X.method()` forms; `no-restricted-globals` adds `performance`, `crypto`, `globalThis` |
| `packages/core/src/_lint-fixtures/` | Negative lint fixture for every determinism hazard | VERIFIED | 7 fixture files: `framework-import`, `external-import`, `dom-global`, `determinism-date-now`, `determinism-math-random`, `determinism-new-date`, `determinism-performance-now`, `determinism-crypto-random`; each exercises both direct + globalThis-qualified form |
| `packages/core/src/boundary.test.ts` | Programmatic proof that each fixture fails lint | VERIFIED | `describe('lint REJECTS each determinism hazard')` with `test.each` over all 5 determinism hazard pairs |
| `packages/core/src/assumptions/assumption-set.ts` | `serializeAssumptionSet` routes through `canonicalJson()` | VERIFIED | WR-01 fix confirmed (commit 6521386) |
| All other Phase 1 artifacts | (unchanged from initial verification) | VERIFIED | See initial VERIFICATION.md for full artifact table |

---

### Key Link Verification

All links verified in initial verification remain wired. Additional link confirmed by re-verification:

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `money.ts` | `schema.ts` | `import { CANONICAL_DECIMAL_RE }` | VERIFIED | `CANONICAL_DECIMAL_RE` exported from `schema.ts:24`; imported and used in `assertCanonicalDecimal()` in `money.ts` — single source of canonical-decimal truth |
| `canonical-json.ts` | (self-guard) | `Number.isFinite(value)` check at primitive branch | VERIFIED | Guard at line 48-51; throws `"canonicalJson: non-finite number..."` |
| `guard.ts` | `Date` (global) | `Proxy` construct trap on `globalThis.Date` | VERIFIED | Zero-arg construction throws; explicit-arg construction passes (`new Date(0)` test passes) |
| `eslint.config.ts` | `_lint-fixtures/**` | `boundary.test.ts` runs `eslint --no-ignore` on each fixture | VERIFIED | 7 fixture files; `boundary.test.ts:64-100` asserts non-zero exit for all 5 determinism hazards |

---

### Data-Flow Trace (Level 4)

Not applicable — pure library functions with no external data sources. Unchanged from initial.

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| All 116 tests pass | `npm test` | 116 passed, 0 failed | PASS |
| Lint exits 0 on real source | `npm run lint` | 0 errors, 2 non-fatal deprecation warnings | PASS |
| Typecheck exits 0 | `npm run typecheck` | 0 errors | PASS |
| `Money.of('Infinity')` throws | test suite (money.test.ts CR-01 block) | `throws /Invalid Money string/` | PASS |
| `Money.of('NaN')` throws | test suite (money.test.ts CR-01 block) | `throws /Invalid Money string/` | PASS |
| `Money.of('1e3')` throws | test suite (money.test.ts CR-01 block) | `throws /Invalid Money string/` | PASS |
| `canonicalJson(NaN)` throws | test suite (canonical-json.test.ts WR-06 block) | `throws /non-finite number/` | PASS |
| `canonicalJson(Infinity)` throws | test suite (canonical-json.test.ts WR-06 block) | `throws /non-finite number/` | PASS |
| `new Date()` throws under guard | test suite (guard.test.ts) | `throws /new Date\(\)/` + `/Nondeterminism in core/` | PASS |
| `new Date(explicitArg)` still works under guard | test suite (guard.test.ts) | `new Date(0)` returns valid Date | PASS |
| `performance.now()` throws under guard | test suite (guard.test.ts) | `throws /performance\.now/` (if host exposes it) | PASS |
| `crypto.getRandomValues()` throws under guard | test suite (guard.test.ts) | `throws /crypto\.getRandomValues/` (if host exposes it) | PASS |
| `globalThis.Date.now()` rejected by lint | boundary.test.ts (`determinism-date-now.fixture.ts`) | eslint exits non-zero | PASS |
| `globalThis.Math.random()` rejected by lint | boundary.test.ts (`determinism-math-random.fixture.ts`) | eslint exits non-zero | PASS |
| `new globalThis.Date()` rejected by lint | boundary.test.ts (`determinism-new-date.fixture.ts`) | eslint exits non-zero | PASS |
| `globalThis.performance.now()` rejected by lint | boundary.test.ts (`determinism-performance-now.fixture.ts`) | eslint exits non-zero | PASS |
| `globalThis.crypto.getRandomValues()` rejected by lint | boundary.test.ts (`determinism-crypto-random.fixture.ts`) | eslint exits non-zero | PASS |
| `node:fs` import rejected by lint (deny-by-default) | boundary.test.ts (`external-import.fixture.ts`) | eslint exits non-zero | PASS |
| Framework import rejected by lint | boundary.test.ts (`framework-import.fixture.ts`) | eslint exits non-zero | PASS |

---

### Probe Execution

No probe scripts declared or found in `scripts/*/tests/probe-*.sh`. Unchanged from initial.

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| CORE-01 | 01-01 | Framework-agnostic calc core with zero React/Next deps, enforced by lint | SATISFIED | Boundary rule confirmed active; deny-by-default pin + safety net (WR-04) hardened |
| CORE-02 | 01-02 | Decimal-precise money arithmetic with documented rounding | SATISFIED | `assertCanonicalDecimal()` closes the string-input gap (CR-01); `canonicalJson` rejects non-finite numbers (WR-06); full test coverage for both |
| CORE-03 | 01-01, 01-02 | Deterministic core functions, no ambient time/randomness | SATISFIED | Runtime guard covers all 5 hazards; lint covers all 5 hazards including globalThis-qualified forms; 7 negative fixtures with programmatic proof |
| ASMP-01 | 01-03 | All assumptions as configurable stored data, never hardcoded | SATISFIED | Unchanged; full nested Zod schema with 7 domains, versioned discriminated union |
| PROF-04 | 01-04 | Saved scenario reproduces exactly (reproducibility) | SATISFIED | Unchanged; `golden.test.ts` proves cent-identical replay; `serializeAssumptionSet` now uses real `canonicalJson()` (WR-01 strengthens future reproducibility) |

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `packages/core/src/assumptions/defaults.ts` | 5 | `PLACEHOLDER` comment | INFO | Intentional — Phase 1 scope boundary for real mill-rate tables (Phase 2 concern) |
| `packages/core/src/engine/engine-input.ts` | 17 | `placeholder` comment on `ScenarioInputs` | INFO | Intentional — minimal Phase-1 shape, widened by later phases |
| `packages/core/src/assumptions/schema.ts` | 40 | `placeholder` comment on `propertyRateAnnual` | INFO | Intentional — same as above |

No `TBD`, `FIXME`, or `XXX` markers found in production core source files.

---

### Human Verification Required

None. All previously identified human verification items have been resolved by the gap-closure commits and confirmed by the automated test suite (116 passing tests including 41+ new tests covering CR-01, WR-02, WR-03, WR-05, and WR-06 fixes).

---

### Gaps Summary

No gaps. All 5 success criteria are fully verified. The 7 gap-closure commits (e07e09d..94a849f) addressed every finding from the initial code review:

- **CR-01**: `Money.of`/`mul` now validate against `CANONICAL_DECIMAL_RE` — same rule as the serialization boundary. Confirmed by 16 new rejection tests.
- **WR-01**: `serializeAssumptionSet` now routes through `canonicalJson()`. The "two canonical serializers" inconsistency is eliminated.
- **WR-02**: Runtime guard now covers `new Date()` (Proxy-based zero-arg detection), `performance.now()`, and `crypto.getRandomValues()`. Three new guard tests pass.
- **WR-03**: ESLint `no-restricted-syntax` selectors extended for `globalThis.X.method()` chained forms for all five hazards. Confirmed by lint fixtures.
- **WR-04**: `eslint-plugin-boundaries` version pinned to exact `6.0.2` in `package.json`. `external-import.fixture.ts` + boundary test now serve as the silent-removal safety net.
- **WR-05**: 7 `_lint-fixtures/` files + `boundary.test.ts` `describe` block provide programmatic, per-rule proof that every determinism guard trips. This was the coverage gap that made SC-3 unverifiable.
- **WR-06**: `canonicalJson` throws on `NaN`/`Infinity`/`-Infinity` with a clear error message instead of silently coercing to `null`. Confirmed by 4 new tests.

The test count increase from 75 → 116 (41 new tests) reflects the breadth of the gap-closure coverage. The phase goal is fully achieved.

---

_Verified: 2026-06-23T21:35:00Z_
_Verifier: Claude (gsd-verifier)_
_Re-verification after gap closure: 7 commits e07e09d..94a849f_
