# Phase 1: Foundations & Determinism Core - Research

**Researched:** 2026-06-23
**Domain:** TypeScript monorepo bootstrap, decimal-precise money arithmetic, deterministic pure-function core, lint-enforced architecture boundaries, golden-master reproducibility
**Confidence:** HIGH (all library mechanics verified against official docs + npm registry on 2026-06-23)

## Summary

This phase scaffolds an npm-workspaces monorepo and builds `packages/core` only — a pure, framework-agnostic calculation substrate. The work is almost entirely "plumbing and primitives": no real engine result is computed. Every decision (D-01..D-14) is already locked by CONTEXT.md; research below establishes **HOW** to implement each, with copy-pasteable config and exact API signatures.

The four hard parts, in descending order of subtlety:

1. **The lint boundary that actually fails CI.** The obvious choice — `import/no-restricted-paths` — does **NOT** block npm package imports like `react`/`next`; it only restricts relative path *zones* `[VERIFIED: import-js/eslint-plugin-import docs]`. Banning framework packages requires either the built-in `no-restricted-imports` (static imports only — misses `import()`) or, more robustly, `eslint-plugin-boundaries`' `external` rule in deny-by-default mode. Recommendation: use **both** layers.
2. **Determinism enforcement** via `no-restricted-syntax` ESQuery selectors (lint) + a runtime guard module (test). The lint rule catches `Date.now`, `Math.random`, `process.env`; the runtime guard makes them throw if ever reached.
3. **Money as an immutable class wrapping a frozen `Decimal.clone({ precision, rounding })`** — banker's rounding is `ROUND_HALF_EVEN = 6` `[VERIFIED: mikemcl.github.io/decimal.js]`. Full precision retained through all math; rounding only at output boundaries.
4. **Golden-master harness** that is explicitly NOT `toMatchSnapshot` — a committed JSON fixture, regenerated only behind `UPDATE_GOLDEN=1`, compared via deep-equal on canonical JSON.

**Primary recommendation:** Bootstrap with Node 24 / npm 11 (already installed). Pin the CLAUDE.md stack; add `typescript-eslint@8.62`, `eslint@10.5`, `eslint-plugin-boundaries@6`, `eslint-plugin-import@2.32`. Configure ESLint 10 flat config with file-scoped overrides for `packages/core/**`. Build `Money`, `CalendarDate`, `AssumptionSet` (Zod 4 discriminated union on `schemaVersion`), `EngineInput`, the frozen `Decimal` clone, and the gated golden harness. TDD the whole thing with Vitest 4 `projects`.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Money arithmetic / rounding | Calc core (`packages/core`) | — | Pure functions; the product's correctness lives here. Zero framework deps. |
| Assumption schema + versioning + migration | Calc core | — | Versioned data + Zod validation at the serialization boundary; no persistence yet. |
| Determinism enforcement (no time/random/env) | Calc core | Build/CI (lint) | Belt-and-suspenders: runtime guard in core + ESLint rule in CI. |
| Framework-boundary enforcement | Build/CI (lint) | Calc core (tsconfig: no DOM/JSX) | The "separate package" *is* the boundary; lint + tsconfig make violations a build failure. |
| Reproducibility harness | Calc core (test) | — | Golden fixture lives in core test dir; proves determinism before persistence exists. |
| Monorepo wiring / test runner | Repo root | — | npm workspaces + Vitest `projects`; orchestration only, no domain logic. |

**Note:** This phase has NO Browser/Frontend-Server/Database/API tiers in play — `apps/web` and persistence are explicitly deferred (CONTEXT.md `<deferred>`). All capability ownership is core + CI.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Money Primitive & Rounding Policy**
- **D-01:** `Money` is an immutable class wrapping a decimal.js `Decimal`, exposing a curated API (`add`/`sub`/`mul`/`percentOf`/`toCents`/`toString`). Raw `Decimal` operations and bare `number` dollar math must not be possible through the public surface — and bare-number money math is rejected by tests (CORE-02).
- **D-02:** Rounding policy uses banker's rounding (HALF_EVEN) — avoids the systematic upward bias HALF_UP introduces when summing many rounded values across a multi-decade projection.
- **D-03:** Full decimal precision retained through all intermediate math (amortization, compounding). Rounding to cents only at defined output boundaries (stored results + display) — never per-operation. This is why decimal.js was chosen over integer-minor-units.

