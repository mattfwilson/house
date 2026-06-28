---
phase: 06-persistence-listings-adapter
fixed_at: 2026-06-28T00:43:00Z
review_path: .planning/phases/06-persistence-listings-adapter/06-REVIEW.md
iteration: 1
findings_in_scope: 6
fixed: 6
skipped: 0
status: all_fixed
---

# Phase 6: Code Review Fix Report

**Fixed at:** 2026-06-28
**Source review:** .planning/phases/06-persistence-listings-adapter/06-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 6 (all Warnings; no Critical/Blocker findings, Info findings out of scope)
- Fixed: 6
- Skipped: 0

Baseline before fixes: `tsc -b` clean, 469 tests passing, lint had 7 pre-existing
`no-unused-vars` errors. After fixes: `tsc -b` clean, **474 tests passing** (5 new tests added),
**lint clean**.

## Fixed Issues

### WR-01: Load path casts a validated `AnyAssumptionSet` to `CurrentAssumptionSet` without migration

**Files modified:** `packages/app/src/adapters/persistence/scenario-repo.ts`
**Commit:** 5968fb2
**Applied fix:** Replaced `parseAssumptionSet(raw.assumptions) as CurrentAssumptionSet` with
`migrate(parseAssumptionSet(raw.assumptions))`. `migrate` (already exported from `@house/core`)
returns a `CurrentAssumptionSet` after re-validating through the V4 schema (`AssumptionsV4.parse`),
so this is a legitimate narrowing rather than an `as` cast asserting an unproven version. Verified
the reproducibility contract still holds: for a stored current-version (V4) snapshot `migrate` is
the identity re-parse, so the save -> reload round-trip remains **byte-identical** (the two
`toBe`-asserted round-trip tests still pass). Removed the now-unused `CurrentAssumptionSet` type
import.

### WR-02: FK enforcement is implicit (compile-time default) and never proven by a negative test

**Files modified:** `packages/app/src/adapters/persistence/db.ts`,
`packages/app/src/adapters/persistence/repository-contract.test.ts`
**Commit:** f66e5ea
**Applied fix:** Added `sqlite.pragma('foreign_keys = ON')` to `openDb` so the scenarios->profiles
FK is enforced as a property of the adapter, not of the driver's compile flags (CLAUDE.md sanctions
a future `node:sqlite` swap, which defaults FK off). Added a SQLite-only negative contract test:
saving a scenario whose `profileId` references no profile row now throws a `FOREIGN KEY` error
(asserted with `toThrow(/FOREIGN KEY/i)`).

### WR-03: No disposal path — DB connections and WAL handles are never closed

**Files modified:** `packages/app/src/container.ts`, `packages/app/src/container.test.ts`
**Commit:** 66febe3
**Applied fix:** Added a `close(): void` lifecycle hook to the `Container` interface, implemented in
`makeContainer` as `() => db.$client.close()` (checkpoints WAL into the main DB file, releases the
file/WAL/SHM handles). Documented it as a composition-root lifecycle hook (not a port). Added a
container test that constructs a container, asserts a port call works, then asserts `close()` runs
without throwing.

### WR-04: Forged-blob / corrupt-row rejection (T-06-12, T-06-13) is documented but untested

**Files modified:** `packages/app/src/adapters/persistence/repository-contract.test.ts`
**Commit:** 1d02230
**Applied fix:** Added two SQLite-only negative tests that write forged rows DIRECTLY via Drizzle
(bypassing the adapters' save path): (a) T-06-12 — a `scenarios.snapshot` blob whose `scenario.price`
is a bare JS number (a float smuggled past the decimal-string boundary) makes `scenarioRepo.load`
throw; (b) T-06-13 — a `profiles` row whose `grossAnnualIncome` is a non-canonical decimal string
makes `profileRepo.load` throw at `parseProfile`.

### WR-05: MockListingsProvider returns shared references to unfrozen fixture objects

**Files modified:** `packages/app/src/adapters/listings/fixtures.ts`,
`packages/app/src/adapters/listings/mock-provider.test.ts`
**Commit:** 864aae5
**Applied fix:** The exported `LISTING_FIXTURES` is now built by `Object.freeze`-ing each listing at
module load (`RAW_LISTING_FIXTURES.map((l) => Object.freeze(l))`), matching the runtime-immutability
discipline the calc core enforces on `EngineInput`. Listings are flat (string/number leaves) so a
shallow freeze fully seals each record. Added a test proving a returned listing is frozen and that a
mutation attempt throws `TypeError` without corrupting the shared singleton.

### WR-06: profile-repo documentation contradicts its own clock-ownership implementation

**Files modified:** `packages/app/src/adapters/persistence/profile-repo.ts`
**Commit:** 57880ef
**Applied fix:** Corrected the file header and class doc comments (documentation only — no logic
change). They now state the actual contract: this adapter OWNS the wall clock via an injected `now`
(real `Date.now()` in the container, a fixed clock in tests) and stamps `created_at`/`updated_at`
itself, because the locked nine-leaf `Profile` port carries no timestamp fields so the caller cannot
supply them. Added the explicit contrast with `scenario-service`, where the caller owns the clock.

## Additional Fix (guardrail-directed, beyond the numbered findings)

### LINT: pre-existing `no-unused-vars` errors blocking a green lint gate

**Files modified:** `eslint.config.ts`, `packages/core/src/tco/rent-vs-buy.test.ts`
**Commit:** a6b6fde
**Applied fix:** The project guardrails directed clearing the pre-existing lint failures and
confirming `npm run lint` passes. Baseline `eslint .` had 7 `no-unused-vars` errors (present at the
phase tip, in files untouched by the WR fixes):
- 6 in `packages/core/src/types/persistence.type-test.ts` — the `_q`/`_id`/`_p` port-signature
  probe parameters. Fixed by adding the standard leading-underscore ignore convention
  (`argsIgnorePattern`/`varsIgnorePattern`/`caughtErrorsIgnorePattern: '^_'`) to the eslint config.
  This does NOT weaken real coverage — only bindings the author explicitly marked with a leading
  `_` are ignored.
- 1 in `packages/core/src/tco/rent-vs-buy.test.ts` — a genuinely dead `computeTco` import
  (referenced only in a comment). Removed the unused import.

`eslint .` is now clean. Note this touched two core files outside `packages/app`; both changes are
inert to runtime behavior (a lint-config convention and a dead-import removal) and the full test
suite (including `rent-vs-buy.test.ts`) still passes.

## Skipped Issues

None — all 6 in-scope findings were fixed.

## Verification

Each fix was verified individually (re-read + `tsc -b` + the relevant test file). Final full-suite
verification of the complete set:
- `tsc -b`: clean
- `vitest run`: 43 files, **474 tests passing** (469 baseline + 5 new: FK negative, 2 forged-row
  negatives, container `close()`, fixture freeze)
- `eslint .`: clean

Per the verification guidance, WR-01 and WR-03 are structural/behavioral changes whose correctness
is covered by the byte-identity round-trip tests and the new disposal test respectively; no fix was
left in a logic-bug-suspect state requiring separate human verification.

---

_Fixed: 2026-06-28_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
