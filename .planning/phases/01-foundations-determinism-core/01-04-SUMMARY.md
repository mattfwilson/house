---
phase: 01-foundations-determinism-core
plan: 04
subsystem: reproducibility-harness
tags: [golden-master, canonical-json, determinism, canary, compounding, decimal-string, reproducibility, public-surface, eslint-scoped-exception]

# Dependency graph
requires:
  - "01-01: @house/core skeleton (ESLint boundary + determinism guards; Vitest projects; cross-env update-golden script; *.test.ts excluded from tsc -b)"
  - "01-02: Money (toDecimalString / toCents), Dec (frozen Decimal clone), CalendarDate + calendarDate()"
  - "01-03: AssumptionSet + parseAssumptionSet, DEFAULT_ASSUMPTIONS (returns.realAnnual), EngineInput + engineInput()"
provides:
  - "canonicalJson(value) — deterministic serializer: Money -> decimal string, object keys sorted recursively, order-independent byte-identical output (D-10)"
  - "runCanary(input: EngineInput): CanaryResult — deterministic (1+r)^30 Decimal compounding reading returns.realAnnual; Money rounded only at the toCents boundary; asOf from input, never a clock (D-08)"
  - "golden-snapshot.json — committed frozen golden master (Money as decimal strings, sorted keys) in src/__fixtures__/"
  - "golden.test.ts — gated harness: UPDATE_GOLDEN=1 regenerates (reviewable diff), otherwise deep-equal on canonical JSON; PLUS a serialize->deserialize->recompute round-trip (NOT toMatchSnapshot)"
  - "index.ts public surface — re-exports Money, calendarDate, AssumptionSet schema/types/helpers/defaults/migrate, EngineInput/engineInput, runCanary, canonicalJson; raw Dec/Decimal NO LONGER leaked"
  - "eslint.config.ts golden.test.ts-scoped override — only the UPDATE_GOLDEN env read sanctioned, auditable to one file (T-04-04)"
affects:
  - "Phase 2+ (TCO, Affordability, FI-Impact, Town Scoring) — import everything through the now-stable @house/core barrel"
  - "FI-05 (FI oracle test) — will reuse this golden-master pattern (gated regen, canonical deep-equal) to reconcile the FI math against the existing retirement model"

# Tech tracking
tech-stack:
  added: []  # no new dependencies; reused decimal.js + the cross-env update-golden script from 01-01
  patterns:
    - "Canonical serialization = normalize-then-stringify (Money->decimal string, recursive key sort) rather than a JSON.stringify replacer, because a replacer alone cannot reorder keys"
    - "Golden master regenerated ONLY behind UPDATE_GOLDEN=1 producing a reviewable git diff — explicitly NOT Vitest toMatchSnapshot (which -u / first-run auto-re-blesses drift, the T-04-01 tampering threat)"
    - "Round-trip reproducibility proven by re-parsing the serialized snapshot THROUGH parseAssumptionSet/calendarDate (never trusting raw JSON) and re-running the canary"
    - "Public barrel deliberately omits raw Dec/Decimal — dollars cross the boundary only as the closed Money API (asserted by index.test.ts: 'Decimal'/'Dec' NOT in the module)"
    - "Single sanctioned env read (UPDATE_GOLDEN) scoped to golden.test.ts by a documented, greppable ESLint override — defense against env-read scope creep"

key-files:
  created:
    - "packages/core/src/serialize/canonical-json.ts"
    - "packages/core/src/serialize/canonical-json.test.ts"
    - "packages/core/src/engine/canary.ts"
    - "packages/core/src/engine/canary.test.ts"
    - "packages/core/src/golden.test.ts"
    - "packages/core/src/__fixtures__/golden-snapshot.json"
    - "packages/core/src/index.test.ts"
  modified:
    - "packages/core/src/index.ts (export runCanary + canonicalJson; remove raw Dec/DecimalInstance leak)"
    - "eslint.config.ts (documented golden.test.ts-scoped UPDATE_GOLDEN env-read exception)"

key-decisions:
  - "canonicalJson normalizes recursively (Money->toDecimalString, sort object keys, preserve array order) then JSON.stringify — a replacer-only approach can't sort keys, so byte-identical order-independence requires the normalize pass"
  - "The canary is representative, not a trivial echo: it reads returns.realAnnual, computes (1+r)^30 at full Dec precision, multiplies a Money principal, and reports principal/final/gain — exercising the real compounding+rounding+assumption-read machinery the FI oracle will trust"
  - "Money values stay full-precision in the result (toDecimalString in the golden master); toCents() is the documented rounding boundary, asserted positive in canary.test.ts. Cent-identical enforcement is on the canonical-JSON string compare"
  - "Regeneration is gated on UPDATE_GOLDEN=1 via the existing cross-env npm script (Windows/POSIX portable); NOT toMatchSnapshot. Tamper-detection manually verified (mutating one digit fails the golden test)"
  - "index.ts stopped exporting raw Dec/DecimalInstance (they were exported by 01-02/01-03) so the public surface cannot re-open the bare-float hole; index.test.ts asserts 'Decimal'/'Dec'/'DecimalInstance' are NOT in the module"

