---
phase: 02-tco-engine
reviewed: 2026-06-25T00:00:00Z
depth: standard
files_reviewed: 6
files_reviewed_list:
  - packages/core/src/tco/amortization.ts
  - packages/core/src/tco/pmi.ts
  - packages/core/src/tco/tco.ts
  - packages/core/src/tco/rent-vs-buy.ts
  - packages/core/src/engine/engine-input.ts
  - packages/core/src/index.ts
findings:
  critical: 1
  warning: 2
  info: 1
  total: 4
status: issues_found
---

# Phase 02 Gap-Closure: Code Review Report

**Reviewed:** 2026-06-25
**Depth:** standard
**Files Reviewed:** 6
**Status:** issues_found

## Summary

This review covers the gap-closure plans 02-06 (calculation-correctness fixes: zero-rate amortization guard, rent-vs-buy out-of-bounds clamp, PMI drop-off handling, appreciating buy-outflow) and 02-07 (ScenarioInputs Zod trust-boundary validation).

The zero-rate amortization guard (CR-02), the schedule index clamp (CR-01), and the WR-02/WR-03 appreciating-outflow fixes are correctly implemented and well-tested. The Zod schema boundary (CR-03) is sound and mirrors the AssumptionSet discipline faithfully.

One critical bug remains: the `pmiDropOffMonth` field on `TcoBreakdown` conflates two distinct states — "PMI does not apply" and "PMI applies but never drops off within the amortization term" — both represented as `null`. The `buyMonthlyOutflowAt` function treats both cases identically (zero PMI in the monthly outflow), silently zeroing out a real cost when the schedule never hits the 78% LTV threshold. Additionally, `PmiBasis` is missing from the public `index.ts` export surface despite `computePmi` being exported. Two warnings cover negative-equity sell-cost distortion and the redundant `assumptions.pmi.dropOffLtv` field.

---

## Critical Issues

### CR-01: `pmiDropOffMonth = null` is ambiguous — PMI silently zeroed in monthly outflow when schedule never reaches drop-off threshold

**File:** `packages/core/src/tco/tco.ts:222` and `packages/core/src/tco/rent-vs-buy.ts:129`

**Issue:** `TcoBreakdown.pmiDropOffMonth` is `null` in two distinct situations:
1. PMI does not apply at all (`pmiResult.applies === false`).
2. PMI applies but the amortization schedule never reduces the balance to the 78% LTV threshold within `termMonths` (e.g. a very high-LTV loan on a very short term, or any future scenario with exotic inputs the schema permits).

In `tco.ts` line 222:
```typescript
pmiDropOffMonth: pmiResult.applies ? pmiResult.dropOffMonth : null,
```
When `pmiResult.applies === true` and `pmiResult.dropOffMonth === null` (never drops off), `pmiDropOffMonth` is `null` — indistinguishable from no-PMI.

In `buyMonthlyOutflowAt` (rent-vs-buy.ts, line 129):
```typescript
if (tco.pmiDropOffMonth !== null && month <= tco.pmiDropOffMonth) {
```
This guard fails for both cases, so when PMI applies but never reaches the threshold, the entire PMI cost is silently omitted from every month's buy outflow. The borrower is charged PMI for the whole hold (correctly captured in `tco.pmi.annualized` via `pmiChargedMonths ?? totalMonthsHeld`), but that cost is entirely absent from the `rentVsBuy` monthly simulation, making buying appear cheaper than it is and biasing the verdict toward "buy."

The TCO breakdown's `pmi.annualized` gets the right number (because `pmiChargedMonths` uses `?? totalMonthsHeld`) but the rent-vs-buy loop does not.

**Fix:** Distinguish the two null cases. One approach: add a separate `pmiApplies` boolean to `TcoBreakdown` alongside the nullable `pmiDropOffMonth`, so callers can tell the difference.

In `tco.ts`:
```typescript
// In TcoBreakdown interface, add:
readonly pmiApplies: boolean;

// In computeTco return:
pmiApplies: pmiResult.applies,
pmiDropOffMonth: pmiResult.applies ? pmiResult.dropOffMonth : null,
```

In `rent-vs-buy.ts`, update `buyMonthlyOutflowAt` to charge PMI for the full hold when it applies but never drops off:
```typescript
// MONTH-GATED PMI (WR-02): charge PMI if applies AND either month <= drop-off, or there is
// no drop-off within the schedule (drop-off == null means PMI never terminates in the term).
let pmiMonthly = Money.zero();
if (tco.pmiApplies) {
  const neverDropsOff = tco.pmiDropOffMonth === null;
  const stillCharging = neverDropsOff || month <= tco.pmiDropOffMonth!;
  if (stillCharging) {
    const loan = new Dec(price).times(new Dec(1).minus(new Dec(downPaymentPct))).toFixed();
    const monthlyPmiRate = new Dec(pmiAnnualRateOfLoan).div(12).toFixed();
    pmiMonthly = Money.of(loan).mul(monthlyPmiRate);
  }
}
```

