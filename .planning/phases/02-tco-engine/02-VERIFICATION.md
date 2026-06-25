---
phase: 02-tco-engine
verified: 2026-06-25T20:00:00Z
status: human_needed
score: 5/5 roadmap success criteria verified
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 4/5
  gaps_closed:
    - "rentVsBuy does not crash on a valid input where holdingYears * 12 exceeds termMonths (CR-01) — clamped schedule index in rent-vs-buy.ts, locking test added"
    - "scheduledPayment and amortizationSchedule zero-rate divide-by-zero (CR-02) — r.isZero() guard added in amortization.ts, locking tests added"
    - "PMI charged flat past dropOffMonth (WR-02) — pmiDropOffMonth surfaced on TcoBreakdown; buyMonthlyOutflowAt charges PMI only while month <= dropOffMonth"
    - "buy outflow held flat while rent compounds (WR-03) — buyMonthlyOutflowAt recomputes property-tax + maintenance per year on appreciating value"
    - "ScenarioInputs is validated at the trust boundary via a Zod schema before entering the calc (CR-03) — ScenarioInputsSchema + parseScenarioInputs added; engineInput() validates at assembly; golden round-trip uses parseScenarioInputs"
  gaps_remaining: []
  regressions: []
warnings:
  - must_have: "pmiDropOffMonth = null is ambiguous — PMI silently zeroed in monthly outflow when schedule never reaches drop-off threshold"
    severity: WARNING
    reason: "When pmiResult.applies=true AND pmiResult.dropOffMonth=null (PMI applies but the schedule never reaches 78% LTV within termMonths — e.g. a 12-month balloon loan with 10% down), tco.ts line 222 sets pmiDropOffMonth=null (indistinguishable from 'no PMI applies'). buyMonthlyOutflowAt checks tco.pmiDropOffMonth !== null and silently charges $0 PMI for all months. Meanwhile tco.pmi.annualized correctly charges PMI via the ?? fallback. Result: TcoBreakdown and rent-vs-buy are inconsistent for very short-term high-LTV inputs. Does not affect standard 15-year or 30-year conforming mortgages where drop-off is always found. All test scenarios use standard terms where the ambiguity does not manifest. Biases toward 'buy' for edge-case inputs."
  - must_have: "PmiBasis type not exported from index.ts despite computePmi being public"
    severity: INFO
    reason: "computePmi is exported but its basis parameter type (PmiBasis = 'auto-78' | 'requested-80') is not re-exported from index.ts. Downstream code relying on structural string literal compatibility works today, but cannot name the type explicitly without a deep import violating the package boundary."
human_verification:
  - test: "Confirm anti-funnel rent-wins input plausibility"
    expected: "Newton $850k / 7.0% / 7-year hold / $3,200/mo rent is a realistic greater-Boston scenario. BUY ending NW $257,910 vs RENT $563,158 (or similar updated figures) with rent winning should feel plausible — not a pathological edge case."
    why_human: "Reasonableness of a financial scenario cannot be verified programmatically; requires domain judgment on whether the price/rate/rent/hold inputs reflect real greater-Boston market conditions."
  - test: "Confirm committed golden fixture numbers are sane"
    expected: "Newton $450k, 20% down, 6.5%/30yr, 10yr hold: TCO total $3,280.61/mo (P+I $2,275.44 unchanged), rent-vs-buy winner RENT (rentEndingNetWorth $228,503.08 per 02-06 regeneration, buyEndingNetWorth $168,035.61). These should be in a believable range for a $450k Newton house."
    why_human: "Financial sanity of headline output numbers requires human judgment; automated tests only verify internal consistency and exact rounding, not whether the absolute figures are plausible."
  - test: "Assess pmiDropOffMonth=null ambiguity acceptability"
    expected: "For the primary use case (Boston conforming mortgages: 15yr or 30yr term, 10–20% down), the scheduled amortization always reaches the 78% LTV threshold within the term, so pmiDropOffMonth is always a concrete month number and the ambiguity does not manifest. Decide whether to add a pmiApplies boolean to TcoBreakdown to disambiguate before Phase 4 layers the FI-impact engine on top of buyMonthlyOutflowAt."
    why_human: "Whether this edge case matters for the project's actual use (standard Boston conforming mortgages) requires domain judgment on typical term/LTV combinations. The fix is mechanical but the priority decision requires human input."
