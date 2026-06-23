# Pitfalls Research

**Domain:** Personal home-affordability + FI-impact decision engine (greater Boston / Massachusetts), pure TypeScript calculation core
**Researched:** 2026-06-22
**Confidence:** HIGH for financial-math and JS money-math pitfalls (verified against CFPB/FDIC, established JS guidance, FI literature); HIGH for MA-tax mechanics (verified against Mass.gov DLS, MassHousing); MEDIUM for product-funnel/UX pitfalls (reasoned from domain + a few sources)

> Priority note for the roadmap: the **Critical Pitfalls** below are *existential* — if the math is wrong or the assumptions are silently overconfident, the product is worse than nothing because it produces confident false answers. Treat the first ~8 as gating, with explicit verification criteria.

---

## Critical Pitfalls

### Pitfall 1: Floating-point money math (silent cent drift)

**What goes wrong:**
All JS/TS numbers are IEEE-754 doubles. `0.1 + 0.2 === 0.30000000000000004`. Across a 360-month amortization loop with interest accrual, rounding, PMI deltas, tax, and FI compounding over 50 years, errors accumulate and surface as off-by-a-few-dollars (or worse) results, balances that don't reconcile, and tests that are flaky to the last cent. For a product whose *entire value proposition is correctness*, this is fatal.

**Why it happens:**
Developers represent dollars as floats (`payment = 2143.27`) and chain arithmetic directly. It looks fine in spot checks and only diverges after many operations.

