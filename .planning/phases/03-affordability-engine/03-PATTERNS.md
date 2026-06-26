# Phase 3: Affordability Engine - Pattern Map

**Mapped:** 2026-06-26
**Files analyzed:** 13 (8 new, 5 modified/extended)
**Analogs found:** 13 / 13 (every new/modified file has a strong in-repo analog)

All work lands in `packages/core/src/` (pure calc core, zero framework deps). No UI, DB, or
network tier touched. Every dollar crosses a boundary as `Money`; all ratio/solve/comparison
math is done in the internal `Dec` (never re-exported, never a bare `number`).

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `affordability/dti.ts` (NEW) | utility (pure derivation) | transform | `tco/rent-vs-buy.ts` (`buyMonthlyOutflowAt` — TCO-line subset → `Money`) | role-match (exact discipline) |
| `affordability/dti.test.ts` (NEW) | test (worked-example) | transform | `tco/tco.test.ts` / `tco/property-tax.test.ts` | exact |
| `affordability/bank-affordability.ts` (NEW) | service (solver) | batch/iterative | `tco/rent-vs-buy.ts` (`rentVsBuy` — Dec loop driving `computeTco`) | role-match |
| `affordability/bank-affordability.test.ts` (NEW) | test (solver + property) | batch | `tco/rent-vs-buy.test.ts` | exact |
| `affordability/true-affordability.ts` (NEW) | service (solver + gate) | batch/iterative | `tco/rent-vs-buy.ts` + `tco/closing-costs.ts` | role-match |
| `affordability/true-affordability.test.ts` (NEW) | test (floor + gate) | batch | `tco/rent-vs-buy.test.ts` | exact |
| `affordability/gap.ts` (NEW) | service (composer + verdict enum) | transform | `tco/rent-vs-buy.ts` (`RentVsBuyResult` + `winner` enum) | role-match |
| `affordability/gap.test.ts` (NEW) | test (verdict incl. anti-funnel) | transform | `tco/rent-vs-buy.test.ts` (rent-wins acceptance) | exact |
| `affordability/evaluate-scenario.ts` (NEW, D-06) | service (per-scenario report) | request-response | `tco/tco.ts` (`computeTco` single pass) | role-match |
| `affordability/evaluate-scenario.test.ts` (NEW) | test | request-response | `tco/tco.test.ts` | exact |
| `affordability/affordability.type-test.ts` (NEW) | type-test (no-bare-number guard) | — | `tco/tco.type-test.ts` | exact |
| `engine/engine-input.ts` (MODIFY) | model + boundary (Zod) | transform | `ScenarioInputs`/`ScenarioInputsSchema`/`parseScenarioInputs` in the SAME file | exact (in-file twin) |
| `engine/engine-input.test.ts` (MODIFY) | test (boundary validation) | transform | the `parseScenarioInputs` describe-block in the SAME file | exact |
| `engine/engine-input.type-test.ts` (MODIFY) | type-test | — | the same file (extend SCENARIO/EngineInput guards) | exact |
| `index.ts` (MODIFY) | config (public barrel) | — | the existing TCO export block in the SAME file | exact |
| `golden.test.ts` (MODIFY) + `__fixtures__/affordability-golden-snapshot.json` (NEW) | test (golden-master) | — | `golden.test.ts` `canonicalTcoResult` + `roundTrip` in the SAME file | exact (extend in place) |

## Shared Patterns

These cross-cutting patterns apply to MOST new files. Copy them once; the planner should
reference them from each plan's action section rather than re-describing them.

### Shared P1: Internal `Dec` for all ratio/solve/comparison math; `Money` only at boundaries
**Source:** `tco/rent-vs-buy.ts` lines 43-51 (imports), 75-86 (Dec math), 231-289 (Dec loop +
`Money.of(dec.toFixed())` at the boundary); `money/decimal-config.ts` lines 18-25.
**Apply to:** dti.ts, bank-affordability.ts, true-affordability.ts, gap.ts, evaluate-scenario.ts.