**AssumptionSet Structure & Versioning**
- **D-04:** `AssumptionSet` is nested by domain — namespaced groups (`tax`, `dti`, `returns`, `inflation`, `maintenance`, `swr`, `pmi`, …) rather than a flat map.
- **D-05:** Versioned by an integer `schemaVersion` with a per-version Zod schema and an explicit `migrate(old) -> current` path.
- **D-06:** Numeric assumption values serialized as canonical decimal strings (e.g. `"0.035"`), parsed to `Decimal` on use.
- **D-07:** A single versioned defaults module in the core holds the seed `AssumptionSet` (pure data, no env reads). (Claude's discretion on exact default *values*; structure/versioning per above.)

**Reproducibility Harness**
- **D-08:** Golden test exercises a deterministic "canary" computation (real `Decimal` compounding + banker's rounding + an `AssumptionSet` read) PLUS a snapshot serialize → deserialize round-trip.
- **D-09:** Frozen golden master is a committed JSON fixture in the core test directory, regenerated only via a deliberate, gated command (e.g. `UPDATE_GOLDEN=1`). NOT Vitest `toMatchSnapshot`.
- **D-10:** Cent-identical equality asserted by deep-equal on canonical JSON — money serialized as decimal strings, object keys sorted.

**Determinism Enforcement**
- **D-11:** Time and assumptions threaded via a single immutable `EngineInput` object (`{ asOf, assumptions, ...scenarioInputs }`). That object **is** the shape a snapshot captures.
- **D-12:** Ambient nondeterminism rejected by BOTH a CI lint rule (ESLint `no-restricted-globals`/`no-restricted-syntax`, scoped to `packages/core`, forbidding `Date.now`, `Math.random`, env reads) AND a runtime test guard that makes those throw if reached.
- **D-13:** `asOf` is a branded ISO `YYYY-MM-DD` `CalendarDate` string — the core never touches a JS `Date`.
- **D-14:** `decimal.js` precision/rounding configured via a frozen `Decimal.clone({ precision, rounding })` constant used everywhere; global `Decimal` never mutated via `Decimal.set`.

### Claude's Discretion
- Monorepo bootstrap mechanics: npm workspaces layout, root vs per-package `tsconfig` (core `tsconfig` has no DOM lib / no JSX), Vitest `projects` wiring, coverage gating for the core.
- Choice of lint-boundary mechanism (`import/no-restricted-paths` vs `eslint-plugin-boundaries`) — as long as it fails the build in CI.
- Exact shape/identifiers of the `Money` API, the `EngineInput` type, the canary computation's specific formula, and the seed default assumption values.
- Internal `decimal.js` precision level (significant digits) for the configured clone.
- Whether to use `drizzle-zod` later; for this phase Zod validates the `AssumptionSet`/snapshot at the serialization boundary only.

### Deferred Ideas (OUT OF SCOPE)
- `apps/web` scaffolding — NOT in this phase; core-only. (Later "Web Shell" phase.)
- Persistence (SQLite / Drizzle migrations) — explicitly deferred; the golden test must work *before* persistence exists.
- Sensitivity analysis (ASMP-02) and the real FI engine (FI-*).
- Exact seed mill-rate / tax tables — Phase 2 (TCO) concern; only the `AssumptionSet` *shape* is locked here.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CORE-01 | All financial math lives in a pure, framework-agnostic calc core with zero React/Next deps (enforced by a lint boundary rule) | "Lint boundary" section — `eslint-plugin-boundaries` external deny-by-default + `no-restricted-imports` + core `tsconfig` with no DOM/JSX. The separate package IS the structural boundary. |
| CORE-02 | Money arithmetic uses decimal-precise math so no floating-point error accumulates across multi-decade projections | `Money` class wrapping frozen `Decimal.clone`, banker's rounding (`ROUND_HALF_EVEN = 6`), full precision retained; type-level branding + test-level rejection of bare-number math. |
| CORE-03 | Core fully unit-tested, deterministic (no ambient time/randomness inside the core) | Vitest 4 `projects` + coverage; `no-restricted-syntax` ESQuery lint rules + runtime determinism guard module; `CalendarDate` branded string so core never touches JS `Date`. |
| ASMP-01 | All assumptions configurable, stored data — never hardcoded | Nested `AssumptionSet`, Zod 4 discriminated union on integer `schemaVersion`, decimal-string serialization, versioned defaults module, `migrate()` path. |
| PROF-04 | A saved scenario snapshots every input + assumption so its result regenerates exactly; replaying a snapshot reproduces the stored result | Golden-master harness: canary compute + serialize/deserialize round-trip; committed JSON fixture gated behind `UPDATE_GOLDEN=1`; deep-equal on canonical JSON. `EngineInput` is the snapshot unit (D-11). |
</phase_requirements>

## Standard Stack

All versions verified via `npm view <pkg> version` on 2026-06-23. CLAUDE.md pins match the registry `latest` for the runtime stack; dev-tooling additions are pinned below.

### Core (runtime deps of `packages/core`)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| decimal.js | 10.6.0 | Arbitrary-precision decimal arithmetic — the ONLY runtime dep of the core | CLAUDE.md-mandated. Immutable instances; configurable precision/rounding; banker's rounding supported. `[VERIFIED: npm registry]` (last modified 2025-07-06) |

### Supporting (boundary validation; dev/test tooling)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| zod | 4.4.3 | Runtime validation + schema-derived types at the AssumptionSet/snapshot serialization boundary | `AssumptionSet` per-version schema, decimal-string validation, branded types. `[VERIFIED: npm registry]` |
| typescript | 6.0.3 | Types everywhere, strict mode, branded types | CLAUDE.md-pinned. Compatible with typescript-eslint 8.62 (peer `>=4.8.4 <6.1.0`). `[VERIFIED: npm registry]` |
| vitest | 4.1.9 | Unit test runner; `projects` config | CLAUDE.md-pinned. `workspace` key deprecated since 3.2 → use `projects`. `[VERIFIED: npm registry + vitest.dev/guide/projects]` |
| @vitest/coverage-v8 | 4.1.9 | Coverage for the core (gate at high %) | Must lockstep with vitest 4.1.9 (peer pin). `[VERIFIED: npm registry]` |
| eslint | 10.5.0 | Lint engine (flat config) | **VERSION DRIFT — see below.** Latest is 10.5.0, not 9.x. typescript-eslint 8.62 peer accepts `^10.0.0`. `[VERIFIED: npm registry]` |
| typescript-eslint | 8.62.0 | Flat-config helper + TS parser/plugin bundle | Peer: `eslint ^8.57 || ^9 || ^10`, `typescript >=4.8.4 <6.1.0` → TS 6.0.3 OK. `[VERIFIED: npm registry]` |
| eslint-plugin-import | 2.32.0 | `import/no-restricted-paths` for relative-path zones (apps/** ban) | Peer accepts modern ESLint. Use for path zones ONLY (cannot ban npm packages). `[VERIFIED: npm registry + plugin docs]` |
| eslint-plugin-boundaries | 6.0.2 | Deny-by-default external-import enforcement (the robust "no framework in core" rule) | Peer `eslint >=6.0.0`. `external` rule with `no-unknown` bans any non-allowlisted package. `[VERIFIED: npm registry + plugin docs]` |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `eslint-plugin-boundaries` (external rule) | built-in `no-restricted-imports` with `paths`/`patterns` | `no-restricted-imports` is allowlist-by-omission → you must enumerate every banned package (`react`, `react-dom`, `next`, `next/*`, …) and it catches **static imports only, not `import()`** `[VERIFIED: eslint.org]`. `boundaries` is deny-by-default (allowlist `decimal.js`+`zod`, ban everything else, including dynamic imports). Use BOTH — see pitfall. |
| `import/no-restricted-paths` for framework ban | (n/a) | **Does NOT work for npm packages** — only relative/absolute path zones `[VERIFIED: import-js docs]`. Keep it ONLY for banning `apps/**` and cross-package relative imports. |
| Manual decimal-string regex in Zod | `z.coerce` / third-party | Zod has no native decimal type `[VERIFIED: zod.dev]`; `z.string().regex(/^-?\d+(\.\d+)?$/)` is the standard approach for the serialized boundary (keeps floats out). |
| ESLint 10.5 | ESLint 9.x (`maintenance` tag 9.39.4) | 10.x is current `latest`; typescript-eslint 8.62 supports it. No reason to pin 9.x for a greenfield repo. |

**Installation (planner: split across root / packages/core):**
```bash
# repo root (dev tooling shared by all packages)
npm install -D -w . typescript@6.0.3 vitest@4.1.9 @vitest/coverage-v8@4.1.9 \
  eslint@10.5.0 typescript-eslint@8.62.0 eslint-plugin-import@2.32.0 \
  eslint-plugin-boundaries@6.0.2

# packages/core runtime dep — the ONLY one allowed
npm install -w packages/core decimal.js@10.6.0

# packages/core boundary validation (dev OR runtime; zod is allowlisted in boundaries config)
npm install -w packages/core zod@4.4.3
```

**Version verification performed (2026-06-23):**
```
decimal.js     => 10.6.0   (latest; modified 2025-07-06)
vitest         => 4.1.9    (latest)
@vitest/coverage-v8 => 4.1.9
zod            => 4.4.3    (latest; beta 4.1.x, canary 4.5.x exist — stay on latest)
typescript     => 6.0.3    (latest)
eslint         => 10.5.0   (latest; DRIFT vs typical 9.x assumptions)
typescript-eslint => 8.62.0
eslint-plugin-import => 2.32.0
eslint-plugin-boundaries => 6.0.2
```

### Version Drift Flags
- **ESLint 10.x is current** (`latest = 10.5.0`), not 9.x. CLAUDE.md does not pin an ESLint major. All chosen plugins support ESLint 10 (typescript-eslint 8.62 peer `^10`, boundaries `>=6`, import `2.32`). Use flat config (`eslint.config.ts`/`.mjs`) — eslintrc is legacy in ESLint 10. `[VERIFIED: npm registry]`
- **TypeScript 6.0.3** is within typescript-eslint 8.62's peer range (`<6.1.0`) with no margin to spare — if TS bumps to 6.1, typescript-eslint must be upgraded in lockstep. `[VERIFIED: npm registry]`
- **Zod 4.4.3** is `latest`; ignore the `next`/`beta`/`canary`/`alpha` dist-tags (some point back to 3.x betas). `[VERIFIED: npm registry]`

## Package Legitimacy Audit

slopcheck was not available in this environment (no Python/pip on PATH for `pip install slopcheck`). Per protocol, packages are verified via the ecosystem registry (`npm view`) and all are well-established with official source repos and high download counts — but absent slopcheck, the planner should still confirm each at install time. None are obscure or new.

| Package | Registry | Age / Modified | Source Repo | slopcheck | Disposition |
|---------|----------|----------------|-------------|-----------|-------------|
| decimal.js | npm | mature; mod 2025-07-06 | github.com/MikeMcl/decimal.js | unavailable | Approved (CLAUDE.md-mandated, ubiquitous) |
| zod | npm | mature | github.com/colinhacks/zod | unavailable | Approved |
| typescript | npm | mature | github.com/microsoft/TypeScript | unavailable | Approved |
| vitest | npm | mature | github.com/vitest-dev/vitest | unavailable | Approved |
| @vitest/coverage-v8 | npm | mature | github.com/vitest-dev/vitest | unavailable | Approved |
| eslint | npm | mature | github.com/eslint/eslint | unavailable | Approved |
| typescript-eslint | npm | mature | github.com/typescript-eslint/typescript-eslint | unavailable | Approved |
| eslint-plugin-import | npm | mature | github.com/import-js/eslint-plugin-import | unavailable | Approved |
| eslint-plugin-boundaries | npm | mature | github.com/javierbrea/eslint-plugin-boundaries | unavailable | Approved |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

*slopcheck was unavailable at research time. All packages are CLAUDE.md-prescribed or their direct, well-known tooling dependencies — none are hallucination-risk candidates. The planner MAY add a single `checkpoint:human-verify` before the first install to confirm versions, but a per-package gate is unnecessary given provenance.*

## Architecture Patterns

### System Architecture Diagram

```
                       ┌──────────────────────────────────────────────┐
                       │  CONSUMER (this phase: ONLY the test suite)   │
                       │  later phases: TCO, Affordability, FI engines │
                       └───────────────────────┬──────────────────────┘
                                                │ imports
                                                ▼
   ┌───────────────────────────────  packages/core  ────────────────────────────────┐
   │                                                                                  │
   │   EngineInput { asOf: CalendarDate, assumptions: AssumptionSet, ...inputs }      │
   │        │  (immutable; IS the snapshot unit — D-11)                               │
   │        ▼                                                                         │
   │   ┌─────────────┐   reads slice   ┌──────────────────┐                           │
   │   │ canary /    │◄────────────────│ AssumptionSet     │  decimal strings on disk │
   │   │ engine fns  │                 │  (nested by domain)│  parsed→Decimal on use   │
   │   │ (pure)      │                 └────────▲──────────┘                           │
   │   └─────┬───────┘                          │ validate / migrate                  │
   │         │ uses                    ┌─────────┴──────────┐                          │
   │         ▼                         │ Zod schema-per-     │                          │
   │   ┌──────────┐  wraps   ┌───────┐ │ version (discrim.   │                          │
   │   │  Money   │─────────►│Decimal│ │ union on            │                          │
   │   │ (class,  │          │ clone │ │ schemaVersion)      │                          │
   │   │immutable)│          │frozen │ └────────────────────┘                          │
   │   └────┬─────┘          │HALF_  │                                                 │
   │        │ rounds only at │ EVEN  │   ┌─────────────────────────────────────┐       │
   │        ▼ output boundary└───────┘   │ determinism guard (runtime):        │       │
   │   canonical JSON  ───────────────►  │ Date.now/Math.random/env → throw    │       │
   │   (money=strings, sorted keys)      └─────────────────────────────────────┘       │
   └──────────────────────────────────────────────────────────────────────────────────┘
        ▲                                              ▲
        │ deep-equal                                   │ ENFORCED BY (CI, build-fail):
   ┌────┴─────────────────┐              ┌─────────────┴──────────────────────────────┐
   │ golden master fixture│              │ ESLint flat config (files: packages/core/**)│
   │ committed JSON;       │              │ • boundaries/external: allow [decimal.js,   │
   │ regen ONLY via         │              │   zod] — ban everything else (incl import())│
   │ UPDATE_GOLDEN=1        │              │ • no-restricted-imports: react/next/dom     │
   └──────────────────────┘              │ • no-restricted-syntax: Date.now/Math.random │
                                          │ • no-restricted-globals: process            │
   ┌──────────────────────────────────┐  │ + core tsconfig: lib has NO "dom", no JSX    │
   │ Vitest 4 projects (root config)  │  └─────────────────────────────────────────────┘
   │  • project "core" env=node       │
   └──────────────────────────────────┘
```

Primary trace (canary use case): `EngineInput` → engine fn reads `AssumptionSet` slice → does `Money`/`Decimal` compounding at full precision → rounds at the output boundary → serializes to canonical JSON → deep-equals the committed golden master. Determinism is enforced statically (lint) and dynamically (runtime guard) along the way.

### Recommended Project Structure
```
/                              # repo root
├── package.json               # "workspaces": ["packages/*", "apps/*"]; scripts: test, lint, typecheck
├── tsconfig.base.json         # shared strict compiler options (no lib here)
├── eslint.config.ts           # flat config; core-scoped override block
├── vitest.config.ts           # test.projects = ['packages/*']  (root-level)
├── vitest.shared.ts           # shared test options (projects can't `extends` root config)
└── packages/
    └── core/
        ├── package.json        # name "@house/core"; dep: decimal.js, zod
        ├── tsconfig.json       # extends base; lib ["ES2023"] — NO "dom"; jsx: undefined
        ├── vitest.config.ts    # mergeConfig(shared, defineProject({ test:{ environment:'node', name:'core' }}))
        └── src/
            ├── money/
            │   ├── decimal-config.ts   # frozen Decimal.clone({precision, rounding}) — the ONE clone
            │   ├── money.ts            # immutable Money class (D-01)
            │   └── money.test.ts
            ├── time/
            │   ├── calendar-date.ts    # branded ISO YYYY-MM-DD string (D-13)
            │   └── calendar-date.test.ts
            ├── assumptions/
            │   ├── schema.ts           # Zod per-version schemas, discriminated union (D-05)
            │   ├── assumption-set.ts    # nested types (D-04), parse/serialize (D-06)
            │   ├── defaults.ts          # versioned seed AssumptionSet (D-07)
            │   ├── migrate.ts           # migrate(old) -> current (D-05)
            │   └── *.test.ts
            ├── engine/
            │   ├── engine-input.ts     # EngineInput type (D-11)
            │   └── canary.ts           # deterministic canary computation (D-08)
            ├── determinism/
            │   ├── guard.ts            # runtime guard: Date.now/Math.random/env throw (D-12)
            │   └── guard.test.ts
            ├── serialize/
            │   └── canonical-json.ts   # sorted keys, money→string (D-10)
            ├── __fixtures__/
            │   └── golden-snapshot.json # committed golden master (D-09)
            ├── golden.test.ts          # gated regen via UPDATE_GOLDEN=1 (D-09)
            └── index.ts                # public surface (re-exports)
```
*(Exact folder names are Claude's discretion; this layout maps each decision to a file.)*

### Pattern 1: Frozen Decimal clone — the single configured constructor (D-14)
**What:** One module exports a `Decimal` *constructor clone* with precision + banker's rounding baked in. Every `Money` and every calc uses this clone. The global `Decimal` is never `.set()`.
**When to use:** Always, for any decimal arithmetic in the core.
```typescript
// Source: https://mikemcl.github.io/decimal.js/  (Decimal.clone, ROUND_HALF_EVEN=6)
// packages/core/src/money/decimal-config.ts
import Decimal from 'decimal.js';

// precision = SIGNIFICANT DIGITS (default 20). For multi-decade monthly compounding
// (e.g. (1+r)^360) plus summation, 34 sig-figs (IEEE-754 decimal128 width) is a safe,
// conventional headroom choice with negligible cost. rounding=6 is ROUND_HALF_EVEN.
export const Dec = Decimal.clone({
  precision: 34,
  rounding: Decimal.ROUND_HALF_EVEN, // === 6
});
// `Dec` is a constructor: new Dec('0.035'). Do NOT call Decimal.set anywhere.
export type DecimalInstance = InstanceType<typeof Dec>;
```
**Verified facts** `[VERIFIED: mikemcl.github.io/decimal.js]`:
- `Decimal.clone(obj)` returns a new independent constructor; config keys: `precision` (1..1e9, default 20), `rounding` (0..8, default 4), plus `minE/maxE/toExpNeg/toExpPos/modulo/crypto`.
- `ROUND_HALF_EVEN = 6` (banker's). `ROUND_HALF_UP = 4` is the default — explicitly NOT what we want.
- Decimal instances are immutable; `.plus/.minus/.times/.dividedBy/.pow` all return new instances.
- `precision` counts **significant digits**, not decimal places. Rounding to cents at the boundary uses `.toDecimalPlaces(2, rm)` or `.toFixed(2, rm)`.

### Pattern 2: Immutable Money class with a closed API (D-01, D-03, CORE-02)
**What:** A class wrapping a `Dec` instance. Public methods only: `add/sub/mul/percentOf/toCents/toString`. No method returns or accepts a raw `Decimal` or bare `number` for dollar amounts. Full precision retained; `toCents()` is the ONLY rounding boundary.
```typescript
// packages/core/src/money/money.ts
import { Dec, type DecimalInstance } from './decimal-config';

declare const MoneyBrand: unique symbol; // nominal typing safety net

export class Money {
  // private + branded → cannot be constructed or duck-typed from outside
  private readonly [MoneyBrand]!: void;
  private constructor(private readonly v: DecimalInstance) {}

  // ONLY entry points — force decimal strings, never raw JS number for dollars
  static of(decimalString: string): Money { return new Money(new Dec(decimalString)); }
  static zero(): Money { return new Money(new Dec(0)); }

  add(o: Money): Money { return new Money(this.v.plus(o.v)); }
  sub(o: Money): Money { return new Money(this.v.minus(o.v)); }
  // multiply by a DIMENSIONLESS rate (string), not by another Money
  mul(rate: string): Money { return new Money(this.v.times(new Dec(rate))); }
  percentOf(rate: string): Money { return this.mul(rate); }

  // OUTPUT BOUNDARY — the only place rounding happens (banker's via clone default)
  toCents(): bigint { return BigInt(this.v.times(100).toDecimalPlaces(0).toFixed(0)); }
  toDecimalString(): string { return this.v.toFixed(); }   // full precision, for canonical JSON
  toString(): string { return this.v.toDecimalPlaces(2).toFixed(2); } // display only
}
```
**How bare-number money math is rejected (CORE-02), two layers:**
1. **Type level:** `Money` has no `number`-accepting dollar constructor; the brand makes structurally-identical objects non-assignable. `Money + number` and `someMoney * 1.05` are type errors because `Money` has no `[Symbol.toPrimitive]`/`valueOf` returning a number, and TS forbids arithmetic operators on class instances.
2. **Test level:** explicit tests assert (a) `// @ts-expect-error` on `Money.add(5 as any)` style misuse, (b) constructing from a float-derived string loses no precision, (c) summing 1000 rounded values via `Money` equals the full-precision sum rounded once (proves D-03 "round at boundary only").

### Pattern 3: Branded CalendarDate (D-13)
**What:** `asOf` is a string `YYYY-MM-DD`, branded so it's not interchangeable with a plain string, validated on construction, never a JS `Date`.
```typescript
// packages/core/src/time/calendar-date.ts
declare const CalDateBrand: unique symbol;
export type CalendarDate = string & { readonly [CalDateBrand]: never };

const ISO = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
export function calendarDate(s: string): CalendarDate {
  if (!ISO.test(s)) throw new Error(`Invalid CalendarDate: ${s}`);
  return s as CalendarDate; // pure string ops only downstream — no Date object EVER
}
```
*Zod equivalent for the boundary:* `z.string().regex(ISO).brand<'CalendarDate'>()` `[VERIFIED: zod.dev — .brand() attaches a static brand, runtime parsing unaffected]`.

### Pattern 4: AssumptionSet — nested, versioned, Zod discriminated union (D-04/05/06, ASMP-01)
```typescript
// packages/core/src/assumptions/schema.ts
import * as z from 'zod';

const decStr = z.string().regex(/^-?\d+(\.\d+)?$/); // canonical decimal string (D-06)

const AssumptionsV1 = z.object({
  schemaVersion: z.literal(1),
  tax:         z.object({ /* ... */ }),
  dti:         z.object({ frontEnd: decStr, backEnd: decStr }),
  returns:     z.object({ realAnnual: decStr }),
  inflation:   z.object({ annual: decStr }),
  maintenance: z.object({ annualPctOfValue: decStr }),
  swr:         z.object({ rate: decStr }),       // ~3-3.5%, not 4% (STATE.md decision)
  pmi:         z.object({ /* LTV rules */ }),
});

