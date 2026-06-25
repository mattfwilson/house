---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: executing
stopped_at: Completed 02-05-PLAN.md (Wave 4 — two-portfolio rent-vs-buy + TCO golden); Phase 2 all plans complete
last_updated: "2026-06-25T17:17:44.325Z"
last_activity: 2026-06-25 -- Phase 02 execution started
progress:
  total_phases: 7
  completed_phases: 1
  total_plans: 11
  completed_plans: 10
  percent: 14
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-06-22)

**Core value:** Answer "what does buying this house do to our early-retirement timeline?" — and be allowed to conclude "don't buy / rent and invest the difference."
**Current focus:** Phase 02 — tco-engine

## Current Position

Phase: 02 (tco-engine) — EXECUTING
Plan: 2 of 7
Status: Ready to execute
Last activity: 2026-06-25 -- Phase 02 execution started

Progress: [██████████] 100%

## Performance Metrics

**Velocity:**

- Total plans completed: 9
- Average duration: —
- Total execution time: —

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01 | 4 | - | - |

**Recent Trend:**

- Last 5 plans: —
- Trend: —

*Updated after each plan completion*
| Phase 01 P01 | 20 | 3 tasks | 16 files |
| Phase 01 P02 | 12 | 2 tasks | 12 files |
| Phase 01 P03 | 10 | 2 tasks | 11 files |
| Phase 01 P04 | 4 | 2 tasks | 9 files |
| Phase 02 P01 | 12 | 3 tasks | 13 files |
| Phase 02 P02 | 10 | 2 tasks | 4 files |
| Phase 02 P03 | 4 | 3 tasks | 6 files |
| Phase 02-tco-engine P04 | 7min | 2 tasks | 4 files |
| Phase 02-tco-engine P05 | 14min | 2 tasks | 5 files |
| Phase 02-tco-engine P06 | 8 | 3 tasks | 7 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Foundation]: Pure framework-agnostic calc core (no React); enforced by package boundary + lint rule
- [Foundation]: Decimal-precise money representation, never raw float dollars
- [Foundation]: Assumptions are first-class versioned stored data; scenarios snapshot a frozen copy for reproducibility
- [FI]: Re-implement FI math clean, reconcile against existing retirement model via golden-master oracle test
- [FI]: Long-horizon SWR default (~3-3.5%), not 4% — configurable assumption
- [Phase ?]: [Foundation]: CORE-01 enforced by eslint-plugin-boundaries deny-by-default (allow only decimal.js+zod) + no-DOM/no-JSX core tsconfig
- [Phase ?]: [Foundation]: Negative fixtures (react import + DOM global) committed as durable proof the lint/tsc guards fail the build; boundary.test.ts asserts it portably via execSync
- [Phase 01-02]: [Foundation]: Single frozen Dec = Decimal.clone({ precision: 34, rounding: ROUND_HALF_EVEN }); global Decimal never .set() (D-14). Banker's rounding demonstrably required (HALF_UP breaks the cent tests)
- [Phase 01-02]: [Foundation]: Money is immutable + branded with a closed string-only API and no number-returning valueOf/toJSON; rounds to cents only at toCents (D-01/D-02/D-03)
- [Phase 01-02]: [Foundation]: Type-level guarantees (no bare-number money math, CalendarDate brand) enforced via *.type-test.ts in the tsc -b graph (esbuild/Vitest do not honor @ts-expect-error)
- [Phase 01-02]: [Foundation]: Determinism runtime guard (Date.now/Math.random throw) wired into the core Vitest setupFiles (D-12 runtime half); CalendarDate is a pure branded YYYY-MM-DD string, no JS Date (D-13)
- [Phase 01-03]: [Foundation]: AssumptionSet is nested by domain + versioned by integer schemaVersion via a Zod discriminatedUnion; unknown versions rejected at parse (D-04/D-05, ASMP-01)
- [Phase 01-03]: [Foundation]: Numeric tunables serialize as canonical decimal STRINGS (decStr regex, not z.number()); floats can never re-enter the boundary (D-06)
- [Phase 01-03]: [Foundation]: EngineInput is the single immutable snapshot unit threading asOf (CalendarDate) + assumptions explicitly, Object.freeze'd, never derived from Date.now (D-11)
- [Phase ?]: [Phase 01-04]: [Foundation]: Reproducibility loop closed (PROF-04) — runCanary does real (1+r)^30 Dec compounding reading an AssumptionSet slice; canonicalJson serializes Money as decimal strings with sorted keys; golden master deep-equal compared, regenerated ONLY behind UPDATE_GOLDEN=1 (not toMatchSnapshot)
- [Phase ?]: [Phase 01-04]: [Foundation]: Public @house/core barrel finalized as the stable downstream import boundary; raw Dec/Decimal no longer exported (dollars cross only as the closed Money API)
- [Phase 02-01]: [TCO]: AssumptionsV2 is current (CURRENT_VERSION=2); new decStr slices appreciation/transaction/rent/closing + tax.assessmentRatio; migrate runs a REAL v1ToV2 transform (not identity), proven by a distinct-valued V1 fixture test
- [Phase 02-01]: [TCO]: AnyAssumptionSet is an explicit z.infer<V1> | z.infer<V2> union, NOT z.infer of the discriminatedUnion — Zod 4 infers the latter as `any` over two large .strict() objects, erasing migrate's discriminant narrowing
- [Phase 02-01]: [TCO]: ScenarioInputs widened to the full house contract (price, downPaymentPct, annualRate, termMonths, holdingYears, town, insuranceAnnual, hoaMonthly, monthlyRent + optional overrides); dollars/rates as canonical decimal strings; Phase 2 is fixed-rate only (D-16)
- [Phase 02-01]: [TCO]: Seeded 24-town FY-stamped greater-Boston mill-rate table (residential rate stored as published, $/$1,000, A3) behind a .strict() Zod row schema; resolveMillRate returns the snapshot-capturable {rate, fy} pair and throws on unknown towns; full-MA + other scoring metrics deferred to Phase 5 (D-09)
- [Phase 02-01]: [TCO]: V2 default tunables seeded as [ASSUMED] conservative values (appreciation 0.0075, sellCost 0.065, rentGrowth 0, closing 0.025, assessmentRatio 1.0) pending user confirmation
- [Phase 02-02]: [TCO]: Amortization uses a RECONCILED final payment (final principal IS the remaining balance) so finalBalance === $0.00 exactly and principal-sum === loan exactly (Pitfall 2); monthlyRate = nominal-annual/12 kept FULL Dec precision (never rounded), each period's split rounded to cents HALF_EVEN at the Money boundary
- [Phase 02-02]: [TCO]: PMI applies iff origination LTV (loan/originalValue) STRICTLY > 0.80 — exactly 20% down does NOT trigger PMI; drop-off measured against CONSTANT original value + scheduled balance, 78% auto / 80% requested toggle (no appreciated-value input by design, Pitfall 3); oracle: $360k/6.375%/360 → premium $225.00, drop-off auto-78 month 108 vs requested-80 month 94
- [Phase 02-02]: [TCO]: tco/ barrel exports deferred to Plan 04 (alongside computeTco) per plan artifacts note
- [Phase 02-03]: [TCO]: Property tax = assessed × mill-rate/$1,000 (div(1000) INSIDE the function — rate stored as published, A3); assessed = price × assessmentRatio grown at appreciation under a HELD-CONSTANT mill rate (D-10); NO flat-% path and NO 2.5% bill clamp (Pitfall 9); PROP_2_5_FLAG = "Prop 2½ caps the town levy, not your individual bill"
- [Phase 02-03]: [TCO]: Single appreciation idiom — homeValueAt is a thin re-use of property-tax's assessedValueAt with ratio "1.0"; carrying-costs imports it (no duplicated (1+r)^year power). Maintenance tracks appreciating value; insurance + HOA flat in today's dollars (D-15)
- [Phase 02-03]: [TCO]: Closing = price × rateOfPrice OR dollar override (override wins, D-12); amortizeOverHold divides the lump in Dec into { annual, monthly } for display only — t=0-lump semantics for the Plan-05 net-worth model documented, not amortized (D-13)
- [Phase ?]: computeTco annualized-is-source-of-truth: monthly = annualized/12, each line cents-pinned so total = exact sum of per-line cents; breakdown is the year-0 snapshot
- [Phase 02-05]: [TCO]: rentVsBuy is a SYMMETRIC two-portfolio net-worth model — buy monthly outflow = computeTco total.monthly MINUS amortizedClosing (closing is t=0 lump, D-11); renter seeds its portfolio with DP+closing+other one-time at t=0; the cheaper path each month invests |diff| into ITS OWN portfolio (Pitfall 6); both compound monthly at (1+returns.realAnnual)^(1/12)
- [Phase 02-05]: [TCO]: BUY equity = appreciated home value (separate appreciation.realAnnual, NOT the portfolio return — D-04) minus amortization remaining balance (principal = forced savings), liquidated with the explicit sellCostPct haircut (D-05) at horizon; crossoverYear = first year buy ending NW >= rent NW (null is a legitimate anti-funnel outcome)
- [Phase 02-05]: [TCO]: all-real convention locked (D-02) — returns/appreciation/rent real rates consumed DIRECTLY (no double-Fisher); toReal=(1+n)/(1+i)-1 exposed for a future nominal knob only; inflation never enters the compounding (tested inflation-invariant)
- [Phase 02-05]: [TCO]: reproducibility loop closed for the FULL TCO result — committed tco-golden-snapshot.json deep-equals canonicalJson({tco, rentVsBuy}); gated UPDATE_GOLDEN-only regeneration, never toMatchSnapshot; canary golden-snapshot.json is byte-identical (canary reads only returns.realAnnual, unaffected by the widened scenario — the widened reconciliation lands in fixedInput())
- [Phase 02-05]: [TCO]: ANTI-FUNNEL PROVEN — realistic Newton $850k/7%/7yr/$3,200-rent set yields RENT wins ($563,158 vs $257,910); the golden fixture itself (Newton $450k) is also rent-wins. The "rent and invest the difference" verdict is reachable (PROJECT.md core value)
- [Phase ?]: [Phase 02-06]: [TCO]: amortization + rentVsBuy are crash-proof — r.isZero() straight-line guard (zero-rate) and a clamped schedule index (hold past payoff = $0.00 balance = full equity)
- [Phase ?]: [Phase 02-06]: [TCO]: PMI is drop-off-aware everywhere — computeTco annualizes the hold average (premium x chargedMonths / holdingYears) + exposes pmiDropOffMonth; rentVsBuy charges PMI only while month <= dropOffMonth
- [Phase ?]: [Phase 02-06]: [TCO]: the rentVsBuy buy outflow is time-varying — property-tax + maintenance grow per hold year on the appreciating value (P+I/ins/HOA flat); golden fixture regenerated cent-identically, RENT still wins

### Pending Todos

[From .planning/todos/pending/ — ideas captured during sessions]

None yet.

### Blockers/Concerns

[Issues that affect future work]

- Critical correctness pitfalls (float money, amortization final-balance, PMI 78/80 basis, DTI definitions, real-vs-nominal FI, opportunity-cost symmetry, SWR horizon) are existential — fence each into its mapped phase with gating verification (see research/PITFALLS.md).
- Anti-funnel guarantee: a realistic input set must reach a "rent and invest" verdict (acceptance check in Phase 4).

## Deferred Items

Items acknowledged and carried forward from previous milestone close:

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| *(none)* | | | |

## Session Continuity

Last session: 2026-06-25T17:16:47.718Z
Stopped at: Completed 02-05-PLAN.md (Wave 4 — two-portfolio rent-vs-buy + TCO golden); Phase 2 all plans complete
Resume file: None (Phase 2 ready for verification/transition)
