---
phase: 02-tco-engine
reviewed: 2026-06-25T15:17:13Z
depth: standard
files_reviewed: 14
files_reviewed_list:
  - packages/core/src/assumptions/defaults.ts
  - packages/core/src/assumptions/migrate.ts
  - packages/core/src/assumptions/schema.ts
  - packages/core/src/engine/engine-input.ts
  - packages/core/src/index.ts
  - packages/core/src/tco/amortization.ts
  - packages/core/src/tco/carrying-costs.ts
  - packages/core/src/tco/closing-costs.ts
  - packages/core/src/tco/pmi.ts
  - packages/core/src/tco/property-tax.ts
  - packages/core/src/tco/rent-vs-buy.ts
  - packages/core/src/tco/tco.ts
  - packages/core/src/towns/town-table.schema.ts
  - packages/core/src/towns/town-table.ts
findings:
  critical: 3
  warning: 7
  info: 5
  total: 15
status: issues_found
---

# Phase 02: Code Review Report

**Reviewed:** 2026-06-25T15:17:13Z
**Depth:** standard
**Files Reviewed:** 14
**Status:** issues_found

## Summary

This is the TCO (total-cost-of-ownership) calculation core. The decimal.js (`Dec`) / `Money`
discipline is consistently and impressively applied: no bare JS `number` math touches money or
rates anywhere in the reviewed files, full precision is retained through intermediates, cents are
pinned at documented boundaries, and the golden/oracle tests are exact-equality. The amortization
reconciliation, PMI gating, property-tax mill-rate model, and rent-vs-buy symmetry are all
modeled correctly for the *happy path*, and the test suite proves those happy paths to the cent.

The defects are concentrated at the **input boundary** and **edge of the input domain**. The
central structural gap: `ScenarioInputs` is a TypeScript-only interface with **no runtime Zod
validation** (unlike `AssumptionSet`, which is rigorously gated). `engineInput()` freezes raw,
untrusted strings and numbers straight into the calc. Several numeric inputs that the type system
permits — and that a persisted/forged snapshot could carry — drive the engine into divide-by-zero,
out-of-bounds array access, or silently wrong results. Because "financial correctness is the whole
product" and snapshots are a stated trust boundary (T-03-01), these boundary gaps are BLOCKERs, not
style nits.

## Critical Issues

### CR-01: `rentVsBuy` reads past the end of the amortization schedule when `holdingYears × 12 > termMonths`

**File:** `packages/core/src/tco/rent-vs-buy.ts:133,175`
**Issue:** `totalMonths = holdingYears * 12` drives the projection loop, but the amortization
schedule has exactly `termMonths` rows. When the hold outlasts the loan term (e.g. `holdingYears: 31`
with `termMonths: 360`, or any 15-year loan held > 15 years), the loop runs to `month = 372` while
`schedule.rows` has 360 entries. At line 175:

```ts
const remainingBalance = new Dec(schedule.rows[month - 1]!.balance.toDecimalString());
```

`schedule.rows[371]` is `undefined`; the `!` non-null assertion suppresses the TS guard, so this
throws `TypeError: Cannot read properties of undefined (reading 'balance')` at runtime. A
held-past-payoff house is a completely realistic scenario (the loan is paid off, equity = full home
value), and `holdingYears`/`termMonths` are unvalidated `number`s. This is a hard crash on valid input.

**Fix:** Once the loan is paid off the remaining balance is `$0.00`. Clamp the row index and treat
out-of-range months as a zero balance:

```ts
const lastIdx = schedule.rows.length - 1;
const row = month - 1 <= lastIdx ? schedule.rows[month - 1]! : undefined;
const remainingBalance = row
  ? new Dec(row.balance.toDecimalString())
  : new Dec(0); // loan fully amortized before the hold ended
```

Add a rent-vs-buy test with `holdingYears` exceeding the loan term to lock this in.

### CR-02: Division-by-zero on a 0% loan in `scheduledPayment` / `amortizationSchedule`

**File:** `packages/core/src/tco/amortization.ts:57-62,82-87`
**Issue:** The closed-form payment `M = P·r·(1+r)^n / ((1+r)^n − 1)` is undefined when the monthly
rate `r = 0`: `pow = (1+0)^n = 1`, so the denominator `pow.minus(1)` is `0` and `div(0)` throws
(decimal.js raises on divide-by-zero). `annualRate` is an unvalidated string; `"0"` is a perfectly
canonical decimal that `Money`/`decStr` accept, and a 0%-interest scenario (seller financing, an
interest-free family loan, or simply a user typo) is a legitimate input. The engine crashes instead
of returning the trivially-correct level payment `P / n`.