---

## Warnings

### WR-01: `PmiBasis` type not exported from `index.ts` despite `computePmi` being public

**File:** `packages/core/src/index.ts:62`

**Issue:** `computePmi` is exported through the package's public surface, and its `basis` parameter requires a `PmiBasis` value (`'auto-78' | 'requested-80'`). `PmiBasis` itself is not re-exported from `index.ts`. Downstream consumers in `apps/web` or Phase 3 code that need to type a `basis` variable explicitly cannot do so without a deep import (`@house/core/tco/pmi`) that violates the package boundary design (the whole point of `index.ts` is to be the single import door).

TypeScript accepts bare string literals at the call site structurally, so this does not cause a compile error today, but any downstream code attempting to name the `PmiBasis` type in its own signatures is stuck.

**Fix:**
```typescript
// In packages/core/src/index.ts, extend the existing computePmi export line:
export { computePmi, type PmiResult, type PmiBasis } from './tco/pmi.js';
```

### WR-02: Negative-equity liquidation distorts the sell-cost model for underwater houses

**File:** `packages/core/src/tco/rent-vs-buy.ts:235-236`

**Issue:** The equity liquidation is:
```typescript
const equity = homeValue.minus(remainingBalance);
const liquidatedEquity = equity.times(sellRetain);   // sellRetain = 1 - sellCostPct
```

When `equity < 0` (the house is underwater — balance exceeds current home value), `liquidatedEquity = equity * (1 - sellCostPct)`. Because `(1 - sellCostPct) < 1`, multiplying a negative value by a fraction less than 1 makes the result LESS negative than `equity` alone — i.e., the sell-cost haircut is applied in reverse, as if selling were a benefit. The correct model for an underwater sale is `liquidatedEquity = equity - sellCostPct * homeValue` (sell costs are on the gross proceeds, not on equity), which is MORE negative than `equity` when proceeds are positive.

This biases the buy path favorably in underwater scenarios (e.g., short hold at high appreciation=0 or negative appreciation). The effect is small for the current default assumptions (0.75% real appreciation over a 7-year hold rarely goes underwater), but can be triggered with `appreciation.realAnnual = '-0.05'` or similar stress inputs that the schema does not prevent.

**Fix:** Replace the single-line liquidation with an explicit net-proceeds formula:
```typescript
const grossProceeds = homeValue;  // already a Dec
const sellCosts = grossProceeds.times(new Dec(sellCostPct));
const liquidatedEquity = homeValue.minus(remainingBalance).minus(sellCosts);
// i.e.: net = home_value * (1 - sellCostPct) - remaining_balance
// equivalently:
const netProceeds = homeValue.times(sellRetain);
const liquidatedEquity = netProceeds.minus(remainingBalance);
```
The corrected formula `homeValue * (1 - sellCostPct) - remainingBalance` is the standard real-estate net-proceeds model: sell costs are a percentage of the SALE PRICE, not of the owner's equity. This makes the underwater case correctly MORE negative.

---

## Info

### IN-01: `assumptions.pmi.dropOffLtv` is stored but never read by the PMI engine

**File:** `packages/core/src/assumptions/schema.ts:73-74` and `packages/core/src/tco/pmi.ts`

**Issue:** The `AssumptionsV1` and `AssumptionsV2` schemas both carry a `pmi.dropOffLtv` field (documented as "e.g. '0.8' — PMI removable at/under 80% LTV"). The DEFAULT_ASSUMPTIONS sets it to `'0.8'`. However, `computePmi` does not read this field from `assumptions` at all — the drop-off threshold is controlled entirely by the `PmiBasis` enum (`'auto-78'` = 78% threshold, `'requested-80'` = 80% threshold), hard-coded inside `dropOffThreshold()` in `pmi.ts`. The stored `dropOffLtv` assumption is silently ignored in every call path.

This creates two problems:
1. A user who edits `dropOffLtv` in persisted assumptions would expect the PMI behavior to change — it does not.
2. The schema carries a dead field that adds confusion about which source of truth governs drop-off.

**Fix (short-term):** Add a code comment to the schema noting that `dropOffLtv` is superseded by the `PmiBasis` argument and is retained for snapshot compatibility only. Alternatively, remove `dropOffLtv` from the schema if no snapshot has been committed that depends on it, and update the `computeTco` call in `tco.ts` to derive the `basis` from `assumptions.pmi` if the design intent was always to make drop-off a user-tunable.

---

_Reviewed: 2026-06-25_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
