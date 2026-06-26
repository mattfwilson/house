# Phase 4: FI-Impact Engine & Sensitivity (flagship) - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-26
**Phase:** 4-fi-impact-engine-sensitivity-flagship
**Areas discussed:** FI target & renter housing, Baseline & projection depth, Oracle reconciliation, Sensitivity / tornado design, Comparison & ranking

---

## FI target & renter housing

### FI target definition

| Option | Description | Selected |
|--------|-------------|----------|
| Target spend ÷ SWR | FI number = target annual retirement spend ÷ swr.rate; adds one household input; ties to SWR sensitivity | ✓ |
| Explicit FI number | Household supplies the target portfolio value directly; SWR becomes decorative/un-sweepable | |
| Multiple of current spend | Derive target spend from today's spending × (1/SWR); assumes retirement spend == working spend | |

**User's choice:** Target spend ÷ SWR
**Notes:** Adds `targetAnnualRetirementSpend` to the household block. SWR stays load-bearing so the tornado can sweep it.

### Renter retirement housing (the fulcrum)

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — asymmetric targets | Renter target = (spend + annual rent) ÷ SWR; owner target = spend ÷ SWR (housing covered post-payoff) | ✓ |
| No — symmetric target | Both hit the same target; housing captured only via accumulation contribution difference | |
| Make it a toggle | Stored assumption, stress-tested both ways | |

**User's choice:** Yes — asymmetric targets
**Notes:** The honest anti-funnel framing; strongest pro-buy force, must be surfaced and defensible.

### Owner perpetual carrying cost

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — owner target += tax+ins+maint | Owner FI target adds ongoing property tax + insurance + maintenance; symmetric with renter's rent | ✓ |
| No — spend already includes it | Assume target spend already bakes in upkeep; don't add separately | |
| You decide | Claude picks the consistent treatment | |

**User's choice:** Yes — owner target += tax+ins+maint
**Notes:** Both perpetual housing costs sit in their respective targets, in today's dollars. Prevents pretending a paid-off house is free.

### FI-date detection

| Option | Description | Selected |
|--------|-------------|----------|
| First month NW ≥ target | Monthly projection from current NW; FI date = first month NW ≥ that path's target; owner seed −DP/closing, contribution −premium | ✓ |
| Annual step | Same logic, yearly resolution | |
| You decide | Claude chooses step + decomposition | |

**User's choice:** First month NW ≥ target
**Notes:** Monthly, mirrors the existing rentVsBuy loop. FI delta in months and years.

---

## Baseline & projection depth

### Baseline definition

| Option | Description | Selected |
|--------|-------------|----------|
| Keep renting + invest the gap | Baseline = rentVsBuy rent path extended to an FI date; symmetric anti-funnel comparator | ✓ |
| Status-quo snapshot | Current NW + savings compounding, no rent/house reference; not symmetric | |
| You decide | Claude locks the exact baseline | |

**User's choice:** Keep renting + invest the gap

### Projection depth

| Option | Description | Selected |
|--------|-------------|----------|
| Accumulation-only | Project until NW hits target, then stop; no decumulation/Monte-Carlo | ✓ |
| Through decumulation | Continue past FI into withdrawal; invites sequence-of-returns false precision (out of scope) | |
| Cap horizon if FI never reached | Accumulation-only + max horizon safety | (folded into D-07) |

**User's choice:** Accumulation-only
**Notes:** Sequence-of-returns / Monte-Carlo explicitly out of scope (v2).

### Never-FI handling

| Option | Description | Selected |
|--------|-------------|----------|
| Cap horizon → 'FI not reached' | Max-horizon knob; if NW < target at cap, first-class "FI not reached within horizon" verdict | ✓ |
| Return null delta + flag | Same cap, sentinel date + boolean unreachable flag | |
| You decide | Claude picks the encoding | (encoding left to discretion) |

**User's choice:** Cap horizon → 'FI not reached'
**Notes:** The unreachable verdict is the cleanest "don't buy" signal (FI-06). Encoding is Claude's discretion.

---

## Oracle reconciliation

### Oracle form

| Option | Description | Selected |
|--------|-------------|----------|
| Spreadsheet | Excel/Sheets model; hand off numbers as expected values | |
| Code / script | Runnable code/notebook; mirror formulas | |
| Mental model / rules | Assumptions/notes in head; agree on hand-computed examples | |
| No usable oracle yet | No clean external model; build independent hand-verified worked examples as the golden master | ✓ |

