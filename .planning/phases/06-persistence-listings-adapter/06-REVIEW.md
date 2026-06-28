---
phase: 06-persistence-listings-adapter
reviewed: 2026-06-27T00:00:00Z
depth: standard
files_reviewed: 22
files_reviewed_list:
  - packages/core/src/types/profile.ts
  - packages/core/src/types/listing.ts
  - packages/core/src/types/saved-scenario.ts
  - packages/core/src/types/persistence.type-test.ts
  - packages/core/src/ports/repositories.ts
  - packages/core/src/ports/listings.ts
  - packages/core/src/index.ts
  - packages/app/src/adapters/persistence/schema.ts
  - packages/app/src/adapters/persistence/db.ts
  - packages/app/src/adapters/persistence/scenario-repo.ts
  - packages/app/src/adapters/persistence/profile-repo.ts
  - packages/app/src/adapters/persistence/in-memory-repos.ts
  - packages/app/src/adapters/persistence/migration.test.ts
  - packages/app/src/adapters/persistence/repository-contract.test.ts
  - packages/app/src/adapters/listings/fixtures.ts
  - packages/app/src/adapters/listings/mock-provider.ts
  - packages/app/src/adapters/listings/mock-provider.test.ts
  - packages/app/src/services/profile-service.ts
  - packages/app/src/services/scenario-service.ts
  - packages/app/src/services/profile-service.test.ts
  - packages/app/src/container.ts
  - packages/app/src/container.test.ts
findings:
  critical: 0
  warning: 6
  info: 2
  total: 8
status: issues_found
---

# Phase 6: Code Review Report

**Reviewed:** 2026-06-27
**Depth:** standard
**Files Reviewed:** 22
**Status:** issues_found

## Summary

Phase 6 adds SQLite persistence (better-sqlite3 + Drizzle) and a walled-off `ListingsProvider`
adapter behind a new `packages/app` imperative shell. The money discipline holds well: every dollar
leaf crosses as a canonical decimal string, the mock provider compares prices through
`Money.of().toCents()` (exact `bigint`, no float coercion), and Drizzle parameterizes all SQL (no
injection surface). The dependency-inversion boundary is real and lint-enforced, and the
reproducibility round-trip (save → reload → byte-identical canonical JSON) is asserted with plain
`toBe`, not auto-blessing snapshots.

No BLOCKER-level correctness, security, or data-loss defects were proven. The findings below
concentrate on (1) a load-path `as` cast that asserts a version the validator did not prove, (2)
foreign-key and forged-input defenses that are claimed in comments but never exercised by a negative
test, (3) unmanaged DB-handle lifecycle, and (4) immutability/documentation gaps that erode the
strong determinism discipline the rest of the codebase upholds.

The good news worth recording: I verified that better-sqlite3 in this repo is compiled with
`SQLITE_DEFAULT_FOREIGN_KEYS=1` (node_modules/better-sqlite3/deps/defines.gypi:14), so the
scenarios→profiles FK *is* enforced at runtime — but see WR-02 for why that is fragile and untested.

## Narrative Findings (AI reviewer)

## Warnings

### WR-01: Load path casts a validated `AnyAssumptionSet` to `CurrentAssumptionSet` without migration

**File:** `packages/app/src/adapters/persistence/scenario-repo.ts:64`
**Issue:** `deserializeSnapshot` does:
```ts
assumptions: parseAssumptionSet(raw.assumptions) as CurrentAssumptionSet,
```
`parseAssumptionSet` returns `AnyAssumptionSet` (a union over every schema version — see
`packages/core/src/assumptions/assumption-set.ts:33`). Zod validates the *structure* of whatever
version was stored, but the `as CurrentAssumptionSet` cast asserts a version Zod did **not** prove,
and `migrate()` is never called. Today `CURRENT_VERSION` is V4 and every save is V4, so nothing
breaks — but the moment the assumptions schema gains a V5, a previously-saved snapshot will be parsed
as its old shape, mis-typed as current, and handed to `computeTco`, which may read a now-undefined
current-version field. This is exactly the "`as` cast that bypasses validation on load" class the
phase brief calls out — it bypasses *version* narrowing, not field validation. Note the contrast:
`parseScenarioInputs`/`parseHousehold` return their precise types with no widening cast; only the
assumptions leaf launders a union into a member.
**Fix:** Narrow legitimately instead of asserting. Either migrate on load (accepting that
byte-identity for pre-current snapshots no longer holds, which is the honest reproducibility story for
an evolved schema):
```ts
import { migrate } from '@house/core';
assumptions: migrate(parseAssumptionSet(raw.assumptions)),
```
or, if the frozen-byte contract must win, re-parse through a *current-version-only* schema so an
old-version blob is rejected loudly rather than silently mis-typed.

