---
phase: 01-foundations-determinism-core
plan: 03
subsystem: assumptions-and-engine-input
tags: [assumptions, zod, discriminated-union, decimal-string, versioning, migrate, engine-input, immutability, determinism]

# Dependency graph
requires:
  - "01-01: @house/core skeleton (decimal.js + zod deps allow-listed; no-DOM/no-JSX tsconfig; ESLint boundary + determinism guards; Vitest projects + setupFiles)"
  - "01-02: Dec (frozen Decimal clone), Money, CalendarDate + calendarDate() validator, runtime determinism guard"
provides:
  - "decStr — Zod decimal-string validator (/^-?\\d+(\\.\\d+)?$/) keeping JS floats out of the serialized boundary (D-06)"
  - "AssumptionSetSchema — z.discriminatedUnion('schemaVersion', [AssumptionsV1]); unknown version rejected (D-05)"
  - "AssumptionsV1 — nested .strict() groups tax/dti/returns/inflation/maintenance/swr/pmi, every leaf a decStr (D-04)"
  - "AnyAssumptionSet / CurrentAssumptionSet / AssumptionSet types (Zod-inferred, single source of truth)"
  - "DEFAULT_ASSUMPTIONS — versioned pure seed (no env, no Date); swr.rate '0.033' (locked SWR decision) (D-07)"
  - "parseAssumptionSet / serializeAssumptionSet — boundary helpers (validate-through-Zod; never trust raw JSON)"
  - "migrate(input) — version-gated step-up (identity for V1; rejects unknown versions via exhaustive assertNever) (D-05)"
  - "EngineInput + engineInput() factory — immutable { asOf: CalendarDate, assumptions, scenario } snapshot unit (D-11)"
affects:
  - "01-04 golden harness — EngineInput is the frozen-and-replayed input unit; AssumptionSet feeds the canary's assumption read; serialize round-trip proves reproducibility"
  - "All downstream calc phases (TCO, Affordability, FI-Impact, Town Scoring) — read their own AssumptionSet slice instead of hardcoding tunables (ASMP-01)"

# Tech tracking
tech-stack:
  added: []  # no new dependencies; uses zod@4.4.3 + decimal.js@10.6.0 from 01-01
  patterns:
    - "Versioning expressed as Zod discriminatedUnion (not a hand-rolled switch) — adding V2 is appending one object schema"
    - "decStr decimal-string validator at the boundary instead of z.number() — floats can never re-enter (D-06, Pitfall 7)"
    - ".strict() on every nested group — a snapshot cannot smuggle unknown keys past the boundary"
    - "Types inferred from the Zod schema (single source of truth) so runtime validator and compile-time shape never drift"
    - "Boundary helpers validate-through-Zod and never spread raw JSON into config (anti prototype-pollution, T-03-03)"
    - "migrate() re-validates then switches on schemaVersion with an exhaustive assertNever(never) guard"
    - "EngineInput is readonly at the type level AND Object.freeze'd at runtime; asOf threaded explicitly (no Date.now)"
    - "*.type-test.ts (in the tsc -b graph, not Vitest) carries the @ts-expect-error CalendarDate/readonly guards"

key-files:
  created:
    - "packages/core/src/assumptions/schema.ts"
    - "packages/core/src/assumptions/assumption-set.ts"
    - "packages/core/src/assumptions/defaults.ts"
    - "packages/core/src/assumptions/migrate.ts"
    - "packages/core/src/assumptions/schema.test.ts"
    - "packages/core/src/assumptions/assumption-set.test.ts"
    - "packages/core/src/assumptions/migrate.test.ts"
    - "packages/core/src/engine/engine-input.ts"
    - "packages/core/src/engine/engine-input.test.ts"
    - "packages/core/src/engine/engine-input.type-test.ts"
  modified:
    - "packages/core/src/index.ts (export AssumptionSet schema/helpers/defaults/migrate + EngineInput surface)"

key-decisions:
  - "AssumptionSet TYPES are inferred from the Zod schema and re-exported from assumption-set.ts (single source of truth); the runtime validator and the compile-time shape are physically the same definition and cannot drift"
  - "Every nested group uses .strict() — extra/unknown keys are rejected at the boundary (a forged snapshot can't smuggle fields)"
  - "decStr forbids exponent form (1e3) and separators (1,000) — only canonical base-10 decimal strings cross, so the serialized form is float-free and human-diffable"
  - "migrate() re-validates its input with parseAssumptionSet before switching, so a forged out-of-range schemaVersion is rejected even if a caller skipped parsing; the default branch is an exhaustive assertNever(never)"
  - "EngineInput.scenario is a minimal placeholder (ScenarioInputs { label }) sufficient for Plan 04's canary; later phases widen it without changing the asOf/assumptions threading contract"
  - "DEFAULT_ASSUMPTIONS values are plausible MA-flavored PLACEHOLDERS (effective income 0.27, property 0.011, DTI 0.28/0.36, real return 0.05, inflation 0.025, maintenance 0.01, swr 0.033, pmi 0.0075 dropping at 0.8 LTV) — NOT authoritative tax/mill-rate tables (Phase 2 / TCO concern, per D-07 discretion)"

