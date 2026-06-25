---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: executing
stopped_at: Phase 2 context gathered
last_updated: "2026-06-25T14:32:00.000Z"
last_activity: 2026-06-25 -- Completed 02-01 (Wave-1 TCO foundation)
progress:
  total_phases: 7
  completed_phases: 1
  total_plans: 9
  completed_plans: 5
  percent: 56
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-06-22)

**Core value:** Answer "what does buying this house do to our early-retirement timeline?" — and be allowed to conclude "don't buy / rent and invest the difference."
**Current focus:** Phase 02 — tco-engine

## Current Position

Phase: 02 (tco-engine) — EXECUTING
Plan: 2 of 5
Status: Executing Phase 02 (Wave 1 complete)
Last activity: 2026-06-25 -- Completed 02-01 (Wave-1 TCO foundation)

Progress: [██████░░░░] 56%

## Performance Metrics

**Velocity:**

- Total plans completed: 4
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

Last session: 2026-06-25T14:32:00.000Z
Stopped at: Completed 02-01-PLAN.md (Wave 1)
Resume file: .planning/phases/02-tco-engine/02-02-PLAN.md