### WR-02: FK enforcement is implicit (compile-time default) and never proven by a negative test

**File:** `packages/app/src/adapters/persistence/db.ts:21-24`
**Issue:** `openDb` sets only `journal_mode = WAL`; it never issues `PRAGMA foreign_keys = ON`. The
scenarios→profiles FK is enforced *only* because this build's better-sqlite3 happens to be compiled
with `SQLITE_DEFAULT_FOREIGN_KEYS=1`. CLAUDE.md explicitly lists `node:sqlite` (FK **off** by default)
as a sanctioned future driver swap; making that swap would silently disable FK enforcement with no
compile or test failure. Worse, the claim is load-bearing in comments
(`repository-contract.test.ts:130`, `container.test.ts:7` — "the SQLite arm enforces a real FOREIGN
KEY constraint") yet **no test inserts a scenario with a non-existent `profileId` and asserts a
throw**. `seedProfiles` always seeds the owner first, so FK enforcement is asserted in prose and
exercised by nothing.
**Fix:** Make it explicit and prove it:
```ts
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('foreign_keys = ON'); // do not rely on a driver compile flag
```
and add a contract test: saving a scenario whose `profileId` references no profile row must throw a
FK-constraint error in the SQLite arm.

### WR-03: No disposal path — DB connections and WAL handles are never closed

**File:** `packages/app/src/container.ts:44-52`, `packages/app/src/adapters/persistence/db.ts:21-25`
**Issue:** `openDb` constructs a `better-sqlite3` handle and `makeContainer` wires it into the
adapters, but neither `Container` nor `Db` exposes a `close()`/`dispose()`. For a file-backed
production DB the connection (and its WAL/SHM file handles) leaks for the process lifetime with no
clean checkpoint on shutdown — the contract test itself documents that an open handle blocks file
deletion on Windows and that closing is what checkpoints WAL into the main file
(`repository-contract.test.ts:344-349`). The phase brief explicitly flags "resource-leak (unclosed DB
handles)" as in-scope.
**Fix:** Add a `close(): void` to the `Container` interface that calls `db.$client.close()`, and have
callers (and future `apps/web` shutdown hooks) invoke it. At minimum expose the underlying handle so a
composition root can close it deterministically.

### WR-04: Forged-blob / corrupt-row rejection (T-06-12, T-06-13) is documented but untested

**File:** `packages/app/src/adapters/persistence/scenario-repo.ts:55-68`, `packages/app/src/adapters/persistence/profile-repo.ts:92-111`
**Issue:** Both adapters advertise defense-in-depth: `deserializeSnapshot` claims a smuggled float
throws at the Zod boundary (T-06-12), and `rowToProfile` claims a corrupt DB value is rejected on read
(T-06-13). These are security-relevant trust boundaries, but a grep of the suite shows the only
`toThrow` assertions are the profile cap, the unique index, and a *positive* `parseListing` sweep —
**no test ever stores a corrupt blob or a non-canonical profile column and asserts the load path
throws.** The defenses may well work, but they are unverified, and WR-01 shows the load path already
has one gap where invalid-by-version data can slip through. Untested security claims tend to rot.
**Fix:** Add negative tests: (a) write a `scenarios.snapshot` blob containing a bare-number `price`
(e.g. `{"asOf":"2026-01-01","assumptions":{...},"scenario":{"price":850000}}`) and assert
`scenarioRepo.load(...)` throws; (b) write a `profiles` row with a non-canonical decimal string and
assert `profileRepo.load(...)` throws.

