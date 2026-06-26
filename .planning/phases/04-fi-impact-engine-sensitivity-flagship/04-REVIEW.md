---
phase: 04-fi-impact-engine-sensitivity-flagship
reviewed: 2026-06-26T00:00:00Z
depth: standard
files_reviewed: 12
files_reviewed_list:
  - packages/core/src/fi/projection.ts
  - packages/core/src/fi/fi-target.ts
  - packages/core/src/fi/fi-impact.ts
  - packages/core/src/fi/compare.ts
  - packages/core/src/fi/sensitivity.ts
  - packages/core/src/tco/compounding.ts
  - packages/core/src/tco/rent-vs-buy.ts
  - packages/core/src/assumptions/schema.ts
  - packages/core/src/assumptions/defaults.ts
  - packages/core/src/assumptions/migrate.ts
  - packages/core/src/engine/engine-input.ts
  - packages/core/src/index.ts
findings:
  critical: 1
  warning: 4
  info: 4
  total: 9
status: issues_found
---

# Phase 4: Code Review Report

**Reviewed:** 2026-06-26
**Depth:** standard
**Files Reviewed:** 12
**Status:** issues_found

## Summary

Reviewed the Phase 4 FI-Impact engine: the monthly projection loop, asymmetric FI targets, the FI-impact orchestrator, N-scenario ranking, the six-driver tornado, the shared compounding helper, and the V3 schema/defaults/migration/engine-input/barrel.

The phase's stated priorities are largely well-served: **no float leaks** were found (all money/rate math stays in `Dec`/`Money`; result shapes carry `Money` and decimal STRINGS); **purity** holds (no react/next/DOM imports anywhere in scope); the **shared `monthlyGrowthFactor`** is genuinely the single compounding definition used by both `projection`/`fi-impact` and `rentVsBuy`; the **projection loop terminates** on a bounded `for` at the stored cap with correct off-by-one handling (month 0 seed check, then 1..cap inclusive); and the **discriminated `FiOutcome`** correctly avoids Infinity/-1 sentinels in serialized output.

The one BLOCKER is a real division-by-zero / negative-divisor gap in `fiTargets`: a zero `swr.rate` crashes the engine (`Money.of("Infinity")` throws) and a negative `swr.rate` silently produces a negative FI target that the projection treats as "FI reached at month 0." Both are reachable through the sensitivity tornado's `swr` driver and through ordinary user assumptions, with no guard. Defaults keep the happy path safe, which is why tests pass — but the FORCE stance is that this is a latent crash + a silently-wrong result.

The Warnings center on a genuine (not "verbatim," as the comment claims) year-index divergence between `fi-impact`'s `equityFor` and `rentVsBuy`'s equity snapshot, the cross-baseline delta semantics in `compareScenarios`, and an unguarded `monthlyGrowthFactor` that yields `NaN` for a sub-(-1) return.

The known-and-out-of-scope items (inert `tax.propertyRateAnnual` → zero tax swing; the pre-existing unused-import in `rent-vs-buy.test.ts:23`) are confirmed and not re-litigated below.

## Critical Issues

### CR-01: No zero/negative guard on `swr.rate` — division yields Infinity (crash) or a negative FI target (silent "reached at month 0")

**File:** `packages/core/src/fi/fi-target.ts:67-71` (`divideBySwr`), reachable via `packages/core/src/fi/sensitivity.ts:146-153` (`swr` driver) and `packages/core/src/fi/fi-target.ts:101-102`.

**Issue:** `divideBySwr` divides a `Money` numerator by `swr.rate` in `Dec` with no guard:

```ts
const d = new Dec(numerator.toDecimalString()).div(new Dec(swrRate));
return Money.of(d.toFixed());
```

decimal.js does NOT throw on divide-by-zero — it returns `Infinity`. Confirmed empirically:
- `swr.rate === "0"` → `d.toFixed()` is `"Infinity"` → `Money.of("Infinity")` fails the canonical-decimal regex and **throws** (`Invalid Money string: "Infinity"`). The whole `fiImpact`/`tornado`/`compareScenarios` call crashes, not just the affected path.
- `swr.rate < 0` → produces a **negative** numerator/rate, e.g. `(80000+36000) / -0.001 = -116000000`, which **passes** `Money.of`'s regex (it allows a leading `-`). The owner/renter target is then negative, so in `projectFiDate` the month-0 check `comparisonNw(seed,...) >= targetDec` is true for any non-negative seed → `reached(0)`. The engine reports "FI reached immediately" — a silently nonsensical result.

