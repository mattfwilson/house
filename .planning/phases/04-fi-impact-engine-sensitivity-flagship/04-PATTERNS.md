# Phase 4: FI-Impact Engine & Sensitivity (flagship) - Pattern Map

**Mapped:** 2026-06-26
**Files analyzed:** 14 (new module + extensions + golden/oracle)
**Analogs found:** 14 / 14 (every new file has an existing in-repo analog — this phase is composition, not greenfield)

> **Binding stack rules (CLAUDE.md, non-negotiable, apply to EVERY file below):**
> - **No bare `number` for money/rate.** Dollars cross boundaries as `Money`; rates/ratios as canonical decimal STRINGS (`decStr`). All compounding/comparison/division in the internal `Dec` (34-digit, HALF_EVEN). `Dec`/`Decimal` are NEVER exported.
> - **No framework deps in `packages/core`.** No React/Next/DOM. Pure data in, pure data out.
> - **Determinism.** No `Date.now()` / `Math.random()` (the guard throws). `asOf` + all assumptions + new bands/max-horizon are explicit data on `EngineInput` / `AssumptionSet`.
> - **`.strict()` Zod at every boundary leaf** is a `decStr` (never `z.number()`).
> - **`canonicalJson` THROWS on non-finite numbers** — the unreachable verdict is a discriminated `kind` variant, never an `Infinity`/`-1` sentinel.

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `packages/core/src/fi/fi-target.ts` | service (pure calc) | transform | `affordability/evaluate-scenario.ts` (`savingsRateAt` Dec-then-Money) + `tco/property-tax.ts` (`assessedValueAt`/`annualPropertyTax`) | role + flow match |
| `packages/core/src/fi/projection.ts` | service (pure calc) | transform (iterative loop) | `tco/rent-vs-buy.ts` (`rentVsBuy` monthly loop, lines 228–264) | exact (THE substrate) |
| `packages/core/src/fi/fi-impact.ts` | service (top-level orchestrator) | request-response (input→result) | `affordability/gap.ts` (`affordabilityGap` composer + result + verdict) | exact |
| `packages/core/src/fi/compare.ts` | service (ranking) | batch / transform | `affordability/gap.ts` (`winner`/verdict enum, cent-exact ordering) | role-match |
| `packages/core/src/fi/sensitivity.ts` | service (perturb + re-run) | batch (grid sweep) | `tco/rent-vs-buy.ts` (`buyMonthlyOutflowAt` per-month re-run) + `gap.ts` composer | role-match |
| `packages/core/src/fi/fi.type-test.ts` | type-test | — | `affordability/affordability.type-test.ts` + `tco/tco.type-test.ts` | exact |
| `packages/core/src/fi/oracle.test.ts` | test (independent oracle) | — | `golden.test.ts` (gated, hand-pinned) + new closed-form (RESEARCH §1) | role-match (no oracle exists yet) |
| `packages/core/src/fi/projection.test.ts` | test (unit) | — | `affordability/gap.test.ts` / `evaluate-scenario.test.ts` | exact |
| `packages/core/src/fi/fi-impact.test.ts` | test (unit) | — | `affordability/gap.test.ts` | exact |
| `packages/core/src/fi/compare.test.ts` | test (unit) | — | `affordability/gap.test.ts` | exact |
| `packages/core/src/fi/sensitivity.test.ts` | test (unit) | — | `affordability/gap.test.ts` | exact |
| `packages/core/src/engine/engine-input.ts` (MODIFY) | model + boundary | request-response | self — `Household`/`HouseholdSchema`/`parseHousehold` (extend in place) | exact (same file) |
| `packages/core/src/assumptions/{schema,defaults,migrate}.ts` (MODIFY) | config (versioned schema) | request-response | self — `AssumptionsV2` / `v1ToV2` (append V3 + `v2ToV3`) | exact (same pattern) |
| `packages/core/src/golden.test.ts` (MODIFY) + `__fixtures__/fi-golden-snapshot.json` | test (golden) | file-I/O (gated) | self — `canonicalTcoResult` / `canonicalAffordabilityResult` blocks | exact (same file) |
| `packages/core/src/index.ts` (MODIFY) | config (barrel) | — | self — the per-phase export block pattern | exact (same file) |