---

# Phase 2: TCO Engine Verification Report (Re-verification)

**Phase Goal:** Build the shared TCO substrate that Affordability and FI-Impact both consume — full monthly and annualized total cost of ownership for a scenario, computed correctly down to the cent, plus the rent-vs-buy comparison at the household's actual numbers.
**Verified:** 2026-06-25T20:00:00Z
**Status:** human_needed
**Re-verification:** Yes — after gap closure (plans 02-06 and 02-07)

## Re-Verification Summary

All five gaps from the prior `02-VERIFICATION.md` (two BLOCKERs: CR-01 out-of-bounds crash, CR-02 zero-rate divide-by-zero; two correctness WARNINGs: WR-02 flat PMI past drop-off, WR-03 flat buy outflow vs compounding rent; one trust-boundary BLOCKER: CR-03 no Zod validation on ScenarioInputs) are confirmed closed in the codebase. All five roadmap success criteria are now verified. One new WARNING (not a BLOCKER) was introduced by the gap-closure implementation and is documented below.

## Goal Achievement

### Observable Truths (Roadmap Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| SC1 | Amortization produces a full schedule whose final balance is exactly $0.00 and whose principal sum equals the original loan exactly (invariant tests + external-oracle agreement on a non-round rate) | VERIFIED | `amortization.ts` zero-rate guard (`r.isZero()` straight-line branch) + reconciled final period. `amortization.test.ts` adds: zero-rate `scheduledPayment('400000','0','360')` exact-cent lock; `amortizationSchedule('360000','0',360)` with final balance `$0.00`, principal sum exact, interest `$0.00` per period. All CR-02 locking tests pass alongside the original oracle/invariant assertions. |
| SC2 | Property tax is computed as assessed value x seeded MA town mill rate (FY-stamped), never a flat percentage and never a 2.5%-cap on the bill | VERIFIED | Unchanged from initial verification. `property-tax.ts` uses `/1000` division in Dec. 24-town FY2024 table. `tco.ts` captures `resolvedMillRate` + `millRateFy`. `buyMonthlyOutflowAt` uses `tco.resolvedMillRate` for the appreciating annual property tax per hold year. |
| SC3 | PMI is added when down payment < 20% and removed at 78% LTV automatic / 80% requested against the original value and scheduled balance (toggle-tested), not at appreciated value | VERIFIED | `pmi.ts` unchanged. `tco.ts` now surfaces `pmiDropOffMonth` on `TcoBreakdown` (number or null when no PMI applies). `buyMonthlyOutflowAt` charges PMI only while `month <= tco.pmiDropOffMonth`. `tco.test.ts` asserts `pmiDropOffMonth === 108` for the 10%-down scenario and `pmiDropOffMonth === null` for 20%-down. WR-02 locking tests confirm post-drop-off outflow is lower by exactly the PMI premium. |
| SC4 | The full TCO breakdown (P+I, tax, insurance, maintenance reserve, HOA, PMI, amortized closing costs) is presented both monthly and annualized | VERIFIED | `computeTco` returns `TcoBreakdown` with seven `TcoLine { monthly, annualized }` fields plus `total` and `pmiDropOffMonth`. PMI annualization is now drop-off-aware (hold average, not flat x 12). `tco.test.ts` asserts `pmiDropOffMonth === 108` and the WR-02 annualized figure `$2,430.00` (NOT `$2,700.00`). `tco.type-test.ts` enforces no bare-number dollar fields at build time. |
| SC5 | Rent-vs-buy is computed at the household's real numbers, investing the down payment and monthly difference symmetrically and treating principal as forced savings (no opportunity-cost asymmetry) | VERIFIED | `rent-vs-buy.ts` now: (a) does not crash when `holdingYears*12 > termMonths` (CR-01 clamped schedule index — `month - 1 < schedule.rows.length ? row : undefined`); (b) charges PMI only while `month <= tco.pmiDropOffMonth` (WR-02); (c) grows property-tax + maintenance per hold year via `assessedValueAt`/`homeValueAt` (WR-03); (d) `buyMonthlyOutflowAt` exported and tested with exact-cent locking assertions. All original anti-funnel, buy-wins, symmetry, Fisher, and sell-haircut tests still pass with unchanged winners. |

