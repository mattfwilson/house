# Phase 3: Affordability Engine - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-26
**Phase:** 3-affordability-engine
**Areas discussed:** True-affordability depth, Solve direction & down payment, Household inputs contract, The gap output

---

## True-affordability depth

### Q: How should 'true affordability' be governed in Phase 3, given the full FI-date engine lands in Phase 4?

| Option | Description | Selected |
|--------|-------------|----------|
| Savings-rate floor | Max price whose housing cost leaves annual savings ≥ a target floor; Phase 4 computes the actual FI-date shift | ✓ |
| Minimal FI-date projection now | Light net-worth compounding to find FI date; max price where FI date ≤ threshold | |
| Both: floor + FI-date check | Compute both, take the binding one | |

**User's choice:** Savings-rate floor — clean phase boundary, honors AFF-02 by proxy.

### Q: How do you want to express the FI 'threshold' the house must not violate?

| Option | Description | Selected |
|--------|-------------|----------|
| Target savings rate / annual savings | User supplies the savings rate their FI plan requires | ✓ |
| Target retirement date/age | User supplies a target FI date; Phase 3 derives required savings rate | |
| Target FI number (net worth) | User supplies the net-worth target | |

**User's choice:** Target savings rate / annual savings — no FI-number/date math in Phase 3.

### Q: When buying drains your savings, what should Phase 3 count as the drain against the floor?

| Option | Description | Selected |
|--------|-------------|----------|
| Housing cost minus current rent | Incremental drain = TCO total monthly − current rent; principal counts as cash out | ✓ |
| Full housing cost, principal excluded | Drain = TCO total − principal − current rent (principal = forced savings) | |
| Absolute housing cost | Drain = full TCO total, ignoring current rent | |

**User's choice:** Housing cost minus current rent — matches rent-vs-buy delta + anti-funnel baseline.

### Q: Your savings rate / floor is measured against which income basis?

| Option | Description | Selected |
|--------|-------------|----------|
| Gross income | Savings rate = annual savings ÷ gross income; shares income input with DTI denominator | ✓ |
| After-tax (net) income | Savings rate ÷ after-tax income | |
| You decide | Keep bank + true consistent | |

**User's choice:** Gross income.

### Q: Should true affordability also gate on whether you actually have the down payment + closing cash?

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — min(savings-rate ceiling, cash-on-hand ceiling) | DP + closing ≤ available net worth − reserve | ✓ |
| No — savings-rate floor only | Funding the DP left to Phase 4 | |
| Flag only | Warn rather than cap | |

**User's choice:** Yes — true affordability = min(savings-rate ceiling, cash-on-hand ceiling).

---

## Solve direction & down payment

### Q: What's the primary output shape for both bank and true affordability?

| Option | Description | Selected |
|--------|-------------|----------|
| Solve for max price + also evaluate a given scenario | Headline = max affordable price; also pass/headroom on a priced scenario | ✓ |
| Solve for max price only | Just the ceilings | |
| Evaluate a given scenario only | No price-solving | |

**User's choice:** Solve for max price + also evaluate a given scenario.

### Q: When solving for max price, how is the down payment treated?

| Option | Description | Selected |
|--------|-------------|----------|
| Fixed dollar amount | loan = price − DP; LTV/PMI rise with price; ties to cash-on-hand gate | ✓ |
| Fixed percent of price | Reuses downPaymentPct; constant LTV/PMI | |
| Support both | Scenario specifies either | |

**User's choice:** Fixed dollar amount.

---

## Household inputs contract

### Q: Where should household financials live?

| Option | Description | Selected |
|--------|-------------|----------|
| New household/profile block on EngineInput | Zod-validated like ScenarioInputs; the shape Phase 6 persists | ✓ |
| Extend ScenarioInputs | Couples finances to each house | |
| Put in AssumptionSet | Wrong category — facts not tunables | |

**User's choice:** New household/profile block on EngineInput.

### Q: How should existing monthly debt obligations be represented?

| Option | Description | Selected |
|--------|-------------|----------|
| Single monthly total | One figure: total minimum monthly debt payments | ✓ |
| Itemized list of debts | Array of named debts | |

**User's choice:** Single monthly total.

### Q: Where does 'current rent' come from?

| Option | Description | Selected |
|--------|-------------|----------|
| Household-level current rent | A fact about you; ScenarioInputs.monthlyRent stays as the comparable's market rent | ✓ |
| Reuse ScenarioInputs.monthlyRent | Conflates comparable rent with current rent | |

**User's choice:** Household-level current rent.

---

## The gap output

### Q: What should the gap output contain?

| Option | Description | Selected |
|--------|-------------|----------|
| Both ceilings + signed gap + which constraint binds each | bank/true max price, gap, binding constraint per side | ✓ |
| Both ceilings + signed gap | Numbers without binding detail | |
| Just the two ceilings | Minimal | |

**User's choice:** Both ceilings + signed gap + which constraint binds each.

### Q: Should the gap carry a directional verdict, and on what unit?

| Option | Description | Selected |
|--------|-------------|----------|
| Directional verdict, compared on price | bank>true / true>bank / aligned, on max price | ✓ |
| Numbers only, no verdict | Leave framing to Phase 7 | |
| You decide | Keep anti-funnel reachable | |

**User's choice:** Directional verdict, compared on price.

---

## Claude's Discretion

- Exact field names/units of the new household/profile type and its Zod schema; reserve default value; result-object shapes (bank, true, evaluate-scenario, gap).
- The max-price solve mechanism (closed-form vs binary search) and convergence tolerance.
- Whether to widen the Money API with comparison/division helpers or use internal Dec for solve/ratio math.
- Whether bank affordability also returns front-/back-end ratios for a given price (evaluate-scenario path).

## Deferred Ideas

- Actual FI-date shift / net-worth trajectory / ranking / sensitivity / oracle reconciliation — Phase 4.
- Bank "stress/qualifying rate" higher than the note rate — deferred refinement.
- Itemized debt list — later nicety.
- Persistence of household/profile + scenarios — Phase 6.
- ARM / variable-rate qualification — fixed-rate only (Phase 2 D-16).