---

## Pattern Assignments

### `packages/core/src/fi/fi-target.ts` (service, transform)

**Analogs:** `affordability/evaluate-scenario.ts` (the Dec-then-Money division idiom) + `tco/property-tax.ts` + `tco/carrying-costs.ts` (appreciating-value helpers).

**Imports pattern** — copy the module-header `Dec`/`Money` import + a doc comment explaining the Dec/Money discipline (from `evaluate-scenario.ts` lines 26–30):
```typescript
import { Dec } from '../money/decimal-config.js';
import { Money } from '../money/money.js';
import type { EngineInput } from '../engine/engine-input.js';
```

**Division-in-Dec, cross-to-Money-once idiom** — the FI target `(spend + housing) / swr.rate` MUST use this exact shape (`Money` has NO `div`; division lives in `Dec`, result re-enters as `Money` via `.toFixed()`). Mirror `savingsRateAt` (`evaluate-scenario.ts` lines 55–60):
```typescript
function savingsRateAt(tco: TcoBreakdown, household: Household): InstanceType<typeof Dec> {
  const drain = new Dec(cashSavingsDrain(tco).toDecimalString());
  const premium = drain.minus(new Dec(household.currentRent)).times(12);
  const post = new Dec(household.currentAnnualSavings).minus(premium);
  return post.div(new Dec(household.grossAnnualIncome));
}
```
→ For the FI target, build the numerator as `Money` (`spend.add(annualHousing)`), lift to `Dec` via `.toDecimalString()`, `.div(new Dec(swrRate))`, and return `Money.of(d.toFixed())`.

**Owner perpetual-housing basis** — reuse the appreciating-value helpers verbatim (do NOT re-derive `(1+appr)^year`). From `property-tax.ts` lines 53–55, 63–72 and `carrying-costs.ts` lines 27–38:
```typescript
// property-tax.ts
export function annualPropertyTax(assessedValue: Money, millRatePerThousand: string): Money {
  return assessedValue.mul(new Dec(millRatePerThousand).div(1000).toFixed());
}
export function assessedValueAt(price, assessmentRatio, appreciationRealAnnual, year): Money { /* (1+appr)^year in Dec */ }
// carrying-costs.ts
export function maintenanceAnnual(homeValue: Money, annualPctOfValue: string): Money {
  return homeValue.mul(annualPctOfValue);
}
export function homeValueAt(price, appreciationRealAnnual, year): Money { /* assessedValueAt(...,'1.0',...) */ }
```
**D-02 (surface both targets):** the result object must expose `{ renterTarget, ownerTarget, renterHousingAnnual, ownerHousingAnnual }` — all `Money` — never bury them (the fairness fulcrum must be visible).

**Basis decision (RESEARCH Open Q1 / L7):** pick ONE all-real treatment for the owner housing basis (year-0 value vs appreciated-at-FI-year) and document it inline — mirror the `[ASSUMED] … (D-07) — pending user confirmation` comment style used in `defaults.ts` lines 21–23.

---

### `packages/core/src/fi/projection.ts` (service, iterative loop)

**Analog:** `tco/rent-vs-buy.ts` — THE substrate. Reuse `monthlyGrowthFactor`, `buyMonthlyOutflowAt`, `amortizationSchedule`, `homeValueAt`. **Do NOT rebuild trajectory math.**