Both states are reachable two ways:
1. **Sensitivity tornado:** the `swr` driver perturbs absolutely (`absolute(swr.rate, swrBand, '-')`, sensitivity.ts:151). With a user-configured `swr.rate` at/below `swrBand` (e.g. swr `0.004`, band `0.005`), the low sweep produces `-0.001`. The perturbed value re-validates through `engineInput`, but `decStr` accepts a negative string, so nothing rejects it.
2. **Direct user assumptions:** `swr.rate` is a `decStr` with no positivity refinement in `schema.ts`, so a forged/edited snapshot can set `swr.rate` to `"0"` or a negative.

Defaults (swr `0.033`, swrBand `0.005`) keep the happy path safe, which is why the suite is green — but the guard is absent.

**Fix:** Reject a non-positive SWR at the boundary AND guard the divide. Add a `.refine` on the `swr.rate` leaf in `schema.ts` (mirroring the `downPaymentPct` [0,1) precedent), and clamp/skip the perturbation in the tornado so a swept band cannot drive SWR to ≤ 0:

```ts
// schema.ts — swr group
swr: group({
  rate: decStr.refine((s) => Number(s) > 0, { message: 'swr.rate must be > 0' }),
}),

// fi-target.ts — divideBySwr, defense in depth
function divideBySwr(numerator: Money, swrRate: string): Money {
  const r = new Dec(swrRate);
  if (r.lessThanOrEqualTo(0)) {
    throw new Error(`fiTargets: swr.rate must be > 0 (got ${swrRate}); FI number = spend / swr.`);
  }
  return Money.of(new Dec(numerator.toDecimalString()).div(r).toFixed());
}
```

Then in `sensitivity.ts` clamp the swr low endpoint (or document that a band ≥ rate is invalid input the boundary already rejects). The boundary refine is the load-bearing fix; the `divideBySwr` guard converts the remaining edge into a clear error instead of an opaque `Money.of("Infinity")` throw.

## Warnings

### WR-01: `equityFor` year index diverges from `rentVsBuy`'s equity snapshot — the "verbatim" claim is false

**File:** `packages/core/src/fi/fi-impact.ts:153-159` vs `packages/core/src/tco/rent-vs-buy.ts:242-245`.

**Issue:** The comment at fi-impact.ts:151-152 and 118-119 asserts the equity math is "verbatim from rent-vs-buy.ts 246-253." It is not. The home-value year index differs:

- `rentVsBuy` snapshots equity only at year boundaries (`month % 12 === 0`) using `year = month / 12` (rent-vs-buy.ts:243) — so at month 12 the home is valued at **year 1** (one year of appreciation).
- `fiImpact.equityFor` runs every month using `year = Math.floor((month - 1) / 12)` (fi-impact.ts:154) — so at month 12, `floor(11/12) = 0`, valuing the home at **year 0** (no appreciation). It only reaches year 1 at month 13.

For the same hold-month-12, the two engines compute different home values (and thus different liquidated equity). The schedule-balance index (`month - 1`) is consistent between them; only the appreciation year differs. This is a real modeling inconsistency between the FI-date instrument and the rent-vs-buy instrument that the comments claim are identical. It biases the FI buy path's equity slightly low relative to `rentVsBuy` at every year boundary, making the FI date marginally later than the rent-vs-buy crossover would imply. Functionally defensible (a monthly-cadence valuation is arguably more correct), but the divergence is undocumented and contradicts the in-file claim of equivalence — a future maintainer "fixing" one to match the other could silently shift FI dates.

**Fix:** Either align the year derivation with `rentVsBuy` (use the same year basis the rent-vs-buy snapshot uses for a given month), or — if the monthly cadence is intentional — correct the comments at fi-impact.ts:118-119 and 151-152 to state the FI path values equity at `floor((month-1)/12)` (current-completed-year basis) **deliberately differing** from rent-vs-buy's year-boundary basis, and add a test pinning the intended month-12 home value so the two cannot be silently "reconciled" later.

### WR-02: `compareScenarios` ranks buy rows by each scenario's OWN renter baseline, not the table's row-0 baseline

**File:** `packages/core/src/fi/compare.ts:108-127`.