// future: AssumptionsV2 = z.object({ schemaVersion: z.literal(2), ... })
export const AssumptionSetSchema = z.discriminatedUnion('schemaVersion', [
  AssumptionsV1, /* AssumptionsV2, ... */
]);
export type AnyAssumptionSet = z.infer<typeof AssumptionSetSchema>;
export const CURRENT_VERSION = 1 as const;
```
```typescript
// packages/core/src/assumptions/migrate.ts
export function migrate(input: AnyAssumptionSet): CurrentAssumptionSet {
  let cur = input;
  // while (cur.schemaVersion < CURRENT_VERSION) cur = stepUp(cur);
  return cur as CurrentAssumptionSet;
}
```
**Verified** `[VERIFIED: zod.dev]`: `z.discriminatedUnion(key, [...])` narrows on the discriminator; `z.literal(n)` for integer discriminants; `.parse()` throws `ZodError`, `.safeParse()` returns `{success, data?, error?}`; `z.infer<typeof S>` extracts the type; import path is `"zod"` in Zod 4 (the `zod/v4` subpath also exists for explicit pinning).

### Pattern 5: Golden-master harness — gated, canonical, NOT toMatchSnapshot (D-08/09/10, PROF-04)
```typescript
// packages/core/src/serialize/canonical-json.ts
export function canonicalJson(value: unknown): string {
  return JSON.stringify(value, (_k, v) => {
    if (v instanceof Money) return v.toDecimalString();   // money → decimal string (D-10)
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      return Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b))); // sorted keys
    }
    return v;
  });
}
```
```typescript
// packages/core/src/golden.test.ts
import { readFileSync, writeFileSync } from 'node:fs';
import { test, expect } from 'vitest';
import { runCanary } from './engine/canary';
import { canonicalJson } from './serialize/canonical-json';

