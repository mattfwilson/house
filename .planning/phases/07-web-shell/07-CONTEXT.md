# Phase 7: Web Shell - Context

**Gathered:** 2026-06-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Build `apps/web` — a **thin Next.js shell** (the FIRST app package; it does not exist yet) over the already-proven pure core (`packages/core`) and imperative shell (`packages/app`). It holds **zero financial logic**: every computation runs in the core via thin Server Action / service wrappers around the existing `packages/app` services (`computeAndSaveScenario`, `loadScenario`, `listScenarios`, `deleteScenario`, `saveProfile`, `listProfiles`, `makeContainer`) and the core engine entry points (`evaluateScenario`, `compareScenarios`, `tornado`, `scoreTowns`, `fiImpact`).

Delivers four UI surfaces over previously-built engine outputs:
1. **Editors** — profile, assumptions, and scenario forms.
2. **Comparison** — N scenarios ranked by FI-date impact, with the "rent and invest the difference" baseline as a first-class row.
3. **Town affordability heatmap** — rendering the locked Phase-5 heatmap encoding contract.
4. **Sensitivity (tornado) view** — the one-way FI-date swing across drivers.

The UI **leads with FI-impact / true affordability** and presents bank affordability only as the gap — **never a "buy" funnel**. No new v1 requirement is introduced; this is the UI surface for engine requirements delivered in Phases 1–6.

**Out of scope (unchanged project boundaries):** live listing data, auth/multi-tenant, any new financial math in the UI layer, live property-tax refresh.

</domain>

<decisions>
## Implementation Decisions