requirements-completed: [ASMP-01]

# Metrics
duration: ~10min
completed: 2026-06-23
---

# Phase 1 Plan 03: Versioned AssumptionSet & EngineInput Summary

**Assumptions-as-first-class-data (ASMP-01): a nested, integer-`schemaVersion`-versioned `AssumptionSet` validated by a Zod `discriminatedUnion`, with every tunable serialized as a canonical decimal string (no floats at the boundary), a pure versioned defaults seed, a version-gated `migrate()`, and the immutable `EngineInput` snapshot unit that threads `asOf` + `assumptions` explicitly — the exact shape Plan 04's golden harness will freeze and replay.**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-06-23
- **Completed:** 2026-06-23
- **Tasks:** 2 (both TDD: RED -> GREEN, no REFACTOR needed)
- **Files created/modified:** 11 (10 created, 1 modified)

## Accomplishments

- `schema.ts`: the Zod 4 trust boundary. `decStr = z.string().regex(/^-?\d+(\.\d+)?$/)` (decimal-string validator, never `z.number()` — D-06, Pitfall 7). `AssumptionsV1` is `.strict()` with `schemaVersion: z.literal(1)` and nested `.strict()` groups `tax`/`dti`/`returns`/`inflation`/`maintenance`/`swr`/`pmi`, every leaf a `decStr`. `AssumptionSetSchema = z.discriminatedUnion('schemaVersion', [AssumptionsV1])`; `CURRENT_VERSION = 1 as const`; `AnyAssumptionSet`/`CurrentAssumptionSet` inferred.
- `assumption-set.ts`: re-exports the inferred types (single source of truth) plus `parseAssumptionSet` / `serializeAssumptionSet` boundary helpers that validate THROUGH Zod and never trust raw JSON (T-03-03).
- `defaults.ts`: `DEFAULT_ASSUMPTIONS` — pure data, no `process`/env, no `Date`; `swr.rate` is `"0.033"` (< 0.04, the locked long-horizon SWR decision); every value a decimal string; typed as `CurrentAssumptionSet` so a shape change is a compile error.
- `migrate.ts`: `migrate(input)` re-validates then switches on `schemaVersion` (identity for V1; an exhaustive `assertNever` default throws on any unknown version — T-03-01), structured so a future V1->V2 step slots in as one `case`.
- `engine-input.ts`: `EngineInput` = readonly `{ asOf: CalendarDate, assumptions: CurrentAssumptionSet, scenario: ScenarioInputs }`; `engineInput()` factory `Object.freeze`s the result and never consults a clock — `asOf` is threaded explicitly (D-11). `ScenarioInputs` is a minimal placeholder for the canary, widened by later phases.
- `index.ts`: public `@house/core` surface now exports the AssumptionSet schema/types/helpers/defaults/migrate and the EngineInput factory/types.
- Type-level guarantees made load-bearing: `engine-input.type-test.ts` (in the `tsc -b` graph) carries `@ts-expect-error` probes proving a bare string is not assignable to `asOf` (D-13) and that `EngineInput` fields are readonly (D-11).
- Final gate: `npm test` (53 tests, 8 files), `npm run typecheck` (`tsc -b`), `npm run lint` — all exit 0.

## Task Commits

Each task committed atomically (TDD RED then GREEN):

1. **Task 1 RED — failing AssumptionSet tests** — `a265973` (test)
2. **Task 1 GREEN — schema, helpers, defaults, migrate** — `8bce2fb` (feat)
3. **Task 2 RED — failing EngineInput tests** — `85ec99d` (test)
4. **Task 2 GREEN — EngineInput factory + public exports** — `fc5e75f` (feat)

**Plan metadata:** committed separately with SUMMARY/STATE/ROADMAP/REQUIREMENTS.

## Decisions Made

