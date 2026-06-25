# Phase 2: TCO Engine - Pattern Map

**Mapped:** 2026-06-25
**Files analyzed:** 22 (new + modified)
**Analogs found:** 22 / 22 (every new file maps to a defended in-repo precedent)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `packages/core/src/tco/amortization.ts` | service (pure calc) | transform | `engine/canary.ts` | role+flow (Dec→Money rate math) |
| `packages/core/src/tco/amortization.test.ts` | test | transform | `engine/canary.test.ts` | role-match |
| `packages/core/src/tco/pmi.ts` | service (pure calc) | transform | `engine/canary.ts` | role-match |
| `packages/core/src/tco/pmi.test.ts` | test | transform | `engine/canary.test.ts` | role-match |
| `packages/core/src/tco/property-tax.ts` | service (pure calc) | transform | `engine/canary.ts` + RESEARCH §"Property tax" | role+flow |
| `packages/core/src/tco/property-tax.test.ts` | test | transform | `engine/canary.test.ts` | role-match |
| `packages/core/src/tco/carrying-costs.ts` | service (pure calc) | transform | `engine/canary.ts` | role-match |
| `packages/core/src/tco/carrying-costs.test.ts` | test | transform | `engine/canary.test.ts` | role-match |
| `packages/core/src/tco/closing-costs.ts` | service (pure calc) | transform | `engine/canary.ts` | role-match |
| `packages/core/src/tco/closing-costs.test.ts` | test | transform | `engine/canary.test.ts` | role-match |
| `packages/core/src/tco/rent-vs-buy.ts` | service (pure calc) | transform | `engine/canary.ts` (multi-period compound) | role+flow |
| `packages/core/src/tco/rent-vs-buy.test.ts` | test | transform | `engine/canary.test.ts` | role-match |
| `packages/core/src/tco/tco.ts` | service (top-level aggregator) | transform | `engine/canary.ts` (EngineInput→result) | role+flow |
| `packages/core/src/tco/tco.test.ts` | test | transform | `engine/canary.test.ts` | role-match |
| `packages/core/src/tco/tco.type-test.ts` | type-test | n/a | `money/money.type-test.ts` | exact |
| `packages/core/src/towns/town-table.ts` | model + data + resolver | request-response (lookup) | `assumptions/defaults.ts` (pure data) + `time/calendar-date.ts` (resolver/validator) | role-match |
| `packages/core/src/towns/town-table.schema.ts` | config (Zod boundary) | request-response | `assumptions/schema.ts` (`decStr`/`group`/`.strict()`) | exact |
| `packages/core/src/towns/town-table.test.ts` | test | request-response | `assumptions/schema.test.ts` | role-match |
| `packages/core/src/assumptions/schema.ts` (MODIFY) | config (Zod boundary) | request-response | itself (`AssumptionsV1` → append `AssumptionsV2`) | exact (extend) |
| `packages/core/src/assumptions/defaults.ts` (MODIFY) | config (pure data) | n/a | itself (`DEFAULT_ASSUMPTIONS` → V2) | exact (extend) |
| `packages/core/src/assumptions/migrate.ts` (MODIFY) | service | transform | itself (add `case 1: return v1ToV2(set)`) | exact (extend) |
| `packages/core/src/engine/engine-input.ts` (MODIFY) | model | n/a | itself (widen `ScenarioInputs`) | exact (extend) |
| `packages/core/src/index.ts` (MODIFY) | config (barrel) | n/a | itself (export new types/fns) | exact (extend) |
| `packages/core/src/golden.test.ts` (MODIFY) | test | transform | itself (add TCO golden case) | exact (extend) |

---

## Pattern Assignments

### `packages/core/src/tco/amortization.ts` (pure calc, transform)

**Analog:** `packages/core/src/engine/canary.ts` — this file IS the sanctioned `Dec`-for-rates → `Money`-for-dollars precedent. RESEARCH explicitly resolves the "widen Money vs use Dec" discretion in favor of internal `Dec`.

**Imports pattern** (`canary.ts` lines 15-18) — note `.js` extensions (NodeNext), `Dec` from internal config, `Money` from closed API, types as `type`:
```typescript
import { Dec } from '../money/decimal-config.js';
import { Money } from '../money/money.js';
import type { EngineInput } from './engine-input.js';
import type { CalendarDate } from '../time/calendar-date.js';
```