`Dec` is the frozen 34-digit HALF_EVEN clone. It is NEVER exported from `index.ts` (see
`index.ts` lines 6-9). All division, ratios, and comparisons happen on `Dec` instances:
```typescript
import { Dec } from '../money/decimal-config.js';
import { Money } from '../money/money.js';
// ratio = numerator / denominator, in Dec:
const ratio = new Dec(numeratorMoney.toDecimalString()).div(new Dec(grossMonthly));
// comparison (Dec has greaterThan / lessThan / greaterThanOrEqualTo — see rent-vs-buy L234,273):
if (ratio.greaterThan(new Dec(threshold))) { /* fails */ }
// cross to Money ONLY at the result boundary:
const price = Money.of(low.toDecimalPlaces(2, Dec.ROUND_HALF_EVEN).toFixed());
```
**The closed `Money` API has no `div`, no comparison, no `pow`** (`money/money.ts` lines 34-90 —
only `add`/`sub`/`mul(rateStr)`/`percentOf`/`toCents`/`toDecimalString`/`toString`). Per
CONTEXT D-15/RESEARCH Pattern-2-vs-closed-form: **do NOT widen `Money`** — do ratio/solve math in
`Dec`. To pull a dollar value into `Dec` use `new Dec(money.toDecimalString())` (the exact bridge
`rent-vs-buy.ts` uses at lines 215, 231, 253, 258).

### Shared P2: The per-trial-price `EngineInput` rebuild (the solver inner loop)
**Source:** `tco/tco.ts` lines 132-154 (how `computeTco` consumes `scenario.price` /
`downPaymentPct`); `engine/engine-input.ts` lines 122-134 (`engineInput()` factory).
**Apply to:** bank-affordability.ts, true-affordability.ts.

Each solver trial derives `downPaymentPct = downPaymentCash / price` in `Dec` (D-07/D-08), rebuilds
a frozen `EngineInput` with the trial `price` + derived `downPaymentPct`, and calls `computeTco`
unchanged — NEVER re-derives amortization (anti-pattern, RESEARCH "Don't Hand-Roll"). Note the
loan derivation `computeTco` already does at `tco.ts` line 154:
`loan = price × (1 − downPaymentPct)`.
```typescript
function inputAtPrice(base: EngineInput, price: string): EngineInput {
  const pct = new Dec(base.household!.downPaymentCash).div(new Dec(price)).toFixed();
  return engineInput({
    asOf: base.asOf,
    assumptions: base.assumptions,
    household: base.household,                       // carried through (optional-on-input, A3)
    scenario: { ...base.scenario, price, downPaymentPct: pct },
  });
}
const tco = computeTco(inputAtPrice(base, trialPrice));
```
**Pitfall guard (RESEARCH Pitfall 3):** keep the binary-search low bound strictly above
`downPaymentCash` so `pct < 1` always — `ScenarioInputsSchema.downPaymentPct` refines to `[0,1)`
(`engine-input.ts` lines 77-83) and `engineInput()` will THROW mid-solve on `pct ≥ 1`.

### Shared P3: Two distinct TCO-line numerators (the D-14 gating split)
**Source:** `tco/rent-vs-buy.ts` lines 127-160 (`buyMonthlyOutflowAt` — the precedent for
excluding `amortizedClosing` and selecting a TCO-line SUBSET); `tco/tco.ts` lines 64-93
(`TcoBreakdown` line names: `principalAndInterest`, `propertyTax`, `insurance`, `maintenance`,
`hoa`, `pmi`, `amortizedClosing`, `total`, each a `TcoLine { monthly; annualized }`).
**Apply to:** dti.ts (lender numerator) and true-affordability.ts (savings drain).

