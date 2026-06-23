---
phase: 01-foundations-determinism-core
plan: 02
subsystem: core-primitives
tags: [money, decimal.js, bankers-rounding, branded-types, calendar-date, determinism, vitest-setup]

# Dependency graph
requires:
  - "01-01: @house/core skeleton (decimal.js + zod deps, no-DOM/no-JSX tsconfig, ESLint boundary+determinism guards, Vitest projects wiring with the TODO setupFiles slot)"
provides:
  - "Dec — the single frozen Decimal.clone({ precision: 34, rounding: ROUND_HALF_EVEN }) constructor (D-14)"
  - "Money — immutable, branded, decimal-precise class with a closed API; rounds to cents only at toCents (D-01/D-02/D-03, CORE-02)"
  - "CalendarDate — branded YYYY-MM-DD string + calendarDate() validator; no JS Date in core (D-13)"
  - "installDeterminismGuard() + guard.setup.ts wired into the core Vitest setupFiles (D-12 runtime half, CORE-03)"
affects:
  - "All downstream calc phases (TCO, Affordability, FI-Impact, Town Scoring) — Money/CalendarDate are the load-bearing primitives they build on"
  - "01-03 AssumptionSet (decimal-string values parse to Dec), 01-04 golden harness (Money.toDecimalString in canonical JSON)"

# Tech tracking
tech-stack:
  added: []  # no new dependencies; uses decimal.js@10.6.0 from 01-01
  patterns:
    - "Single frozen Decimal.clone constructor exported as Dec; global Decimal never .set() (D-14)"
    - "Branded nominal types via `declare const X: unique symbol` for Money and CalendarDate (duck-typing rejected at compile time)"
    - "Closed Money API: string-only dollar entry, no number-accepting factory, no number-returning valueOf/toJSON (CORE-02 type-level enforcement)"
    - "Round-at-boundary-only: full precision through all math, HALF_EVEN rounding only at toCents (D-03)"
    - "*.type-test.ts files (in the tsc -b graph, NOT *.test.ts) as load-bearing @ts-expect-error regression guards — mirrors the 01-01 dom-global.fixture pattern"
    - "named import { Decimal } from 'decimal.js' (not default) to expose statics under NodeNext + verbatimModuleSyntax"

key-files:
  created:
    - "packages/core/src/money/decimal-config.ts"
    - "packages/core/src/money/money.ts"
    - "packages/core/src/money/money.test.ts"
    - "packages/core/src/money/money.type-test.ts"
    - "packages/core/src/time/calendar-date.ts"
    - "packages/core/src/time/calendar-date.test.ts"
    - "packages/core/src/time/calendar-date.type-test.ts"
    - "packages/core/src/determinism/guard.ts"
    - "packages/core/src/determinism/guard.setup.ts"
    - "packages/core/src/determinism/guard.test.ts"
  modified:
    - "packages/core/vitest.config.ts (resolved the Plan 01-01 setupFiles TODO)"
    - "packages/core/src/index.ts (export Money, Dec, DecimalInstance, calendarDate, CalendarDate)"

key-decisions:
  - "Dec uses precision 34 (decimal128 width) + ROUND_HALF_EVEN (=6); the decimal.js default ROUND_HALF_UP (=4) is explicitly NOT used — proven demonstrable: switching to HALF_UP breaks 4 banker's-rounding tests"
  - "Money exposes NO valueOf/toJSON returning a number — keeps the bare-number hole closed; arithmetic operators on Money are compile errors"
  - "Type-level CORE-02/D-13 guarantees live in *.type-test.ts (tsc -b graph), because Vitest/esbuild strips types and does NOT validate @ts-expect-error; *.test.ts are excluded from tsc -b by the core tsconfig"
  - "installDeterminismGuard is intentionally NOT re-exported from index.ts — it is a test-time-only utility (mutates globals), imported directly by guard.setup.ts"
  - "CalendarDate regex validates SHAPE + month/day ranges only (permits e.g. 2026-02-30); full calendar-day validation is deferred to avoid reintroducing JS Date into the core"