requirements-completed: [PROF-04]

# Metrics
duration: ~4min
completed: 2026-06-23
---

# Phase 1 Plan 04: Reproducibility Harness (Golden Master + Canary) Summary

**The reproducibility loop closed (PROF-04): a deterministic `runCanary` doing real `(1+r)^30` `Dec` compounding + an `AssumptionSet` slice read over a frozen `EngineInput`, serialized through an order-independent, float-free `canonicalJson` (Money -> decimal string, keys sorted), deep-equal-compared against a committed golden-master fixture regenerated ONLY behind `UPDATE_GOLDEN=1` (never `toMatchSnapshot`), plus a serialize -> deserialize -> recompute round-trip proving data reproducibility, and the public `index.ts` barrel assembled into a stable import boundary that no longer leaks raw `Decimal`.**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-06-23
- **Completed:** 2026-06-23
- **Tasks:** 2 (Task 1 TDD: RED -> GREEN, no REFACTOR; Task 2 fixture-gen + commit)
- **Files created/modified:** 9 (7 created, 2 modified)

## Accomplishments

- `serialize/canonical-json.ts`: `canonicalJson(value)` — a recursive normalizer (`Money` -> `toDecimalString()`, object keys sorted at every depth, array element order preserved) feeding `JSON.stringify`. Two differently-key-ordered equivalent objects produce byte-identical output; a `Money` is emitted as its decimal STRING, never a JS number (D-10, no float leak).
- `engine/canary.ts`: `runCanary(input)` reads `input.assumptions.returns.realAnnual`, computes the compounding factor `(1 + r)^30` at full `Dec` precision (HALF_EVEN, 34 digits), multiplies the fixed `Money` principal (`100000`), and returns `{ asOf, periods, realAnnual, principal, final, gain }`. `asOf` comes straight from the `EngineInput` (never a clock). Deterministic: same input -> same canonical result.
- `__fixtures__/golden-snapshot.json`: the committed frozen golden master — `{"asOf":"2026-01-01","final":"432194.2375150662009157288198886473","gain":"332194.2375150662009157288198886473","periods":30,"principal":"100000","realAnnual":"0.05"}` — every Money value a decimal string, keys sorted.
- `golden.test.ts`: gated harness. With `UPDATE_GOLDEN=1` it (mkdir + ) writes the fixture and returns; otherwise it reads the committed fixture and `expect(produced).toBe(golden)` (deep-equal on canonical JSON). It ALSO asserts a snapshot round-trip: serialize the `EngineInput` to canonical JSON, re-parse it THROUGH `parseAssumptionSet`/`calendarDate` (never trusting raw JSON), re-run `runCanary`, and assert the recomputed canonical result equals the first (D-08). Deliberately NOT `toMatchSnapshot`.
- `index.ts`: public surface now re-exports `runCanary`/`CanaryResult` + `canonicalJson`, and STOPPED exporting raw `Dec`/`DecimalInstance` — the bare-float hole stays closed at the package boundary. `index.test.ts` asserts the phase primitives are exported and that `Decimal`/`Dec`/`DecimalInstance` are NOT in the module.
- `eslint.config.ts`: a documented, `golden.test.ts`-scoped override making the single `process.env.UPDATE_GOLDEN` read the only sanctioned env access, auditable to one named file (T-04-04).
- Final gate: `npm test` (75 tests, 12 files), `npm run typecheck` (`tsc -b`), `npm run lint` — all exit 0.

## Task Commits

1. **Task 1 RED — failing canonicalJson / runCanary / index tests** — `1f0f611` (test)
2. **Task 1 GREEN — canonicalJson + canary + public barrel (no raw Decimal)** — `4f4bd6a` (feat)
3. **Task 2 — golden master fixture + gated reproducibility test + scoped ESLint exception** — `d5f8155` (feat)

**Plan metadata:** committed separately with SUMMARY/STATE/ROADMAP/REQUIREMENTS.

## Decisions Made