**Core rate-math pattern** (`canary.ts` lines 55-59) — the `(1+r)^n` chain in `Dec`, flatten to canonical string with `.toFixed()` (never `.toString()`), feed `Money.mul`:
```typescript
const growthFactor = new Dec(1).plus(new Dec(realAnnual)).pow(CANARY_PERIODS);
const principal = Money.of(CANARY_PRINCIPAL);
const final = principal.mul(growthFactor.toFixed());   // .toFixed() → canonical fixed-point
const gain = final.sub(principal);
```
For amortization the planner applies this to: `monthlyRate = new Dec(annualRate).div(12)`, `factor = new Dec(1).plus(r).pow(termMonths)`, payment via `.times()/.div()`, then `Money.of(paymentDec.toFixed())` (RESEARCH Pattern 1 / Code Examples lines 366-381).

**CRITICAL — `.toFixed()` not `.toString()`:** `Money.of` validates against `CANONICAL_DECIMAL_RE = /^-?\d+(\.\d+)?$/` (`money.ts` line 14-15 imports it from `schema.ts` line 24). `Dec.toString()` can emit `1e21` exponent form which this regex REJECTS. Always `.toFixed()` when crossing into `Money.of`/`Money.mul`.

**Result-object shape pattern** (`canary.ts` lines 31-42) — `readonly` interface, dollars as `Money`, rates echoed as the decimal string that was read:
```typescript
export interface CanaryResult {
  readonly asOf: CalendarDate;
  readonly periods: number;
  readonly realAnnual: string;      // the slice that was read (echoed for the snapshot)
  readonly principal: Money;
  readonly final: Money;
  readonly gain: Money;
}
```
Amortization schedule rows follow this: each row `{ readonly period: number; readonly interest: Money; readonly principal: Money; readonly balance: Money }`. Per-period interest rounds to cents at its `Money` boundary while `monthlyRate` stays full-precision `Dec` (RESEARCH Pattern 2 / Open Question 2; Pitfall 2).

**Money API available** (`money.ts`): `add`, `sub`, `mul(rateStr)`, `percentOf(rateStr)`, `toCents()`, `toDecimalString()`, `Money.of(str)`, `Money.zero()`. There is **NO** `div`/`pow`/comparison — do that in `Dec` and surface as `Money`. Compare dollars in tests via `.toDecimalString()` or `.toCents()` (bigint).

---

### `packages/core/src/tco/property-tax.ts` (pure calc, transform)

**Analog:** `engine/canary.ts` (Dec→Money) + RESEARCH Code Examples lines 394-401.

**Pattern** — mill rate published per-$1,000, divide in the function, multiply via `Money.mul` (no bare numbers):
```typescript
// RESEARCH lines 397-400 — millRatePerThousand is a decStr from the town table.
function annualPropertyTax(assessedValue: Money, millRatePerThousand: string): Money {
  return assessedValue.mul(new Dec(millRatePerThousand).div(1000).toFixed());
}
```
Constant mill rate, assessed value grows at `appreciation.realAnnual` (no 2.5% bill cap — emit the qualitative "Prop 2½ caps the levy, not your bill" flag; Pitfall 9 / D-10).

---

### `packages/core/src/tco/rent-vs-buy.ts` (pure calc, transform)

**Analog:** `engine/canary.ts` for the multi-period `Dec` compounding loop; the result-object/`readonly`/`Money` discipline is identical.

**Fisher real-conversion pattern** (RESEARCH Code Examples lines 387-391) — never naive `nominal − inflation` (Pitfall 5); `returns.realAnnual` is ALREADY real (do not double-convert):
```typescript
function toReal(nominal: string, inflation: string): InstanceType<typeof Dec> {
  return new Dec(1).plus(new Dec(nominal))
    .div(new Dec(1).plus(new Dec(inflation)))
    .minus(1);
}
```
Two symmetric portfolios, separate `appreciation.realAnnual`, explicit `transaction.sellCostPct` haircut at horizon end, crossover year (RESEARCH Pattern 4 / Pitfall 6). One realistic input set must let RENT win (anti-funnel).

---

### `packages/core/src/tco/tco.ts` (top-level aggregator, transform)