**LOCKED intra-month convention** — the FI loop MUST use the SAME contribute-then-compound order as `rentVsBuy` (lines 228–264), or the baseline diverges from the golden-tested rent path and the oracle disagrees (Landmine L1 / Pitfall 1). Copy this order:
```typescript
// rent-vs-buy.ts 228–247: invest-the-difference FIRST, THEN compound, THEN grow rent.
for (let month = 1; month <= totalMonths; month++) {
  const buyOut = new Dec(buyMonthlyOutflowAt(input, month).toDecimalString());
  const rentOut = currentRent;
  const diff = buyOut.minus(rentOut).abs();
  if (rentOut.lessThan(buyOut)) { rentPortfolio = rentPortfolio.plus(diff); }
  else if (buyOut.lessThan(rentOut)) { buyPortfolio = buyPortfolio.plus(diff); }
  rentPortfolio = rentPortfolio.times(portfolioMonthly);   // contribute, THEN compound
  buyPortfolio = buyPortfolio.times(portfolioMonthly);
  currentRent = currentRent.times(rentMonthly);
}
```
→ FI loop equivalent: `nw = nw.plus(contributionFor(month)); nw = nw.times(factor);` then test `nw ≥ target`.

**`monthlyGrowthFactor` is currently file-private** (`rent-vs-buy.ts` lines 84–86):
```typescript
function monthlyGrowthFactor(annualReal: string): InstanceType<typeof Dec> {
  return new Dec(1).plus(new Dec(annualReal)).pow(new Dec(1).div(12));
}
```
**Landmine L1 / Open Q4:** promote this to a shared within-package helper so the FI loop, the oracle, AND `rentVsBuy` import ONE definition. The `rentVsBuy` golden MUST stay byte-identical after the extraction (math unchanged).

**Forced-equity reuse (buy-path NW = liquid + liquidated equity, RESEARCH §4 / A5)** — copy the equity composition from `rent-vs-buy.ts` lines 253–261 verbatim, including the schedule index-clamp:
```typescript
const homeValue = new Dec(homeValueAt(price, appreciationRealAnnual, year).toDecimalString());
const row = month - 1 < schedule.rows.length ? schedule.rows[month - 1]! : undefined;
const remainingBalance = row ? new Dec(row.balance.toDecimalString()) : new Dec(0);
const equity = homeValue.minus(remainingBalance);
const liquidatedEquity = equity.times(sellRetain);  // sellRetain = 1 - sellCostPct
```

**Termination + unreachable encoding (D-07 / L3)** — discriminated union, NOT a sentinel (`canonicalJson` throws on `Infinity`). Recommended shape (RESEARCH §2):
```typescript
type FiOutcome =
  | { readonly kind: 'reached'; readonly month: number; readonly years: number }
  | { readonly kind: 'unreached'; readonly cappedAtMonth: number };
```
Loop bound = `maxHorizonYears × 12` read from the new V3 `projection` slice — NEVER an unbounded `while`, NEVER a hardcoded cap.

**`returns.realAnnual` is ALREADY real (L4)** — consume it directly into `monthlyGrowthFactor`; NEVER pass it through `toReal`. `toReal` is ONLY for the D-11 oracle case.

---

### `packages/core/src/fi/fi-impact.ts` (service, top-level orchestrator)

**Analog:** `affordability/gap.ts` (`affordabilityGap`) — the closed top-level composer that runs sub-engines once, computes a signed delta, and returns a closed result.

**Module structure to mirror** (`gap.ts`):
- A long doc comment stating what question it answers + the Dec/Money discipline line (`gap.ts` lines 1–29).
- A closed `readonly` result interface, every dollar a `Money` (`gap.ts` lines 54–68).
- A `household === undefined` guard with a clear throw at the headline entry (`gap.ts` lines 79–86) — FI-impact requires `household.targetAnnualRetirementSpend`.

**Signed-delta + report shape** — copy the signed-difference idiom (`gap.ts` lines 91–95). The FI delta = owner FI month − renter (baseline) FI month, reported in **months AND years** (FI-03). Surface both per-path `FiOutcome`s and both targets (D-02 visibility):
```typescript
const signedGap = bank.bankMaxPrice.sub(tru.trueMaxPrice);   // gap.ts precedent for "owner − baseline" delta
```