- **Normalize-then-stringify, not a replacer.** Byte-identical order-independence requires reordering object keys, which a `JSON.stringify` replacer cannot do. So `canonicalJson` does a recursive normalize pass (Money -> string, sort keys, preserve array order) and stringifies the canonical shape.
- **The canary is representative, not an echo.** Per D-08 / the CONTEXT "not a trivial echo" directive, `runCanary` does real multi-period `Dec` compounding reading an `AssumptionSet` slice — the exact machinery (compounding + banker's rounding + assumption read) the future FI oracle (FI-05) must trust. A load-bearing test alters `realAnnual` and asserts a different `final`, proving the slice is wired, not decorative.
- **Gated regen over `toMatchSnapshot`.** `toMatchSnapshot` auto-writes on first run and re-blesses under `-u`, silently masking drift (T-04-01). Regeneration is instead explicit (`UPDATE_GOLDEN=1` via the cross-env `update-golden` script) and produces a reviewable git diff. Tamper-detection was manually verified.
- **Public surface no longer leaks raw `Decimal`.** 01-02/01-03 had exported `Dec`/`DecimalInstance`; this plan removes them so downstream phases can only handle dollars through the closed `Money` API. `index.test.ts` makes that a regression test.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `UPDATE_GOLDEN=1` write failed because `src/__fixtures__/` did not exist**
- **Found during:** Task 2 (first `npm run update-golden` run)
- **Issue:** `writeFileSync(GOLDEN_PATH, ...)` threw `ENOENT` — `node:fs` does not create missing parent directories, and the `__fixtures__` directory did not exist yet (the plan lists the fixture as an artifact but nothing creates the folder).
- **Fix:** Added `mkdirSync(dirname(GOLDEN_PATH), { recursive: true })` immediately before the write in the `UPDATE_GOLDEN` branch. Idempotent; only runs during gated regeneration.
- **Files modified:** packages/core/src/golden.test.ts
- **Verification:** `npm run update-golden` succeeds and writes the fixture; the ungated `npm run test -w packages/core -- src/golden` then passes against it.
- **Committed in:** `d5f8155` (Task 2)

### Plan-prescribed approach adjusted (documented)

**2. [Note] The broad `*.test.ts` ESLint override already permitted the env read; the golden override is an explicit, documented narrowing**
- **Why:** The 01-01 ESLint config already turns `no-restricted-globals`/`no-restricted-properties` off for ALL `packages/core/src/**/*.test.ts` (needed for `boundary.test.ts`'s node built-ins). The plan still asks for a `golden.test.ts`-scoped exception for the `UPDATE_GOLDEN` read. I added it as a documented, greppable override block so the single sanctioned env read has a named home auditable to one file (satisfies T-04-04's "scoped to golden.test.ts only" intent), rather than relying solely on the broad relaxation.
- **Files:** eslint.config.ts
- **Committed in:** `d5f8155` (Task 2)

---

**Total deviations:** 1 auto-fixed (Rule 3 - blocking dir-creation) + 1 documented config note. No package changes, no scope creep, no architectural changes.

## Issues Encountered

- `eslint-plugin-boundaries@6` continues to emit the (non-fatal) `boundaries/external` deprecation warning carried over from 01-01/01-02/01-03; `npm run lint` still exits 0. Migration to `boundaries/dependencies` remains a future tidy-up, not a Phase-1 blocker.
- Git reports CRLF normalization warnings on commit (Windows). Cosmetic; no content impact.

## Known Stubs

None. `ScenarioInputs` remains the intentional Phase-1 placeholder documented in 01-03 (widened by later phases); it is not a hidden stub. Every artifact this plan produces is fully wired and exercised.

## Threat Flags

None — no new security-relevant surface beyond the plan's threat model. All four register entries are mitigated as planned:
- **T-04-01** (silent re-blessing): regen gated behind `UPDATE_GOLDEN=1` with a reviewable diff, NOT `toMatchSnapshot`; tamper-detection (mutate one cent -> fail) manually verified.
- **T-04-02** (non-deterministic/non-canonical serialization): `canonicalJson` sorts keys + emits Money as a decimal string; the canary's `asOf` comes from the EngineInput, never `Date.now`; round-trip assertion present.
- **T-04-03** (float leak into the golden master): Money serialized via `toDecimalString`, assumption values are decimal strings end to end; the committed fixture contains only strings/integers, no float.
- **T-04-04** (ESLint env-read exception widening): override scoped to `golden.test.ts` and documented as the single `UPDATE_GOLDEN` read; `grep` confirms `UPDATE_GOLDEN` is the ONLY `process.env` access in `packages/core/src`.

## User Setup Required

None — no external service configuration required. Regenerating the golden master (when the canary intentionally changes) is `npm run update-golden`, which then surfaces a reviewable git diff.

## Next Phase Readiness

- `@house/core`'s public `index.ts` is now the stable import boundary for Phase 2+ — Money, CalendarDate, the AssumptionSet surface, EngineInput, runCanary, and canonicalJson are all re-exported, with raw Decimal walled off.
- The golden-master pattern (frozen fixture + gated regen + canonical deep-equal) is established and ready to be reused by FI-05 to reconcile the FI math against the existing retirement model.
- Determinism is now provable end-to-end before any persistence exists: a frozen EngineInput recomputes cent-identically, and the serialize->deserialize->recompute round-trip is lossless.

## Self-Check: PASSED

All 7 created files and 2 modified files verified present on disk; all 3 task commits (1f0f611, 4f4bd6a, d5f8155) verified in git history. Full gate green: `npm test` (75 passing, 12 files), `npm run typecheck` (`tsc -b`, 0), `npm run lint` (0, deprecation warning only). Tamper-detection manually verified (mutating one digit in the fixture fails the golden test; fixture restored).

---
*Phase: 01-foundations-determinism-core*
*Completed: 2026-06-23*