Two SEPARATELY-NAMED functions, never `tco.total` blindly:
```typescript
// LENDER DTI carrying cost (D-14, Pitfall 1): P+I + tax + insurance + PMI + HOA.
// EXCLUDES maintenance (not a lender input) AND amortizedClosing (t=0 lump).
function lenderDtiCarryingCost(tco: TcoBreakdown): Money {
  return tco.principalAndInterest.monthly
    .add(tco.propertyTax.monthly)
    .add(tco.insurance.monthly)
    .add(tco.pmi.monthly)
    .add(tco.hoa.monthly);
}
// CASH SAVINGS DRAIN (D-03/D-14): total − amortizedClosing. KEEPS maintenance; excludes only
// the t=0 closing lump — exactly buyMonthlyOutflowAt's exclusion (rent-vs-buy.ts L110-160).
function cashSavingsDrain(tco: TcoBreakdown): Money {
  return tco.total.monthly.sub(tco.amortizedClosing.monthly);
}
```
`Money.add`/`Money.sub` take a `Money` (`money/money.ts` lines 53-60). Each numerator MUST get its
own hand-verified worked-example fixture (RESEARCH §Validation, Pitfall 4).

### Shared P4: DTI thresholds are assumptions, not household facts
**Source:** `assumptions/schema.ts` lines 101-103 (`dti: group({ frontEnd: decStr, backEnd: decStr })`),
line 96 (`tax.effectiveIncomeRate: decStr`). Read via `input.assumptions.dti.frontEnd` /
`.dti.backEnd` (the same `input.assumptions.*` access `computeTco` uses at `tco.ts` lines 146-150).
**Apply to:** dti.ts, bank-affordability.ts. **Never** add household facts to the AssumptionSet
(D-09, RESEARCH anti-pattern). `dti.frontEnd` = "0.28", `dti.backEnd` = "0.36" in defaults.

## Pattern Assignments

### `engine/engine-input.ts` (MODIFY — model + Zod boundary, D-09)

**Analog: the `ScenarioInputs` triad in the SAME file** — copy it verbatim in structure for the new
`household` block. Three pieces, each mirrored:

**(1) Interface** — mirror `ScenarioInputs` (`engine-input.ts` lines 28-53). Every dollar leaf is a
canonical decimal STRING, counts are bare `number`. Fields (RESEARCH §Code Examples + D-10, D-17):
`grossAnnualIncome`, `existingMonthlyDebt`, `targetSavingsRate`, `availableNetWorth`,
`currentRent`, `downPaymentCash`, `reserve`, **`currentAnnualSavings` (D-17 — required for the
well-defined savings-rate floor)**.

**(2) Zod schema** — mirror `ScenarioInputsSchema` (`engine-input.ts` lines 73-94) exactly:
```typescript
export const HouseholdSchema = z
  .object({
    grossAnnualIncome: decStr,
    existingMonthlyDebt: decStr,
    targetSavingsRate: decStr.refine(            // copy the downPaymentPct [0,1) refine, L77-83
      (s) => { const n = Number(s); return n >= 0 && n < 1; },
      { message: 'targetSavingsRate must be in [0,1)' },
    ),
    availableNetWorth: decStr,
    currentRent: decStr,
    downPaymentCash: decStr,
    reserve: decStr,
    currentAnnualSavings: decStr,                // D-17
  })
  .strict();                                     // T-07-03: reject unknown keys
```
`decStr` is imported already at `engine-input.ts` line 16 (from `../assumptions/schema.js`).

**(3) Loader** — mirror `parseScenarioInputs` (`engine-input.ts` lines 103-105):
```typescript
export function parseHousehold(input: unknown): Household {
  return HouseholdSchema.parse(input) as Household;
}
```

