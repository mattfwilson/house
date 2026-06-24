# Phase 2: TCO Engine - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-24
**Phase:** 2-tco-engine
**Areas discussed:** Rent-vs-buy depth, Property tax & assessed value, One-time & MA-lumpy costs, Scenario input contract

---

## Rent-vs-buy depth

### RvB output depth
| Option | Description | Selected |
|--------|-------------|----------|
| Two-portfolio ending net worth over a horizon | Fully model buy (equity net of sell costs) vs rent+invest over a configurable horizon; output ending net worth + crossover. Phase 4 layers FI-date/ranking/sensitivity on top. | ✓ |
| Steady-state cost comparison only | Monthly/annual carrying-cost comparison, no horizon/appreciation; Phase 4 owns all projection. | |
| Reusable cash-flow components + steady-state | Emit symmetric cash-flow primitives + steady-state; Phase 4 invests them over time. | |

**User's choice:** Two-portfolio ending net worth over a horizon
**Notes:** Drives the need for a holding horizon, appreciation, and sell-side costs — none present in `AssumptionsV1`.

### Real-vs-nominal convention
| Option | Description | Selected |
|--------|-------------|----------|
| All real (today's dollars), Fisher conversion | Whole projection in today's dollars; nominal→real via Fisher `(1+nom)/(1+inf)−1`. Matches Phase 1's REAL `returns.realAnnual`. | ✓ |
| All nominal, inflate the target | Project nominal, inflate FI target by CPI. | |
| You decide | — | |

**User's choice:** All real (today's dollars), Fisher conversion
**Notes:** Locked project-wide; Phase 4 inherits this as its "single declared convention."

### Holding horizon location
| Option | Description | Selected |
|--------|-------------|----------|
| Per-scenario input | `holdingYears` on `ScenarioInputs`; different houses get different holds. | ✓ |
| Assumption (household-wide default) | Single horizon applied to every scenario. | |
| Both: assumption default, scenario override | Default + per-scenario override. | |

**User's choice:** Per-scenario input

### Home appreciation
| Option | Description | Selected |
|--------|-------------|----------|
| Separate conservative real knob (~1%/yr real) | `appreciation.realAnnual`, low default, explicitly not the portfolio return. | ✓ |
| Tie to inflation (0% real) | Home tracks inflation only. | |
| You decide | — | |

**User's choice:** Separate conservative real knob (~1%/yr real)

### Sell-side transaction costs
| Option | Description | Selected |
|--------|-------------|----------|
| Explicit % haircut (~6–7%) | `transaction.sellCostPct` haircuts equity at liquidation; ~5–6% realtor + MA excise stamp. | ✓ |
| Fold into one flat round-trip cost | Single combined buy+sell friction figure. | |
| Defer to Phase 4 | Skip in P2. | |

**User's choice:** Explicit % haircut (~6–7%)

### Rent escalation
| Option | Description | Selected |
|--------|-------------|----------|
| Flat real (0% real growth) | Rent rises with inflation → constant in today's dollars; knob to stress later. | ✓ |
| Configurable real rent-growth knob | `rent.realGrowthAnnual` to model a hot market. | |
| You decide | — | |

**User's choice:** Flat real (0% real growth)

---

## Property tax & assessed value

### Assessed value model
| Option | Description | Selected |
|--------|-------------|----------|
| Price as proxy + optional assessment-ratio knob | Default assessed = price (`assessmentRatio` 1.0), tunable down where assessments lag. | ✓ |
| Price equals assessed value (no knob) | Simplest, no knob. | |
| Separate assessed-value input per scenario | User enters assessed value directly. | |

**User's choice:** Price as proxy + optional assessment-ratio knob

### Rate source
| Option | Description | Selected |
|--------|-------------|----------|
| Town reference → engine resolves rate, snapshot captures resolved rate+FY | Scenario stores town id; resolved rate+FY vintage captured in snapshot for reproducibility. | ✓ |
| Raw mill rate on the scenario | Explicit `millRate`; no table. | |
| Town reference with raw-rate override | Default from table, per-scenario override. | |

**User's choice:** Town reference → engine resolves rate, snapshot captures resolved rate+FY

### Seed scope
| Option | Description | Selected |
|--------|-------------|----------|
| Curated greater-Boston subset, real FY-stamped DOR rates | ~20–40 towns now; full MA + other metrics → Phase 5. | ✓ |
| Full MA table (~351 municipalities) now | Complete but front-loads Phase 5's job. | |
| Minimal handful to prove the mechanism | 2–3 towns. | |

