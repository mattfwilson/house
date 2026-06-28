---
phase: 06-persistence-listings-adapter
verified: 2026-06-27T23:55:00Z
status: passed
score: 4/4 must-haves verified
overrides_applied: 0
---

# Phase 6: Persistence + Listings Adapter Verification Report

**Phase Goal:** Add the imperative shell around the proven core — local SQLite persistence for two profiles and many named reloadable scenarios via repository ports, plus the `ListingsProvider` adapter interface with a `MockListingsProvider` exercising it end to end. Snapshots stored here must satisfy the reproducibility contract proven in Phase 1.
**Verified:** 2026-06-27T23:55:00Z
**Status:** passed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User can create and save two financial profiles (net worth, income, savings rate, existing debts, current rent) to local SQLite | ✓ VERIFIED | `SqliteProfileRepository` persists all nine Household leaves as TEXT columns; `saveProfile` enforces ≤2 cap (count-and-throw); `profile-service.test.ts` asserts #1/#2 succeed, 3rd distinct throws, edit does not trip |
| 2 | User can create multiple named house scenarios under a profile and reload them in a later session, with each saved scenario storing the full input + assumption snapshot | ✓ VERIFIED | `SqliteScenarioRepository` serializes via `canonicalJson`; `deserializeSnapshot` re-validates every leaf through Zod parsers; `repository-contract.test.ts` asserts `expect(canonicalJson(loaded.input)).toBe(storedBlob)` (plain `toBe`, byte-identical); fresh-connection reload tested file-backed (PROF-03) |
| 3 | A `ListingsProvider` adapter interface is defined in the core, isolated from engine math, and depended on only through the interface (never the concrete type outside the DI container) | ✓ VERIFIED | `packages/core/src/ports/listings.ts` is a pure interface file (no Zod, no driver imports); `container.ts` is the single site naming `MockListingsProvider`; eslint `boundaries/element-types` fails the build on a services→adapter import; `boundary.test.ts` passes (exit non-zero proven) |
| 4 | A `MockListingsProvider` returning static fixtures exercises the full `ListingsProvider` interface end to end | ✓ VERIFIED | `MockListingsProvider` implements both `getListings` (town+price filters via `Money.toCents()`) and `getListingById`; 10 Boston-area fixtures in `LISTING_FIXTURES`; `container.test.ts` asserts `getListings({}).length > 0` and town filter narrows result |

**Score:** 4/4 truths verified

---

### Specific Concerns Examined

#### WR-01: `as CurrentAssumptionSet` version cast at scenario-repo.ts:64

The cast `parseAssumptionSet(raw.assumptions) as CurrentAssumptionSet` asserts a version that Zod did not narrow to — `parseAssumptionSet` returns `AnyAssumptionSet`, and the `as` cast skips calling `migrate()`. The code review correctly identified this as the same class of issue the phase brief warned about.

**Assessment for criterion 2:** Does NOT undermine criterion 2 today. The `migrate()` function exists in core and handles V1→V2→V3→V4 chains. Today `CURRENT_VERSION` is V4 and every save produces a V4 blob, so:
- `parseAssumptionSet` validates the stored blob as a well-formed V4 structure
- The `as CurrentAssumptionSet` assertion is factually correct today
- Byte-identical round-trips are proven: `expect(canonicalJson(loaded.input)).toBe(storedBlob)` uses plain `toBe` and passes in both SQLite and InMemory arms

The risk is latent: if a V5 schema is introduced without also fixing the load path to call `migrate()`, a V4 snapshot would be silently mis-typed. This is a WARNING for future maintainers, not a blocker for the current phase goal.

#### WR-04: Boundary test not truly firing