### App shape & navigation
- **D-01:** **Hybrid information architecture** — a primary **cockpit** route plus dedicated routes for the **town heatmap** and the **sensitivity tornado**. Not a single cram-everything screen, not a conventional multi-page admin tool; the cockpit carries the "flight simulator" feel, the data-dense views get their own room.
- **D-02:** **Persistent top profile + scenario switcher** (header bar), always present. The cockpit is the home route; swapping the active scenario re-flies the instruments in place. The heatmap and sensitivity routes **inherit the active profile/scenario context** (e.g. the active budget drives the heatmap bucketing).
- **D-03:** **The cockpit IS the comparison view.** Landing on the cockpit shows the **ranked-by-FI-date comparison table** (all of the profile's scenarios + the rent-baseline row). Selecting a row **expands that scenario's FI-impact instruments + assumptions inline** — comparison and "flying one scenario" are the same screen.

### Headline view & FI-lead (anti-funnel)
- **D-04:** **Hero metric per row = FI-date delta vs the no-purchase baseline** (e.g. "+3 yr 4 mo later", "2 mo earlier"), rendered color-honest (not green-good). The table is **ranked by this delta**. Net-worth-at-horizon and the monthly housing delta are secondary readouts.
- **D-05:** **Rent-and-invest baseline = a pinned, visually distinct benchmark row that also competes in the ranking.** If it out-ranks every buy scenario it naturally sorts to #1 — and **that is the "don't buy" signal** (no separate verdict chip needed). This makes the anti-funnel conclusion reachable by construction.
- **D-06:** **Bank affordability is presented only as "the gap," framed as a warning.** True affordability is the primary number; bank affordability appears as the contrast ("a bank would approve ~$X more than your FI plan can absorb"), rendered as a caution — **never** a target, never "headroom." Satisfies success criterion 4 + AFF-03.
- **D-07:** **Hero visual inside an expanded scenario = the trajectory-vs-baseline chart** — a net-worth-over-time line chart overlaying this scenario against the no-purchase (rent & invest) baseline, with the FI-threshold line and the FI-date crossover markers on each. The divergence between the two lines IS the cost of the house. Built with **Recharts** (CLAUDE.md names this the headline visual).

### Assumptions ↔ results coupling
- **D-08:** **Live recompute, debounced (~300ms), no Apply button.** Editing an assumption immediately re-flies the cockpit instruments. The synchronous, pure core makes the Server Action round-trip cheap — this is the flight-simulator payoff (fly the knob, watch the instruments respond).
- **D-09:** **Shared working assumption set drives the whole comparison** so the ranked table is always apples-to-apples under one return/SWR/inflation/etc. **Saving a scenario freezes the current working set into that scenario's reproducible snapshot** (honors Phase-6 D-05/D-07: snapshot = canonical-JSON blob, Zod-validated on load). **Re-opening a saved scenario loads its frozen set as the new working set.**
- **D-10:** **Assumptions live in a persistent docked rail/sidebar**, always visible in the cockpit and echoed on the heatmap + sensitivity routes, knobs inline next to the instruments — the most literal reading of success criterion 3 ("assumptions visible and editable next to every result").

### Visual style & design system
- **D-11:** **shadcn/ui + Tailwind** as the component/styling foundation (Radix primitives, copy-in components — accessible tables, dialogs, sliders, tabs; you own the code, no runtime dep lock-in). Run the **registry safety gate on init** (vet any non-official-shadcn registry blocks before use). This is the Phase-7 resolution of the app-chrome decisions the 05-UI-SPEC explicitly deferred.
- **D-12:** **Dense "instrument-panel" aesthetic** — data-forward, tighter spacing, darker surfaces, the UI-SPEC teal/amber/slate palette doing the semantic work, numbers + trajectory chart front-and-center. Must stay **anti-funnel**: no success-green, no aspirational "buy this" styling (per the locked UI-SPEC color contract).
- **D-13:** **Town heatmap rendered as a CSS-grid table-heatmap** (not visx this build) — the towns×metrics matrix as a styled CSS grid, cells colored by the locked bucket palette + lightness intensity, hatched "no data" cells, per-metric breakdown in tooltips. No extra chart dependency; fully honors the 05-UI-SPEC heatmap encoding contract; sufficient for 24 towns. (visx remains the sanctioned future escalation if richer interaction is ever needed.)

### Scenario builder
- **D-14:** **Manual entry is the default path, with an optional "prefill from a sample listing."** The scenario form takes the inputs directly (price, down payment, rate, term, town from the curated 24-town table, insurance, HOA, etc.). A **`MockListingsProvider` browse is offered as an *optional* prefill** to seed price/town/beds before tweaking — this surfaces LIST-02 in the UI while keeping the project's "invert the flow — finances first, not houses first" thesis as the default. Listings are never the required entry point.
- **D-15:** **Add/Edit is an inline expanding editor** within the comparison table (a new/expanded editable row); on save it re-flies and re-ranks immediately, keeping the user in the cockpit and reinforcing the live loop. (Not a modal, not a separate route.)
- **D-16:** **The existing core Zod schemas are the single source of validation at the Server Action boundary.** Form inputs are plain numerics converted to canonical decimal strings and validated through the existing `parseScenarioInputs` / `ScenarioInputsSchema` (and `parseHousehold` / `parseAssumptionSet` for the other editors); field-level errors are surfaced from the parse result. **No duplicated validation logic in components**, no bare-`number` money — matches the validate-through-Zod-at-every-boundary discipline from prior phases.

### Claude's Discretion
- **Sensitivity tornado view specifics** (how the per-driver one-way swing reads, bar ordering/labeling) — not deep-dived; render faithfully over the existing `tornado` output, top drivers labeled, "no headline number without a range" (FI-05). Whether sweeps recompute live or behind a "Run" was left open (D-08 chose live for the cockpit; a sweep-heavy view may warrant an explicit trigger — planner's call).
- **First-run / empty states** — not deep-dived; follow the 05-UI-SPEC copywriting contract where it applies (e.g. heatmap empty/error copy is verbatim-locked) and standard "no profiles / no scenarios yet" affordances elsewhere.
- **Server Action / data-flow wiring** — how the DI `container` (`makeContainer`) is instantiated per request/process and threaded into Server Actions; route structure under App Router; where Zustand holds ephemeral builder/selection state vs server-truth. Follow ARCHITECTURE.md + the `packages/app` public surface.
- **Responsive layout** of the rail + cockpit + inline editor at the ScenarioInputs/AssumptionSet field counts.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Locked UI contract (load-bearing — honor verbatim)
- `.planning/phases/05-town-scoring-heatmap/05-UI-SPEC.md` — the heatmap encoding + color contract Phase 7 MUST render faithfully: bucket palette (teal Realistic `#0F766E` / amber Stretch `#B45309` / slate Fantasy `#64748B` / hatched-gray No-data `#94A3B8`), colorblind-safe + anti-funnel (no success-green), per-metric explainable tooltip shape, MA-flag chips as neutral/informational badges (never destructive), and the verbatim copywriting contract (bucket labels, empty/error/missing-metric copy, CTA). Also records which app-chrome decisions were **deferred to Phase 7** (now resolved in D-11..D-16).

### Architecture & dependency direction
- `.planning/research/ARCHITECTURE.md` — functional-core / imperative-shell + ports-and-adapters; the `core` / `app` / `web` package diagram; `apps/web` is a **thin caller** of `packages/app` services and never imports adapters directly (only ports via the container). NOTE: it says pnpm; the repo is **npm workspaces** (Phase-6 D-04).
- `.planning/phases/06-persistence-listings-adapter/06-CONTEXT.md` — the imperative-shell decisions this UI sits on: DI `container.ts` as the single composition root, `MockListingsProvider` as the only listings impl, scenario snapshot = canonical-JSON blob Zod-validated on load, ≤2-profile soft cap at the service layer.

### Requirements & roadmap
- `.planning/ROADMAP.md` §"Phase 7: Web Shell" — goal + the 4 success criteria (forms run math in core via thin wrappers; ranked comparison + rent-baseline first-class row; heatmap + tornado with assumptions visible/editable next to results; FI-lead never a buy funnel).
- `.planning/REQUIREMENTS.md` — the engine requirements this UI surfaces (TCO, AFF-01/02/03, FI-01..06, ASMP-02, TOWN-01..04, PROF-01/02/03, LIST-01/02). Note line ~137: Phase 7 introduces no new v1 requirement.
- `.planning/PROJECT.md` — core value ("what does buying this house do to our early-retirement timeline?"), the anti-funnel mandate, and the "flight simulator for a house purchase" mental model that drives the cockpit IA.

### Stack & the code this UI calls
- `CLAUDE.md` — Next 16 App Router + React 19, Server Components/Actions, decimal.js (no bare-`number` money at any boundary), Recharts for trajectory charts, visx sanctioned (but deferred — D-13), Zustand for ephemeral builder/selection UI state, Vitest `projects` (add an `apps/web` entry).
- `packages/app/src/index.ts` — the public service surface `apps/web` wraps: `saveProfile`, `listProfiles`, `MAX_PROFILES`, `computeAndSaveScenario`, `loadScenario`, `listScenarios`, `deleteScenario`, `ComputeAndSaveParams`, `makeContainer`, `Container`.
- `packages/core/src/index.ts` — the engine entry points the views render over: `evaluateScenario` (bank-vs-true gap), `compareScenarios` (ranked + anti-funnel baseline row), `tornado` (sensitivity), `scoreTowns` (heatmap data), `fiImpact` / `projectFiDate` (trajectory + FI date), plus `ScenarioInputsSchema`/`parseScenarioInputs`, `parseHousehold`, `parseAssumptionSet` for boundary validation (D-16).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`packages/app` services** (`computeAndSaveScenario`, `loadScenario`, `listScenarios`, `deleteScenario`, `saveProfile`, `listProfiles`, `makeContainer`/`Container`) — Server Actions are thin wrappers over these; the cockpit never re-implements orchestration.
- **`packages/core` engine entry points** — `compareScenarios` already produces the ranked list + the anti-funnel rent-baseline row (D-04/D-05); `evaluateScenario` produces the bank-vs-true gap (D-06); `tornado` produces the sensitivity swing; `scoreTowns` produces the heatmap matrix satisfying the 05-UI-SPEC encoding contract; `fiImpact`/`projectFiDate` produce the trajectory + FI date (D-07).
- **Existing Zod boundary schemas** — `ScenarioInputsSchema`/`parseScenarioInputs`, `parseHousehold`, `parseAssumptionSet`, `decStr` — reused verbatim as the form validation boundary (D-16); no UI-side schema duplication.
- **`packages/core/src/towns/town-table.ts`** — the curated 24-town set powering both the scenario-form town selector and the heatmap rows.

### Established Patterns
- **Zero financial logic outside the core** — enforced by the package boundary + `eslint-plugin-boundaries`; `apps/web` may import `@house/app` (services + ports) and `@house/core` types, never concrete adapters (only via the container — Phase-6 D-03).
- **Validate-through-Zod-at-every-boundary / no bare-`number` money** — every Server Action parses inputs through the existing core schemas; money stays canonical decimal strings end to end (D-16).
- **Reproducibility contract survives the UI** — saving freezes the working AssumptionSet + inputs into the canonical-JSON snapshot (D-09); the UI must not mutate snapshots in place.

### Integration Points
- **New `apps/web` workspace package** — the first under `apps/*` (root `package.json` already globs `apps/*`). Adds Next 16 + React 19 + Tailwind + shadcn/ui + Recharts; a new Vitest `projects` entry (jsdom/happy-dom for any component tests). better-sqlite3 is auto-externalized by Next 16 server bundling.
- **DI container instantiation** — `makeContainer` (names the SQLite adapters + `MockListingsProvider`) is wired into Server Actions; the single composition root stays in `packages/app`, `apps/web` only receives port-typed `Container`.

</code_context>

<specifics>
## Specific Ideas

- **Mental model is the design brief:** "flight simulator for a house purchase — fly the scenario and watch the instruments (FI date, net-worth trajectory, liquidity) respond before committing." The cockpit (D-01/D-03) + live recompute (D-08) + persistent assumptions rail (D-10) exist to make that literal.
- **Anti-funnel is a hard product constraint, not a preference** — the rent-baseline must be able to win and read as "don't buy" (D-05), and the bank number must never read as headroom (D-06). If every path nudges toward "buy," the UI has failed (PROJECT.md).
- **Listings stay walled off by default** — the optional sample-listing prefill (D-14) is a convenience that exercises the adapter in-UI, not a houses-first entry point; the default and emphasis remain finances-first.

</specifics>

<deferred>
## Deferred Ideas

- **visx heatmap** — the richer/sanctioned heatmap renderer; deferred in favor of a CSS-grid table-heatmap this build (D-13). Revisit only if interaction needs outgrow the grid.
- **Live/real listings UI** (`RealListingsProvider`, Zillow/Redfin/MLS/IDX) — out of scope project-wide; the port + mock keep it pluggable later.
- **Per-scenario assumption overrides** — considered (Assumptions Q2) and deliberately rejected in favor of the shared-working-set + freeze-on-save model (D-09) to keep comparisons fair and snapshots unambiguous. Revisit only if a shared-vs-custom-assumptions UX emerges.
- **Explicit "Run" trigger for sweep-heavy views** — live recompute was chosen for the cockpit (D-08); the heatmap/sensitivity sweep recompute cadence is left to the planner and may warrant an explicit trigger.

None of the above were scope creep — discussion stayed within the Phase 7 boundary.

</deferred>

---

*Phase: 7-web-shell*
*Context gathered: 2026-06-28*