**User's choice:** Curated greater-Boston subset, real FY-stamped DOR rates

### Tax growth over horizon
| Option | Description | Selected |
|--------|-------------|----------|
| Tracks appreciating assessed value, constant rate | Tax = (assessed grown at appreciation) × constant rate; no 2.5% cap; Prop 2½ caveat flag. | ✓ |
| Flat in real terms (assessment frozen at purchase) | Tax computed once, held flat. | |
| You decide | — | |

**User's choice:** Tracks appreciating assessed value, constant rate

---

## One-time & MA-lumpy costs

### Closing-cost amortization basis
| Option | Description | Selected |
|--------|-------------|----------|
| Over the holding horizon | Spread over per-scenario `holdingYears`; t=0 lump in the net-worth model. | ✓ |
| Over the loan term (e.g. 30 yr) | Standard amortization convention. | |
| Configurable amortization period | Separate knob. | |

**User's choice:** Over the holding horizon

### Closing-cost entry
| Option | Description | Selected |
|--------|-------------|----------|
| % of price assumption + $ override | Stored ~2–3% rate auto-fills; per-scenario dollar override. | ✓ |
| Flat dollar input per scenario | Dollar amount each time, no default. | |
| You decide | — | |

**User's choice:** % of price assumption + $ override

### MA lumpy costs (betterment / Title 5)
| Option | Description | Selected |
|--------|-------------|----------|
| Generic optional one-time-cost line now; town flags in Phase 5 | Optional "other costs" input in P2; qualitative town flagging in Phase 5. | ✓ |
| Full betterment + Title 5 modeling now | Apportionment + septic reserve in P2. | |
| Defer entirely to Phase 5 | No one-time-other input in P2. | |

**User's choice:** Generic optional one-time-cost line now; town flags in Phase 5

---

## Scenario input contract

### Down payment form
| Option | Description | Selected |
|--------|-------------|----------|
| Percent of price (`downPaymentPct`) | Loan = price × (1 − pct); LTV falls out for PMI math. | ✓ |
| Dollar amount (`downPaymentAmount`) | pct derived as amount/price. | |
| Either, user's choice per scenario | Discriminated union, normalized internally. | |

**User's choice:** Percent of price

### Recurring cost expression & escalation
| Option | Description | Selected |
|--------|-------------|----------|
| Maintenance % of appreciating value; insurance & HOA flat real, all tunable | Maintenance reuses `maintenance.annualPctOfValue`, tracks appreciating value; insurance flat $/yr, HOA flat $/mo, flat real. | ✓ |
| All three as flat real dollars | Insurance/maintenance/HOA all flat dollars. | |
| You decide | — | |

**User's choice:** Maintenance % of appreciating value; insurance & HOA flat real, all tunable

### Loan type
| Option | Description | Selected |
|--------|-------------|----------|
| Fixed-rate only | Single fixed rate; keeps amortization invariants clean. | ✓ |
| Fixed + ARM | Adds intro period, caps, index assumptions. | |
| You decide | — | |

**User's choice:** Fixed-rate only

---

## Claude's Discretion

- **Money API extension** for amortization (division/comparison/powers) — use internal `Dec` inside core vs widen the `Money` API; either acceptable if no bare-number dollars cross the public boundary.
- **AssumptionSet versioning** — bump to `AssumptionsV2` with `migrate(V1→V2)` vs extend V1 in place (no persisted snapshots exist until Phase 6).
- **TCO result-object shape**, widened `ScenarioInputs` field identifiers, seeded town-table data structure, insurance default value, and exact default values for new assumptions (within stated conservative bounds).
- **Day-count / monthly-rate convention** — apply US standard (nominal annual / 12), document it.

## Deferred Ideas

- Phase 4: FI-date shift, N-scenario ranking, sensitivity bands, no-purchase baseline, retirement-model oracle reconciliation.
- Phase 5: full-MA mill-rate table + other scoring metrics; MA-specific qualitative flags (septic/Title 5, betterment, 40B).
- ARM mortgage modeling (P2 is fixed-rate only).
- Full betterment-apportionment / Title 5 septic-reserve modeling.
- Forward tax rate-drift / revaluation modeling (P2 holds rate constant, grows assessed value only).
- Persistence of scenarios/assumptions (Phase 6).