**(4) Wire into `EngineInput` + `engineInput()`** — extend the interface (lines 111-115) and the
factory (lines 122-134). **Per RESEARCH A3 (recommended): make `household` OPTIONAL on
`EngineInput`/`engineInput()`** so existing TCO-only call sites (and the byte-identical
`tco-golden-snapshot.json`) need no change; the affordability entry points require/validate it.
The factory validates only when present, mirroring line 132's `parseScenarioInputs`:
```typescript
household: parts.household ? Object.freeze(parseHousehold(parts.household)) : undefined,
```

### `engine/engine-input.test.ts` (MODIFY — boundary validation)

**Analog: the `parseScenarioInputs` describe-block in the SAME file** (lines 90-184). Copy its
exact shape for `parseHousehold`: a `VALID_HOUSEHOLD` const (mirror `VALID_SCENARIO` L25-36), an
ACCEPTS-well-formed test (L91-94), REJECTS non-canonical decStr (L144-160), REJECTS `.strict()`
extra key (L163-167), REJECTS missing required field (L174-178), and the `targetSavingsRate ∈
[0,1)` range cases mirroring the `downPaymentPct` block (L126-142). Also extend the `engineInput`
factory tests (L44-88) to pass a `household` and assert it round-trips/freezes.

### `affordability/dti.ts` (utility — transform)

**Analog: `tco/rent-vs-buy.ts` `buyMonthlyOutflowAt`** (lines 127-160). See **Shared P3** for
`lenderDtiCarryingCost`. Then the two ratio functions (RESEARCH Pattern 1), computed in `Dec`
(**Shared P1**), against gross MONTHLY income (`grossAnnualIncome ÷ 12` in `Dec`):
- `frontEndRatio = lenderDtiCarryingCost / grossMonthly`
- `backEndRatio = (lenderDtiCarryingCost + existingMonthlyDebt) / grossMonthly`

Use gross, never net (Pitfall 2 — no `× (1 − taxRate)` near the denominator).

### `affordability/bank-affordability.ts` (service — iterative solver)

**Analog: `tco/rent-vs-buy.ts` `rentVsBuy`** (lines 170-289 — the Dec loop that drives `computeTco`
and crosses to `Money` only at the boundary). Use **Shared P2** (per-trial input rebuild) and
**Shared P4** (read `assumptions.dti.*`). Monotonic binary search to the cent (RESEARCH §Code
Examples "Monotonic binary search"): `passes(price)` = both `frontEndRatio ≤ dti.frontEnd` AND
`backEndRatio ≤ dti.backEnd`; exponential-bracket `high` until it fails; bisect until
`high − low ≤ 0.01`; return `Money.of(low.toDecimalPlaces(2, Dec.ROUND_HALF_EVEN).toFixed())`
(the exact `pinToCents` idiom from `tco.ts` lines 106-108). Report `bankMaxPrice`,
`bankMaxLoan = price − downPaymentCash`, the binding ratio, and both ratios at the solved price.

### `affordability/true-affordability.ts` (service — solver + gate)

**Analogs:** `tco/rent-vs-buy.ts` (the Dec solve loop) + `tco/closing-costs.ts` `closingCosts`
(lines 33-38) for the cash gate. Two ceilings, `min` of them (D-05):
- **Ceiling A (savings floor):** `cashSavingsDrain` (**Shared P3**), then
  `annualPremium = (drain_monthly − currentRent) × 12` (D-03); `postPurchaseAnnualSavings(price) =
  currentAnnualSavings − annualPremium` (D-17); binary-search the max price where
  `postPurchaseAnnualSavings / grossAnnualIncome ≥ targetSavingsRate` (D-04), all in `Dec`.
- **Ceiling B (cash gate, D-05):** `downPaymentCash + closingCosts(price, assumptions.closing.rateOfPrice,
  override) ≤ availableNetWorth − reserve`. Same binary-search solver shared with A.

`reserve` is a household field consumed as-is (no engine default — RESEARCH Assumption A1).

### `affordability/gap.ts` (service — composer + verdict enum)

