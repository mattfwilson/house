---
phase: 01-foundations-determinism-core
reviewed: 2026-06-23T00:00:00Z
depth: standard
files_reviewed: 20
files_reviewed_list:
  - packages/core/src/money/decimal-config.ts
  - packages/core/src/money/money.ts
  - packages/core/src/time/calendar-date.ts
  - packages/core/src/determinism/guard.ts
  - packages/core/src/determinism/guard.setup.ts
  - packages/core/src/assumptions/schema.ts
  - packages/core/src/assumptions/assumption-set.ts
  - packages/core/src/assumptions/defaults.ts
  - packages/core/src/assumptions/migrate.ts
  - packages/core/src/engine/engine-input.ts
  - packages/core/src/engine/canary.ts
  - packages/core/src/serialize/canonical-json.ts
  - packages/core/src/index.ts
  - eslint.config.ts
  - packages/core/tsconfig.json
  - packages/core/vitest.config.ts
  - tsconfig.base.json
  - vitest.shared.ts
  - package.json
  - packages/core/package.json
findings:
  critical: 1
  warning: 6
  info: 3
  total: 10
status: issues_found
---

# Phase 1: Code Review Report

**Reviewed:** 2026-06-23
**Depth:** standard
**Files Reviewed:** 20
**Status:** issues_found

## Summary