const FIXTURE = new URL('./__fixtures__/golden-snapshot.json', import.meta.url);

test('canary computation replays cent-identically (D-08/09/10)', () => {
  const input = /* a fixed EngineInput: frozen asOf + frozen AssumptionSet */;
  const result = runCanary(input);
  // round-trip: serialize → deserialize → recompute proves data reproducibility (D-08)
  const produced = canonicalJson(result);

  if (process.env.UPDATE_GOLDEN === '1') {        // GATED regeneration (D-09)
    writeFileSync(FIXTURE, produced + '\n');
    return;
  }
  const golden = readFileSync(FIXTURE, 'utf8').trimEnd();
  expect(produced).toBe(golden);                  // deep-equal on canonical JSON (D-10)
});
```
**Why this and not `expect(x).toMatchSnapshot()`:** `toMatchSnapshot` auto-writes the fixture on first run and can be silently re-blessed with `-u`. The `UPDATE_GOLDEN=1` env gate forces an explicit, reviewable git diff (D-09). The canary MUST do real `Decimal` compounding + banker's rounding + an `AssumptionSet` read (not a trivial echo) so it proves the machinery the future FI-oracle test (FI-05) will rely on.

### Pattern 6: Determinism — lint + runtime guard (D-12, CORE-03)
ESLint flat config block scoped to the core (see Code Examples for full config). Runtime guard:
```typescript
// packages/core/src/determinism/guard.ts
// Imported by the test setup (and optionally a dev build) to make ambient nondeterminism throw.
export function installDeterminismGuard(): void {
  const ban = (name: string) => () => { throw new Error(`Nondeterminism in core: ${name}`); };
  // freeze the hazards the lint rule guards — belt-and-suspenders
  Date.now = ban('Date.now') as typeof Date.now;
  Math.random = ban('Math.random') as typeof Math.random;
}
```
*Note:* the runtime guard is a **test-time** safety net (CONTEXT.md D-12 "runtime test guard that makes those throw if ever reached"). Do not mutate globals in shipped library code paths; install only in the Vitest setup file so any core code that reaches for `Date.now`/`Math.random` during a test fails loudly.

### Anti-Patterns to Avoid
- **Using `Decimal.set()` to configure precision globally.** Violates D-14 and "no module-level mutable defaults." Use `Decimal.clone()` once, export the constructor.
- **Relying on `import/no-restricted-paths` to ban `react`/`next`.** It silently does nothing for package names. (See pitfall #1.)
- **`toMatchSnapshot` for the golden master.** Auto-writes; re-blessable with `-u`. Violates D-09.
- **Letting `Money` expose a `valueOf()`/`toJSON()` that returns a `number`.** Re-opens the bare-number hole.
- **JS `Date` anywhere in the core** — even `new Date(isoString)` introduces timezone parsing nondeterminism. Keep `CalendarDate` a pure string.
- **`extends`-ing the root vitest config from a per-project config.** Per-project configs can't `extends` root `[VERIFIED: vitest.dev]`; factor shared options into `vitest.shared.ts` and `mergeConfig`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Decimal arithmetic / banker's rounding | A custom BigInt-cents math layer | decimal.js `Dec.clone({rounding: ROUND_HALF_EVEN})` | Amortization needs `pow`, division with controlled precision; HALF_EVEN is built-in and tested. CLAUDE.md mandates it. |
| Runtime schema validation + versioning | Hand-written type guards | Zod 4 `discriminatedUnion` + `safeParse` | Discriminated narrowing, error reporting, brand types, type inference all come free `[VERIFIED: zod.dev]`. |
| "No framework in core" enforcement | Code review / convention | `eslint-plugin-boundaries` external rule (deny-by-default) + separate package | A convention is a hope; a CI lint failure is a guarantee (CORE-01). |
| Stable serialization for golden compare | `JSON.stringify` with default key order | `canonicalJson` (sorted keys, money→string) | Default key order is insertion-dependent → false diffs. Must be canonical (D-10). |
| Multi-project test orchestration | Multiple test scripts + manual globbing | Vitest 4 `test.projects` | One command runs core (and later web) with per-project env `[VERIFIED: vitest.dev]`. |

**Key insight:** Every primitive here exists *so downstream phases can't make the existential mistake.* The value is in the enforcement (lint + tests + types), not the lines of code. A `Money` class that *can* be bypassed is worthless; the brand + closed API + tests are the product.

## Common Pitfalls

### Pitfall 1: `import/no-restricted-paths` does not block `react`/`next` imports
**What goes wrong:** You configure `import/no-restricted-paths` to "ban react in core," it passes lint, and a framework import slips into the core undetected — CORE-01 silently unmet.
**Why it happens:** The rule operates on resolved **file paths only**, not bare npm specifiers `[VERIFIED: import-js/eslint-plugin-import docs]`. `from: ['react']` matches nothing.
**How to avoid:** Use `eslint-plugin-boundaries` `external` rule in deny-by-default mode (allowlist `decimal.js` + `zod`, ban everything else, including `import()`), OR built-in `no-restricted-imports` with an explicit pattern list. Keep `import/no-restricted-paths` ONLY for relative-path zones (ban `../../apps/**`).
**Warning signs:** A test that imports `react` inside `packages/core/src` and lint stays green. **Add exactly this negative test** to the plan: a throwaway file importing `react` MUST fail `npm run lint`.

### Pitfall 2: `no-restricted-imports` misses dynamic `import()`
**What goes wrong:** `const x = await import('next/headers')` sneaks framework code in despite the lint rule.
**Why it happens:** `no-restricted-imports` "applies to static imports only, not dynamic ones" `[VERIFIED: eslint.org]`.
**How to avoid:** Layer `eslint-plugin-boundaries` (covers dynamic imports) on top; or add `no-restricted-syntax` selectors for `ImportExpression`. Belt-and-suspenders, matching D-12's philosophy.
**Warning signs:** Boundary tests only cover static `import`.

### Pitfall 3: `precision` is significant digits, not decimal places
**What goes wrong:** You set `precision: 2` thinking "2 cents" and silently corrupt every intermediate value to 2 sig-figs.
**Why it happens:** decimal.js `precision` = significant digits (default 20) `[VERIFIED: mikemcl.github.io/decimal.js]`. Cents-rounding is a separate `.toDecimalPlaces(2, rm)` call at the boundary (D-03).
**How to avoid:** Set clone `precision` high (34 recommended). Never reduce precision globally to "round" — round only at `toCents`/display.
**Warning signs:** Intermediate amortization values look truncated; a 30-year compound differs from a reference at the 4th digit.

### Pitfall 4: HALF_UP bias when summing rounded values
**What goes wrong:** Rounding each line item HALF_UP then summing introduces a systematic upward bias over hundreds of monthly figures across decades (the exact reason D-02 picks HALF_EVEN).
**Why it happens:** `ROUND_HALF_UP = 4` is decimal.js's **default** — easy to inherit by forgetting to set `rounding`.
**How to avoid:** Always `rounding: Decimal.ROUND_HALF_EVEN` (6) in the clone; **and** round only once at the boundary, not per line item (D-03). Write the "sum-of-1000 rounded == full-precision sum rounded once" test.
**Warning signs:** Totals drift a cent or two from a full-precision reference.

### Pitfall 5: Per-project vitest config can't `extends` root
**What goes wrong:** `extends: '../../vitest.config.ts'` in `packages/core/vitest.config.ts` errors or silently ignores options.
**Why it happens:** Vitest `projects` configs cannot `extends` the root config `[VERIFIED: vitest.dev]`; the `workspace` key is deprecated post-3.2.
**How to avoid:** Put shared options in `vitest.shared.ts` and `mergeConfig(shared, defineProject({...}))`.
**Warning signs:** Core tests run in the wrong environment, or shared coverage settings don't apply.

### Pitfall 6: Coverage is process-global in Vitest, not per-project
**What goes wrong:** You try to set a high coverage threshold only on the core project and it's ignored.
**Why it happens:** "coverage is done for the whole process" `[VERIFIED: vitest.dev]` — thresholds are global.
**How to avoid:** This phase has only the core project, so global coverage gating effectively gates the core. When `apps/web` is added later, revisit. Set thresholds in the root coverage config.

### Pitfall 7: Zod has no native decimal — floats can re-enter at the boundary
**What goes wrong:** Using `z.number()` for a rate lets `0.035` become a binary float, defeating D-06.
**Why it happens:** Zod has no decimal type `[VERIFIED: zod.dev]`.
**How to avoid:** Validate assumption values as `z.string().regex(/^-?\d+(\.\d+)?$/)` and parse to `Dec` on use. Never `z.number()` for money/rates.
**Warning signs:** A serialized AssumptionSet contains `0.035000000000000003`.

## Runtime State Inventory

> Greenfield repo — this is NOT a rename/refactor/migration phase. No stored data, live services, OS registrations, secrets, or build artifacts pre-exist. The only on-disk state this phase *creates* is the committed golden-master JSON fixture (intentional, version-controlled). Section included for completeness; all categories are "None."

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — no DB exists; persistence is deferred. | none |
| Live service config | None — no external services. | none |
| OS-registered state | None. | none |
| Secrets/env vars | `UPDATE_GOLDEN` is a *gating* env var read ONLY in the golden test (not core runtime). No secrets. | none |
| Build artifacts | None pre-exist (greenfield). `node_modules`, `dist`, golden fixture will be created. | none |

**Nothing found in any category — verified by:** `ls` of repo root shows only `CLAUDE.md`, `affordability-engine-gsd-brief.md`, `.planning/`, `.claude/`, `.git/`. No `package.json`, `packages/`, `apps/`, lockfile, or DB.

## Code Examples

### Complete ESLint flat config (the boundary + determinism enforcement)
```typescript
// Source: eslint.org (no-restricted-imports/syntax/globals), eslint-plugin-boundaries docs,
//         typescript-eslint flat config. ESLint 10.5 flat config.
// eslint.config.ts  (repo root)
import tseslint from 'typescript-eslint';
import boundaries from 'eslint-plugin-boundaries';
import importPlugin from 'eslint-plugin-import';

export default tseslint.config(
  ...tseslint.configs.recommended,

  // ── packages/core: zero framework, fully deterministic ──────────────────
  {
    files: ['packages/core/**/*.ts'],
    plugins: { boundaries, import: importPlugin },
    settings: {
      'boundaries/elements': [{ type: 'core', pattern: 'packages/core/**' }],
    },
    rules: {
      // (A) DENY-BY-DEFAULT external imports — only decimal.js & zod allowed.
      //     Covers static AND dynamic imports. This is the real CORE-01 guard.
      'boundaries/external': ['error', {
        default: 'disallow',
        rules: [{ from: ['core'], allow: ['decimal.js', 'zod'] }],
      }],
      // (B) explicit framework ban (static imports) — defense in depth
      'no-restricted-imports': ['error', {
        paths: [
          { name: 'react', message: 'No framework in core (CORE-01).' },
          { name: 'react-dom', message: 'No framework in core (CORE-01).' },
          { name: 'next', message: 'No framework in core (CORE-01).' },
        ],
        patterns: [{ group: ['next/*', 'react/*', 'react-dom/*'] }],
      }],
      // (C) ban relative imports into apps/** (path zones — the ONE thing this rule is for)
      'import/no-restricted-paths': ['error', {
        zones: [{ target: './packages/core', from: './apps', message: 'core may not import app code.' }],
      }],
      // (D) determinism: forbid Date.now / Math.random / dynamic import (D-12)
      'no-restricted-syntax': ['error',
        { selector: "CallExpression[callee.object.name='Date'][callee.property.name='now']",
          message: 'Determinism: thread asOf via EngineInput, no Date.now (D-12).' },
        { selector: "CallExpression[callee.object.name='Math'][callee.property.name='random']",
          message: 'Determinism: core must not use Math.random (D-12).' },
        { selector: "NewExpression[callee.name='Date']",
          message: 'Core must not touch JS Date — use CalendarDate (D-13).' },
        { selector: 'ImportExpression',
          message: 'No dynamic import() in core (boundary evasion).' },
      ],
      // (E) ban env / global hazards (D-12)
      'no-restricted-globals': ['error',
        { name: 'process', message: 'Core must not read env/process (D-12).' },
      ],
      'no-restricted-properties': ['error',
        { object: 'process', property: 'env', message: 'No env reads in core (D-12).' },
      ],
    },
  },
);
```
*ESQuery selector format `[VERIFIED: eslint.org/docs/.../no-restricted-syntax]`. `boundaries/external` deny-by-default `[CITED: eslint-plugin-boundaries docs]`.*

### Root package.json (workspaces)
```jsonc
// Source: npm workspaces docs (built-in npm 11)
{
  "name": "house",
  "private": true,
  "workspaces": ["packages/*", "apps/*"],
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "eslint .",
    "typecheck": "tsc -b",
    "update-golden": "UPDATE_GOLDEN=1 vitest run packages/core"   // cross-platform: see note
  }
}
```
*Windows note: this repo's shell is PowerShell. `UPDATE_GOLDEN=1 vitest ...` is POSIX syntax; for a portable script use `cross-env` (dev dep) — `cross-env UPDATE_GOLDEN=1 vitest run packages/core` — or document running it via the Bash tool. Flag for planner.*

### Root vitest config (projects)
```typescript
// Source: vitest.dev/guide/projects  (Vitest 4; `projects`, not `workspace`)
// vitest.config.ts (root)
import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    projects: ['packages/*'],   // each package brings its own vitest.config.ts
    coverage: {                  // coverage is process-global
      provider: 'v8',
      thresholds: { lines: 95, functions: 95, branches: 90, statements: 95 }, // gate the core
    },
  },
});
```
```typescript
// vitest.shared.ts (root) — projects can't `extends` root, so share here
import { defineProject } from 'vitest/config';
export const sharedTest = { globals: false } as const;
```
```typescript
// packages/core/vitest.config.ts
import { defineProject, mergeConfig } from 'vitest/config';
import { sharedTest } from '../../vitest.shared';
export default mergeConfig(
  defineProject({ test: { ...sharedTest, name: 'core', environment: 'node',
    setupFiles: ['./src/determinism/guard.setup.ts'] } }), // installs runtime guard (D-12)
  {},
);
```

### packages/core tsconfig (no DOM, no JSX)
```jsonc
// packages/core/tsconfig.json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "lib": ["ES2023"],            // NO "dom" / "dom.iterable" — enforces no browser APIs
    "types": [],                  // no @types/node ambient in the pure core
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true
    // no "jsx" key → JSX disallowed
  },
  "include": ["src"]
}
```
*Omitting `"dom"` from `lib` means `document`, `window`, `localStorage`, etc. are type errors — a compile-time complement to the lint boundary. `[CITED: TypeScript handbook — lib option]` `[ASSUMED: ES2023 is the appropriate lib target for Node 24 — verify against tsconfig.base]`.*

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| ESLint `.eslintrc` + `extends` strings | Flat config (`eslint.config.ts`) | ESLint 9 (default), 10 (legacy removed) | Must author flat config; eslintrc not used. `[VERIFIED: npm — eslint 10.5 latest]` |
| Vitest `workspace` key / `vitest.workspace.ts` | `test.projects` array | Vitest 3.2 (deprecated), 4 (replaced) | Use `projects`; per-project configs, no `extends` of root. `[VERIFIED: vitest.dev]` |
| `@typescript-eslint/*` separate parser+plugin wiring | `typescript-eslint` unified flat-config helper | typescript-eslint 8.x | `tseslint.config(...)` helper; single dep. `[VERIFIED: npm]` |
| Zod 3 import / `.merge` | Zod 4 (`"zod"` or `"zod/v4"`), discriminatedUnion narrowing | Zod 4.x | Use 4.4.3; brand/discriminatedUnion stable. `[VERIFIED: npm + zod.dev]` |

**Deprecated/outdated:**
- Vitest `workspace` → removed in favor of `projects`.
- ESLint eslctrc-style config → flat config only in ESLint 10.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `precision: 34` sig-figs is appropriate headroom for multi-decade monthly compounding | Pattern 1 / Pitfall 3 | Too low → precision loss in long compounds; too high → negligible perf cost. 34 (decimal128 width) is conservative-safe. Planner/impl can tune; not a correctness risk if ≥ ~28. |
| A2 | `ES2023` is the correct `lib` target for the core under Node 24 | tsconfig example | Wrong lib could expose/hide APIs; low risk — adjust to match `tsconfig.base` Node 24 target (ES2023/ES2024 both fine). |
| A3 | Coverage thresholds 95/95/90/95 are the right gate for the core | vitest config | Purely a policy choice; planner/user may set differently. Not a correctness risk. |
| A4 | Installing `zod` as a runtime dep of the core (not just dev) is acceptable | Installation | Zod is allowlisted in the boundary config and used for boundary validation; it is pure (no framework). If the team wants the *pure math* core dep-free except decimal.js, move Zod validation to a thin `core/io` subpath. Worth a planner decision. |

**Note:** Exact seed assumption *values* (tax rates, DTI %, SWR, etc.) are explicitly Claude's discretion (D-07) and deferred for real values to Phase 2 — only the *shape* is locked. Not logged as assumptions because CONTEXT.md grants discretion.

## Open Questions (RESOLVED)

1. **Should Zod be a runtime dependency of the pure core, or quarantined?**
   - RESOLVED: Zod is allowed as a runtime dependency of `packages/core` and is allowlisted alongside `decimal.js` in the `boundaries/external` deny-by-default config (Plan 01-01, Task 3). Per the recommendation, all Zod usage is confined to the `assumptions/` (`schema.ts`/`assumption-set.ts`) and `serialize/` modules (Plans 01-03 and 01-04) so it remains trivially extractable to a non-core `io` boundary later if dep-graph minimalism is wanted. No further user decision is required for this phase.
   - What we know: CONTEXT.md says "Zod validates the AssumptionSet/snapshot at the serialization boundary only" (discretion item). The boundary config allowlists `decimal.js` + `zod`.
   - What's unclear: whether the team wants `packages/core`'s runtime dep graph to be *strictly* `decimal.js` only, with Zod confined to a non-core `io` boundary module.
   - Recommendation: allow Zod in core (it's pure, framework-free) but keep all Zod usage in `assumptions/schema.ts` + `serialize/` so it's trivially extractable later. Surface to user in planning if dep-graph minimalism matters.

2. **Cross-platform `UPDATE_GOLDEN=1` invocation (Windows/PowerShell).**
   - RESOLVED: `cross-env` is added as a dev dependency (installed in Plan 01-01, Task 2; confirmed in the Task 1 supply-chain gate) and the root `update-golden` script is `cross-env UPDATE_GOLDEN=1 vitest run packages/core`, making it PowerShell-portable. Plan 01-04 generates and re-verifies the golden fixture through this portable script.
   - What we know: dev shell is PowerShell; the env-var-prefix syntax is POSIX-only.
   - What's unclear: whether to add `cross-env` (one more dev dep) vs. documenting Bash-tool invocation.
   - Recommendation: add `cross-env` for a portable `npm run update-golden`. Trivial, well-known package.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | All (runtime + test) | ✓ | v24.15.0 | — |
| npm (workspaces) | Monorepo bootstrap | ✓ | 11.12.1 | — |
| git | Golden-master diff review, commit_docs | ✓ | repo initialized | — |
| Python/pip (for slopcheck) | Package legitimacy audit (optional) | ✗ | — | Manual `npm view` registry verification (done) |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** slopcheck (used registry verification instead — all packages are CLAUDE.md-prescribed/well-known).

## Validation Architecture

> `workflow.nyquist_validation` is `true` in config.json — section included.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.9 |
| Config file | root `vitest.config.ts` + `packages/core/vitest.config.ts` — **none exist yet (Wave 0)** |
| Quick run command | `vitest run packages/core` (single project) |
| Full suite command | `npm test` → `vitest run` (all projects) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CORE-01 | A `react`/`next`/`apps` import in core FAILS lint | lint (negative) | `npm run lint` (with a fixture import) → non-zero exit | ❌ Wave 0 |
| CORE-01 | Core `tsconfig` rejects DOM globals (`document`) | typecheck (negative) | `tsc -b` → error on `// @ts-expect-error document` | ❌ Wave 0 |
| CORE-02 | Bare-number money math is impossible/rejected | unit + type | `vitest run packages/core/src/money` (incl. `@ts-expect-error` cases) | ❌ Wave 0 |
| CORE-02 | Sum-of-N-rounded == full-precision-sum-rounded-once (HALF_EVEN) | unit | `vitest run packages/core/src/money/money.test.ts` | ❌ Wave 0 |
| CORE-03 | `Date.now`/`Math.random` in core FAILS lint | lint (negative) | `npm run lint` | ❌ Wave 0 |
| CORE-03 | Runtime guard throws if `Date.now` reached in a test | unit | `vitest run packages/core/src/determinism` | ❌ Wave 0 |
| CORE-03 | Core coverage ≥ threshold | coverage | `vitest run --coverage` | ❌ Wave 0 |
| ASMP-01 | AssumptionSet parses/migrates; bad version/float rejected | unit | `vitest run packages/core/src/assumptions` | ❌ Wave 0 |
| ASMP-01 | Numeric values round-trip as decimal strings (no float) | unit | `vitest run packages/core/src/assumptions` | ❌ Wave 0 |
| PROF-04 | Canary replays cent-identically vs committed golden master | golden | `vitest run packages/core/golden.test.ts` | ❌ Wave 0 |
| PROF-04 | Snapshot serialize→deserialize round-trip is lossless | unit | `vitest run packages/core/golden.test.ts` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `vitest run packages/core` + `npm run lint` (fast; core is small)
- **Per wave merge:** `npm test` + `npm run lint` + `tsc -b`
- **Phase gate:** full suite green + coverage threshold met before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] Root `package.json` (workspaces) + `tsconfig.base.json` + `eslint.config.ts` + `vitest.config.ts` + `vitest.shared.ts`
- [ ] `packages/core/package.json` + `tsconfig.json` + `vitest.config.ts`
- [ ] Framework install: the `npm install` commands in Installation
- [ ] `packages/core/src/determinism/guard.setup.ts` (Vitest setupFile installing the runtime guard)
- [ ] Negative-test fixtures: a file importing `react` (must fail lint), a `// @ts-expect-error document` case (must fail tsc), `@ts-expect-error Money+number` cases
- [ ] `packages/core/src/__fixtures__/golden-snapshot.json` (generated once via `UPDATE_GOLDEN=1`)

*No existing test infrastructure — entire harness is new. Wave 0 must scaffold it before any primitive is TDD'd.*

## Security Domain

> `security_enforcement: true`, `security_asvs_level: 1` in config.json — section included. **This is a pure offline calculation library with no I/O, network, auth, persistence, user input over a wire, or untrusted data in this phase.** Most ASVS categories are N/A by construction.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No auth anywhere (private 2-user tool; auth out of scope project-wide). |
| V3 Session Management | no | No sessions; no web layer in this phase. |
| V4 Access Control | no | No access control surface. |
| V5 Input Validation | **yes (light)** | Zod 4 at the AssumptionSet/snapshot deserialization boundary — `safeParse` rejects malformed/forged snapshots (defense against a corrupt fixture, not an attacker). |
| V6 Cryptography | no | No crypto. (Note: `Decimal.clone({crypto:false})` default — keep it false; the core must NOT use `crypto.getRandomValues`, which `Decimal` can use for `random()` — and `Decimal.random` is itself banned by the determinism rule.) |
| V7 Error Handling/Logging | minimal | Construction validators throw typed errors; no secret logging (no secrets). |
| V8–V14 (data protection, comms, config, malicious code, business logic, files, API) | no | No network, no files (except the version-controlled golden fixture), no external API. |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Supply-chain / slopsquat in new deps | Tampering | All deps are CLAUDE.md-prescribed, registry-verified (`npm view`), well-known. Commit a lockfile; consider `npm ci` in CI. |
| Malformed/forged AssumptionSet snapshot deserialized | Tampering | Zod `safeParse` on every deserialize; `migrate()` gates on `schemaVersion`; reject unknown versions. |
| Determinism subversion (non-reproducible result trusted as oracle) | Repudiation (of correctness) | Lint + runtime guard + golden master — the entire phase IS this mitigation. |
| Prototype pollution via `JSON.parse` of snapshot | Tampering | Validate with Zod immediately after parse; never spread untrusted parsed objects into config without schema validation. |

**Security verdict:** No high/medium application-security findings expected in this phase (`security_block_on: high`). The dominant "security" property here is *integrity/determinism of computation*, which the phase's own success criteria already enforce.

## Sources

### Primary (HIGH confidence)
- npm registry (`npm view <pkg> version` / `peerDependencies` / `dist-tags`), 2026-06-23 — exact current versions and compatibility for decimal.js 10.6.0, vitest 4.1.9, @vitest/coverage-v8 4.1.9, zod 4.4.3, typescript 6.0.3, eslint 10.5.0, typescript-eslint 8.62.0, eslint-plugin-import 2.32.0, eslint-plugin-boundaries 6.0.2.
- mikemcl.github.io/decimal.js — `Decimal.clone` config, `ROUND_HALF_EVEN = 6`, immutability, `toDecimalPlaces`/`toFixed`/`toString`, `clone` vs `set`.
- vitest.dev/guide/projects — `projects` array, `workspace` deprecation (3.2), per-project no-`extends`/`mergeConfig`/`defineProject`, per-project `environment`, process-global coverage, run commands.
- eslint.org/docs/latest/rules/no-restricted-syntax — ESQuery selector format + custom messages.
- eslint.org/docs/latest/rules/no-restricted-imports — `paths`/`patterns` format, gitignore-style globs, file scoping, **static-imports-only** caveat.
- github.com/import-js/eslint-plugin-import (no-restricted-paths docs) — `zones` format and the **path-only, not package-name** limitation.
- zod.dev — `discriminatedUnion`, `z.literal`, `.brand()`, `parse`/`safeParse`, `z.infer`, no-native-decimal → regex approach, import path.

### Secondary (MEDIUM confidence)
- CLAUDE.md (binding prescriptive stack) — cross-checked every recommendation against it; all versions match registry `latest`.

### Tertiary (LOW confidence)
- None relied upon for load-bearing claims.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every version + peer range verified against npm registry on 2026-06-23.
- Architecture / lint boundary: HIGH — the critical `no-restricted-paths`-doesn't-ban-packages gotcha verified against official plugin docs; `boundaries/external` deny-by-default cited.
- Money/Decimal mechanics: HIGH — clone config + `ROUND_HALF_EVEN=6` + immutability verified against official decimal.js docs.
- Determinism enforcement: HIGH (lint selectors verified) / MEDIUM on exact runtime-guard ergonomics (a small implementation detail, Claude's discretion).
- Pitfalls: HIGH — each tied to a verified source.

**Research date:** 2026-06-23
**Valid until:** ~2026-07-23 (30 days; stable libraries — but ESLint 10 / typescript-eslint / Zod 4 / Vitest 4 are actively released; re-verify versions if planning slips past a month).