**Issue:** Row 0 carries `fiImpact(baselineInput).baseline` (the renter outcome of the `baselineInput`). Each buy row's `fiDeltaMonths` comes from `fiImpact(input).fiDeltaMonths` (compare.ts:123), which is `buyMonth − renterMonth` computed against **that scenario's own** renter baseline (`fiImpact(input)` recomputes its own baseline from `input`, fi-impact.ts:230-241). The comparator then ranks reached rows on those deltas (compare.ts:68).

If the scenarios in the batch carry households/rents that differ from `baselineInput` (the API permits this — `scenarios` is `readonly EngineInput[]`, each with its own `household`/`scenario.monthlyRent`), the deltas are measured against different zero-points than the displayed row-0 baseline, so the ranking mixes incomparable quantities and row 0 no longer is the true zero for the ranked deltas. The tests only ever pass scenarios sharing one `HOUSEHOLD`, so this never surfaces. The header comment ("the zero point every buy is measured against") implies a single shared baseline that the code does not enforce.

**Fix:** Either (a) document and enforce that every `scenarios[i]` must share `baselineInput`'s household/rent (assert it, or derive each buy row's delta against `baselineImpact.baseline` rather than the per-scenario baseline), or (b) if per-scenario baselines are intended, surface each row's own baseline so the delta's reference point is explicit. Concretely, to make row 0 the genuine common zero:

```ts
const buyRows = scenarios.map((input) => {
  const impact = fiImpact(input);
  // Delta against the SHARED baseline (row 0), not the per-scenario renter baseline.
  const delta =
    impact.buy.kind === 'reached' && baselineImpact.baseline.kind === 'reached'
      ? impact.buy.month - baselineImpact.baseline.month
      : null;
  return { label: input.scenario.label, outcome: impact.buy, fiDeltaMonths: delta, /* ... */ };
});
```

### WR-03: `monthlyGrowthFactor` returns `NaN` for an annual real return ≤ −1, which propagates silently as "unreached"

**File:** `packages/core/src/tco/compounding.ts:20-22`, reachable via `packages/core/src/fi/sensitivity.ts:110` (`return` driver) and any `(1+r)^(1/12)` consumer.

**Issue:** `new Dec(1).plus(new Dec(annualReal)).pow(new Dec(1).div(12))` computes a fractional power of `(1 + r)`. For `r ≤ −1` the base is ≤ 0, and decimal.js returns `NaN` for a non-integer power of a negative/zero base (confirmed: `(1 + (−1.5))^(1/12)` → `NaN`). A `NaN` factor makes every `nw.times(factor)` NaN, every `>=` comparison false, and the projection silently returns `unreached` — a corrupt computation masquerading as the legitimate "FI not reached" verdict, with no error. The `return` tornado driver perturbs absolutely (`absolute(returns.realAnnual, returnBand, '-')`); with a user return near/below −1 minus the band, the low sweep crosses into the NaN regime. Defaults are nowhere near this, so tests pass.

**Fix:** Guard the factor's base at the boundary and/or in the helper:

```ts
export function monthlyGrowthFactor(annualReal: string): InstanceType<typeof Dec> {
  const base = new Dec(1).plus(new Dec(annualReal));
  if (base.lessThanOrEqualTo(0)) {
    throw new Error(`monthlyGrowthFactor: (1 + annualReal) must be > 0 (got annualReal=${annualReal}).`);
  }
  return base.pow(new Dec(1).div(12));
}
```

Pair with a `decStr` refine on `returns.realAnnual` (and the perturbation clamp) so a swept band cannot drive `1 + r` ≤ 0.

### WR-04: `migrate` re-validates with `parseAssumptionSet` but then trusts the un-narrowed return for the version switch

**File:** `packages/core/src/assumptions/migrate.ts:28-47`.

**Issue:** `migrate` calls `parseAssumptionSet(input)` (which returns `AnyAssumptionSet`, the per-version union) and switches on `set.schemaVersion`. The `case 1` arm calls `v1ToV2(set)` and `case 2` calls `v2ToV3(set)` with `set` narrowed by the discriminant. This relies on Zod's `discriminatedUnion` having actually narrowed `set` to the V1/V2 member inside each case. Per the schema.ts:233-243 note, `z.infer` over the discriminated union "degrades to `any`," which is precisely why `AnyAssumptionSet` is hand-built as an explicit union — but `parseAssumptionSet` returns `z.infer<...>` of the *schema* (assumption-set.ts:33-35 returns `AssumptionSetSchema.parse(input)` typed as `AnyAssumptionSet`). The narrowing therefore depends on the hand-built union members staying structurally in lockstep with the schema branches. If a future version is added to the schema's `discriminatedUnion` but not to `AnyAssumptionSet` (or vice versa), the `assertNever(set)` exhaustiveness guard can silently stop being `never`, and a real version could fall through to the `default` throw at runtime even though it is parseable. This is a latent fragility, not a present bug (V1/V2/V3 are all in both lists today).