**Fix:** Special-case a zero rate before the closed form:

```ts
export function scheduledPayment(loan: string, annualRate: string, termMonths: number): Money {
  const r = monthlyRate(annualRate);
  if (r.isZero()) {
    return Money.of(new Dec(loan).div(termMonths).toFixed());
  }
  const pow = new Dec(1).plus(r).pow(termMonths);
  const m = new Dec(loan).times(r).times(pow).div(pow.minus(1));
  return Money.of(m.toFixed());
}
```

Apply the same guard in `amortizationSchedule` (the `paymentDec` computation has the identical
`div(...minus(1))` denominator). This affects `computeTco` and `rentVsBuy` transitively, since both
build a schedule.

### CR-03: `ScenarioInputs` crosses the calc boundary with no runtime validation (forged-snapshot trust gap)

**File:** `packages/core/src/engine/engine-input.ts:26-78`
**Issue:** `AssumptionSet` is gated by Zod at the serialization boundary (T-03-01/02/03), but
`ScenarioInputs` is a *type-only* interface. `engineInput()` does `Object.freeze({ ...scenario })`
with zero validation, and the golden round-trip harness (`golden.test.ts:166`) passes
`snapshot.scenario` straight through with only a TypeScript cast (`as ScenarioInputs`) — no parse.
A persisted or forged snapshot can therefore carry:

- a non-canonical / non-numeric `price`, `downPaymentPct`, `annualRate`, etc. (only caught much later,
  if at all, by `Money.of` — and only on fields that actually reach a `Money.of` call on that exact run);
- a negative `termMonths` / `holdingYears` (negative-length loops silently produce empty schedules and
  zeroed totals — a wrong, non-throwing result);
- `downPaymentPct` of `"1.5"` (loan goes negative) or `"1"` (loan = 0, then CR-02-style div-by-zero);
- `termMonths` of `0` (div-by-zero / empty schedule).

This defeats the stated guarantee that snapshots are validated at the trust boundary, and means
"reproducible from a snapshot" is not actually safe against a corrupt snapshot — the exact threat the
`AssumptionSet` schema was built to stop.

**Fix:** Add a `ScenarioInputsSchema` (Zod) mirroring the `AssumptionSet` pattern: every dollar/rate
field a `decStr`, `termMonths`/`holdingYears` as `z.number().int().positive()`, `downPaymentPct`
constrained to `[0, 1)`, optional fields validated when present. Parse it in `engineInput()` (or expose
a `parseScenarioInputs()` the snapshot loader must call), and use it in `roundTrip()` instead of the
bare cast.

## Warnings

### WR-01: `downPaymentPct >= 1` silently produces a zero or negative loan

**File:** `packages/core/src/tco/tco.ts:129`, `packages/core/src/tco/rent-vs-buy.ts:125`
**Issue:** `loan = price × (1 − downPaymentPct)`. With `downPaymentPct = "1"` the loan is `0`
(`scheduledPayment` then hits CR-02 div-by-zero via `pow.minus(1)` only if rate>0, but with loan=0 the
numerator is 0 → `0/0` NaN-ish throw); with `downPaymentPct = "1.5"` the loan is *negative* and the
amortization schedule produces negative interest/principal with no error. Nothing rejects an
all-cash or over-100% down payment.

**Fix:** Validate `downPaymentPct ∈ [0, 1)` in the `ScenarioInputs` schema (CR-03). If all-cash
(`downPaymentPct = 1`) is a desired scenario, short-circuit: zero P+I, zero PMI, no schedule.

### WR-02: PMI premium is charged on the original loan for the entire hold, never dropping at `dropOffMonth`

**File:** `packages/core/src/tco/tco.ts:160`, `packages/core/src/tco/pmi.ts:71-72`
**Issue:** `computePmi` correctly computes `dropOffMonth` (the month PMI legally terminates), but
`computeTco` annualizes PMI as `monthlyPremium × 12` and the rent-vs-buy monthly outflow uses that
flat figure for *every* month of the hold. So a borrower who hits 78% LTV at month 108 is still
modeled as paying PMI in year 20. This overstates ownership cost and biases the rent-vs-buy verdict
toward "rent" — a correctness error in the flagship comparison, even though it is conservative. The
year-0 breakdown is defensible (PMI is active at t=0), but `rentVsBuy` holding it flat across the
whole hold is not. `dropOffMonth` is computed and then effectively ignored by every consumer.