### WR-05: MockListingsProvider returns shared references to unfrozen fixture objects

**File:** `packages/app/src/adapters/listings/mock-provider.ts:33-51`, `packages/app/src/adapters/listings/fixtures.ts:22`
**Issue:** `getListings`/`getListingById` return the *same* `Listing` objects held in
`LISTING_FIXTURES`. The fixtures array is `readonly Listing[]` and the fields are `readonly` at the
type level, but the objects are never `Object.freeze`d (unlike `EngineInput`, which core freezes at
runtime). A consumer that mutates a returned listing — `listing.town = '…'` slips past `readonly` via
any `any`/cast or plain JS UI code — corrupts the singleton fixture for every subsequent query in the
process. This contradicts the runtime-immutability discipline the calc core enforces everywhere, and a
future `RealListingsProvider` that returns fresh objects per call would not share this footgun, so
behavior would silently differ across implementations of the same port.
**Fix:** Freeze the fixtures at module load (`LISTING_FIXTURES.map(Object.freeze)` behind the
`readonly Listing[]` type, or `Object.freeze` each literal), or return shallow copies from the
provider. Freezing the source literals is cheapest and matches the core convention.

### WR-06: profile-repo documentation contradicts its own clock-ownership implementation

**File:** `packages/app/src/adapters/persistence/profile-repo.ts:8-10, 17-18, 23, 33`
**Issue:** The header states "Timestamps are integer epoch-ms supplied by the caller/service — never
`Date.now()` here," and the class doc repeats "The caller supplies `createdAt`/`updatedAt` … they are
NOT generated in this adapter." The implementation does the opposite: the constructor defaults to
`now: () => number = () => Date.now()` and `save` stamps `const ts = this.now()`. Because `Profile`
carries no timestamp fields, the caller *cannot* supply them — the adapter *must* generate them, which
is what the code correctly does. On a project whose entire spine is "who owns the clock," documentation
that inverts the determinism story on a clock-stamping path is a real maintenance hazard (a reader
trusting the comment would look for a non-existent caller-supplied timestamp).
**Fix:** Correct the comments to describe the actual contract: this adapter owns the wall clock via an
injected `now` (real `Date.now()` in the container, a fixed clock in tests), because the locked
`Profile` port carries no timestamps. Contrast it explicitly with `scenario-service`, where the
caller *does* supply `now`.

## Info

### IN-01: MIGRATIONS_FOLDER resolution will not work from `dist/` despite the comment's claim

**File:** `packages/app/src/adapters/persistence/db.ts:30-34`
**Issue:** The comment asserts the migrations-folder resolution "works identically under tsx/vitest
(src) and the built dist output." Resolved from a built `dist/adapters/persistence/db.js`, the three
`..` segments point at `packages/app/dist/drizzle`, but the committed migrations live at
`packages/app/drizzle` and `package.json` has no build step copying them into `dist/` (only `test` and
`typecheck` scripts exist). Today this is harmless — `package.json` `exports` resolves `.` to
`./src/index.ts`, so nothing runs from `dist/` — but the comment is a latent trap: the first time
someone executes the built output (or relies on the declared `outDir`), migrations silently won't be
found.
**Fix:** Either drop the "works in dist" claim, or add a build step that copies `drizzle/` into
`dist/` and resolve the folder accordingly.

### IN-02: `count()` query result depends on `count(*)` fitting a JS number

**File:** `packages/app/src/adapters/persistence/profile-repo.ts:83-86`
**Issue:** `sql<number>\`count(*)\`` plus `row?.c ?? 0` is correct and safe for this 2-profile tool,
but the `<number>` type assertion trusts the driver to hand back a JS number rather than a `bigint`.
better-sqlite3 returns integers as numbers by default (and these counts are tiny), so there is no
practical risk here — noted only for completeness given the project's zero-tolerance stance on numeric
assumptions. No change required.

---

_Reviewed: 2026-06-27_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