- **Inferred types as the single source of truth.** Rather than declaring the nested TypeScript shape by hand and a parallel Zod schema, the schema is authored once and the types are `z.infer`'d from it (re-exported via `assumption-set.ts`). This makes drift between the runtime validator and the compile-time shape structurally impossible.
- **`.strict()` on every group.** Unknown keys are rejected at the boundary, so a corrupt/forged snapshot cannot carry extra fields through `parseAssumptionSet` into config (reinforces T-03-03 alongside the "never spread raw JSON" helper discipline).
- **`migrate()` re-validates before switching.** Even though the documented contract is "parse first, then migrate," `migrate()` calls `parseAssumptionSet` itself, so a forged out-of-range `schemaVersion` is rejected regardless of caller discipline (T-03-01). The `default` branch is an `assertNever(never)` exhaustiveness guard.
- **`decStr` forbids exponent/separator forms.** Only canonical base-10 strings (`-?\d+(\.\d+)?`) cross — `1e3` and `1,000` are rejected — keeping the serialized form float-free, canonical, and human-diffable for the golden harness.
- **Placeholder seed values, explicitly not tax tables.** `DEFAULT_ASSUMPTIONS` carries plausible MA-flavored rates per D-07 discretion; real per-town mill-rate/tax tables are deferred to Phase 2 (TCO). Only the shape + versioning are locked here.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `@ts-expect-error` directive must sit on the property line that errors, not the statement above it**
- **Found during:** Task 2 GREEN (`tsc -b` after writing `engine-input.type-test.ts`)
- **Issue:** The `@ts-expect-error` for the "plain string is not a CalendarDate" assertion was placed on the line before the `engineInput({ ... })` call. TypeScript reports the assignability error on the inner `asOf: '2026-06-23'` property line, not on the outer call line, so the directive was both unused (TS2578) and the real error (TS2322) leaked.
- **Fix:** Moved the `@ts-expect-error` to sit directly above the offending `asOf` property inside the object literal. Same assertion, correct placement.
- **Files modified:** packages/core/src/engine/engine-input.type-test.ts
- **Verification:** `tsc -b` exits 0; the directive is now load-bearing (weakening the `asOf` brand would make it unused and fail the build).
- **Committed in:** `fc5e75f` (Task 2 GREEN)

### Plan-prescribed approach adjusted (documented)

**2. [Rule 3 - Blocking] Type-level `@ts-expect-error` lives in `engine-input.type-test.ts`, not `engine-input.test.ts`**
- **Why:** Task 2's `<action>` text says to put the `@ts-expect-error` (string-not-assignable-to-asOf) in `engine-input.test.ts`. But the established 01-02 pattern (and the core tsconfig) excludes `*.test.ts` from the `tsc -b` graph, and Vitest/esbuild strip types without honoring `@ts-expect-error` — so a type assertion there is NOT load-bearing. Following the locked pattern, the compile-time assertions go in `engine-input.type-test.ts` (in the `tsc -b` graph); the `*.test.ts` file keeps the runtime assertions (freeze, explicit-asOf, round-trip). This honors the prior-context instruction to "follow that established pattern for any type-level assertions."
- **Files:** packages/core/src/engine/engine-input.type-test.ts (added), packages/core/src/engine/engine-input.test.ts (runtime only)
- **Committed in:** `85ec99d` (RED) + `fc5e75f` (GREEN)

---

**Total deviations:** 2 (both Rule 3 - blocking/pattern-conformance). No package changes, no scope creep, no architectural changes.

## Issues Encountered

- `eslint-plugin-boundaries@6` continues to emit the (non-fatal) `boundaries/external` deprecation warning carried over from 01-01/01-02; `npm run lint` still exits 0. Migration to `boundaries/dependencies` remains a future tidy-up, not a Phase-1 blocker.
- Git reports CRLF normalization warnings on commit (Windows). Cosmetic; no content impact.

## Known Stubs

- `ScenarioInputs` is an intentional minimal placeholder (`{ label: string }`) — just enough for Plan 04's reproducibility canary. This is documented as the snapshot-unit shape that later phases (TCO/Affordability/FI-Impact) will widen with real per-scenario inputs; it does not block ASMP-01 (every *assumption* tunable is fully modeled in the AssumptionSet). Not a hidden stub — it is the explicit Phase-1 scope boundary.

## Threat Flags

None — no new security-relevant surface beyond the plan's threat model. All four register entries (T-03-01 unknown version, T-03-02 float at boundary, T-03-03 prototype pollution / raw-JSON spread, T-03-04 hardcoded tunable) are mitigated as planned: `discriminatedUnion` + `assertNever` reject unknown versions, `decStr` rejects floats, the boundary helpers validate-through-Zod and never spread raw JSON, and every tunable lives in the nested schema + defaults module.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- `EngineInput` + `engineInput()` are exported and ready for 01-04: the golden harness freezes an `EngineInput`, replays it, and asserts cent-identical output; the AssumptionSet serialize/deserialize round-trip is the data-reproducibility half of the canary.
- `DEFAULT_ASSUMPTIONS` gives the canary a stable, pure assumption source to read from (proving ASMP-01's "downstream reads slices, nothing hardcoded").
- The versioning machinery (`schemaVersion` + `migrate()`) is in place so snapshot replay can gate on version before persistence exists.

## Self-Check: PASSED

All 10 created files and 1 modified file verified present on disk (see verification below); all 4 task commits (a265973, 8bce2fb, 85ec99d, fc5e75f) verified in git history. Full gate green: `npm test` (53 passing, 8 files), `npm run typecheck` (`tsc -b`, 0), `npm run lint` (0, deprecation warning only).

---
*Phase: 01-foundations-determinism-core*
*Completed: 2026-06-23*