**Analog:** `engine/canary.ts` lines 49-69 — `runCanary(input: EngineInput): CanaryResult`. `computeTco` mirrors this signature: takes the frozen widened `EngineInput`, reads assumption slices + scenario fields, returns a `Money`-valued breakdown object with `{ monthly, annualized }` per line (P+I, tax, insurance, maintenance, HOA, PMI, amortizedClosing). Captures the resolved mill rate + FY into the result (Pitfall 11 / D-08).

---

### `packages/core/src/tco/tco.type-test.ts` (type-test, no Vitest)

**Analog:** `packages/core/src/money/money.type-test.ts` (EXACT pattern). Also `engine/engine-input.type-test.ts`.

**Pattern** (`money.type-test.ts` lines 1-11, 13-17) — header explains it is NOT a `*.test.ts` (stays in `tsc -b`, out of Vitest), each `@ts-expect-error` asserts a misuse is a compile error (unused suppression → TS2578 build failure):
```typescript
import { Money } from './money.js';
const m = Money.of('10');
// @ts-expect-error -- bare number is not a Money (CORE-02: no bare-number dollar math).
m.add(5);
```
For TCO: assert result-object dollar fields are `Money` not `number`, and that no bare-number dollar entry point exists on the TCO result. File MUST be named `*.type-test.ts` (NOT `*.test.ts`) so esbuild/Vitest don't strip the `@ts-expect-error` checks.

---

### `packages/core/src/towns/town-table.schema.ts` (Zod boundary, request-response)

**Analog:** `packages/core/src/assumptions/schema.ts` (EXACT pattern — reuse `decStr` and the `group`/`.strict()` idiom).

**Pattern** (`schema.ts` lines 32-37) — reuse the shared `decStr` validator and `.strict()` to reject unknown keys:
```typescript
export const decStr = z.string().regex(CANONICAL_DECIMAL_RE, '...');
const group = <Shape extends z.ZodRawShape>(shape: Shape) => z.object(shape).strict();
```
Town row schema: `z.object({ town: z.string(), fy: z.number().int(), residentialMillRate: decStr }).strict()` (RESEARCH Pattern 5 lines 283-289). `millRate` is a `decStr` (per-$1,000, stored as published — Assumption A3). FY-stamp **per row** (mixed vintage allowed — Open Question 1).

---

### `packages/core/src/towns/town-table.ts` (data + resolver, request-response)

**Analogs:** `assumptions/defaults.ts` (pure literal data — no `Date`, no env, no computation) for the seeded table; `time/calendar-date.ts` (lines 19-24) for the validator/resolver-that-throws idiom.

**Pure-data pattern** (`defaults.ts` lines 1-14) — header states "PURE DATA. No process/env reads, no Date, no computation"; every value a canonical decimal STRING; the object satisfies the schema type at compile time so a shape change is a type error.

**Resolver pattern** (`calendar-date.ts` lines 19-24) — validate and throw a meaningful error on miss:
```typescript
export function calendarDate(s: string): CalendarDate {
  if (!ISO_DATE.test(s)) {
    throw new Error(`Invalid CalendarDate: ${JSON.stringify(s)} (expected YYYY-MM-DD)`);
  }
  return s as CalendarDate;
}
```
`resolveMillRate(town)` returns `{ residentialMillRate, fy }`; the resolved pair is captured into the TCO result so replay is self-contained (Pitfall 11 / D-08).

---

### `packages/core/src/assumptions/schema.ts` (MODIFY — add `AssumptionsV2`)

**Analog:** itself — `AssumptionsV1` (lines 44-77) is the template; the file header (lines 12-13) and the union (lines 79-83) explicitly document "adding V2 is appending one object schema to the union."

**Extend pattern:**
- Copy the `AssumptionsV1` object, set `schemaVersion: z.literal(2)`, add new `group({...})` slices: `appreciation: group({ realAnnual: decStr })`, `transaction: group({ sellCostPct: decStr })`, `rent: group({ realGrowthAnnual: decStr })`, `closing: group({ rateOfPrice: decStr })`, and `tax.assessmentRatio: decStr` (Open Question 3 recommends `assessmentRatio` under existing `tax`).
- Line 83 changes to: `z.discriminatedUnion('schemaVersion', [AssumptionsV1, AssumptionsV2])`.
- `CURRENT_VERSION = 2 as const` (line 86); `CurrentAssumptionSet = z.infer<typeof AssumptionsV2>` (line 92).
- Every new tunable is a `decStr` — never `z.number()` (T-03-02).