**Result interface** — closed `readonly`, e.g. `{ baseline: FiOutcome, buy: FiOutcome, fiDeltaMonths: number | null, fiDeltaYears: string | null, targets: { renterTarget, ownerTarget, renterHousingAnnual, ownerHousingAnnual } }` — dollars `Money`, the years delta a decimal STRING (months/12 in `Dec`).

---

### `packages/core/src/fi/compare.ts` (service, ranking)

**Analog:** `affordability/gap.ts` verdict enum + cent-exact ordering; and `rent-vs-buy.ts` `winner` (lines 283–287, bigint-cent comparison, never float).

**Ranking rules (D-08):** baseline is always row 0 (delta = 0 by definition); buy scenarios sorted by FI-date delay ascending; `unreached` sorts LAST. Map `unreached` to a max-ordering key WITHOUT putting `Infinity` in the serialized object (L3) — e.g. sort `unreached` after all `reached`, then by `cappedAtMonth`.

**Enum-as-structured-data precedent** (`gap.ts` lines 43, 96–101) — verdicts/kinds are plain string literals, NO UI copy (Phase 7 owns wording):
```typescript
export type AffordabilityVerdict = 'bankExceedsTrue' | 'trueExceedsBank' | 'aligned';
```
→ FI comparison rows carry the `FiOutcome.kind` string verbatim; the "don't buy" signal (FI-06) is the `unreached` row sorting worst — a feature, not an error.

---

### `packages/core/src/fi/sensitivity.ts` (service, grid sweep)

**Analogs:** `tco/rent-vs-buy.ts` (`buyMonthlyOutflowAt` — the "re-run a pure fn per step" idiom) + `gap.ts` (composer).

**Cheap-re-run architecture (Pitfall 5/10, D-12/13/14)** — `projectFiDate` must be a pure fn of `EngineInput`; the tornado is `for each driver: project(perturb(input, driver, ±band))`. NO `switch(driver)` with bespoke math per arm; NO hardcoded bands (they are V3 stored data). Shape (RESEARCH §5):
```typescript
const DRIVERS = ['return','inflation','appreciation','maintenance','tax','swr'] as const;
// row: { driver, low: FiOutcome, base: FiOutcome, high: FiOutcome, swingMonths: number }
// sort rows DESC by swingMonths; topDrivers = rows.slice(0,3).map(r => r.driver)
```

**Band semantics (D-12 / L6):** most bands are ABSOLUTE ± on a rate; **tax is ±15% RELATIVE** — perturb the rate multiplicatively (`× 0.85` / `× 1.15`), the others additively. Each band must encode its mode (absolute vs relative). All perturbation arithmetic in `Dec`.

---

### `packages/core/src/fi/fi.type-test.ts` (type-test)

**Analogs:** `affordability/affordability.type-test.ts` + `tco/tco.type-test.ts`. Copy the structure exactly.

**Header (NOT a `*.test.ts` — part of the `tsc -b` graph)** — from `tco.type-test.ts` lines 1–16: explain that each `@ts-expect-error` asserts a misuse is a compile error (unused suppression → TS2578 → build fails).

**Guards to replicate per FI result type** (`affordability.type-test.ts` lines 21–93):
```typescript
declare const result: FiImpactResult;
// (1) every dollar field is Money, not number
// @ts-expect-error -- ownerTarget is a Money, not a number (no bare-number dollar leak).
const _n: number = result.targets.ownerTarget;
// (2) cannot SET a Money field from a bare number
// (3) a plain object is not a Money (brand blocks structural typing)
// (4) decimal-STRING fields (fiDeltaYears, swr-derived ratios) assigned to number must error
```
Also assert the `FiOutcome` discriminant: `kind` is `'reached' | 'unreached'` (a bare `number` FI-date must NOT typecheck — the no-`-1`-sentinel guarantee at the type level).