**User's choice:** No usable oracle yet
**Notes:** Reframes FI-05 — the independent derivation becomes the oracle. The brief's assumed "existing retirement model to fork" is not a clean artifact.

### Oracle construction

| Option | Description | Selected |
|--------|-------------|----------|
| Closed-form formula + edge cases | Future-value-of-annuity solved for n, independently in the test; + 0% and high-inflation edges | |
| Hand-computed numeric fixtures | A handful of fully worked numeric examples pinned as golden | |
| Both | Closed-form analytic check AND hand-verified numeric fixtures (incl. 0% + high-inflation) | ✓ |

**User's choice:** Both
**Notes:** High-inflation case must route through the Fisher `toReal` path (all-real engine otherwise never sees inflation).

---

## Sensitivity / tornado design

### Perturbation method

| Option | Description | Selected |
|--------|-------------|----------|
| Per-parameter ± bands, stored | Each driver gets its own realistic band as stored data; varied independently | ✓ |
| Uniform ±X% on all | Same relative swing on every parameter; mixes incomparable magnitudes | |
| You decide | Claude picks bands; mechanic locked | |

**User's choice:** Per-parameter ± bands, stored

### Swept parameters

| Option | Description | Selected |
|--------|-------------|----------|
| Six: return, inflation, appreciation, maintenance, tax, SWR | SC5 five + home appreciation (a known top driver) | ✓ |
| Exactly the SC5 five | return, inflation, maintenance, tax, SWR; omits appreciation | |
| You decide | Claude finalizes the list (≥ SC5 five) | |

**User's choice:** Six (incl. appreciation)

### Output shape

| Option | Description | Selected |
|--------|-------------|----------|
| Per-driver FI-date swing, ranked | Each driver's low/base/high FI-date + swing, sorted by magnitude, top drivers flagged; ready-to-render tornado | ✓ |
| FI-date swing + net-worth swing | Also report net-worth-at-horizon swing per driver | |
| You decide | Claude finalizes the result shape | |

**User's choice:** Per-driver FI-date swing, ranked
**Notes:** FI-date is the headline metric; net-worth swing kept out for v1 leanness. Bar chart is Phase 7.

---

## Comparison & ranking

### Ranking and baseline placement

| Option | Description | Selected |
|--------|-------------|----------|
| Baseline as row 0, scenarios by FI delay | Baseline first-class (delta=0); buy scenarios ranked by FI-date delay ascending; unreachable last | |
| All paths ranked together by FI date | Baseline as just another row; rank by absolute FI date | |
| You decide | Claude finalizes shape; baseline-as-first-class-row + rank-by-FI-impact locked | ✓ |

**User's choice:** You decide
**Notes:** Locked rules — baseline always a first-class row, rank by FI-date impact. Recommended default (Claude's discretion): baseline row 0, buy scenarios by FI-date delay ascending, unreachable to the bottom. Tie-break + result-object shape are Claude's discretion.

---

## Claude's Discretion

- `targetAnnualRetirementSpend` field identifier/units + Zod schema placement on the household block.
- Buy path net-worth composition for FI-target detection (liquid-only vs liquid + home equity) — must be locked consistently and documented.
- The value the owner's perpetual tax+ins+maint is computed on at the FI horizon (today's vs appreciated value).
- `Dec` vs widening the `Money` API for FI-target/annuity math.
- Max-horizon default, unreachable result encoding, comparison/ranking result-object shape + tie-break, final sensitivity bands, and the FI projection / FI-delta / tornado result shapes.
- Whether to bump the AssumptionSet schema version for the new sensitivity-band + max-horizon tunables.

## Deferred Ideas

- Decumulation / withdrawal-phase / sequence-of-returns / Monte-Carlo modeling (out of scope, v2).
- Forking/importing a real external retirement model (none exists; independent oracle replaces it).
- Net-worth-at-horizon swing in the tornado (v1 reports FI-date swing only).
- Two-way / interaction sensitivity, Monte-Carlo bands.
- Variable/phased retirement spend, Social Security / pension modeling.
- ARM / variable-rate / stress-qualifying-rate (inherited fixed-rate-only).
- Town scoring, persistence, listings adapter, web UI (Phases 5/6/7).