---

### `packages/core/src/assumptions/defaults.ts` (MODIFY — V2 defaults)

**Analog:** itself (lines 14-47). Add `DEFAULT_ASSUMPTIONS_V2` (or bump in place) typed `: CurrentAssumptionSet` so a shape mismatch is a compile error. Conservative seeds (Assumption A2): `appreciation.realAnnual "0.0075"`, `transaction.sellCostPct "0.065"`, `rent.realGrowthAnnual "0"`, `closing.rateOfPrice "0.025"`, `tax.assessmentRatio "1.0"`. Tag `[ASSUMED]` until user-confirmed. All canonical decimal STRINGS.

---

### `packages/core/src/assumptions/migrate.ts` (MODIFY — V1→V2 arm)

**Analog:** itself (lines 18-32). The switch (line 23) already documents the slot: `case 1: return v1ToV2(set)`. Add a `v1ToV2(set)` that fills the new V2 slices with V2 defaults and sets `schemaVersion: 2`. Update `case 2: return set;` as the new current. The `assertNever` exhaustiveness guard (lines 34-36) stays. Mirror `migrate.test.ts` (lines 10-28): unchanged-when-current, parses-against-current, rejects-unknown-version.

---

### `packages/core/src/engine/engine-input.ts` (MODIFY — widen `ScenarioInputs`)

**Analog:** itself (lines 21-23) — the comment at lines 18-20 already says "Later phases (TCO, Affordability, FI-Impact) widen this with the real per-scenario fields (price, down payment, income, etc.)."

**Widen `ScenarioInputs`** keeping every field `readonly` and dollars/rates as appropriate types. From CONTEXT decisions: `price` (Money string at boundary or Money), `downPaymentPct` (decStr — D-14), `annualRate` (decStr), `termMonths` (number), `holdingYears` (number — D-03), `town` (string ref — D-08), `insuranceAnnual`, `hoaMonthly`, `monthlyRent`, optional `closingCostsOverride`, optional `otherOneTimeCosts` (D-13). `engineInput()` (lines 40-50) already `Object.freeze`s scenario — no change needed there.

---

### `packages/core/src/index.ts` (MODIFY — public barrel)

**Analog:** itself (lines 10-41). Export the new `Money`-typed result types and `computeTco`/`resolveMillRate`/`rentVsBuy` functions plus the widened `ScenarioInputs` (already exported line 34). DO NOT export `Dec`/`Decimal` (lines 7-9 explain why — dollars cross only as `Money`). New TCO result types are exported `type`-only.

---

### `packages/core/src/golden.test.ts` (MODIFY) + TCO fixture

**Analog:** itself (lines 43-103) + `__fixtures__/golden-snapshot.json`. Add a fixed-input TCO golden case using `computeTco`, serialize with `canonicalJson`, deep-equal against a committed `__fixtures__/tco-golden-*.json`. Use the **gated** `UPDATE_GOLDEN=1` write (lines 67-76) — never `toMatchSnapshot` (lines 16-19 explain why: `-u` silently re-blesses drift = the tampering threat). Regenerate via `npm run update-golden`. Widening `ScenarioInputs`/bumping to V2 changes the existing canary fixture shape → regenerate it too (RESEARCH Runtime State Inventory line 319).

---

## Shared Patterns

### Dec-for-rates → Money-for-dollars (the canary precedent)
**Source:** `packages/core/src/engine/canary.ts` lines 55-59; `money/decimal-config.ts` lines 20-23.
**Apply to:** ALL `tco/*.ts` calc files.
```typescript
import { Dec } from '../money/decimal-config.js';   // 34-digit, HALF_EVEN; NOT exported
import { Money } from '../money/money.js';
// ...rate/power/div/comparison in Dec...
const result = Money.of(decValue.toFixed());          // .toFixed() → canonical string
```
Rule: rates/powers/divisions/comparisons live in `Dec`; every dollar that crosses any boundary is a `Money`; `.toFixed()` (never `.toString()`) when entering `Money.of`/`Money.mul`. Never widen the `Money` API (`money.type-test.ts` guards it).