**How to avoid:**
- Pick a money representation up front and enforce it across the whole core: either **integer minor units (cents/bigint)** or a **decimal library (decimal.js / big.js)**. Do not mix.
- Make `Money` a distinct type (branded type or class), not a bare `number`, so the compiler stops accidental float arithmetic.
- Define rounding policy explicitly (round half-up to the cent for payments; banker's rounding is also defensible — pick one and document it).
- Internal long-horizon *projection* math (FI compounding) can stay in float for the trajectory, but anything presented as a dollar figure or compared in a test should go through the controlled rounding boundary. Be deliberate about where the float→money boundary is.

**Warning signs:**
- Tests assert with `toBeCloseTo` instead of exact equality on dollar outputs.
- Amortization final balance isn't exactly $0.00.
- Sum of monthly P+I over the term ≠ total of payments.

**Phase to address:** Foundational / calculation-core setup phase — before any amortization or FI code. This is a one-line decision that's very expensive to retrofit.

---

### Pitfall 2: Amortization schedule errors (rounding, final payment, rate conversion)

**What goes wrong:**
The standard pitfalls: (a) using `annualRate / 12` without care, (b) not handling the **final payment** which is almost never exactly equal to the others (the last payment must zero out the balance, so it's computed as remaining balance + one month interest, not the standard payment), (c) rounding each monthly payment to the cent but then computing interest off the *rounded* vs *unrounded* balance, producing a schedule that drifts and ends at a nonzero balance, (d) computing interest on the wrong day-count basis.

**Why it happens:**
The closed-form payment formula `M = P·r·(1+r)^n / ((1+r)^n − 1)` is easy; the *schedule* (per-period principal/interest split, rounded, reconciling to zero) is where bugs live. People test the monthly payment number and assume the schedule is right.

**How to avoid:**
- Generate the full schedule iteratively: each period, `interest = round(balance · monthlyRate)`, `principal = payment − interest`, `balance -= principal`. **Force the final period to pay off the exact remaining balance.**
- Assert invariants in tests: schedule length = term; sum(principal) = original principal exactly; final balance = 0 exactly; sum(interest) matches an independent total-interest calc.
- Validate against an external oracle (a bank amortization calculator or a spreadsheet) for at least 2-3 representative loans, including a non-round rate.
- Decide and document the monthly-rate convention (nominal annual / 12 is standard US mortgage convention — use it).

**Warning signs:**
Final balance not exactly zero; principal+interest of last row looks like a "normal" payment; schedule total interest disagrees with `payment·n − principal` by more than rounding.

**Phase to address:** Affordability/TCO engine phase (the amortization module). Gate with invariant tests.

---

### Pitfall 3: PMI drop-off computed at the wrong LTV / wrong "value"

**What goes wrong:**
PMI rules are widely misunderstood and easy to model incorrectly. Under the federal Homeowners Protection Act there are **two distinct thresholds, against the ORIGINAL value (purchase price / appraised value at origination), based on the amortization schedule** — not current market value:
- **Automatic termination at 78% LTV** (lender must drop it; based on the *scheduled* amortized balance hitting 78% of original value, borrower current).
- **Borrower-requested cancellation at 80% LTV** (borrower must request in writing; can be reached early via extra payments; requires good payment history).
- Plus a **midpoint-of-the-loan-term** backstop termination.
Common modeling errors: dropping PMI at 80% automatically (it's 78% automatic / 80% on request), using *appreciated current value* instead of *original value* to hit the threshold (HPA uses original value), or ignoring that extra principal payments accelerate the 80% request date but the 78% automatic date is fixed to the *original schedule*.

**Why it happens:**
"Drop PMI at 20% equity" is the folk version; the statutory mechanics are more specific and the 78 vs 80 distinction is non-obvious.

**How to avoid:**
- Model PMI removal against **original value** and the **scheduled balance**: automatic at scheduled balance ≤ 78% of original value; allow an optional "request at 80%" toggle for the borrower-initiated path.
- Treat appreciation-based early removal (re-appraisal) as a *separate, optional* scenario lever, not the default — it requires a new appraisal and lender approval, not automatic.
- Keep the PMI rate and the original value as stored assumptions; surface the drop-off month explicitly in the schedule.

**Warning signs:** PMI disappears at month derived from current/appreciated value; PMI removal date insensitive to whether you choose automatic vs requested; no distinction between 78% and 80%.

**Phase to address:** TCO/amortization phase. (Verified against CFPB/FDIC HPA materials.)

---

### Pitfall 4: DTI math — front-end vs back-end definition errors

**What goes wrong:**
DTI is defined precisely and is easy to get subtly wrong: **front-end (housing) ratio = PITI + HOA + PMI ÷ gross monthly income**; **back-end ratio = (PITI + HOA + PMI + all other recurring monthly debt obligations) ÷ gross monthly income**. Errors: using net income instead of gross; forgetting that PITI includes property *taxes and insurance and PMI and HOA*, not just P+I; including or excluding the wrong debts in back-end (it's minimum monthly obligations on revolving/installment debt, not total balances); applying the 28/36 thresholds to the wrong ratio.

**Why it happens:**
"DTI" gets used loosely. The 28/36 split maps to front/back specifically, and "housing payment" silently means full PITI(+HOA+PMI), not the mortgage payment.

**How to avoid:**
- Encode front-end and back-end as separate, explicitly-named functions with documented numerators/denominators.
- Use **gross** income; make that explicit in the type/field name (`grossMonthlyIncome`).
- Housing cost numerator must be the *full carrying cost* (P+I + property tax + homeowners insurance + PMI + HOA/condo), consistent with the TCO module — reuse the same TCO components, don't recompute.
- Make the 28/36 thresholds configurable assumptions (per requirements), and label which ratio each threshold gates.

**Warning signs:** Front-end ratio equals just P+I / income; back-end uses total debt balances; thresholds applied without labeling which ratio.

**Phase to address:** Affordability engine phase (bank-affordability path).

---

### Pitfall 5: Real vs nominal returns mixed in the FI projection

**What goes wrong:**
The single most common FI-math error: mixing nominal and real (inflation-adjusted) figures in the same calculation. E.g., compounding a portfolio at a **nominal** 7-10% but comparing the FI target to spending in **today's dollars**, or inflating expenses with CPI while using a real return on assets (double-counting inflation), or showing a net-worth trajectory in nominal dollars next to a "years to FI" computed in real terms. The FI *date* is extremely sensitive to this; a 2-3% inconsistency moves the retirement year by many years.

**Why it happens:**
There are two internally-consistent conventions (do everything in real terms, OR do everything in nominal and inflate the target), and people accidentally combine them.

**How to avoid:**
- **Choose one convention for the whole engine and document it.** Recommended: do the projection in **real (today's-dollar) terms** — use a *real* expected return (nominal return minus inflation, via the Fisher relation `(1+nom)/(1+inf) − 1`, not naive subtraction), and keep the spending target in today's dollars. This makes the FI number directly interpretable.
- Store inflation as a first-class assumption; never bury it in a return number.
- Reconcile against the existing retirement model (the stated test oracle) — agreement there is the strongest correctness signal for this module.
- Label every displayed dollar as real or nominal.

**Warning signs:** Inflation applied to expenses AND a sub-market "real" return used on assets; FI target in today's dollars compared to nominal portfolio; Fisher vs naive (nom − inf) subtraction not specified.

**Phase to address:** Opportunity-cost / FI-impact engine phase. Reconcile against the retirement-model oracle as the acceptance test.

---

### Pitfall 6: Opportunity-cost modeling of the down payment done asymmetrically

**What goes wrong:**
The flagship feature compares "buy" vs "rent and invest the difference." The classic mistakes that bias the answer:
- Counting the down payment + closing costs as foregone investment growth (correct) but **forgetting the symmetric monthly delta**: when renting is cheaper month-to-month, the *difference* must be invested in the rent scenario; when buying is cheaper, the difference is invested in the buy scenario. Modeling only one side rigs the result.
- Treating **all of the mortgage payment as a cost** — principal portion is forced savings (equity), only interest + tax + insurance + maintenance + PMI + HOA are true "cost." But also don't treat equity as fully liquid (selling costs ~6-8%).
- Ignoring **transaction costs** (closing costs to buy, ~5-6% realtor + transfer taxes to sell) which can dominate over short horizons.
- Using home appreciation (3-5% typical, ~0.3-1.3% *real* historically after maintenance) at the same rate as equity returns (~7% real) — or vice versa, applying stock returns to home equity.

**Why it happens:**
Rent-vs-buy is genuinely a full opposing-portfolios simulation, not a payment comparison. Commercial calculators simplify it (often in the "buy" direction).

**How to avoid:**
- Model **two complete net-worth trajectories** (buy vs rent) over the same horizon, each investing whatever cash the *other* scenario consumed. Compare ending net worth (and FI date), net of selling costs on the home.
- Separate appreciation rate (home) from investment return (portfolio) as distinct assumptions.
- Include buy-side closing costs and sell-side transaction costs explicitly.
- Subtract the principal portion from "cost" but apply a liquidation haircut when converting equity to net worth.

**Warning signs:** Only one scenario invests the monthly difference; full mortgage payment treated as cost; home equity grows at stock-market rate; no transaction costs.

**Phase to address:** Opportunity-cost / FI-impact engine phase (the flagship). This is where the product's integrity lives.

---

### Pitfall 7: 4% rule / safe-withdrawal-rate assumption invalid for a 40-50 year horizon

**What goes wrong:**
The 4% rule was derived for a **30-year** retirement. The project targets retire-by-45-47, i.e. a **40-55 year** horizon. At that length the historical success rate of 4% drops materially (simulations through 2024 show ~90% for stock-heavy portfolios over 50 years vs >95% over 30), and FIRE practitioners commonly use **3-3.5%**. If the FI-date engine assumes 25× expenses (4%) by default, it will tell the user they can retire *years too early* — a confident, dangerous error.

**Why it happens:**
"25× your spending / 4% rule" is the FIRE shorthand everyone repeats; the horizon caveat is omitted.

**How to avoid:**
- Make the withdrawal rate (or the FI multiple) a **first-class, configurable assumption** with a default appropriate to a long horizon (e.g. 3.25-3.5% → ~29-31×), not a hardcoded 4%/25×.
- Show the FI date's sensitivity to this assumption prominently (ties directly to the sensitivity-analysis requirement).
- Consider modeling sequence-of-returns risk at least as a flag/Monte-Carlo option later; even noting "this is a single deterministic path, not a success probability" prevents overconfidence.

**Warning signs:** 4%/25× hardcoded; FI date identical regardless of expected horizon length; no place to set SWR.

**Phase to address:** FI-impact engine phase; assumption surfaced in the assumptions/config system. (Verified against FIRE SWR literature.)

---

### Pitfall 8: Sequence-of-returns risk presented as certainty (single deterministic path)

**What goes wrong:**
A deterministic projection using one average return produces a single FI date and net-worth curve that *looks* precise. But real outcomes depend heavily on the *order* of returns (sequence-of-returns risk) especially near/after the retirement transition. Presenting one smooth curve as "your FI date is 2041" is false precision and can be off by a decade in either direction.

**Why it happens:**
Deterministic compounding is simple and gives a clean single number that's satisfying to show.

**How to avoid:**
- Frame the deterministic result honestly: "expected path under constant return X," not "your retirement date."
- Pair every headline FI date with at least a sensitivity band (vary return ±2%, see Pitfall 10), and ideally a Monte-Carlo / historical-sequence range as a later enhancement.
- Note that during *accumulation* sequence risk is mild (no withdrawals), but it spikes around the FI transition — relevant because this tool models exactly that transition.

**Warning signs:** A single FI year shown with no range; UI language implies certainty; no return-rate sensitivity.

**Phase to address:** FI-impact engine + sensitivity-analysis phase.

---

### Pitfall 9: Misunderstanding Prop 2½ — it limits the town LEVY, not the individual tax bill or rate

**What goes wrong:**
A very common MA modeling error is assuming "Proposition 2½ means my property tax can only go up 2.5% per year." It does **not**. Prop 2½ caps the **total municipal levy** (the town's whole tax take): the levy limit grows 2.5% per year **plus new growth**, and can jump further via **overrides** (permanent) and **debt exclusions / capital exclusions** (temporary). An *individual* bill can rise much more than 2.5% due to revaluation shifting assessed value, class shifts, overrides, and the property's assessment changing relative to others. The mill/tax rate itself moves to hit the levy against total assessed value.

**Why it happens:**
The "2½" name strongly implies a 2.5% cap on bills; the levy-vs-bill distinction is subtle and widely misreported.

**How to avoid:**
- Model property tax as **assessed value × town tax rate (mill rate)** using the seeded DOR town table — do **not** model a 2.5% annual cap on the bill.
- If projecting tax growth forward, treat it as an assumption (e.g. assessment growth + rate drift), and explicitly *flag* that Prop 2½ does not cap individual bills, overrides exist, and rates are revalued. A short caveat in the UI prevents a false sense of a 2.5% ceiling.
- Keep mill rates as stored, versioned assumptions (per requirements); note vintage (FY) of the DOR data.

**Warning signs:** Tax projection hardcodes ≤2.5% annual growth; tax called "capped"; no town-rate variance reflected; overrides/exclusions ignored entirely.

**Phase to address:** Town-tax / TCO phase + assumptions system. (Verified against Mass.gov DLS Levy Limits primer.)

---

### Pitfall 10: False precision — no sensitivity analysis on the swing assumptions

**What goes wrong:**
The output (FI-date delta) is dominated by a few high-leverage assumptions: expected investment return, inflation, home appreciation, maintenance %, property tax rate, and SWR. Small changes in these swing the FI date by years. A tool that shows "buying this house delays FI by 4.2 years" as a hard number — when ±1% on return alone moves it by years — is selling false precision and will be trusted wrongly.

**Why it happens:**
Point estimates are easy and look authoritative; sensitivity analysis is more work and makes the answer "messier" (honestly).

**How to avoid:**
- Build sensitivity analysis **early, not as a bolt-on** (it's an Active requirement — honor it). At minimum: one-way sensitivity (tornado) on return, inflation, appreciation, maintenance %, tax rate, SWR, showing FI-date swing for each.
- Show results as ranges/bands, not just a point.
- Identify and label the top 2-3 drivers per scenario so the user knows what their answer actually hinges on.
- Pure core makes this cheap: re-run the same deterministic function across an assumption grid.

**Warning signs:** Headline number with no range; no tornado/one-way view; users can't see which assumption dominates; sensitivity deferred to "later."

**Phase to address:** Dedicated sensitivity-analysis phase, but the *architecture* (parameterized pure functions, no hardcoded assumptions) must be set in the core-foundation phase so sensitivity is a cheap re-run.

---

### Pitfall 11: Non-deterministic / non-reproducible scenarios (unversioned assumptions)

**What goes wrong:**
A saved scenario regenerates a *different* result later because (a) it captured inputs but not the *assumption set* in force at the time (return rate, tax table vintage, DTI thresholds), (b) the calc used `Date.now()` / current date implicitly (e.g. amortization start, "years to FI" anchored to today), (c) the mill-rate table or default assumptions changed between save and recompute, or (d) floating-point/order-of-operations nondeterminism. This breaks the explicit "reproducible scenarios" requirement and destroys trust ("it said 4 years yesterday, 6 today").

**Why it happens:**
Developers persist user inputs but treat assumptions/defaults and "today" as ambient global state rather than scenario-scoped, versioned data.

**How to avoid:**
- A saved scenario must snapshot **every input AND every assumption** (return, inflation, SWR, maintenance %, tax rate + table vintage, DTI thresholds, PMI rate, dates) — assumptions are first-class stored data per the project's own decision; enforce it.
- Make the calculation core **pure and fully parameterized**: no reads of `Date.now()`, no module-level mutable defaults, no global config. The "as-of date" is an explicit input.
- Add a regression/golden test: serialize a scenario, recompute, assert byte-identical (or cent-identical) result. Version the assumption schema.

**Warning signs:** Calc functions reference current date internally; defaults pulled from a global rather than passed in; re-opening a scenario changes the number; tax table updated in place without versioning.

**Phase to address:** Core-foundation phase (purity/parameterization) + persistence phase (snapshot completeness). The reproducibility golden test is the verification.

---

## Moderate / MA-Specific Pitfalls

### Pitfall 12: Ignoring one-time and lumpy MA-specific costs (betterments, Title 5 septic)

**What goes wrong:**
TCO that's only recurring (P+I, tax, insurance, maintenance) misses large MA-specific lumps that materially change affordability:
- **Betterment / special assessments**: town charges abutters for public improvements (sewer, road, water). Can be paid up front or **apportioned up to 20 years at ~5% interest as a lien on the property**, appearing on the tax bill. A buyer may inherit an existing apportioned betterment.
- **Title 5 septic** (relevant outside the urban core): a passing inspection is required at time of sale (within 2 years prior), and a **failed system can cost ~$10k-$50k to replace**; lenders may require escrowing ~1.5× the repair estimate. A state tax credit (up to $6k over 4 years) partially offsets.

**Why it happens:**
These are MA/regional and don't appear in generic affordability tools; they're "edge cases" until they're a $40k surprise.

**How to avoid:**
- Add optional one-time / lumpy cost inputs to TCO: closing costs (already planned), an optional betterment line (with apportionment toggle), and an optional septic-reserve / Title 5 contingency for non-sewered towns.
- At minimum, **flag** these in the UI for relevant towns even if not fully modeled ("this town is largely on septic — budget for Title 5") — aligns with the project's "model or at least flag" stance.

**Warning signs:** TCO has no one-time/lumpy cost category; septic/betterment never mentioned for rural/suburban towns.

**Phase to address:** TCO phase (inputs) + town-scoring phase (per-town flags). (Verified against Mass.gov DLS Betterments and Title 5 materials.)

### Pitfall 13: Mis-scoring or wrongly valuing deed-restricted (40B) units

**What goes wrong:**
Chapter 40B affordable units carry a **deed rider** restricting resale price to a formula-based "Maximum Resale Price" (kept affordable to an income-eligible buyer), restrict refinancing/cash-out, and require monitoring-agent approval. If the town-scoring or affordability model treats a 40B unit's price like a market unit, it badly misrepresents both affordability (you must be income-eligible to buy) and the FI/appreciation math (equity upside is capped by the resale formula, not market appreciation).

**Why it happens:**
40B units look like normal listings at an attractive price; the restrictions live in the deed rider, not the price.

**How to avoid:**
- Since live listings are out of scope, the practical action is to **flag the concept**: note that unusually-low-priced units may be deed-restricted with capped appreciation, and that the FI/appreciation assumption doesn't apply to them. A simple "deed-restricted?" scenario flag that caps appreciation in the model is enough for now.

**Warning signs:** Scenario applies market appreciation to a flagged-affordable unit; no concept of price-restricted resale.

**Phase to address:** Future listings integration; for now a documented flag in the scenario model. (Verified against MassHousing 40B Monitoring Handbook / CHAPA.)

### Pitfall 14: Town heatmap normalization & weighting distortions

**What goes wrong:**
Composite town scores go wrong when: metrics on different scales are summed without normalization (mill rate ~5-20 vs median price ~$400k-$2M dominates everything), "higher is better" vs "lower is better" directions are mixed (low mill rate good, high school rating good), outliers blow up min-max normalization (one $5M town flattens the rest), or weights aren't transparent so the ranking feels arbitrary. Missing data for a town silently scores it as 0 (worst) or NaN (drops it).

**Why it happens:**
Weighted-composite scoring is deceptively simple; normalization and missing-data handling are where it breaks. (The project notes a prior beach-app scoring architecture to reuse — inherit its *correct* normalization, not just its shape.)

**How to avoid:**
- Normalize each metric to a common scale (z-score or robust min-max with outlier clipping), with explicit direction (invert "lower-is-better" metrics).
- Make weights explicit, user-configurable (a requirement), and show each town's per-metric contribution so the score is explainable.
- Handle missing data explicitly (exclude metric + renormalize weights, or impute with a flagged default) — never silent 0/NaN.

**Warning signs:** One metric dominates rankings; a town with missing data sits at the bottom; changing a tiny weight reorders everything; score isn't explainable per town.

**Phase to address:** Town-scoring / heatmap phase.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Money as bare `number` (float) | Fastest to write | Cent drift, flaky tests, correctness erosion across long loops | **Never** — decide representation before writing amortization |
| Hardcoding assumptions (return, tax, DTI, SWR) in calc code | Fewer params to pass | Breaks reproducibility, sensitivity analysis, and the project's first-class-assumptions decision | **Never** (it's an explicit project constraint) |
| Skipping the final-payment reconciliation in amortization | Simpler loop | Schedule never zeroes; total interest wrong | Never for a correctness product |
| Deterministic single-path FI (no Monte Carlo) | Much simpler, fast | Overstates precision | **Acceptable for MVP** if framed honestly + paired with sensitivity bands; add stochastic later |
| Modeling property tax as flat `value × rate` with no forward growth | Simple | Slightly understates long-run TCO | Acceptable for MVP; flag as assumption; revisit |
| Reading `Date.now()` inside calc for "as-of" date | Convenient | Non-reproducible scenarios | Never in the pure core — pass as-of date in |
| Storing only user inputs, not the assumption snapshot, in a saved scenario | Smaller schema | Scenarios silently change on recompute | Never (violates reproducibility requirement) |
| Seeding one mill-rate table with no FY/version tag | Fast | Can't tell which vintage produced a result | Acceptable only if a version/date stamp is attached |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| `ListingsProvider` adapter | Letting listing-shaped concerns (live prices, geo, market data) leak into the pure core "just for now" | Keep the core consuming a *minimal scenario object*; the adapter only fills inputs. The mock must exercise the full interface so the seam is real. |
| SQLite persistence | Storing computed *results* and trusting them as source of truth | Store **inputs + assumption snapshot**; treat results as derivable/cacheable. Recompute-and-compare test guards reproducibility. |
| Existing retirement model (test oracle) | Coupling the new core to it, or assuming agreement without testing | Re-implement clean (per decision) and **reconcile via tests** across several cases, including edge cases (0% return, high inflation). Document any intentional divergence. |
| DOR / Mass.gov tax data | Treating mill rates as static truth forever | Stamp the FY vintage; store as versioned assumption; flag staleness; live refresh is explicitly future scope. |

## "Looks Done But Isn't" Checklist

- [ ] **Amortization:** Often missing the **exact-zero final balance** and the **non-standard last payment** — verify final balance == $0.00 and sum(principal) == original principal exactly.
- [ ] **PMI:** Often missing the **78% automatic vs 80% requested** distinction and the **original-value** basis — verify removal month matches scheduled balance ≤78% of *original* value, and that requested-cancellation toggle behaves differently.
- [ ] **DTI:** Often missing **full PITI+HOA+PMI** in the housing numerator and **gross** income in the denominator — verify against a worked example.
- [ ] **FI projection:** Often missing a **declared real-vs-nominal convention** and **Fisher** (not naive) real-return conversion — verify agreement with the retirement-model oracle.
- [ ] **Rent-vs-buy:** Often missing the **symmetric "invest the difference"** on the cheaper-each-month side and **sell-side transaction costs** — verify both scenarios invest surplus and equity is haircut on liquidation.
- [ ] **SWR / FI multiple:** Often left at hardcoded **4%/25×** despite a 40-50yr horizon — verify it's configurable with a long-horizon default.
- [ ] **Sensitivity:** Often deferred — verify a one-way/tornado view exists on return, inflation, appreciation, maintenance %, tax, SWR, shipping in the same milestone.
- [ ] **Reproducibility:** Often missing — verify save→reopen→recompute is cent-identical and that no calc reads ambient date/global config.
- [ ] **Prop 2½:** Often modeled as a 2.5% bill cap — verify tax = assessed × rate, with a UI caveat, not a capped-growth assumption.
- [ ] **Town score:** Often un-normalized — verify metrics are scaled + direction-corrected and missing data is handled explicitly.
- [ ] **"Don't buy" reachability:** Verify there exists at least one realistic input set that produces a "rent and invest" recommendation (see UX pitfalls).

## UX / Product Pitfalls (the "decision tool → sales funnel" trap)

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Every path ends in a "buy" framing | Tool silently becomes a buy-funnel — explicit project failure mode | Make **"rent & invest the difference"** a first-class, equally-prominent verdict. Add a test/check that some input set yields it. |
| Showing a single confident FI date | False precision; user over-trusts | Show ranges/bands + name the dominant assumption (ties to sensitivity). |
| Defaulting optimistic assumptions (high return, low maintenance, 4% SWR, high appreciation) | Quietly biases toward "you can afford it / buy" | Default to **conservative** assumptions (long-horizon SWR, realistic maintenance 1-2%, real returns); make optimism a deliberate user choice. |
| Leading with "bank affordability" (what a bank will lend) | Anchors user to the max, undermines the FI-impact thesis | Lead with **FI-impact / true affordability**; show bank-affordability as the *gap* (the project's stated framing). |
| Hiding the assumptions behind the result | User can't audit or trust the number | Make assumptions visible and editable next to every result. |
| Comparing scenarios on monthly payment instead of FI-date delta | Reverts to the commodity-calculator framing the product rejects | Rank scenarios by **FI-date impact** (the headline output per requirements). |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| 1. Float money math | Core foundation (before any math) | Exact-equality dollar tests; `Money` type enforced |
| 2. Amortization errors | TCO / amortization phase | Invariant tests (zero final balance, principal sum) + external oracle |
| 3. PMI drop-off | TCO / amortization phase | Removal month matches 78%/80% of original value; toggle test |
| 4. DTI definitions | Affordability (bank path) | Worked-example tests for front/back ratios |
| 5. Real vs nominal | FI-impact engine | Reconciliation with retirement-model oracle |
| 6. Opportunity-cost asymmetry | FI-impact engine (flagship) | Both-scenarios-invest test; transaction costs present |
| 7. SWR / 4% over long horizon | FI-impact + assumptions system | SWR configurable; long-horizon default; sensitivity shown |
| 8. Sequence-of-returns false certainty | FI-impact + sensitivity | Range/band shown, not single date |
| 9. Prop 2½ misunderstanding | Town-tax / TCO + assumptions | Tax = assessed×rate, not 2.5% cap; UI caveat present |
| 10. False precision / no sensitivity | Sensitivity-analysis phase (architecture set in core) | Tornado/one-way view ships; top drivers labeled |
| 11. Reproducibility | Core foundation (purity) + persistence | Save→recompute cent-identical golden test; no ambient date |
| 12. MA lumpy costs (betterment/Title 5) | TCO inputs + town flags | One-time cost category exists; septic towns flagged |
| 13. 40B deed-restricted units | Future listings; flag now | Deed-restricted scenario flag caps appreciation |
| 14. Town score normalization | Town-scoring / heatmap | Metrics normalized + direction-corrected; missing-data handled |
| Funnel / "must be able to say no" | Cross-cutting (UX + FI-impact) | A realistic input set yields "rent & invest" verdict |

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Float money math discovered late | HIGH | Introduce `Money` type/decimal, migrate all arithmetic, re-baseline every golden test. Painful mid-build — hence "decide first." |
| Real/nominal mix-up | MEDIUM | Pick one convention, re-derive FI math, reconcile against oracle; outputs shift but tests catch it. |
| Reproducibility broken (ambient state) | MEDIUM | Thread as-of date + assumption snapshot through pure functions; add golden recompute test. |
| Optimistic-default bias shipped | LOW | Change defaults to conservative; assumptions are already first-class data. |
| PMI / DTI definition wrong | LOW-MEDIUM | Isolated pure functions → fix + re-test against worked examples. Low blast radius if core is pure (the project's architecture pays off here). |

## Sources

- CFPB / FDIC / Federal Reserve Homeowners Protection Act (PMI) materials — 78% automatic / 80% requested / midpoint, original-value basis (HIGH)
- Mass.gov DLS "Levy Limits: A Primer on Proposition 2½" and "Proposition 2½ and Tax Rate Process" — levy (not bill) mechanics, new growth, overrides (HIGH)
- Mass.gov DLS "Betterments" guide + "Ask DLS: Municipal Liens" — apportionment up to 20yr @ ~5%, lien mechanics (HIGH)
- Mass.gov "Title 5 and septic systems" / "Buying or Selling Property with a Septic System" — time-of-sale inspection, replacement cost, escrow, tax credit (HIGH)
- MassHousing "40B Affordability Monitoring Handbook" + CHAPA homeowner guidance — deed rider, maximum resale price, refinance restriction (HIGH)
- FIRE / SWR literature (madfientist, ChooseFI, Vanguard early-retirement, recent SWR research) — 4% is 30yr; ~3-3.5% for 40-50yr; sequence-of-returns risk concentration near transition (MEDIUM-HIGH, multiple sources agree)
- Established JS money-handling guidance (integer minor units / big.js / decimal.js; `0.1+0.2` problem) — DEV/Honeybadger/frontstuff/currency.js (HIGH, well-established)
- Rent-vs-buy opportunity-cost analyses — symmetric invest-the-difference, distinct appreciation vs portfolio return, transaction costs (MEDIUM)
- Project context: `.planning/PROJECT.md` (constraints, decisions, MA realities to model)

---
*Pitfalls research for: personal Boston/MA home-affordability + FI-impact decision engine*
*Researched: 2026-06-22*