---

### `packages/core/src/fi/oracle.test.ts` (test, independent oracle — D-10)

**Analog:** the gated golden pattern in `golden.test.ts` (hand-pinned, reviewable) — but the oracle is a CLOSED-FORM analytic check living in the test, asserting against the engine (NOT an iterative copy of the loop — that would not be independent).

**Closed-form FV-of-annuity solve-for-n** (RESEARCH §1 code example) — matches the contribute-then-grow convention; uses `Dec.ln` (verified available). Implement the **0%-return linear case FIRST** as the convention anchor (`n = ceil((target − seed)/contribution)`), assert EXACT `===` whole months; then the compounding case.

**High-inflation case MUST route through Fisher (`toReal`, D-11 / L2)** — from `rent-vs-buy.ts` lines 75–77:
```typescript
export function toReal(nominal: string, inflation: string): InstanceType<typeof Dec> {
  return new Dec(1).plus(new Dec(nominal)).div(new Dec(1).plus(new Dec(inflation))).minus(1);
}
```
Supply a NOMINAL return + high inflation, convert via `toReal`, feed the resulting real rate to BOTH the engine and the oracle. A high-inflation fixture with no `toReal` call tests nothing — document the case's purpose inline.

---

### `packages/core/src/fi/{projection,fi-impact,compare,sensitivity}.test.ts` (unit tests)

**Analog:** `affordability/gap.test.ts` / `evaluate-scenario.test.ts` (Vitest 4, `node` env, `describe`/`test`/`expect`). Build inputs via `engineInput({ asOf: calendarDate(...), assumptions: DEFAULT_ASSUMPTIONS, scenario, household })`. Quick run: `npx vitest run packages/core/src/fi`. Assert FI dates with exact `===` (no `toBeCloseTo` on whole-month dates — Pitfall 1 warning sign).

---

### `packages/core/src/engine/engine-input.ts` (MODIFY — model + boundary)

**Analog:** self — extend the existing `Household` interface + `HouseholdSchema` in place (the `currentAnnualSavings` leaf is the closest precedent for an annual dollar field).

**Add `targetAnnualRetirementSpend`** as a new dollar leaf. Mirror the existing pattern EXACTLY:
```typescript
// interface Household (lines 116–148): add a readonly STRING dollar leaf w/ doc comment
readonly targetAnnualRetirementSpend: string;  // annual, today's dollars (D-01)
// HouseholdSchema (lines 162–179): add a decStr leaf inside the .strict() object
targetAnnualRetirementSpend: decStr,
```
`parseHousehold` (lines 188–190) needs NO change — it validates through the schema. Keep `.strict()` (rejects unknown keys) and the `decStr` (no bare float). **Note (L5-adjacent):** adding a REQUIRED leaf changes the affordability golden's `FIXED_HOUSEHOLD` — either make the field optional or update `FIXED_HOUSEHOLD` in `golden.test.ts` and regenerate.

---

### `packages/core/src/assumptions/{schema,defaults,migrate}.ts` (MODIFY — config)

**Analog:** self — `AssumptionsV2` + `v1ToV2` are the exact template for `AssumptionsV3` + `v2ToV3`.

**`schema.ts`** — append a V3 object schema copying every V2 slice, bumping the literal to `3`, adding two new `group({...})` slices, every leaf a `decStr` (lines 91–141 are the template):
```typescript
export const AssumptionsV3 = z.object({
  schemaVersion: z.literal(3),
  /* ...every V2 slice copied verbatim... */
  sensitivity: group({                  // D-12/D-13: six driver bands (absolute or relative)
    returnBand: decStr, inflationBand: decStr, appreciationBand: decStr,
    maintenanceBand: decStr, taxBandRelative: decStr, swrBand: decStr,
  }),
  projection: group({ maxHorizonYears: decStr }),   // D-07 cap
}).strict();
// union + version (lines 147–164):
export const AssumptionSetSchema = z.discriminatedUnion('schemaVersion', [AssumptionsV1, AssumptionsV2, AssumptionsV3]);
export const CURRENT_VERSION = 3 as const;
export type AnyAssumptionSet = z.infer<typeof AssumptionsV1> | z.infer<typeof AssumptionsV2> | z.infer<typeof AssumptionsV3>;
export type CurrentAssumptionSet = z.infer<typeof AssumptionsV3>;
```
> Counts that are conceptually integers (`maxHorizonYears`) still cross as `decStr` if stored in the AssumptionSet — keep the no-`z.number()` discipline; convert to `Number()` only at the loop-bound boundary inside calc (the `downPaymentPct` `.refine` Number-comparison precedent, `engine-input.ts` lines 77–83).