Addressed by the executor during 06-06: the fixture import was changed to extensionless (resolves via the `node` resolver's `.ts`/`.js` extension list), and the fixture was excluded from `tsc -b`. The boundary test passes:
```
✓ |app| src/boundary.test.ts > app D-03 boundary (lint-as-test) > lint REJECTS a services -> concrete-adapter import (D-03) 2179ms
```
The D-03 guard demonstrably fires. VERIFIED.

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/core/src/ports/repositories.ts` | `ProfileRepository` + `ScenarioRepository` pure interfaces | ✓ VERIFIED | Synchronous methods only; no Zod/driver imports; `count()` feeds the ≤2 guard |
| `packages/core/src/ports/listings.ts` | `ListingsProvider` + `ListingsQuery` pure interfaces | ✓ VERIFIED | Synchronous; no framework imports; money filters as decimal strings |
| `packages/core/src/types/profile.ts` | `Profile` (nine-leaf Household) + `ProfileSchema` + `parseProfile` | ✓ VERIFIED | Extends `HouseholdSchema`; no `z.number()` on money leaves; no separate `netWorth` leaf (`availableNetWorth` is PROF-01 "net worth") |
| `packages/core/src/types/listing.ts` | `Listing` + `ListingSchema` + `parseListing` | ✓ VERIFIED | `listPrice`/`baths` are `decStr`; `beds`/`livingSqft` are counted integers; `.strict()` |
| `packages/core/src/types/saved-scenario.ts` | `SavedScenario` (frozen `EngineInput` snapshot) + `SavedScenarioMeta` | ✓ VERIFIED | Type-only file; `input: EngineInput`; `createdAt`/`updatedAt` epoch-ms (stamped in app shell) |
| `packages/core/src/types/persistence.type-test.ts` | No-bare-number type-test | ✓ VERIFIED | `@ts-expect-error` on bare-number money and on async port implementations; compiles under `tsc -b` |
| `packages/core/src/index.ts` | Phase 6 barrel exports | ✓ VERIFIED | Exports `ListingsProvider`, `ListingsQuery`, `ScenarioRepository`, `ProfileRepository`, `Listing`, `ListingSchema`, `parseListing`, `Profile`, `ProfileSchema`, `parseProfile`, `SavedScenario`, `SavedScenarioMeta` |
| `packages/app/src/adapters/persistence/schema.ts` | Drizzle schema | ✓ VERIFIED | `profiles` + `scenarios` tables with FK constraint |
| `packages/app/src/adapters/persistence/scenario-repo.ts` | `SqliteScenarioRepository` | ✓ VERIFIED | `serializeSnapshot`/`deserializeSnapshot` via `canonicalJson`; every leaf re-parsed through Zod |
| `packages/app/src/adapters/persistence/profile-repo.ts` | `SqliteProfileRepository` | ✓ VERIFIED | Upserts all nine leaves; `rowToProfile` routes through `parseProfile`; injected clock |
| `packages/app/src/adapters/listings/mock-provider.ts` | `MockListingsProvider` | ✓ VERIFIED | `getListings` + `getListingById` over static fixtures; price comparison via `Money.toCents()` |
| `packages/app/src/adapters/listings/fixtures.ts` | `LISTING_FIXTURES` | ✓ VERIFIED | 10 Boston listings; all money fields are canonical decimal strings |
| `packages/app/src/services/profile-service.ts` | `saveProfile` (≤2 guard) + `listProfiles` | ✓ VERIFIED | Count-and-throw on 3rd distinct; edit bypasses cap; port-only dependency |
| `packages/app/src/services/scenario-service.ts` | Pattern-1 scenario lifecycle | ✓ VERIFIED | `computeAndSaveScenario` calls `computeTco` before persist; timestamps from `now` param |
| `packages/app/src/container.ts` | `makeContainer` composition root | ✓ VERIFIED | Single site naming concrete adapters; `runMigrations` at construction; `Container` fields typed as ports |
| `packages/app/src/boundary.test.ts` | D-03 lint-as-test | ✓ VERIFIED | Shells out to `npx eslint --no-ignore`; asserts non-zero exit + `boundaries/element-types` message |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `packages/core/src/index.ts` | `ports/repositories.ts` | barrel re-export | ✓ WIRED | `ScenarioRepository`, `ProfileRepository` exported at lines 166-169 |
| `packages/core/src/index.ts` | `ports/listings.ts` | barrel re-export | ✓ WIRED | `ListingsProvider`, `ListingsQuery` exported at lines 162-165 |
| `packages/core/src/types/profile.ts` | `engine/engine-input.ts` | `HouseholdSchema.extend(...)` | ✓ WIRED | `ProfileSchema` extends `HouseholdSchema` — nine leaves reused verbatim |
| `packages/app/src/container.ts` | `SqliteScenarioRepository` / `SqliteProfileRepository` / `MockListingsProvider` | `new Sqlite... / new MockListingsProvider` | ✓ WIRED | ONLY site in the codebase naming concrete adapters |
| `packages/app/src/services/scenario-service.ts` | `@house/core` (`ScenarioRepository` port + `computeTco`) | `import type { ScenarioRepository }` + value `computeTco` | ✓ WIRED | No concrete adapter import |
| `eslint.config.ts` | `services/_lint-fixtures/services-imports-adapter.fixture.ts` | `boundaries/element-types` rule | ✓ WIRED | Fixture import is extensionless; rule fires; `boundary.test.ts` proves non-zero exit |

### Data-Flow Trace (Level 4)

This phase is persistence infrastructure — no React components rendering dynamic data. The data flow from caller → service → repository → SQLite → reload is fully exercised by `container.test.ts` and `repository-contract.test.ts`.

| Path | Data Variable | Source | Produces Real Data | Status |
|------|--------------|--------|--------------------|--------|
| `saveProfile` → `SqliteProfileRepository.save` → `profiles` table | nine Household leaves | Drizzle parameterized INSERT | Yes — real SQLite rows | ✓ FLOWING |
| `scenarioRepo.save` → `scenarios` table | `canonicalJson(input)` blob | Drizzle parameterized INSERT | Yes — real SQLite TEXT blob | ✓ FLOWING |
| `scenarioRepo.load` → `deserializeSnapshot` → re-parsed `EngineInput` | `row.snapshot` blob | Drizzle SELECT + JSON.parse + Zod parsers | Yes — byte-identical canonicalJson proven | ✓ FLOWING |
| `MockListingsProvider.getListings` | `LISTING_FIXTURES` | Static literals filtered via `Money.toCents()` | Yes — 10 real fixture objects | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Check | Result | Status |
|----------|-------|--------|--------|
| 469 tests pass including reproducibility round-trip | `npx vitest run` | All 43 files / 469 tests passed (25.91s) | ✓ PASS |
| TypeScript builds clean | `npx tsc -b` | EXIT 0 (no output) | ✓ PASS |
| App code lints clean (D-03 boundary) | `npx eslint "packages/app/src/**/*.ts"` | EXIT 0 (deprecation warnings only — not errors) | ✓ PASS |
| D-03 boundary guard fires on negative fixture | `boundary.test.ts` | Exit non-zero + `boundaries/element-types` message | ✓ PASS |
| Byte-identical reload (household present) | `repository-contract.test.ts` | `expect(canonicalJson(loaded.input)).toBe(storedBlob)` — `toBe` not `toEqual` | ✓ PASS |
| Byte-identical reload (household absent) | `repository-contract.test.ts` | Same assertion; `loaded.input.household` is `undefined` | ✓ PASS |
| Fresh-connection reload (PROF-03) | file-backed DB test | Session 1 saves, session 2 (new connection) finds the row | ✓ PASS |
| ≤2 cap: 3rd profile throws | `profile-service.test.ts` | `expect(() => saveProfile(repo, makeProfile('prof-3'))).toThrow(/cap/i)` | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| PROF-01 | 06-05, 06-06 | User can create and save two financial profiles | ✓ SATISFIED | Nine-leaf `SqliteProfileRepository`; ≤2 cap in `saveProfile`; `profile-service.test.ts` |
| PROF-02 | 06-05, 06-06 | User can create multiple named house scenarios under a profile | ✓ SATISFIED | `SqliteScenarioRepository` with `(profileId, name)` unique index; `computeAndSaveScenario` service |
| PROF-03 | 06-05 | User can save scenarios and reload them in a later session | ✓ SATISFIED | Fresh-connection file-backed reload test in `repository-contract.test.ts:330-358` |
| LIST-01 | 06-01 | `ListingsProvider` adapter interface defined in core, isolated | ✓ SATISFIED | `packages/core/src/ports/listings.ts`; barrel-exported; no engine math inside |
| LIST-02 | 06-04 | `MockListingsProvider` returning static fixtures exercises the interface | ✓ SATISFIED | `MockListingsProvider` + `LISTING_FIXTURES`; end-to-end exercised by `container.test.ts` |

**Note on PROF-04** (Phase 1 requirement, also relevant here): The reproducibility contract is satisfied — byte-identical `canonicalJson` round-trips are asserted with plain `toBe`. The frozen-household contract (post-save profile edit does not mutate the saved snapshot) is explicitly tested in `repository-contract.test.ts:237-265`.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `packages/app/src/adapters/persistence/scenario-repo.ts` | 64 | `as CurrentAssumptionSet` version cast after `parseAssumptionSet` | ⚠️ Warning (WR-01) | Today harmless (V4 is the only version); if V5 is introduced without fixing this load path to call `migrate()`, old snapshots will be silently mis-typed. `migrate()` exists in core and should be called here instead. |
| `packages/app/src/adapters/persistence/db.ts` | 21-24 | `pragma foreign_keys = ON` absent; FK enforcement relies on `SQLITE_DEFAULT_FOREIGN_KEYS=1` compile flag | ⚠️ Warning (WR-02) | FK is enforced today but would silently break if the driver is swapped to `node:sqlite` (FK off by default). No negative test proves the FK rejects a dangling profileId. |
| `packages/app/src/container.ts` | 44-52 | No `close()` / `dispose()` on `Container` or `Db` | ⚠️ Warning (WR-03) | DB handle leaks for process lifetime; WAL/SHM files not checkpointed. Noted as in-scope by the phase brief. |
| `packages/app/src/adapters/listings/mock-provider.ts` | 33-51 | `getListings`/`getListingById` return shared references to non-frozen fixture objects | ⚠️ Warning (WR-05) | A consumer mutating a returned `Listing` (via `any`/cast) would corrupt the singleton for subsequent queries. `Object.freeze` on the fixture literals would match the core's runtime-immutability discipline. |
| `packages/core/src/types/persistence.type-test.ts` | 47,49,55,57,65,66 | `@typescript-eslint/no-unused-vars` on `_q`, `_id`, `_p` params in `@ts-expect-error` lambdas | ⚠️ Warning | `npm run lint` reports 6 errors in this Phase-6-created file. The `tsc -b` and `vitest run` gates pass; the type-test still correctly fires `@ts-expect-error`. Fix: prefix params with `_` (already done) — but the TS-ESLint rule requires `argsIgnorePattern: '^_'` config to suppress this class. Pre-existing failure path; app code lints clean. |
| `packages/app/src/adapters/persistence/profile-repo.ts` | 8-10, 23 | Header comment says "timestamps supplied by caller — never `Date.now()` here"; code does the opposite | ℹ️ Info (WR-06) | Documentation contradicts the correct implementation. No behavior impact. |
| `packages/app/src/adapters/persistence/db.ts` | 30-34 | `MIGRATIONS_FOLDER` resolution will not work from `dist/` | ℹ️ Info (IN-01) | The "works in dist" comment is incorrect — no build step copies `drizzle/` into `dist/`. Harmless today (nothing runs from `dist/`). |

### Human Verification Required

None. Phase 6 is a pure persistence/adapter layer with no UI components. All observable behaviors are fully exercised by the 469-test suite.

---

## Gaps Summary

No gaps. All four success criteria are verified against the codebase. The identified warnings (WR-01 through WR-06, IN-01) are code-quality findings that do not block the phase goal.

**WR-01 (version cast) specifically assessed:** The `as CurrentAssumptionSet` cast at `scenario-repo.ts:64` does not undermine criterion 2 today. Byte-identical reproducibility is proven by `expect(canonicalJson(loaded.input)).toBe(storedBlob)` in both the SQLite and InMemory arms. The risk is future schema evolution without a paired `migrate()` call — worth fixing before V5 is introduced.

---

_Verified: 2026-06-27T23:55:00Z_
_Verifier: Claude (gsd-verifier)_
