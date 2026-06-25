---
status: partial
phase: 02-tco-engine
source: [02-VERIFICATION.md]
started: 2026-06-25T20:00:00Z
updated: 2026-06-25T20:00:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Confirm anti-funnel rent-wins input plausibility
expected: Newton $850k / 7.0% / 7-year hold / $3,200/mo rent is a realistic greater-Boston scenario. BUY ending NW $257,910 vs RENT $563,158 (or similar updated figures) with rent winning should feel plausible — not a pathological edge case.
result: [pending]

### 2. Confirm committed golden fixture numbers are sane
expected: Newton $450k, 20% down, 6.5%/30yr, 10yr hold: TCO total $3,280.61/mo (P+I $2,275.44 unchanged), rent-vs-buy winner RENT (rentEndingNetWorth $228,503.08, buyEndingNetWorth $168,035.61). These should be in a believable range for a $450k Newton house.
result: [pending]

### 3. Assess pmiDropOffMonth=null ambiguity acceptability
expected: For the primary use case (Boston conforming mortgages: 15yr or 30yr term, 10–20% down), the scheduled amortization always reaches the 78% LTV threshold within the term, so pmiDropOffMonth is always a concrete month number and the ambiguity does not manifest. Decide whether to add a `pmiApplies` boolean to `TcoBreakdown` to disambiguate before Phase 4 layers the FI-impact engine on top of `buyMonthlyOutflowAt`.
result: resolved — user chose to fix. Quick task 260625-k0h added `pmiApplies: boolean` to TcoBreakdown and re-gated buy PMI via the exported `shouldChargePmi(pmiApplies, pmiDropOffMonth, month)` predicate so the buy-outflow and tco.pmi.annualized surfaces agree. Confirmed `applies=true/dropOff=null` is currently unreachable via computeTco (amortization always terminates at $0 → finite drop-off), so this was a latent/defensive fix. 227 tests pass, tsc clean, golden diff additive only. Commits d4d0ac2 / 670c74a / 836775e.

## Summary

total: 3
passed: 1
issues: 0
pending: 2
skipped: 0
blocked: 0

## Gaps