### Canonical-decimal-string boundary (`decStr` / `CANONICAL_DECIMAL_RE`)
**Source:** `assumptions/schema.ts` lines 24, 32-34; `money/money.ts` lines 14-15, 26-32.
**Apply to:** All new schema slices (V2, town rows) and any string fed to `Money`/`Dec`.
`CANONICAL_DECIMAL_RE = /^-?\d+(\.\d+)?$/` — no exponent, no separators, no `NaN`/`Infinity`. One regex shared by the Zod boundary AND the Money boundary. New tunables are `decStr`, never `z.number()`.

### Versioned discriminatedUnion + migrate arm
**Source:** `assumptions/schema.ts` lines 44-92; `assumptions/migrate.ts` lines 18-36; `migrate.test.ts`.
**Apply to:** The `AssumptionsV2` bump. Append one object schema, add one `case` to the migrate switch, keep `assertNever` exhaustiveness. RESEARCH recommends a REAL V2 (not in-place V1 edit) to exercise the migration path before Phase 6 persistence (A4).

### `readonly` Money-valued result objects
**Source:** `canary.ts` lines 31-42.
**Apply to:** Every TCO result shape. All fields `readonly`; dollars are `Money`; the rate/FY that was read is echoed into the result (snapshot self-containment — Pitfall 11). Type-asserted by `tco.type-test.ts`.

### type-test files (`*.type-test.ts`, NOT `*.test.ts`)
**Source:** `money/money.type-test.ts`; `engine/engine-input.type-test.ts`.
**Apply to:** `tco.type-test.ts`. Stays in `tsc -b` graph, excluded from Vitest. `@ts-expect-error` per asserted misuse; unused suppression fails the build (TS2578). Run via `npm run typecheck`.

### Gated golden harness (`UPDATE_GOLDEN=1`, canonicalJson, deep-equal — NOT toMatchSnapshot)
**Source:** `golden.test.ts` lines 24-77; `serialize/canonical-json.ts` lines 17-65.
**Apply to:** TCO golden test. `canonicalJson` emits `Money` as decimal string + sorts keys recursively + throws on non-finite numbers. Regenerate only via the env-gated branch (reviewable git diff).

### Determinism (inherited, no action)
**Source:** `determinism/guard.ts` + ESLint `no-restricted-globals`.
**Apply to:** New `tco/`/`towns/` files are covered automatically — `Date.now`/`Math.random`/`new Date` throw inside core. Time is data (`asOf` / FY as branded string or int). FY dates, if stored as dates, use `calendarDate()` (`time/calendar-date.ts`) — never `new Date`.

### Test conventions
**Source:** `canary.test.ts`; `schema.test.ts`; `migrate.test.ts`.
**Apply to:** All `tco/*.test.ts`, `towns/*.test.ts`. Import from `vitest` (`describe, test, expect`); assert dollar equality via `.toDecimalString()` or `.toCents()` (bigint) — exact equality, **never `toBeCloseTo`** (Pitfall 2 warning sign). For SC1 amortization: assert `schedule.length === termMonths`, `sum(principal) === loan` exactly, `finalBalance === Money.zero()` exactly, final payment ≠ normal payment, and oracle agreement on the $400k/6.375%/360 case (RESEARCH lines 252-258, 483-491).

---

## No Analog Found

None. Every new file maps to an existing in-repo precedent. The only genuinely new *asset* is the seeded MA mill-rate **data** (~20-40 greater-Boston towns, FY-stamped, transcribed from the DLS "Tax Rates by Class" report) — its *structure* follows `defaults.ts` (pure data) + `town-table.schema.ts` (Zod boundary), but the values are hand-sourced (RESEARCH Open Question 1; Environment Availability — manual transcription, no live API in Phase 2).

## Metadata

**Analog search scope:** `packages/core/src/**` (money, engine, assumptions, serialize, time, determinism, fixtures)
**Files scanned:** 17 source/test/fixture files read in full
**Key precedent:** `engine/canary.ts` resolves the central discretion question (use internal `Dec`, do NOT widen `Money`) by demonstrating the exact `(1+r)^n` → `Money` pattern.
**Pattern extraction date:** 2026-06-25