**`migrate.ts`** — add a `case 2: return v2ToV3(set);` arm and a `v2ToV3` fn copying `v1ToV2` (lines 50–65): spread the old set, bump `schemaVersion: 3`, seed the new slices from `DEFAULT_ASSUMPTIONS`. Update `assertNever` message bound to `CURRENT_VERSION`.

**`defaults.ts`** — bump `schemaVersion: 3`, add the `sensitivity` + `projection` literals with `[ASSUMED] … pending user confirmation` comments (the existing comment style, lines 21–23, 50–69). Suggested values (D-12, Claude finalizes): `returnBand "0.015"`, `inflationBand "0.01"`, `appreciationBand "0.01"`, `maintenanceBand "0.005"`, `taxBandRelative "0.15"`, `swrBand "0.005"`, `maxHorizonYears "60"`.

**`migrate.test.ts`** — extend for the `v2ToV3` arm (the existing `v1ToV2` test is the template).

---

### `packages/core/src/golden.test.ts` (MODIFY) + `__fixtures__/fi-golden-snapshot.json`

**Analog:** self — `canonicalTcoResult` / `canonicalAffordabilityResult` (lines 120–134) + their `describe` blocks (lines 152–182) + the round-trip block (lines 203–213).

**Add an FI golden** mirroring `canonicalAffordabilityResult` + its gated `describe` (the `UPDATE_GOLDEN === '1'` write/compare branch, lines 168–182):
```typescript
function canonicalFiResult(input: EngineInput): string { return canonicalJson(fiImpact(input)); }
// new describe block + new FI_GOLDEN_PATH = resolve(here, '__fixtures__', 'fi-golden-snapshot.json')
```
Add a round-trip assertion through `parseHousehold` (lines 203–213) since `targetAnnualRetirementSpend` is a new household leaf that must survive serialize→re-parse byte-identically.

**L5 — V3 bump regenerates the THREE existing goldens.** `golden-snapshot.json`, `tco-golden-snapshot.json`, `affordability-golden-snapshot.json` all serialize the full assumptions; the new V3 slices change them. Plan a deliberate `UPDATE_GOLDEN=1 npx vitest run packages/core/src/golden.test.ts` + reviewed diff as its own task.

---

### `packages/core/src/index.ts` (MODIFY — barrel)

**Analog:** self — the per-phase export block (lines 56–103) + the `AssumptionsV2` re-export (lines 14–22).

Add an FI engine block mirroring the affordability block, re-exporting the public fns + closed result types. Add `AssumptionsV3` to the schema re-export. **`Dec`/`Decimal` stay UNEXPORTED** (lines 7–9 doc the rule). `FiOutcome`, the FI/delta/compare/tornado result types, and the engine fns are exported; no raw `Dec` type leaks.

---

## Shared Patterns

### Dec-then-Money (division / compounding boundary)
**Source:** `affordability/evaluate-scenario.ts` lines 55–60; `tco/property-tax.ts` line 54; `money/decimal-config.ts` lines 20–23.
**Apply to:** `fi-target.ts`, `projection.ts`, `fi-impact.ts`, `compare.ts`, `sensitivity.ts`, `oracle.test.ts`.
```typescript
import { Dec } from '../money/decimal-config.js';
import { Money } from '../money/money.js';
// math in Dec; cross to Money ONCE: Money.of(d.toFixed()); Money has NO div — divide in Dec.
```