This is the foundations/determinism core for a financial-calculation engine where correctness is the product. The architecture is well-considered: a single configured `Dec` clone (banker's rounding, 34-digit precision), a closed branded `Money` API with string-only entry, a branded `CalendarDate`, a Zod versioned discriminated-union AssumptionSet at the trust boundary, a frozen `EngineInput`, and a canonical-JSON golden harness. Typecheck passes (`tsc -b`) and all 75 tests pass. Banker's rounding in `toCents()` was empirically verified correct (0.125 -> 12c, 0.135 -> 14c, 2.675 -> 268c).

However, the central claim — "a float can never re-enter the math" — has a real hole on the `Money` *input* path that is not validated the way the *serialization* path is. The determinism enforcement (the stated point of the phase) has several uncaught evasion vectors at both the lint and runtime-guard layers, and one of the load-bearing dependencies (`boundaries/external`) is deprecated and warns it will be removed. There is also a mislabeled "canonical" serializer that does not match the real canonical serializer's contract.

## Critical Issues

### CR-01: `Money.of` / `Money.mul` accept non-canonical, `Infinity`, and exponent-form strings — no input validation

**File:** `packages/core/src/money/money.ts:26-28, 46-48, 50-53`
**Issue:** `Money.of(decimalString)` and `mul(rate)` pass the string straight into `new Dec(...)` with no validation. `decimal.js` accepts `'Infinity'`, `'-Infinity'`, and exponent forms like `'1e3'`, and produces `NaN` from things like `0/0`. The `decStr` Zod validator (`schema.ts:22-24`) only guards the *serialization* boundary; the `Money` constructor path — the primary way dollars enter the engine throughout future phases — has no equivalent gate. This contradicts the module's own header claim that the API is "the whole point is enforcement."

Empirically confirmed:
- `Money.of('Infinity').toCents()` throws an opaque, unintended `RangeError: Cannot convert Infinity to a BigInt` rather than a meaningful "invalid money" error.
- `Money.of('Infinity').toDecimalString()` returns the literal string `"Infinity"`, and a `NaN` value returns `"NaN"` — either of which would be silently written into a canonical-JSON golden master / persisted snapshot, making "cent-identical reproducibility" a lie.
- `Money.of('1e3')` silently succeeds and is treated as 1000, even though `decStr` deliberately rejects exponent form everywhere else — an inconsistency in what "canonical decimal string" means depending on which door the value comes through.

**Fix:** Validate at the `Money` constructor boundary using the same canonical rule as `decStr`, and reject non-finite results:
```ts
const MONEY_STR = /^-?\d+(\.\d+)?$/;

static of(decimalString: string): Money {
  if (!MONEY_STR.test(decimalString)) {
    throw new Error(`Invalid Money string: ${JSON.stringify(decimalString)} (expected canonical decimal, e.g. "1234.56")`);
  }
  return new Money(new Dec(decimalString));
}

mul(rate: string): Money {
  if (!MONEY_STR.test(rate)) {
    throw new Error(`Invalid rate string: ${JSON.stringify(rate)}`);
  }
  return new Money(this.v.times(new Dec(rate)));
}
```
Consider sharing the regex with `schema.ts`'s `decStr` so "canonical decimal string" has one definition.

## Warnings

### WR-01: `serializeAssumptionSet` docstring claims "canonical JSON" but uses raw `JSON.stringify` (no key sort)

**File:** `packages/core/src/assumptions/assumption-set.ts:34-41`
**Issue:** The function comment says "emits canonical JSON" and the file header lists it as the sanctioned serialization boundary, but it calls `JSON.stringify(...)` directly. Raw `JSON.stringify` preserves key *insertion* order, so it is NOT order-independent — verified that `JSON.stringify({b:1,a:2}) !== JSON.stringify({a:2,b:1})`. The real canonical serializer (`serialize/canonical-json.ts`) sorts keys recursively; these two "canonical" serializers disagree. Today the AssumptionSet object literals happen to be authored in a stable order so output is stable, but the contract is mislabeled, and any future code that builds an AssumptionSet by spreading/merging (changing key order) would produce a different byte string for a semantically identical set — breaking hashing/snapshot comparison that relies on this "canonical" claim.
**Fix:** Either route through the real canonical serializer (`canonicalJson(AssumptionSetSchema.parse(set))`) so the two agree, or change the docstring to say "stable JSON serialization (relies on schema-fixed key order)" and stop calling it canonical. Prefer the former for safety.

### WR-02: Runtime determinism guard does not cover `new Date`, `performance.now`, or `crypto` — narrower than its stated goal

**File:** `packages/core/src/determinism/guard.ts:10-21`
**Issue:** The guard's header says it is the runtime safety net for "the hazards the lint rule guards," and the lint rule bans `Date.now`, `Math.random`, AND `new Date` (D-13). But the guard only overrides `Date.now` and `Math.random`. It does not neutralize `new Date()` (e.g. `new Date().getTime()`), `performance.now()`, or `crypto.getRandomValues()` — all of which read ambient/nondeterministic state. So core code that uses `new Date(...)` to read the clock would pass the runtime guard silently. The "belt to the lint suspenders" framing implies parity with the lint rules that does not exist.
**Fix:** Extend the guard to also poison the clock-reading paths it claims to cover, e.g.:
```ts
const OriginalDate = Date;
// preserve construction-from-args but ban zero-arg "now" reads:
globalThis.Date = new Proxy(OriginalDate, {
  construct(target, args) {
    if (args.length === 0) throw new Error('Nondeterminism in core: new Date() (clock read) is forbidden (D-13).');
    return Reflect.construct(target, args);
  },
}) as DateConstructor;
```
At minimum, update the guard's docstring to state precisely which hazards it covers vs. which are lint-only, so the gap is documented rather than implied-closed.

### WR-03: Lint determinism selectors are bypassable via member-access / global forms

**File:** `eslint.config.ts:64-89`
**Issue:** The `no-restricted-syntax` selectors match only `Date.now`/`Math.random` by `callee.object.name`. Verified that `globalThis.Date.now()`, `performance.now()`, and `crypto.getRandomValues(...)` produce ZERO lint errors in a core file. `process` is banned via `no-restricted-globals`, but `performance`, `crypto`, and `globalThis` are not in that list. Since this phase's headline deliverable is airtight determinism enforcement ("turns the constraint into a CI failure, not a hope"), these are concrete evasion paths that defeat the guarantee for an unaware future contributor.
**Fix:** Add `performance`, `crypto`, and `globalThis` to `no-restricted-globals`; add selectors for `MemberExpression[object.name='globalThis']` chains, or restrict `Date`/`Math`/`performance`/`crypto` as globals directly. Add a negative lint fixture for each new vector so `boundary.test.ts` proves they trip.

### WR-04: `boundaries/external` is deprecated and warns it will be removed — the primary CORE-01 guard is on a sunset path

**File:** `eslint.config.ts:41-44`
**Issue:** Running ESLint emits: `Rule "boundaries/external" is deprecated and will be removed in future versions. Please migrate to the "boundaries/dependencies" rule` plus a legacy-selector-syntax warning. The config comments call this rule "the real CORE-01 guard." When `eslint-plugin-boundaries` ships the removal (the dep is pinned `^6.0.2`, so a minor/patch bump could drop it), the core's deny-by-default external-import enforcement silently disappears and the boundary test only covers framework imports, not arbitrary externals. This is a latent failure that turns a CI guarantee back into "a hope."
**Fix:** Migrate to `boundaries/dependencies` with object-based selectors now, or pin `eslint-plugin-boundaries` to an exact version and add a test asserting an arbitrary disallowed external (e.g. `node:fs`) still fails lint, so a future removal breaks CI loudly instead of silently un-guarding the core.

### WR-05: Determinism enforcement is unverified for most hazards — only the framework-import path has a negative test

**File:** `packages/core/src/boundary.test.ts:34-42`
**Issue:** The phase's central promise is that determinism/boundary rules are enforced, not hoped. But the only executable proof (`boundary.test.ts`) lints a single fixture (`framework-import.fixture.ts`) and asserts a framework import fails. There is no negative fixture/test proving `Date.now`, `Math.random`, `new Date`, `process.env`, or a disallowed external (`node:fs`) actually trip lint. Combined with WR-03/WR-04, the determinism rules could silently degrade with no test catching it. (Tests are normally out of scope, but here the *absence* of enforcement tests is the quality defect for a phase whose deliverable is enforcement.)
**Fix:** Add negative fixtures for each banned construct and extend `boundary.test.ts` to assert each one produces a non-zero eslint exit attributable to the intended rule.

### WR-06: `canonicalJson` silently coerces `NaN`/`Infinity` numbers to `null` and does not reject raw JS numbers

**File:** `packages/core/src/serialize/canonical-json.ts:38-39, 47-48`
**Issue:** `normalize` lets primitives (including `number`) "pass through unchanged," then `JSON.stringify` converts `NaN`/`Infinity` to `null`. The whole premise (header comment) is "FLOAT-FREE: a float in the golden master would make cent-identical a lie." But a stray JS `number` in the value graph is silently serialized as a number (re-opening the float hole the design is meant to seal), and a `NaN`/`Infinity` becomes `null` with no error — masking a corrupt computation in the golden artifact instead of failing loudly.
**Fix:** Make the canonical serializer defensive about its own invariant:
```ts
if (typeof value === 'number') {
  throw new Error(`canonicalJson: bare number ${value} is forbidden (use Money / decimal string).`);
}
```
If bare numbers are legitimately needed for some fields (e.g. `periods`), allowlist only finite integers and reject non-finite values explicitly.

## Info

### IN-01: `noFallthroughCasesInSwitch` makes the documented "falls through" V2 pattern a future compile error

**File:** `packages/core/src/assumptions/migrate.ts:25`
**Issue:** The inline note suggests the V2 step-up will be written as `case 1: return v1ToV2(set); // falls through`. With `noFallthroughCasesInSwitch` enabled (`tsconfig.base.json:14`), a real fall-through (a `case` without a terminating statement) is a compile error — though since the example uses `return`, it would actually compile. The comment's "falls through" wording is misleading and could lead a future contributor to write an actual fall-through that fails to compile.
**Fix:** Reword the comment to describe the intended chaining explicitly (`case 1: set = v1ToV2(set); // then fall to case 2` requires removing the `return`), or show the concrete pattern that satisfies `noFallthroughCasesInSwitch`.

### IN-02: `migrate` re-parses already-validated input on the hot path

**File:** `packages/core/src/assumptions/migrate.ts:18-21`
**Issue:** `migrate` re-runs `parseAssumptionSet(input)` even though its `@param` doc states input is "an already-Zod-validated `AnyAssumptionSet`." This is defensible as defense-in-depth (and explicitly justified in the comment), but it double-validates on every call. Not a correctness bug; flagging the redundancy and the doc/behavior tension (doc says pre-validated, code distrusts it). Out of v1 perf scope; noting for clarity only.
**Fix:** Keep the re-validation (safety > speed here) but align the docstring to say it re-validates defensively rather than assuming pre-validated input.

### IN-03: `percentOf` is an exact alias of `mul` with no semantic difference

**File:** `packages/core/src/money/money.ts:50-53`
**Issue:** `percentOf(rate)` just calls `this.mul(rate)` with identical semantics — it does NOT divide by 100, so the name "percent" is misleading (a caller might pass `'3.5'` expecting 3.5% and get 350%). It adds API surface with no behavior of its own and an easy-to-misread name.
**Fix:** Either remove `percentOf` (callers use `mul` with a rate like `'0.035'`), or give it real percent semantics (`this.mul(...)` after dividing the rate by 100) and document the expected `'3.5'`-style input. Don't keep a same-behavior alias whose name implies different math.

---

_Reviewed: 2026-06-23_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
