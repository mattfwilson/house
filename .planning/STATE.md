---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: executing
stopped_at: Phase 6 context gathered
last_updated: "2026-06-27T23:53:40.808Z"
last_activity: 2026-06-27 -- Phase 06 planning complete
progress:
  total_phases: 7
  completed_phases: 5
  total_plans: 26
  completed_plans: 26
  percent: 71
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-06-22)

**Core value:** Answer "what does buying this house do to our early-retirement timeline?" — and be allowed to conclude "don't buy / rent and invest the difference."
**Current focus:** Phase 05 — town-scoring-heatmap

## Current Position

Phase: 6
Plan: Not started
Status: Ready to execute
Last activity: 2026-06-27 -- Phase 06 planning complete

Progress: 4 of 7 phases complete (Phase 4: 4/4 plans + 2/2 gap-closure — DONE)

## Performance Metrics

**Velocity:**

- Total plans completed: 36
- Average duration: —
- Total execution time: —

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01 | 4 | - | - |
| 02 | 7 | - | - |
| 03 | 5 | - | - |
| 04 | 6 | - | - |
| 05 | 4 | - | - |

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
| Phase 02-tco-engine P07 | 3min | 2 tasks | 5 files |
| Phase 03 P01 | 5min | 4 tasks | 3 files |
| Phase 03 P02 | 12min | 2 tasks | 4 files |
| Phase 03 P03 | 6min | 2 tasks | 2 files |
| Phase 03 P04 | 10min | 3 tasks | 8 files |
| Phase 03 P05 | 7min | 3 tasks | 4 files |
| Phase 04 P01 | ~25min | 4 tasks | 9 files |
| Phase 04 P02 | ~12min | 3 tasks | 5 files |
| Phase 04 P03 | ~10min | 3 tasks | 5 files |
| Phase 04 P04 | 12min | 3 tasks | 6 files |
| Phase 04 P05 | ~12min | 3 tasks | 8 files |
| Phase 04 P06 | ~3min | 1 task | 2 files |

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
- [Phase 02-07]: [TCO]: ScenarioInputs is validated at the snapshot trust boundary by ScenarioInputsSchema (Zod .strict(), decStr leaves, positive-int counts, downPaymentPct in [0,1)), mirroring AssumptionSetSchema — CR-03 closed; parseScenarioInputs is the loader helper, engineInput() parses through it, and the golden round-trip rebuilds through a real parse (not a bare cast). downPaymentPct's [0,1) range is a decStr.refine boundary guard (Number(s), not money math)
- [Phase ?]: [Phase 03-01]: [Affordability]: Household is the durable person-vs-house input contract (D-09) — a Zod .strict()/decStr/targetSavingsRate-in-[0,1) trust boundary mirroring ScenarioInputs, parseHousehold the only loader; OPTIONAL on EngineInput (A3) so TCO-only callers + the byte-identical tco-golden-snapshot.json are untouched, and the household KEY is omitted entirely (not undefined) when absent to satisfy exactOptionalPropertyTypes
- [Phase 03-02]: [Affordability]: lenderDtiCarryingCost is the D-14 numerator = P+I + propertyTax + insurance + pmi + hoa (PITI+HOA+PMI), summed from the TcoBreakdown line monthlies — EXCLUDES maintenance + amortizedClosing and NEVER reads tco.total (Pitfall 1); both DTI ratios divide by GROSS-monthly income with no tax haircut (Pitfall 2)
- [Phase 03-02]: [Affordability]: bankAffordability (AFF-01) solves the max approvable price to the cent via monotonic bisection — low strictly above downPaymentCash so trial pct = cash/price < 1 (Pitfall 3), exponential high bracket (no hard ceiling) + iteration caps (T-03-04), thresholds read from assumptions.dti.* (Shared P4); reuses computeTco per trial price (never re-derives amortization, Shared P2); returns bankMaxPrice, bankMaxLoan = price − cash (D-06), both ratios, and the bindingRatio; monotonic across the PMI kink
- [Phase 03-04]: [Affordability]: affordabilityGap (AFF-03) composes the bank + true ceilings: signedGap = bankMaxPrice − trueMaxPrice (Money); verdict decided on Money.toCents() bigints vs ALIGNED_TOLERANCE_CENTS (exported $1,000 constant, A2) — bankExceedsTrue (anti-funnel) | trueExceedsBank | aligned (D-13, structured enum, NO UI copy). Carries bank bindingRatio + true bindingConstraint (D-12). ANTI-FUNNEL PROVEN reachable AND pinned in the golden fixture itself (bank $672,721 vs true $475,515, signedGap +$197,206, verdict bankExceedsTrue, Pitfall 6). evaluateScenario (D-06) REPORTS at a fixed price (computeTco once, reuses dti.ts + cashSavingsDrain): ratios + pass flags + savingsRateImpact + headroom below the binding ceiling. affordability.type-test.ts guards every dollar field on all four result shapes as Money-only (CORE-02). Public @house/core barrel publishes the four entry points + result types + verdict/binding enums + lenderDtiCarryingCost/cashSavingsDrain (Money-returning) + Household/HouseholdSchema/parseHousehold; frontEndRatio/backEndRatio NOT exported (they return internal Dec). Golden round-trip carries household through parseHousehold (Pitfall 5); UPDATE_GOLDEN-gated, never toMatchSnapshot (T-03-07); tco + canary goldens byte-identical
- [Phase 03-05]: [Affordability]: Both max-price solvers GUARD the bisection precondition — if !passes(low0) (cash+1) they return Money.zero() instead of silently bisecting an unbracketed interval to ≈downPaymentCash+1 (CR-01, T-03-09): an infeasible bank household (back-end DTI > 0.36 at the floor) gets a $0 ceiling with the real ratiosAt(low0) reported; the shared solveMaxPrice $0 fixes BOTH true ceilings (cash-gate budget < downPaymentCash, savings-floor rate < target at every price) at once. Bracket-cap exhaustion while passes(high) is still true THROWS a diagnosable Error before bisection (CR-02, T-03-10). Decision: $0 sentinel over a feasible:false field — keeps all four result SHAPES, index.ts, gap.ts, affordability.type-test.ts unchanged; $0 composes through min/signedGap/verdict as the honest "infeasible at this profile" answer. Feasible prices (635347.53/477861.63/482309.67/400000) + affordability-golden-snapshot.json byte-identical (no UPDATE_GOLDEN); core suite 287 green
- [Phase 03-03]: [Affordability]: trueAffordability (AFF-02) = min of two ceilings via ONE shared solveMaxPrice bisection. cashSavingsDrain is the SECOND D-14 numerator (tco.total − amortizedClosing, KEEPS maintenance — differs from the lender numerator by exactly maintenance). Savings-rate floor: (currentAnnualSavings − (drain − currentRent)×12)/grossAnnualIncome ≥ targetSavingsRate (GROSS denom D-04, currentAnnualSavings baseline D-17, incremental over currentRent D-03). Cash-on-hand gate: downPaymentCash + closingCosts(price) ≤ availableNetWorth − reserve (D-05, closingCosts reused, reserve as-is A1). trueMaxPrice = min(A,B) cent-exact via toCents(); bindingConstraint reports the lower ceiling (savingsFloor wins ties)
- [Phase 04-01]: [FI]: AssumptionsV3 is current (CURRENT_VERSION=3) — a sensitivity slice (six LOCKED driver bands: return 0.015 / inflation 0.01 / appreciation 0.01 / maintenance 0.005 / taxBandRelative 0.15 RELATIVE ±15% L6 / swr 0.005) + a projection slice (maxHorizonYears 60, D-07) as first-class decStr stored data (ASMP-02). v2ToV3 migrate arm + chained v1ToV2→V3 so every prior version lands a complete V3, seeded from DEFAULT_ASSUMPTIONS; proven by distinct-valued migrate.test fixtures
- [Phase 04-01]: [FI]: targetAnnualRetirementSpend is a REQUIRED decStr Household leaf (no .refine, unbounded positive dollars) — FI number = spend ÷ swr.rate (D-01, FI-01/FI-02); a missing spend has no honest default. monthlyGrowthFactor promoted to tco/compounding.ts as the ONE within-package definition (L1/A6 closed), imported by rent-vs-buy, NOT exported from index.ts (returns unexported Dec). The three existing goldens regenerated byte-IDENTICAL under V3 (they serialize only computed results, not the assumption set) — provable zero computed-money coupling via empty fixture diff (L5 confirmed at a blocking human checkpoint)
- [Phase 04-02]: [FI]: projectFiDate is the termination-guaranteed monthly NW loop — contribute-then-compound through the SHARED monthlyGrowthFactor (L1), first month NW>=target => FiOutcome kind:'reached' (years=month/12 Dec string), else kind:'unreached' cappedAtMonth=maxHorizonYears*12 (D-07/L3 — a discriminated variant, never an Infinity/-1 sentinel; the canonicalJson-serializable encoding). Optional equityFor adds the buy-path liquidated home equity (A5 = liquid + liquidated equity, matching rentVsBuy's ending-NW), proven to reach STRICTLY earlier than liquid-only
- [Phase 04-02]: [FI]: fiTargets surfaces the asymmetric renter/owner FI targets — renterTarget=(spend+currentRent*12)/swr, ownerTarget=(spend+year-0 tax+ins+maint)/swr — all four Money fields exposed (D-02 fulcrum visible). Owner housing at the YEAR-0 basis (A1, avoids the target↔FI-year fixed point L7; fiYear param keeps the appreciated-basis upgrade API-stable). Division in Dec only (Money has no div), crossed to Money once; SWR knob proven live (higher swr => lower target) for the Plan-04 tornado
- [Phase 04-02]: [FI]: FI-05 oracle is INDEPENDENT (D-09/D-10) — an in-test closed-form FV-of-annuity solve-for-n (n=ceil(ln(A/B)/ln(f)) via Dec.ln), NOT a copy of the engine loop, asserting EXACT === month agreement at 0% (linear anchor ceil((T-S)/C), Pitfall 1 convention lock), under 5%/3% compounding, through toReal (Fisher high-inflation D-11/L2), and on unreachability (oracle Infinity vs engine kind:'unreached'). Oracle C<=0 branch corrected to the general A/B closed form (seed-only growth IS reachable; only a diverging negative contribution is truly unreachable)
- [Phase 04-03]: [FI]: fiImpact (FI-01/FI-03) composes fiTargets + projectFiDate over the Phase-2 substrate — the opportunity-cost SYMMETRY is the correctness core: the buy path's foregone t=0 seed (availableNetWorth − DP+closing, reusing closingCosts) and foregone monthly contribution (savings − ownership premium, premium = buyMonthlyOutflowAt − grown rent, REUSED not re-summed) are EXACTLY the dollars the keep-renting baseline keeps invested (D-05: full NW seed, full savings, no equity, price-independent). Buy NW = liquid + liquidated equity (A5 equityFor). Reports fiDeltaMonths = owner−renter (positive ⇒ buying delays FI) + fiDeltaYears (decimal string); BOTH null when either path unreached. Surfaces both FiOutcomes + both targets (D-02). ANTI-FUNNEL ACCEPTANCE PROVEN as a test: a realistic strained input ($1.4M house / $36k savings) yields buy:unreached + baseline:reached — the tool is verified ABLE to conclude don't-buy
- [Phase 04-03]: [FI]: compareScenarios (FI-04/FI-06) ranks N buys against ONE keep-renting baseline (row 0, isBaseline, delta 0, carries the renter outcome) via a kind-branching comparator — reached-before-unreached, reached by fiDeltaMonths ascending, two unreached by cappedAtMonth ascending, stable input-index tie-break — so the unreached 'don't buy' row sorts WORST. NO non-finite sort key ever materialized (L3): grep gate 0 literal Infinity in compare.ts + a JSON.stringify runtime assertion. A5 product truth surfaced: a cash-heavy buyer of an expensive home can still hit FI on the liquidated equity, so 'expensive' alone ≠ 'don't buy' — LEVERAGE is the discriminator (the unreachable fixture is $4M at 10% down). FI engine block published from index.ts (fiImpact/compareScenarios/fiTargets/projectFiDate + closed types + FiOutcome/FiTargets); Dec/monthlyGrowthFactor stay unexported. Full suite 326 green
- [Phase 04-05]: [FI gap-closure]: the tornado tax driver now BITES (GAP 1/SC5/ASMP-02). Property tax flows through tco.resolvedMillRate (the single chokepoint both ownerHousingAt + buyMonthlyOutflowAt read), so an OPTIONAL tax.millRateOverride decStr leaf (V3 only, absent from defaults → goldens byte-identical) was added; computeTco honors it (effectiveMillRate = millRateOverride ?? resolveMillRate(town), millRateFy stays town FY for provenance). The tax driver perturbs THAT live rate relatively (×(1±taxBandRelative)), seeded inside perturb from the resolved town rate (town lives on the scenario, not assumptions) and threaded via a new DriverSpec.apply baseRate param — NO switch(driver) projection math (Pitfall 10 intact). swingMonths > 0 for a reached scenario; taxBandRelative '0' collapses to zero (stored-band sourcing). GAP 2/CR-01: swr.rate is positive-by-construction in THREE layers — V3 Zod .refine (Number(s)>0, load-bearing), divideBySwr lessThanOrEqualTo(0) throw (defense in depth, replaces silent Money.of('Infinity')/negative month-0 target), and a tornado swr low-band clamp to SWR_FLOOR='0.0001' (a band ≥ rate is degenerate input the model floors, not a tornado-crash). All four goldens byte-identical (NO regen); suite 352 green (+15)
- [Phase 04-04]: [FI]: tornado (ASMP-02/D-12/D-13/D-14) is sensitivity-as-cheap-re-run — a data-driven DRIVER_SPECS table perturbs ONE V3 sensitivity band per driver (return/inflation/appreciation/maintenance/tax/swr) and re-runs the SAME fiImpact(...).buy; NO switch(driver) projection math. Tax is the ONLY relative band (×(1±taxBandRelative), L6); the other five absolute (±band). Each perturb re-freezes through engineInput (re-validates at the Zod boundary, T-04-13); bands from stored data, never hardcoded. swingMonths = |highBound − lowBound| via reached month OR unreached cappedAtMonth — finite, no Infinity (L3, grep 0 in sensitivity.ts); rows sort DESC by swing, topDrivers = top-3. Published tornado + TornadoResult/TornadoRow/TornadoDriver. fi.type-test.ts makes no-bare-number + no-numeric-FI-sentinel a tsc -b guarantee (every FiTargets dollar Money, fiDeltaYears/FiOutcome.years decimal strings, a bare -1 not assignable where a FiOutcome is expected). FI-05 reproducibility CLOSED: canonicalFiResult + committed fi-golden-snapshot.json (gated UPDATE_GOLDEN, never toMatchSnapshot) + a round-trip through parseHousehold proving targetAnnualRetirementSpend survives serialize→re-parse byte-identically; golden is a REACHED buy (month 175) vs reached baseline (month 217), fiDeltaMonths -42. Full suite 337 green. FLAGSHIP PHASE 04 COMPLETE. DEFERRED (out of scope, logged): tax.propertyRateAnnual is INERT (property tax flows through the resolved town mill rate), so the tornado tax driver swing is currently 0 — the relative-band machinery is correct/tested but wiring a perturbable rate is a follow-up; plus 1 pre-existing unrelated lint error in rent-vs-buy.test.ts

- [Phase 04-06]: [FI gap-closure]: the buy-path liquidated-equity YEAR convention is now RECONCILED with rentVsBuy's year-boundary snapshot (WR-01/IN-04). `equityFor` was extracted to a pure, exported `buyEquityAt` (so the convention is unit-pinned — T-04-G4: a future blind re-sync fails CI) using `year = Math.max(0, Math.floor(month/12))`: month 12 → year 1 (AGREES with rentVsBuy's `month/12` at boundaries — the old `floor((month-1)/12)` valued month 12 at year 0, one year of appreciation too few), month 0 → year 0 (no NEGATIVE year — closes IN-02 since projection.ts:85 seeds the month-0 check with equityFor(0)), months 1-11 → year 0. Schedule-balance index `month-1` UNCHANGED (already agreed). The false "verbatim from rent-vs-buy.ts 246-253" comments corrected to the actual reconciled convention (IN-04; grep confirms 0 false equity claims). FI golden BYTE-IDENTICAL (buy month 175 / baseline 217 / delta -42 unchanged — the reconciliation did not straddle a year boundary for the fixed golden input, so NO UPDATE_GOLDEN regen). Suite 355 green (+3 convention pins). FLAGSHIP PHASE 04 fully COMPLETE — all 5 verification gaps + the code-review Critical + 4 Warnings closed.

### Pending Todos

[From .planning/todos/pending/ — ideas captured during sessions]

None yet.

### Blockers/Concerns

[Issues that affect future work]

- Critical correctness pitfalls (float money, amortization final-balance, PMI 78/80 basis, DTI definitions, real-vs-nominal FI, opportunity-cost symmetry, SWR horizon) are existential — fence each into its mapped phase with gating verification (see research/PITFALLS.md).
- Anti-funnel guarantee: a realistic input set must reach a "rent and invest" verdict (acceptance check in Phase 4).

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260625-k0h | Fix pmiDropOffMonth=null ambiguity — add pmiApplies flag to TcoBreakdown, re-gate buy PMI | 2026-06-25 | 836775e | [260625-k0h-fix-pmi-applies-flag](./quick/260625-k0h-fix-pmi-applies-flag/) |

## Deferred Items

Items acknowledged and carried forward from previous milestone close:

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| *(none)* | | | |

## Session Continuity

Last session: 2026-06-27T23:18:48.520Z
Stopped at: Phase 6 context gathered
Resume file: .planning/phases/06-persistence-listings-adapter/06-CONTEXT.md