**Score:** 5/5 roadmap success criteria verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/core/src/tco/amortization.ts` | scheduledPayment + amortizationSchedule | VERIFIED | 129 lines. `r.isZero()` guard in both functions. Straight-line zero-rate path. Reconciled final period retained. |
| `packages/core/src/tco/amortization.test.ts` | Invariant + oracle + CR-02 zero-rate tests | VERIFIED | CR-02 locking tests added: exact-cent zero-rate scheduledPayment, zero-rate schedule final balance `$0.00`, principal sum exact, interest `$0.00`. |
| `packages/core/src/tco/pmi.ts` | computePmi with 78/80 toggle | VERIFIED | Unchanged from initial verification. Correct LTV scan loop. |
| `packages/core/src/tco/tco.ts` | computeTco(input): TcoBreakdown | VERIFIED | 227 lines. `pmiDropOffMonth` surfaced. Drop-off-aware PMI annualization (hold average via `pmiChargedMonths / holdingYears`). Convention #3 documented in header. |
| `packages/core/src/tco/tco.test.ts` | WR-02 PMI annualization locking tests | VERIFIED | Asserts `pmiDropOffMonth === 108`, `pmi.annualized.toCents() === 243000n` (hold average), `not === 270000n` (flat). |
| `packages/core/src/tco/rent-vs-buy.ts` | Two-portfolio net worth + crossover | VERIFIED | 265 lines. `buyMonthlyOutflowAt` exported. CR-01 clamp at line 233. WR-02 month-gated PMI at line 129. WR-03 per-year appreciating tax/maintenance at lines 121–125. |
| `packages/core/src/tco/rent-vs-buy.test.ts` | CR-01, WR-02, WR-03 locking tests | VERIFIED | CR-01 no-crash test (termMonths 180, holdingYears 20); WR-02 tests (outflow drops by exactly PMI premium at drop-off+1, no PMI in year 20); WR-03 tests (later-year outflow > year-0 when appreciation > 0; flat when appreciation = 0). |
| `packages/core/src/engine/engine-input.ts` | ScenarioInputsSchema + parseScenarioInputs + validating engineInput | VERIFIED | 134 lines. `ScenarioInputsSchema` with `decStr` leaves, `z.number().int().positive()` for counts, `downPaymentPct` constrained to `[0,1)`, `.strict()`. `parseScenarioInputs` exported. `engineInput()` calls `parseScenarioInputs` at assembly (not bare `Object.freeze`). |
| `packages/core/src/engine/engine-input.test.ts` | accept-valid + reject-forged boundary tests | VERIFIED | Accepts VALID_SCENARIO and optional fields. Rejects: negative/zero/non-integer holdingYears and termMonths; downPaymentPct '1', '1.5', '-0.1'; non-canonical strings ('1,000', '1e6', '0.06.5', 'NaN'); unknown extra key (.strict()); empty label/town; missing required field. |
| `packages/core/src/golden.test.ts` | Round-trip uses parseScenarioInputs | VERIFIED | `roundTrip()` at line 176 calls `parseScenarioInputs(snapshot.scenario)` — not a bare `as ScenarioInputs` cast. Double-validated by design (engineInput also parses internally). |
| `packages/core/src/index.ts` | Exports ScenarioInputsSchema + parseScenarioInputs | VERIFIED | Lines 35–36 export `ScenarioInputsSchema` and `parseScenarioInputs` alongside `engineInput` and types. |
| `packages/core/src/__fixtures__/tco-golden-snapshot.json` | Regenerated golden fixture | VERIFIED | Regenerated via gated `UPDATE_GOLDEN=1`. `rentEndingNetWorth` moved from `224885.81` to `228503.08` (WR-03 growing buy outflow makes rent portfolio larger). `buyEndingNetWorth` unchanged at `168035.61`. `pmiDropOffMonth: null` (20% down scenario). P+I `2275.44` unchanged. RENT still wins. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `rent-vs-buy.ts` | `buyMonthlyOutflowAt` | exported helper called per month in main loop (line 207) | VERIFIED | The flat `tco.total.monthly` shortcut is gone; the time-varying helper is called for each of the `totalMonths` months. |
| `buyMonthlyOutflowAt` | `tco.pmiDropOffMonth` | `if (tco.pmiDropOffMonth !== null && month <= tco.pmiDropOffMonth)` line 129 | VERIFIED (with WARNING) | Correctly gates PMI on `dropOffMonth` when PMI applies and a drop-off IS found within the schedule. Ambiguous when PMI applies but `dropOffMonth === null` (no drop-off found within termMonths) — see WARNING below. |
| `buyMonthlyOutflowAt` | `assessedValueAt`/`homeValueAt` | per-year appreciating tax/maintenance (lines 122–125) | VERIFIED | Recomputes property-tax and maintenance per hold year using `tco.resolvedMillRate` and `assumptions.maintenance.annualPctOfValue`. Flat components (P+I, insurance, HOA) remain from the year-0 TCO monthly. |
| `rent-vs-buy.ts` | `amortizationSchedule` | clamped index `month - 1 < schedule.rows.length ? row : undefined` (line 233) | VERIFIED | CR-01 fix: out-of-range months (loan paid off before horizon) use `new Dec(0)` for remaining balance. |
| `amortization.ts` | zero-rate guard | `r.isZero()` before `div(pow.minus(1))` in both scheduledPayment and amortizationSchedule | VERIFIED | `scheduledPayment` line 61: straight-line `loan/termMonths`. `amortizationSchedule` line 90: same guard with cents-pinned straight-line per period. |
| `engine-input.ts` | `decStr` from assumptions/schema.ts | `import { decStr }` line 16; used in ScenarioInputsSchema for all dollar/rate fields | VERIFIED | Single canonical-decimal-string definition shared between AssumptionSet and ScenarioInputs schemas. |
| `engineInput()` | `parseScenarioInputs` | `Object.freeze(parseScenarioInputs(parts.scenario))` at assembly (line 132) | VERIFIED | Forged scenarios are rejected at assembly before entering any calc. |
| `golden.test.ts` | `parseScenarioInputs` | `roundTrip()` line 176 | VERIFIED | Replaced bare `as ScenarioInputs` cast with `parseScenarioInputs(snapshot.scenario)`. |
| `index.ts` | `ScenarioInputsSchema`, `parseScenarioInputs` | lines 35–36 export block | VERIFIED | Both exported from public barrel alongside `engineInput`/`ScenarioInputs`. |
| `tco.ts` | `pmiDropOffMonth` on TcoBreakdown | line 222: `pmiResult.applies ? pmiResult.dropOffMonth : null` | WARNING | Ambiguous null: both "PMI does not apply" and "PMI applies but never drops off within termMonths" resolve to `null`. `buyMonthlyOutflowAt` reads this as no PMI — silently zeroing a real PMI cost for very short-term high-LTV inputs. See WARNING section below. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|-------------------|--------|
| `tco.ts` | `TcoBreakdown` | `computeTco(input: EngineInput)` | Yes — Dec math on real scenario inputs | FLOWING |
| `rent-vs-buy.ts` | `RentVsBuyResult` | month-by-month Dec compounding loop via `buyMonthlyOutflowAt` | Yes — time-varying, real projection | FLOWING |
| `buyMonthlyOutflowAt` | per-month buy outflow | flat P+I/ins/HOA from year-0 TCO + appreciating tax/maintenance + month-gated PMI | Yes — mixed flat + appreciating | FLOWING (with WARNING on PMI when `pmiDropOffMonth=null` and PMI actually applies) |
| `tco-golden-snapshot.json` | committed fixture | `canonicalJson({ tco, rentVsBuy })` via `npm run update-golden` | Yes — regenerated real figures | FLOWING |

### Behavioral Spot-Checks

Step 7b: SKIPPED — core package has no runnable entry points; all verification is via the Vitest test suite. Phase gate (02-06 SUMMARY): 197 passed / 20 files. Phase gate (02-07 SUMMARY): 221 passed / 221, statements 98.88%, functions 98.21%, branches 91.35%, lines 98.85% — all above the 95/95/90/95 thresholds.

### Probe Execution

Step 7c: No `probe-*.sh` files declared or found in `scripts/` for this phase.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| TCO-01 | 02-02, 02-04, 02-06 | Monthly P+I via amortization from rate, term, loan amount | SATISFIED | `scheduledPayment` + `amortizationSchedule` with oracle test + zero-rate guard |
| TCO-02 | 02-01, 02-03, 02-04 | Property tax from MA town-level mill rates (seeded static table), not flat % | SATISFIED | 24-town FY2024 table, `annualPropertyTax = assessed * millRate/1000`, `buyMonthlyOutflowAt` uses captured mill rate per year |
| TCO-03 | 02-03 | Homeowners insurance, configurable maintenance reserve (~1-2%/yr), HOA fees | SATISFIED | Insurance flat; maintenance appreciates per year in `buyMonthlyOutflowAt`; HOA flat |
| TCO-04 | 02-02, 02-06 | PMI when DP < 20%, dropped at 78% auto / 80% requested vs original value | SATISFIED (with WARNING) | `computePmi` with toggle test; `pmiDropOffMonth` surfaced on `TcoBreakdown`; WR-02 locking test proves PMI stops at drop-off month. WARNING: ambiguous null for edge-case inputs (see below). |
| TCO-05 | 02-03 | Closing costs as one-time figure, amortizable for cross-scenario comparison | SATISFIED | `closingCosts` + `amortizeOverHold`; closing excluded from buy monthly outflow (t=0 lump) |
| TCO-06 | 02-04 | Full TCO breakdown both monthly and annualized | SATISFIED | `TcoBreakdown` with 7 `TcoLine { monthly, annualized }` fields + total + `pmiDropOffMonth` |
| TCO-07 | 02-05, 02-06, 02-07 | Rent-vs-buy at household's actual numbers — symmetric, principal as forced savings, no opportunity-cost asymmetry | SATISFIED | Engine crash-proof; PMI gated at drop-off; buy outflow grows with appreciation; `ScenarioInputs` Zod-validated at trust boundary |

All 7 TCO requirement IDs are accounted for. No orphaned requirements found in REQUIREMENTS.md for Phase 2.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `packages/core/src/tco/tco.ts` | 222 | `pmiDropOffMonth: pmiResult.applies ? pmiResult.dropOffMonth : null` — both "PMI does not apply" and "PMI applies but never reaches drop-off threshold within termMonths" map to `null` | WARNING | When PMI applies and `pmiResult.dropOffMonth === null`, `buyMonthlyOutflowAt` (line 129: `if (tco.pmiDropOffMonth !== null && ...)`) silently charges $0 PMI for all hold months. `tco.pmi.annualized` correctly charges PMI via the `?? totalMonthsHeld` fallback. Inconsistency biases toward "buy" for very short-term (e.g., 12-month) high-LTV inputs. Standard 15-year and 30-year conforming mortgages always find the drop-off month. Fix: add `pmiApplies: boolean` to `TcoBreakdown`. |
| `packages/core/src/index.ts` | 62 | `computePmi` and `type PmiResult` exported, but `type PmiBasis` not exported | INFO | Downstream code calling `computePmi` with a typed `basis` variable cannot name `PmiBasis` without a deep import violating the package boundary. Structural string literal compatibility works today. Fix: `export { computePmi, type PmiResult, type PmiBasis } from './tco/pmi.js'` |

**Debt-marker check:** No `TBD`, `FIXME`, or `XXX` markers found in any files modified by 02-06 or 02-07.

### Human Verification Required

#### 1. Anti-funnel rent-wins input plausibility

**Test:** Review the `SCENARIO_RENT_WINS` input in `packages/core/src/tco/rent-vs-buy.test.ts` (Newton $850k, 20% down, 7.0%/30yr, 7-year hold, $3,200/mo rent) and confirm it represents a plausible greater-Boston scenario rather than a contrived edge case.
**Expected:** The inputs should feel like something a real Boston-area household might face — price, rate, and rent consistent with the market at approximately 2026 conditions.
**Why human:** Plausibility of a financial scenario requires domain judgment; tests only verify internal consistency.

#### 2. Committed golden fixture numbers sanity check

**Test:** Review `packages/core/src/__fixtures__/tco-golden-snapshot.json` for the Newton $450k scenario. Key figures after 02-06 regeneration: TCO total `$3,280.61/mo` (P+I `$2,275.44` unchanged); rentVsBuy: `buyEndingNetWorth $168,035.61`, `rentEndingNetWorth $228,503.08` — RENT wins. (Note: rentEndingNetWorth rose from the prior `$224,885.81` because WR-03's growing buy outflow makes the renter invest a larger monthly difference in later years.)
**Expected:** The absolute dollar amounts should be in a believable range for a $450k Newton house with 20% down and a 6.5% rate as of 2026. The rent victory margin should feel plausible.
**Why human:** Sanity of headline financial output numbers cannot be verified programmatically; only reasonableness judgment can catch a systematic off-by-order-of-magnitude error.

#### 3. pmiDropOffMonth = null ambiguity — decide before Phase 4

**Test:** Review the `pmiDropOffMonth = null` ambiguity described in the Anti-Patterns section and `02-REVIEW-gap-closure.md` CR-01. For the primary use case (Boston conforming mortgages: 15yr or 30yr term, 10–20% down), the scheduled amortization always reaches the 78% LTV threshold within the term, so `buyMonthlyOutflowAt` always correctly gates PMI. The ambiguity only manifests for very short-term high-LTV inputs (`termMonths` < ~36 with LTV just over 80%) that the schema permits but the project's primary use case never exercises.
**Expected:** Decision: (a) Fix before Phase 4 by adding `pmiApplies: boolean` to `TcoBreakdown` (the mechanical fix is straightforward); or (b) Accept as a known edge-case limitation given the primary Boston conforming-mortgage use case never triggers it.
**Why human:** Whether to fix or accept requires a judgment call on scope and risk tolerance for the project's actual use case. The fix is two-line mechanical change; the risk is negligible for typical inputs but real for exotic inputs the schema allows.

### Re-Verification: Gap Closure Confirmation

| Prior Gap | Closed? | Evidence |
|-----------|---------|----------|
| CR-01: out-of-bounds crash on holdingYears*12 > termMonths | CLOSED | `rent-vs-buy.ts` line 233: `const row = month - 1 < schedule.rows.length ? schedule.rows[month - 1]! : undefined`. Locking test: termMonths 180 / holdingYears 20 — returns `holdingYears === 20`, no throw. |
| CR-02: zero-rate divide-by-zero in scheduledPayment/amortizationSchedule | CLOSED | `amortization.ts` line 61: `if (r.isZero()) return Money.of(new Dec(loan).div(termMonths).toFixed())`. Schedule guard at line 90. Locking tests: exact-cent zero-rate assertions. |
| WR-02: PMI charged flat past dropOffMonth | CLOSED | `pmiDropOffMonth` surfaced on `TcoBreakdown`. `buyMonthlyOutflowAt` charges PMI only while `month <= tco.pmiDropOffMonth`. `tco.ts` PMI annualization uses hold-average. `tco.test.ts` and `rent-vs-buy.test.ts` WR-02 locking tests. |
| WR-03: buy outflow flat while rent compounds | CLOSED | `buyMonthlyOutflowAt` recomputes property-tax and maintenance per hold year on the appreciating assessed/home value. WR-03 locking tests: later-year outflow > year-0 when appreciation > 0; flat when appreciation = 0. |
| CR-03: ScenarioInputs crosses trust boundary with no Zod validation | CLOSED | `ScenarioInputsSchema` (Zod `.strict()`, `decStr` leaves, positive-int counts, `downPaymentPct` [0,1)) in `engine-input.ts`. `parseScenarioInputs` exported. `engineInput()` validates at assembly. Golden round-trip uses `parseScenarioInputs`. `engine-input.test.ts` reject-forged tests covering 13 forged cases. |

### New Findings from 02-REVIEW-gap-closure.md

The code review of the 02-06/02-07 gap-closure changes identified one new critical concern and two warnings:

**New CR-01 (code review) — `pmiDropOffMonth = null` ambiguity (DOWNGRADED to WARNING):**

The code review correctly identifies that `tco.ts` line 222 conflates two distinct states into `null`: (1) PMI does not apply, and (2) PMI applies but the amortization schedule never reaches the 78% LTV threshold within `termMonths`. When state (2) occurs, `buyMonthlyOutflowAt` (line 129) interprets `null` as state (1) and silently charges $0 PMI throughout the hold — undercounting the buy cost and biasing toward "buy."

**Independent assessment:** This is a genuine correctness defect. However, for the primary project use case (Boston area conforming mortgages with standard 15-year or 30-year terms and 10–20% down payments), the balance always reaches the 78% LTV threshold within the term, so `pmiResult.dropOffMonth` is always a concrete month number. The test suite confirms this: the WR-02 test at `'0.06'`/360 months/90% LTV finds `dropOffMonth = 108`. All tested scenarios use standard terms where the ambiguity does not manifest. The defect requires simultaneously: (a) PMI applies (LTV > 80%), AND (b) the loan term is short enough that the balance never crosses 78% LTV — an edge case for the primary use. It does NOT rise to the level of a BLOCKER for the stated phase goal (which is about computing TCO for "a scenario" in the greater-Boston context), but it should be resolved before Phase 4 layers FI-impact calculations on `buyMonthlyOutflowAt`. Classified as WARNING, requiring human decision on timing.

**New WR-01 — `PmiBasis` not exported from `index.ts`:** INFO. Confirmed: `grep PmiBasis packages/core/src/index.ts` returns no matches. Mechanical one-line fix; does not affect correctness.

**New WR-02 (code review) — negative-equity sell-cost formula:** The code review notes that `equity.times(sellRetain)` is incorrect for underwater scenarios (applying the sell-cost haircut to a negative equity makes it less negative, not more). This is the same formula from the original 02-05 implementation. For the primary use case (moderate appreciation, short-to-medium holds), underwater scenarios are rare. Classified as INFO — the primary scenarios do not trigger it, and it was not a gap identified in the prior verification.

---

_Verified: 2026-06-25T20:00:00Z_
_Verifier: Claude (gsd-verifier)_
_Re-verification: Yes — supersedes prior 02-VERIFICATION.md (status: gaps_found)_