**Analog: `tco/rent-vs-buy.ts` `RentVsBuyResult` + the `winner` enum** (interface lines 56-67;
enum derivation lines 282-287 — exact-cent comparison via `Money.toCents()` bigints). Mirror that
verdict idiom for the directional verdict (D-13):
```typescript
type AffordabilityVerdict = 'bankExceedsTrue' | 'trueExceedsBank' | 'aligned';
```
Compose `bankAffordability` + `trueAffordability`, compute `signedGap = bankMaxPrice − trueMaxPrice`
(in `Dec`), surface `bankBindingRatio` + `trueBindingConstraint`, and pick the verdict with a
documented "aligned" tolerance (RESEARCH A2 — e.g. within $1,000; pin with a fixture). Compare on
`toCents()` bigints exactly as `rent-vs-buy.ts` lines 283-286.

### `affordability/evaluate-scenario.ts` (service — request-response, D-06)

**Analog: `tco/tco.ts` `computeTco`** (single-pass aggregator, lines 132-236). One `computeTco`
call on a priced `ScenarioInputs`, then report `{ frontEndRatio, backEndRatio, frontEndPass,
backEndPass, savingsRateImpact, headroom }` — reusing dti.ts + the `cashSavingsDrain`.

### `affordability/affordability.type-test.ts` (type-test — no-bare-number guard)

**Analog: `tco/tco.type-test.ts`** (entire file, lines 1-53). Copy verbatim in structure: NOT a
`*.test.ts` (stays in the `tsc -b` graph, out of Vitest); `declare const` typed handles to each
result shape; `@ts-expect-error` asserting (1) a `Money` field is not assignable to `number`,
(2) a result field cannot be SET from a bare number, (3) a plain object is not a branded `Money`.
Apply to every dollar field on the bank/true/gap/evaluate result types.

### `golden.test.ts` (MODIFY) + `__fixtures__/affordability-golden-snapshot.json` (NEW)

**Analog: the `canonicalTcoResult` + `roundTrip` machinery in the SAME file** (lines 96-178).
- Add an affordability golden block mirroring the TCO golden test (lines 118-132): build a fixed
  input with a `household`, run the gap composer, `canonicalJson` it, gate regeneration on
  `process.env.UPDATE_GOLDEN === '1'` writing to a new `AFFORDABILITY_GOLDEN_PATH`. **Never**
  `toMatchSnapshot` (lines 17-20, 122).
- Extend `FIXED_SCENARIO`/`fixedInput` (lines 54-77) and the `roundTrip` serializer (lines 164-178)
  to carry `household` through `parseHousehold` (Pitfall 5 — lossless round-trip). The existing
  `tco-golden-snapshot.json` stays byte-identical (TCO ignores `household`); verify with a no-diff
  `UPDATE_GOLDEN` run.

### `index.ts` (MODIFY — public barrel)

**Analog: the TCO export block in the SAME file** (lines 50-64). Append a parallel affordability
block: the four entry functions + their result types + the `AffordabilityVerdict` enum, plus the
`Household` type / `HouseholdSchema` / `parseHousehold` (mirroring the `ScenarioInputs` export at
lines 32-38). **Do NOT export `Dec`** (the deliberate omission documented at lines 6-9).

## No Analog Found

None. Every new file maps to a strong in-repo analog; every modified file extends an in-file twin.
Phase 3 is pure composition of Phase 1/2 primitives — there is no novel role or data-flow without
precedent in `packages/core/src/`.

## Metadata

**Analog search scope:** `packages/core/src/` (engine/, tco/, money/, assumptions/, serialize/).
**Files scanned:** 11 read in full (engine-input.ts, engine-input.test.ts, engine-input.type-test.ts,
tco.ts, tco.type-test.ts, rent-vs-buy.ts, closing-costs.ts, money.ts, decimal-config.ts,
golden.test.ts, index.ts) + grep over assumptions/schema.ts.
**Pattern extraction date:** 2026-06-26