**Fix:** In `rentVsBuy`, drop the PMI component from `buyMonthlyOutflow` once `month >= dropOffMonth`
(or model PMI as a separate term in the monthly loop rather than baking it into the flat TCO total).
At minimum, document that the flat-PMI approximation is a known overstatement and assert it in a test.

### WR-03: Maintenance, insurance, HOA, and PMI are held flat at the year-0 figure across the entire hold in `rentVsBuy`

**File:** `packages/core/src/tco/rent-vs-buy.ts:121-122`
**Issue:** `buyMonthlyOutflow` is the **year-0** `computeTco` total (minus amortized closing), held
constant for all `holdingYears`. But the property-tax and maintenance modules explicitly model these
as *growing with the appreciating home value* year over year (`assessedValueAt`, `homeValueAt`,
`propertyTaxSchedule`). The rent side, by contrast, *does* grow (`currentRent` compounds monthly).
This is an asymmetry: rent inflates but the buyer's tax/maintenance do not, biasing the comparison
toward "buy". Given the module's own header rails against "opportunity-cost asymmetry that biases
toward buy" (Pitfall 6), holding the buy outflow flat while growing rent is the same class of bug in
the opposite direction.

**Fix:** Either recompute the buy monthly outflow per hold year from the per-year property-tax and
carrying-cost schedules, or (if a flat-outflow simplification is intentional) hold rent flat too and
document the simplification. As written, the two sides use inconsistent growth assumptions.

### WR-04: `migrate` re-validates with the V2-only return type but `parseAssumptionSet` returns `AnyAssumptionSet`

**File:** `packages/core/src/assumptions/migrate.ts:26,35`
**Issue:** `parseAssumptionSet(input)` returns `AnyAssumptionSet` (V1 | V2). In the `case 2:` arm the
code does `return set;` where `set` is narrowed to the V2 member — fine. But the function is declared
`: CurrentAssumptionSet` and the `default:` arm calls `assertNever(set)`. If a *third* version is ever
added to the discriminated union but a `case` is forgotten here, `assertNever`'s parameter stops being
`never` and this becomes a silent compile error only — at runtime an unhandled version would fall to
`default` and throw with a confusing message. This is acceptable today (only 2 versions) but the
exhaustiveness guard depends entirely on the union type staying narrow; the comment in `schema.ts:155`
notes the union inference "degrades to `any`" under some Zod conditions, which would quietly disable
this guard.

**Fix:** Add a test that feeds a `{ schemaVersion: 3, ... }` object (cast through `unknown`) and asserts
`migrate` throws, so the runtime guard is proven independent of the type-level exhaustiveness.

### WR-05: `crossoverYear` (`>=`) and `winner` (`>`) use inconsistent comparison at exact ties

**File:** `packages/core/src/tco/rent-vs-buy.ts:190,202-203`
**Issue:** `crossoverYear` is "first year buy ending NW `>=` rent ending NW", but `winner` is computed
with strict `>` (tie → `'tie'`). So at the horizon a *tie* yields `winner === 'tie'` yet
`crossoverYear` may be set (the `>=` matched). A consumer reading "crossover at year N but winner is
tie" gets a subtly contradictory result. Also, crossover compares the full `Dec` values while winner
compares `toCents()` bigints — at a sub-cent margin the two can disagree about whether buy caught up.

**Fix:** Pick one comparison basis (cents) and one inequality, and make crossover/winner consistent —
e.g. crossover = first year `buyCents >= rentCents`, winner derived from the same cents at the horizon.

### WR-06: `amortizeOverHold` and the rent-vs-buy loop throw on `holdingYears = 0` (no zero-hold guard)

**File:** `packages/core/src/tco/closing-costs.ts:50-51`, `packages/core/src/tco/rent-vs-buy.ts:184-185`
**Issue:** `amortizeOverHold` divides by `holdingYears` and `holdingYears * 12`; `holdingYears = 0`
(unvalidated) is a divide-by-zero throw. In `rentVsBuy`, `holdingYears = 0` makes `totalMonths = 0`,
the year loop never executes, and `buyEndingByYear[holdingYears - 1]` is `buyEndingByYear[-1]` →
`undefined`, then `!` → the `.toFixed()` throws. Neither path validates the count.

**Fix:** Validate `holdingYears >= 1` in the `ScenarioInputs` schema (CR-03), and/or guard
`amortizeOverHold` to return zero lines for a zero/undefined hold.

