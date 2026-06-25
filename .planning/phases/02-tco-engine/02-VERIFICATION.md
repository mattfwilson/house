---
phase: 02-tco-engine
verified: 2026-06-25T16:00:00Z
status: gaps_found
score: 4/5 roadmap success criteria verified
overrides_applied: 0
gaps:
  - truth: "rentVsBuy does not crash on a valid input where holdingYears * 12 exceeds termMonths (e.g. a 15-year loan held 20 years)"
    status: failed
    reason: "rent-vs-buy.ts line 175 reads schedule.rows[month - 1]! with a non-null assertion. When totalMonths > schedule.rows.length the array access returns undefined and the ! causes a throw at .toDecimalString(). No guard exists. No test exercises this path. This is CR-01 from the code review."
    artifacts:
      - path: "packages/core/src/tco/rent-vs-buy.ts"
        issue: "Line 175: schedule.rows[month - 1]!.balance.toDecimalString() — when month - 1 >= schedule.rows.length (e.g. 15yr loan held 20yr) this is undefined at runtime and crashes. Fix: clamp to last index and treat out-of-range months as zero balance."
      - path: "packages/core/src/tco/amortization.ts"
        issue: "Secondary: scheduledPayment and amortizationSchedule have no guard for annualRate='0', which causes div(pow.minus(1)) = div(0) to throw. CR-02 in the code review."
    missing:
      - "Clamp row index in rentVsBuy: `const row = month - 1 < schedule.rows.length ? schedule.rows[month - 1]! : undefined; const remainingBalance = row ? new Dec(row.balance.toDecimalString()) : new Dec(0);`"
      - "Add test for holdingYears > termMonths / 12 (e.g. holdingYears: 20 with termMonths: 180) to lock the fix"
      - "Zero-rate guard in scheduledPayment / amortizationSchedule: `if (r.isZero()) return Money.of(new Dec(loan).div(termMonths).toFixed());`"
  - truth: "ScenarioInputs is validated at the trust boundary via a Zod schema before entering the calc"
    status: failed
    reason: "ScenarioInputs is a TypeScript-only interface with no Zod schema. engineInput() calls Object.freeze with no validation. The golden round-trip test passes scenario straight through with a bare TypeScript cast. This contradicts the stated guarantee (REQUIREMENTS.md TCO-01 through TCO-07 all depend on correct input) and mirrors the AssumptionSet pattern that this boundary deliberately gaps. This is CR-03 from the code review."
    artifacts:
      - path: "packages/core/src/engine/engine-input.ts"
        issue: "engineInput() does Object.freeze({ ...scenario }) with no validation. A persisted/forged snapshot carrying negative holdingYears, termMonths=0, downPaymentPct='1.5', or a non-canonical price string enters the calc unchallenged."
    missing:
      - "Add ScenarioInputsSchema (Zod): dollar/rate fields as decStr, termMonths/holdingYears as z.number().int().positive(), downPaymentPct constrained to [0,1), optional fields validated when present"
      - "Parse through ScenarioInputsSchema in engineInput() or expose parseScenarioInputs() the snapshot loader must call"
      - "Use parseScenarioInputs in the golden round-trip assertion (golden.test.ts:166) instead of a bare TypeScript cast"
human_verification:
  - test: "Confirm anti-funnel rent-wins input plausibility"
    expected: "Newton $850k / 7.0% / 7-year hold / $3,200/mo rent is a realistic greater-Boston scenario. BUY ending NW $257,910 vs RENT $563,158 with rent winning should feel plausible — not a pathological edge case."
    why_human: "Reasonableness of a financial scenario cannot be verified programmatically; requires domain judgment on whether the price/rate/rent/hold inputs reflect real greater-Boston market conditions."
  - test: "Confirm committed golden fixture numbers are sane"
    expected: "Newton $450k, 20% down, 6.5%/30yr, 10yr hold: TCO total $3,280.61/mo (P+I $2,275.44, property tax $369.75/mo, insurance $166.67, maintenance $375, amortized closing $93.75). Rent-vs-buy: buy $168,035.61 vs rent $224,885.81 — rent wins. These should be in a believable range for a $450k Newton house."
    why_human: "Financial sanity of headline output numbers requires human judgment; automated tests only verify internal consistency and exact rounding, not whether the absolute figures are plausible."
---