### `.strict()` decimal-string Zod boundary
**Source:** `engine/engine-input.ts` lines 162–179 (`HouseholdSchema`); `assumptions/schema.ts` lines 32–37, 91–141.
**Apply to:** the `targetAnnualRetirementSpend` leaf and every new V3 assumption leaf.
```typescript
const group = <Shape extends z.ZodRawShape>(shape: Shape) => z.object(shape).strict();
// every leaf: decStr (NEVER z.number()); the whole object .strict() (rejects unknown keys)
```

### Discriminated-union result for "unreachable" (no sentinel)
**Source:** `affordability/gap.ts` lines 43, 96–101 (string-literal enum, no UI copy); `serialize/canonical-json.ts` (throws on non-finite — the forcing function).
**Apply to:** `projection.ts` (`FiOutcome`), `compare.ts`, `sensitivity.ts`, `fi.type-test.ts`.
```typescript
type FiOutcome =
  | { readonly kind: 'reached'; readonly month: number; readonly years: number }
  | { readonly kind: 'unreached'; readonly cappedAtMonth: number };
```

### Versioned schema bump (V2→V3 + migrate arm)
**Source:** `assumptions/schema.ts` lines 91–164; `assumptions/migrate.ts` lines 28–65.
**Apply to:** `schema.ts`, `migrate.ts`, `defaults.ts`, `migrate.test.ts`.
Append one object schema to the `discriminatedUnion`, bump `CURRENT_VERSION`, add a `case 2: return v2ToV3(set)` arm copying `v1ToV2`, seed new slices from `DEFAULT_ASSUMPTIONS`.

### No-bare-number type-test guard
**Source:** `tco/tco.type-test.ts`; `affordability/affordability.type-test.ts`.
**Apply to:** `fi.type-test.ts`.
Each `@ts-expect-error` asserts a misuse compiles to an error — Money→number read, number→Money set, plain-object→Money, decimal-string→number.

### Gated golden master (never `toMatchSnapshot`)
**Source:** `golden.test.ts` lines 136–182 (`UPDATE_GOLDEN === '1'` write/compare) + round-trip lines 184–249.
**Apply to:** the new FI golden block + `fi-golden-snapshot.json`.

---

## No Analog Found

None. Every new file maps to an existing in-repo analog (this phase is composition over a proven substrate). The two files with the weakest analog are flagged below — both have a close-enough role-match plus a documented research pattern to follow:

| File | Role | Data Flow | Note |
|------|------|-----------|------|
| `fi/oracle.test.ts` | test (independent oracle) | — | No closed-form oracle exists in the repo yet; pattern = gated/hand-pinned `golden.test.ts` + the FV-of-annuity derivation in RESEARCH §1 (the oracle math is intentionally NEW and INDEPENDENT — that independence is the point of D-10). |
| `fi/sensitivity.ts` | service (grid sweep) | batch | No tornado exists yet; architecture = the "pure-fn re-run per step" idiom from `buyMonthlyOutflowAt` + the composer shape from `gap.ts`. |

---

## Metadata

**Analog search scope:** `packages/core/src/{tco,affordability,engine,assumptions,money,serialize}/`, `packages/core/src/index.ts`, `packages/core/src/golden.test.ts`.
**Files read this session:** `tco/rent-vs-buy.ts`, `tco/carrying-costs.ts`, `tco/property-tax.ts`, `tco/tco.type-test.ts`, `engine/engine-input.ts`, `assumptions/{schema,defaults,migrate,assumption-set}.ts`, `affordability/{evaluate-scenario,gap,affordability.type-test}.ts`, `money/decimal-config.ts`, `index.ts`, `golden.test.ts`.
**Pattern extraction date:** 2026-06-26