### WR-07: `assessmentRatio` and other rates accepted unbounded — negative/absurd values silently flow through

**File:** `packages/core/src/assumptions/schema.ts:32-34,98`, `packages/core/src/tco/property-tax.ts:69`
**Issue:** `decStr` only enforces *canonical decimal string shape* (`/^-?\d+(\.\d+)?$/`) — it accepts
`"-0.5"`, `"99"`, `"-1"`. Nothing bounds `assessmentRatio`, `appreciation.realAnnual`,
`propertyRateAnnual`, `sellCostPct`, etc. A negative `sellCostPct` makes a sale *add* money;
`sellCostPct > 1` makes liquidated equity negative; a negative `appreciationRealAnnual` of `< -1`
makes `(1 + r)` negative and `(1+r)^year` oscillate sign. These are assumption-level inputs (somewhat
more trusted), but the schema advertises itself as the trust boundary against forged snapshots
(T-03-02), and shape-only validation lets economically-impossible values through silently.

**Fix:** Add `.refine(...)` bounds on the economically-constrained leaves (e.g. ratios in `[0, 1]`,
appreciation `> -1`), or layer a domain-validation pass after parse. At minimum document that `decStr`
is shape-only and does not constrain sign/magnitude.

## Info

### IN-01: `percentOf` is an unused dead alias of `mul`

**File:** `packages/core/src/money/money.ts:69-71`
**Issue:** `percentOf(rate)` simply calls `this.mul(rate)` and is not referenced anywhere in the
reviewed TCO modules (all call `.mul(...)` directly). Dead-but-exported API surface.
**Fix:** Remove it, or document why both names exist (semantic intent at call sites).

### IN-02: `toReal` is exported and tested but never consumed by the engine

**File:** `packages/core/src/tco/rent-vs-buy.ts:71-73`
**Issue:** The all-real convention (D-02) means `toReal` is never called in production paths — the
header comment says as much. It exists only for a hypothetical nominal-knob future and is exercised
only by its own unit test. This is intentional per the design notes, but it is effectively dead code
in the shipped engine.
**Fix:** Keep if a nominal input is genuinely imminent; otherwise consider removing to shrink the
public surface (it is exported via `rent-vs-buy.js`). Document the "kept for future nominal knob"
rationale at the export site if retained.

### IN-03: Town lookup is case- and whitespace-sensitive with no normalization

**File:** `packages/core/src/towns/town-table.ts:70`
**Issue:** `resolveMillRate` matches `r.town === town` exactly. `"newton"`, `" Newton"`, or
`"Newton "` all throw "Unknown town" despite being the obvious intent. Since `town` is an unvalidated
user/snapshot string, this is a brittle hard-error surface.
**Fix:** Normalize (trim + case-fold) both sides of the comparison, or document that callers must pass
the exact canonical name and validate `town` against the table at the input boundary.

### IN-04: Duplicate scheduled-payment math in `scheduledPayment` and `amortizationSchedule`

**File:** `packages/core/src/tco/amortization.ts:57-62,82-87`
**Issue:** The closed-form `P·r·(1+r)^n / ((1+r)^n − 1)` is written out twice (once unrounded in
`scheduledPayment`, once cents-pinned in `amortizationSchedule`). Two copies of the most
correctness-critical formula risk drifting under future edits (and both need the CR-02 zero-rate
guard).
**Fix:** Factor a private `levelPaymentDec(loan, r, termMonths)` helper both call, then round per-use.

### IN-05: `assessmentRatio: '1.0'` relies on `Money.mul` accepting `'1.0'` — magic ratio string repeated

**File:** `packages/core/src/tco/carrying-costs.ts:37`, `packages/core/src/assumptions/defaults.ts:23`
**Issue:** `homeValueAt` hard-codes the assessment ratio `'1.0'` to reuse `assessedValueAt` as a
generic appreciation helper. The literal `'1.0'` is a magic constant tying maintenance-basis to a
specific string; if `decStr`/`Money` canonicalization ever tightened to reject `'1.0'` (vs `'1'`)
this silently breaks. It is also conceptually odd to route home-value-for-maintenance through a
function named "assessed value".
**Fix:** Extract a named `appreciatedValueAt(price, appreciationRealAnnual, year)` primitive that both
`assessedValueAt` (× ratio) and `homeValueAt` delegate to, rather than passing a magic `'1.0'`.

---

_Reviewed: 2026-06-25T15:17:13Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