# Phase 2: TCO Engine Verification Report

**Phase Goal:** Build the shared TCO substrate that Affordability and FI-Impact both consume — full monthly and annualized total cost of ownership for a scenario, computed correctly down to the cent, plus the rent-vs-buy comparison at the household's actual numbers.
**Verified:** 2026-06-25T16:00:00Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (Roadmap Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| SC1 | Amortization produces a full schedule whose final balance is exactly $0.00 and whose principal sum equals the original loan exactly (invariant tests + external-oracle agreement on a non-round rate) | VERIFIED | `amortization.ts` implements the reconciled final payment pattern. `amortization.test.ts` asserts: `schedule.rows[359].balance.toCents() === 0n`, `sum(principal) === Money.of('400000').toCents()`, `scheduledPayment('400000','0.06375',360).toCents() === 249548n` (oracle), month-1 interest 212500n / principal 37048n. All exact-bigint, zero `toBeCloseTo`. |
| SC2 | Property tax is computed as assessed value x seeded MA town mill rate (FY-stamped), never a flat percentage and never a 2.5%-cap on the bill | VERIFIED | `property-tax.ts`: `annualPropertyTax = assessedValue.mul(new Dec(millRatePerThousand).div(1000).toFixed())`. 24-town FY2024 table exists. `property-tax.test.ts` asserts doubling the mill rate doubles the bill (no clamp). `PROP_2_5_FLAG` is surfaced. `tco.ts` captures `resolvedMillRate` + `millRateFy` in the result. |
| SC3 | PMI is added when down payment < 20% and removed at 78% LTV automatic / 80% requested against the original value and scheduled balance (toggle-tested), not at appreciated value | VERIFIED | `pmi.ts`: origination LTV comparison in Dec, drop-off scans scheduled balance against constant `originalValueDec`, threshold toggles 0.78 / 0.80. `pmi.test.ts` asserts the two drop-off months differ. No appreciated-value input exposed. |
| SC4 | The full TCO breakdown (P+I, tax, insurance, maintenance reserve, HOA, PMI, amortized closing costs) is presented both monthly and annualized | VERIFIED | `computeTco` returns `TcoBreakdown` with seven `TcoLine { monthly, annualized }` fields plus `total`. `tco.type-test.ts` enforces no bare-number dollar fields at build time via `@ts-expect-error`. Golden snapshot confirms real figures. |
| SC5 | Rent-vs-buy is computed at the household's real numbers, investing the down payment and monthly difference symmetrically and treating principal as forced savings (no opportunity-cost asymmetry) — BUT crashes on `holdingYears * 12 > termMonths` | FAILED | `rent-vs-buy.ts` implements symmetric invest-the-difference, Fisher real return, separate appreciation, sell haircut, and anti-funnel. However, line 175 uses `schedule.rows[month - 1]!` without bounds-checking. When `holdingYears * 12 > termMonths` (e.g. a 15-year loan held 20 years), the array access is out-of-bounds, the `!` suppresses the TS guard, and the call to `.toDecimalString()` throws a `TypeError`. No test covers this path. A 15-year loan held past payoff is a completely realistic scenario (and a favorable one for buy). |

**Score:** 4/5 roadmap success criteria verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/core/src/tco/amortization.ts` | scheduledPayment + amortizationSchedule | VERIFIED | 119 lines, substantive, no stub patterns |
| `packages/core/src/tco/amortization.test.ts` | Invariant + oracle tests | VERIFIED | Full oracle case, exact bigint assertions |
| `packages/core/src/tco/pmi.ts` | computePmi with 78/80 toggle | VERIFIED | 87 lines, Dec comparisons, toggle logic |
| `packages/core/src/tco/pmi.test.ts` | Toggle + applies tests | VERIFIED | Substantive; proves toggle produces different months |
| `packages/core/src/tco/property-tax.ts` | annualPropertyTax + schedule + PROP_2_5_FLAG | VERIFIED | 101 lines, /1000 division in Dec, no clamp |
| `packages/core/src/tco/property-tax.test.ts` | Correctness + no-clamp tests | VERIFIED | Asserts mill-rate sensitivity |
| `packages/core/src/tco/carrying-costs.ts` | Maintenance/insurance/HOA | VERIFIED | 84 lines, maintains appreciation through assessedValueAt |
| `packages/core/src/tco/closing-costs.ts` | closingCosts + amortizeOverHold | VERIFIED | 65 lines, Dec division, override logic |
| `packages/core/src/tco/tco.ts` | computeTco(input): TcoBreakdown | VERIFIED | 197 lines, composes all calculators, captures mill rate/FY |
| `packages/core/src/tco/tco.type-test.ts` | No-bare-number guard | VERIFIED | Contains 4 `@ts-expect-error` assertions in tsc -b graph |
| `packages/core/src/tco/rent-vs-buy.ts` | Two-portfolio net worth + crossover | PARTIAL — CR-01 crash | 206 lines, Fisher/symmetry/sell-haircut correct; line 175 out-of-bounds crash unguarded |
| `packages/core/src/tco/rent-vs-buy.test.ts` | Anti-funnel + symmetry + fisher tests | VERIFIED | 10 tests covering rent-wins, buy-wins, symmetry, separate appreciation, Fisher, sell haircut |
| `packages/core/src/__fixtures__/tco-golden-snapshot.json` | Committed golden fixture | VERIFIED | Real figures present: total $3,280.61/mo, rent wins |
| `packages/core/src/towns/town-table.ts` | 20+ town seeded table + resolver | VERIFIED | 24 FY2024 rows, throws on miss |
| `packages/core/src/towns/town-table.schema.ts` | Zod row schema with decStr | VERIFIED | `.strict()`, imports `decStr` from assumptions/schema |
| `packages/core/src/assumptions/schema.ts` | AssumptionsV2 with new slices | VERIFIED | appreciation/transaction/rent/closing/assessmentRatio all decStr |
| `packages/core/src/engine/engine-input.ts` | Widened ScenarioInputs | VERIFIED | All required fields present, `readonly`, strings for dollar/rate |
| `packages/core/src/index.ts` | Public barrel with computeTco, rentVsBuy, etc. | VERIFIED | computeTco, rentVsBuy, scheduledPayment, computePmi, annualPropertyTax, closingCosts, resolveMillRate all exported; Dec/Decimal absent |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `rent-vs-buy.ts` | `computeTco` | `tco.total.monthly.sub(tco.amortizedClosing.monthly)` | VERIFIED | Line 121-122; buy outflow correctly excludes closing |
| `rent-vs-buy.ts` | `amortizationSchedule` | schedule.rows[month-1]!.balance | PARTIAL | Wired, but out-of-bounds when holdingYears*12 > termMonths (CR-01) |
| `tco.ts` | `resolveMillRate` | `resolveMillRate(town)` captured into result | VERIFIED | Line 132; residentialMillRate + fy captured for snapshot self-containment |
| `tco.ts` | all Plan02+Plan03 calculators | scheduledPayment/computePmi/annualPropertyTax/carrying/closing | VERIFIED | All 5 imports present and used |
| `golden.test.ts` | `tco-golden-snapshot.json` | `UPDATE_GOLDEN`-gated deep-equal | VERIFIED | Fixture committed with real figures |
| `assumptions/schema.ts` | `decStr` | imported by town-table.schema.ts | VERIFIED | Single canonical-decimal definition |
| `engine-input.ts` | ScenarioInputs | No Zod schema | FAILED | TypeScript-only; no runtime Zod validation at the trust boundary (CR-03) |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|-------------------|--------|
| `tco.ts` | `TcoBreakdown` | `computeTco(input: EngineInput)` | Yes — real Dec/Money math | FLOWING |
| `rent-vs-buy.ts` | `RentVsBuyResult` | month-by-month Dec compounding loop | Yes — real projection | FLOWING (with CR-01 crash on holdingYears*12 > termMonths) |
| `tco-golden-snapshot.json` | committed fixture | `canonicalJson({ tco, rentVsBuy })` | Yes — real $3,280.61/mo figures | FLOWING |
| `town-table.ts` | `TOWN_RATE_TABLE` | pure-data FY2024 DLS rates | Yes — 24 real FY2024 rates | FLOWING |

### Behavioral Spot-Checks

Step 7b: SKIPPED — core package has no runnable entry points; all verification is via the Vitest test suite. Test counts and coverage are documented in the SUMMARY (187 passed, 98.76% statements, 91.52% branches).

### Probe Execution

Step 7c: No `probe-*.sh` files declared or found in `scripts/` for this phase.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| TCO-01 | 02-02, 02-04 | Monthly P+I via amortization from rate, term, loan amount | SATISFIED | `scheduledPayment` + `amortizationSchedule` with oracle test |
| TCO-02 | 02-01, 02-03, 02-04 | Property tax from MA town-level mill rates (seeded static table), not flat % | SATISFIED | 24-town FY2024 table, `annualPropertyTax = assessed * millRate/1000`, mill rate captured in TcoBreakdown |
| TCO-03 | 02-03 | Homeowners insurance, configurable maintenance reserve (~1-2%/yr), HOA fees | SATISFIED | `insuranceAnnual` flat, `maintenanceAnnual` on appreciating value, `hoaAnnual` flat |
| TCO-04 | 02-02 | PMI when DP < 20%, dropped at 78% auto / 80% requested vs original value | SATISFIED | `computePmi` with toggle test, exact-equality drop-off assertions |
| TCO-05 | 02-03 | Closing costs as one-time figure, amortizable for cross-scenario comparison | SATISFIED | `closingCosts` (%-of-price or override) + `amortizeOverHold` |
| TCO-06 | 02-04 | Full TCO breakdown both monthly and annualized | SATISFIED | `TcoBreakdown` with 7 `TcoLine { monthly, annualized }` fields + total |
| TCO-07 | 02-05 | Rent-vs-buy at household's actual numbers — symmetric, principal as forced savings, no opportunity-cost asymmetry | PARTIAL | Engine correct for happy path; crashes when holdingYears*12 > termMonths (CR-01); no Zod validation at input boundary (CR-03) |

All 7 TCO requirement IDs from the PLAN frontmatter are accounted for. No orphaned requirements found in REQUIREMENTS.md for Phase 2.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `packages/core/src/tco/rent-vs-buy.ts` | 175 | `schedule.rows[month - 1]!.balance` — non-null assert on potentially-undefined array access when `totalMonths > schedule.rows.length` | BLOCKER | Hard crash (`TypeError: Cannot read properties of undefined`) on valid input: any scenario where holdingYears*12 > termMonths (15yr loan held 20yr, 30yr loan held 31yr, etc.) |
| `packages/core/src/tco/amortization.ts` | 57-62, 82-87 | No zero-rate guard on `div(pow.minus(1))` — when `annualRate='0'`, `pow.minus(1) = 0`, decimal.js throws on divide-by-zero | BLOCKER | Hard crash on `annualRate='0'` (seller financing, family loan, or user typo); hits `scheduledPayment`, `amortizationSchedule`, and transitively `computeTco` and `rentVsBuy` |
| `packages/core/src/engine/engine-input.ts` | 73-78 | `engineInput()` calls `Object.freeze({ ...scenario })` with no runtime validation | BLOCKER | Trust boundary gap: `ScenarioInputs` is TypeScript-only. Forged/corrupt snapshots with negative `holdingYears`, `termMonths=0`, `downPaymentPct='1.5'`, non-canonical strings enter the calc unchallenged. Contradicts the `AssumptionSet` validation pattern that exists specifically for this reason. |
| `packages/core/src/tco/tco.ts` | 160 | PMI monthly premium × 12 held flat across the entire hold | WARNING | `computeTco` annualizes PMI as `monthlyPremium × 12` regardless of `dropOffMonth`. `rentVsBuy` uses the flat TCO total (line 122) for every month of the hold. A borrower at 90% LTV paying PMI until month 108 is still modeled as paying PMI in year 20. `dropOffMonth` is computed and then ignored by every consumer. Overstates ownership cost; biases rent-vs-buy toward "rent." WR-02 from the code review. |
| `packages/core/src/tco/rent-vs-buy.ts` | 121-122 | `buyMonthlyOutflow` held flat at the year-0 TCO total while `currentRent` compounds monthly | WARNING | Property tax and maintenance grow with appreciating home value (the modules model this explicitly) but `rentVsBuy` holds the buy outflow flat. Rent grows; buy costs don't. Asymmetric growth assumption biases comparison toward "buy." WR-03 from the code review. |

**Debt-marker check:** No `TBD`, `FIXME`, or `XXX` markers found in the phase files.

### Human Verification Required

#### 1. Anti-funnel rent-wins input plausibility

**Test:** Review the SCENARIO_RENT_WINS input in `packages/core/src/tco/rent-vs-buy.test.ts` (Newton $850k, 20% down, 7.0%/30yr, 7-year hold, $3,200/mo rent) and confirm it represents a plausible greater-Boston scenario rather than a contrived edge case.
**Expected:** The inputs should feel like something a real Boston-area household might face — price, rate, and rent consistent with the market at approximately 2026 conditions.
**Why human:** Plausibility of a financial scenario requires domain judgment; tests only verify internal consistency.

#### 2. Committed golden fixture numbers sanity check

**Test:** Review `packages/core/src/__fixtures__/tco-golden-snapshot.json` for the Newton $450k scenario. Key figures: TCO total $3,280.61/mo (P+I $2,275.44, property tax $369.75/mo = $4,437/yr at 9.86 mill, insurance $166.67, maintenance $375, amortized closing $93.75). Rent-vs-buy: buy $168,035.61 vs rent $224,885.81 — rent wins.
**Expected:** The absolute dollar amounts should be in a believable range for a $450k home in Newton with 20% down and a 6.5% rate as of 2026. The property tax figure especially should correlate with 9.86 mill and $450k assessed value.
**Why human:** Sanity of headline financial output numbers cannot be verified programmatically; only reasonableness judgment can catch a systematic off-by-order-of-magnitude error.

### Gaps Summary

Two BLOCKERs prevent the phase goal from being fully achieved:

**Gap 1 — CR-01: Hard crash when holdingYears*12 > termMonths (rent-vs-buy.ts line 175)**

The rent-vs-buy engine crashes with `TypeError: Cannot read properties of undefined` on any scenario where the holding period outlasts the loan term — for example, a 15-year loan held for 20 years (termMonths=180, holdingYears=20, totalMonths=240, but schedule.rows has only 180 entries). The `!` non-null assertion suppresses TypeScript's guard, so the crash occurs at runtime. A house paid off before the end of the hold is a realistic and even favorable-to-buy scenario (zero remaining balance = full equity). No existing test covers this path.

The fix is a one-line clamp: `const row = month - 1 < schedule.rows.length ? schedule.rows[month - 1]! : undefined; const remainingBalance = row ? new Dec(row.balance.toDecimalString()) : new Dec(0);`. A test with holdingYears > termMonths/12 should be added to lock this in.

Secondary: the same zero-rate issue (CR-02) causes `scheduledPayment` and `amortizationSchedule` to throw on `annualRate='0'` due to `div(pow.minus(1))` = div(0). The fix is a `if (r.isZero()) return Money.of(new Dec(loan).div(termMonths).toFixed())` guard before the closed form.

**Gap 2 — CR-03: ScenarioInputs crosses the trust boundary with no runtime Zod validation**

`AssumptionSet` is rigorously gated by Zod at the serialization boundary — that discipline was established in Phase 1 precisely because "snapshots are a trust boundary." `ScenarioInputs` is a TypeScript-only interface and `engineInput()` does `Object.freeze` with no validation. The golden round-trip test at `golden.test.ts:166` passes the scenario with a bare TypeScript cast (`as ScenarioInputs`), not a Zod parse. This means a persisted or forged snapshot with: negative `holdingYears` (silent empty schedule), `termMonths=0` (div-by-zero), `downPaymentPct='1.5'` (negative loan), or non-canonical strings enters the calc unchallenged. The fix is a `ScenarioInputsSchema` (Zod) with `decStr` on dollar/rate fields and `z.number().int().positive()` on counts, used in `engineInput()` and the round-trip test.

**Two WARNINGs (not blocking the stated phase goal but correctness concerns):**

- WR-02: PMI `dropOffMonth` is computed but never consumed; the flat PMI figure overstates ownership cost in `rentVsBuy` for multi-decade comparisons.
- WR-03: `buyMonthlyOutflow` is held at the year-0 TCO figure while rent compounds monthly — asymmetric growth that biases toward "buy."

These two WARNINGs are at odds with the phase goal's precision claim ("computed correctly down to the cent") and the stated anti-bias guarantee (Pitfall 6 applies equally in both directions). They should be addressed before Phase 4 layers the FI-impact engine on top of `rentVsBuy`.

---

_Verified: 2026-06-25T16:00:00Z_
_Verifier: Claude (gsd-verifier)_