requirements-completed: [CORE-02, CORE-03]

# Metrics
duration: ~12min
completed: 2026-06-23
---

# Phase 1 Plan 02: Money / Time / Determinism Primitives Summary

**Immutable decimal-precise `Money` (closed API, banker's rounding only at the `toCents` boundary), branded `CalendarDate` (no JS `Date` in the core), and the runtime determinism guard wired into the core Vitest setup — the type- and runtime-level lockout of the existential money/time/determinism mistakes, complementing Plan 01's lint guards.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-06-23
- **Completed:** 2026-06-23
- **Tasks:** 2 (both TDD: RED → GREEN, no REFACTOR needed)
- **Files created/modified:** 12 (10 created, 2 modified)

## Accomplishments
- `decimal-config.ts`: the SINGLE frozen `Dec = Decimal.clone({ precision: 34, rounding: ROUND_HALF_EVEN })` constructor (D-14). The global `Decimal` is never `.set()`. Demonstrably correct: switching the clone to `ROUND_HALF_UP` breaks the banker's-rounding tests (4 failures), restoring `ROUND_HALF_EVEN` makes them green.
- `money.ts`: immutable, branded `Money` with a closed API — `of(decimalString)` / `zero()` entry points (no number-accepting dollar factory), `add`/`sub` (take `Money`), `mul`/`percentOf` (take a dimensionless rate STRING), `toCents(): bigint` (the ONLY rounding boundary, HALF_EVEN), `toDecimalString()` (full precision), `toString()` (2dp display). No `valueOf`/`toJSON` returning a number — the bare-number hole stays closed (D-01/D-02/D-03, CORE-02).
- `calendar-date.ts`: branded `CalendarDate` (`YYYY-MM-DD`) + `calendarDate()` validator using a shape+range regex; pure string ops, zero JS `Date` usage in the core (D-13).
- `guard.ts` + `guard.setup.ts`: `installDeterminismGuard()` overwrites `Date.now`/`Math.random` to throw `Nondeterminism in core: …`; the setup file installs it, and `vitest.config.ts` now lists `./src/determinism/guard.setup.ts` in `setupFiles` (resolves the 01-01 TODO; D-12 runtime half).
- Type-level enforcement made load-bearing: `money.type-test.ts` and `calendar-date.type-test.ts` (in the `tsc -b` graph) carry `@ts-expect-error` probes that turn "bare-number dollar math is impossible" and "a bare string is not a CalendarDate" into compile-time regression tests.
- Final gate: `npm test` (27 tests, 4 files), `npm run typecheck` (`tsc -b`), `npm run lint` — all exit 0.

## Task Commits

Each task committed atomically (TDD RED then GREEN):

1. **Task 1 RED — failing Money tests** — `4607811` (test)
2. **Task 1 GREEN — frozen Decimal clone + immutable Money** — `1ee684a` (feat)
3. **Task 2 RED — failing CalendarDate + guard tests** — `17dc5e4` (test)
4. **Task 2 GREEN — branded CalendarDate + determinism guard + Vitest wiring** — `bd531c1` (feat)

**Plan metadata:** committed separately with SUMMARY/STATE/ROADMAP/REQUIREMENTS.

## Decisions Made
- **`*.type-test.ts` (not `*.test.ts`) for the type-rejection guards.** The core tsconfig excludes `*.test.ts` from `tsc -b`, and Vitest/esbuild strips types without honoring `@ts-expect-error`. So the `@ts-expect-error` assertions for CORE-02 (bare-number math) and D-13 (CalendarDate brand) are placed in `*.type-test.ts` files, which ARE in the `tsc -b` graph and are NOT matched by Vitest's `*.test.ts` glob. This mirrors the established `_lint-fixtures/dom-global.fixture.ts` regression pattern from 01-01: if the guarantee regresses, the suppression goes unused and `tsc -b` fails (TS2578).
- **`installDeterminismGuard` is not part of the public `@house/core` surface.** It mutates globals and is strictly a test-time safety net; it is imported directly by the setup file rather than re-exported from `index.ts`.
- **CalendarDate validates shape + range only** (month 01-12, day 01-31), deliberately permitting impossible calendar days like `2026-02-30`. Full calendar correctness would require date arithmetic; doing it without a JS `Date` is out of scope for this primitive and downstream code can layer it without reintroducing `Date` into the core.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Used a named `Decimal` import instead of the default import**
- **Found during:** Task 1 (first `tsc -b` after writing `decimal-config.ts`)
- **Issue:** The research's Pattern 1 snippet uses `import Decimal from 'decimal.js'`. Under this repo's `NodeNext` + `verbatimModuleSyntax: true` tsconfig, the default import's type collapses to the module-namespace shape, so `Decimal.clone` and `Decimal.ROUND_HALF_EVEN` were reported as non-existent (TS2339). decimal.js's `.d.ts` exposes the class (with its statics) as a named export as well.
- **Fix:** `import { Decimal } from 'decimal.js'` — same package, same symbol, no substitution; only the import form changed. The named binding exposes the static `clone`/`ROUND_HALF_EVEN` members.
- **Files modified:** packages/core/src/money/decimal-config.ts
- **Verification:** `tsc -b` exits 0; runtime tests pass (the clone is constructed and used correctly).
- **Committed in:** `1ee684a` (Task 1 GREEN)

**2. [Rule 1 - Bug] Removed an invalid `override` modifier on `Money.toString`**
- **Found during:** Task 1 (same `tsc -b` run)
- **Issue:** The implementation initially marked `Money.toString()` with `override`, but `Money` does not `extends` any class, so `noImplicitOverride`/TS reported TS4112 ("cannot have an 'override' modifier").
- **Fix:** Removed the `override` keyword. `Money.toString` simply shadows `Object.prototype.toString` (which is expected for a display method).
- **Files modified:** packages/core/src/money/money.ts
- **Verification:** `tsc -b` exits 0; the `toString` display tests pass.
- **Committed in:** `1ee684a` (Task 1 GREEN)

---

**Total deviations:** 2 auto-fixed (1 Rule 3 - blocking type-resolution, 1 Rule 1 - bug). No package changes, no scope creep. Both surfaced and were fixed within the Task 1 GREEN step before commit.

## Issues Encountered
- `eslint-plugin-boundaries@6` continues to emit the (non-fatal) `boundaries/external` deprecation warning carried over from 01-01; `npm run lint` still exits 0. Migration to `boundaries/dependencies` remains a future tidy-up, not a Phase-1 blocker.
- Git reports CRLF normalization warnings on commit (Windows). Cosmetic; no content impact.

## User Setup Required
None — no external service configuration required.

## Next Phase Readiness
- `Money`, `Dec`, `CalendarDate` are exported from `@house/core` and ready for 01-03 (AssumptionSet: decimal-string values parse to `Dec`) and 01-04 (golden harness: `Money.toDecimalString()` feeds canonical JSON; the determinism guard underpins the reproducibility claim).
- The Vitest `setupFiles` slot left by 01-01 is now filled; every core test runs with the determinism guard installed.
- Coverage thresholds (95/95/90/95) from 01-01 are now meaningfully exercised by the money/time/determinism suites; full coverage gating will be most informative once the engine/golden modules land.

## Self-Check: PASSED

All 10 created files and 2 modified files verified present on disk; all 4 task commits (4607811, 1ee684a, 17dc5e4, bd531c1) verified in git history. Full gate (`npm test` 27 passing, `npm run typecheck` 0, `npm run lint` 0) green.

---
*Phase: 01-foundations-determinism-core*
*Completed: 2026-06-23*