**Fix:** Add a compile-time assertion tying the two together, e.g. a `satisfies` check or a type test asserting `AssumptionSetSchema`'s inferred discriminant set equals `AnyAssumptionSet['schemaVersion']`, so adding a schema branch without updating `AnyAssumptionSet` fails `tsc`. At minimum, add a migrate.test.ts case for each version that proves the narrowed `set` carries the version's added slices (not just the discriminant).

## Info

### IN-01: `compareScenarios` recomputes the baseline N+1 times

**File:** `packages/core/src/fi/compare.ts:108,119`.

**Issue:** `fiImpact(baselineInput)` runs the full buy + renter projection once for row 0, and `fiImpact(input)` runs again for every scenario — each of which internally recomputes its own renter baseline (fi-impact.ts:230-231) that is then discarded for ranking purposes. For a large batch this is N redundant baseline projections. Performance is explicitly out of v1 scope, so this is noted only because it compounds with WR-02 (the recomputed-but-discarded baselines are the same ones whose semantics differ from row 0).

**Fix:** If WR-02 is resolved by ranking against the shared baseline, the per-scenario baseline projection becomes dead work and can be skipped (project only the buy path per scenario).

### IN-02: `comparisonNw` is recomputed for the month-0 seed check using `equityFor(0)`

**File:** `packages/core/src/fi/projection.ts:85`.

**Issue:** The month-0 degenerate check calls `comparisonNw(nw, equityFor, 0)`. For the buy path, `equityFor(0)` evaluates `Math.floor((0-1)/12) = floor(-1/12) = -1` (fi-impact.ts:154), i.e. `homeValueAt(price, appr, -1)` — appreciation to the **−1** power. This produces a (1+appr)^−1 discount of the home value at month 0, and reads `schedule.rows[-1]` (`month - 1 = -1 < rows.length` is true, so `schedule.rows[-1]!` → `undefined`, then `remainingBalance = new Dec(0)`). So at month 0 the buy path counts a slightly *de-appreciated* full home value with zero loan balance. This only matters if the seed-plus-equity already meets the owner target at t=0 (a household already at/above FI before buying), an unusual but real case, and the year=−1 valuation is a minor inconsistency rather than a crash. Worth pinning with a test.

**Fix:** Clamp the year to ≥ 0 in `equityFor` (`const year = Math.max(0, Math.floor((month - 1) / 12))`) so month 0 values the home at year 0 with a zero balance, matching the intuitive "today's equity" at t=0.

### IN-03: `assertNever` reads the discriminant through a cast that can mask a non-object

**File:** `packages/core/src/assumptions/migrate.ts:89-93`.

**Issue:** `(set as { schemaVersion?: unknown })?.schemaVersion` defends against a non-object `set` at runtime, which is reasonable, but `String(version)` on a deeply-malformed value yields `"[object Object]"`/`"undefined"` in the error. Minor: the error message could be less informative than intended for a forged payload. Low impact since `parseAssumptionSet` already rejects malformed input before the switch.

**Fix:** Optional — include `JSON.stringify(set)?.slice(0, 80)` in the message for diagnosability, or leave as-is since the path is effectively unreachable post-validation.

### IN-04: In-file comments assert "verbatim" / "the SAME" equivalences that the code does not guarantee

**File:** `packages/core/src/fi/projection.ts:5-7,16-23`; `packages/core/src/fi/fi-impact.ts:118-119,151-152`.

**Issue:** Several comments claim the FI path compounds/equity-computes "in the SAME order" / "verbatim" as `rentVsBuy`. The compounding order claim is accurate (contribute-then-compound matches rent-vs-buy's invest-then-compound), but the equity-year claim is not (see WR-01). Over-strong "this is identical to X" comments are a maintenance hazard: they invite a future edit to "re-sync" the two and silently change financial output. Documentation-only, but in a correctness-critical engine the comments carry weight.

**Fix:** Downgrade the equivalence claims to precisely what holds (compounding order is shared via `monthlyGrowthFactor`; equity valuation cadence intentionally differs), per the WR-01 fix.

---

_Reviewed: 2026-06-26_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
