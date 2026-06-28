# Phase 7: Web Shell - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-28
**Phase:** 7-web-shell
**Areas discussed:** App shape & navigation, Headline view & FI-lead, Assumptions ↔ results coupling, Visual style & design system, Scenario builder

---

## Area selection (multiSelect)

| Option | Selected |
|--------|----------|
| App shape & navigation | ✓ |
| Headline view & FI-lead | ✓ |
| Assumptions ↔ results coupling | ✓ |
| Visual style & design system | ✓ |

A fifth area (Scenario builder) was added in the post-areas continuation round.

---

## App shape & navigation

**Q1 — Overall information architecture?**

| Option | Description | Selected |
|--------|-------------|----------|
| Hybrid cockpit + deep views | Primary cockpit route + dedicated heatmap & sensitivity routes | ✓ |
| Single-page cockpit | Everything on one screen, all panels live | |
| Multi-page routes | Conventional sidebar nav, separate pages | |

**Q2 — How to choose active profile + scenario?**

| Option | Description | Selected |
|--------|-------------|----------|
| Persistent top switcher | Header switcher always present; cockpit home; deep views inherit context | ✓ |
| Scenario-list landing | List/grid home, click in to a cockpit | |
| You decide | Planner picks | |

**Q3 — Where does the ranked comparison live?**

| Option | Description | Selected |
|--------|-------------|----------|
| Cockpit IS the compare view | Land on ranked table; select a row → expand instruments inline | ✓ |
| Compare as a deep view | Cockpit = one scenario; comparison its own route | |
| Split panel in cockpit | Active scenario + compact compare list always both visible | |

**User's choice:** Hybrid IA; persistent top switcher; cockpit is the comparison view.
**Notes:** Driven by the "flight simulator" mental model — keep the live feel in the cockpit, give the dense heatmap/tornado their own room.

---

## Headline view & FI-lead

**Q1 — Hero metric per scenario row?**

| Option | Description | Selected |
|--------|-------------|----------|
| FI-date delta vs baseline | Lead with shift in FI date vs no-purchase baseline; rank by it | ✓ |
| Absolute FI date/age | Lead with resulting FI date/age | |
| Verdict-first | Lead with a qualitative verdict chip | |

**Q2 — Rent-baseline appearance + 'don't buy' surfacing?**

| Option | Description | Selected |
|--------|-------------|----------|
| Pinned benchmark row, ranks honestly | Distinct anchor row that competes; #1 → that IS 'don't buy' | ✓ |
| Anchor row + explicit callout | Same, plus banner when baseline wins | |
| You decide | Planner picks silent vs callout | |

**Q3 — Bank affordability vs true affordability?**

| Option | Description | Selected |
|--------|-------------|----------|
| Gap framed as a warning | True affordability primary; bank number only as caution-contrast | ✓ |
| Side-by-side equal billing | Two equal numbers + gap | |
| Gap behind disclosure | Bank number hidden behind an expander | |

**Q4 — Hero visual when expanded?**

| Option | Description | Selected |
|--------|-------------|----------|
| Trajectory vs baseline chart | Net-worth over time, scenario vs baseline, FI markers (Recharts) | ✓ |
| Numbers-first, chart secondary | Big readouts lead, chart below | |
| Multi-scenario overlay | Overlay all scenarios at once | |

**User's choice:** FI-date delta hero; pinned competing benchmark row; bank affordability as warning-gap; trajectory-vs-baseline chart.
**Notes:** Anti-funnel framing is load-bearing throughout; CLAUDE.md names the trajectory-vs-baseline chart as the headline visual.

---

## Assumptions ↔ results coupling

**Q1 — How do assumption edits drive recompute?**

| Option | Description | Selected |
|--------|-------------|----------|
| Live recompute (debounced) | ~300ms debounce, no Apply button | ✓ |
| Live cockpit, explicit for sweeps | Live cockpit; explicit 'Run' for heatmap/tornado | |
| Explicit Recompute button | Stage edits, commit on Apply | |

**Q2 — Assumptions across the comparison vs per-scenario snapshots?**

| Option | Description | Selected |
|--------|-------------|----------|
| Shared working set + freeze on save | One set drives all; freeze into snapshot on save; reload sets working set | ✓ |
| Per-scenario, edited when expanded | Each scenario carries its own assumptions | |
| Global + per-scenario overrides | Baseline + flagged overrides | |

**Q3 — Where does the assumptions control live?**

| Option | Description | Selected |
|--------|-------------|----------|
| Persistent rail/sidebar | Docked, always visible, echoed on deep routes | ✓ |
| Collapsible drawer | Slide-out on demand | |
| You decide | Planner picks | |

**User's choice:** Live debounced recompute; shared working set frozen on save; persistent assumptions rail.
**Notes:** Honors Phase-6 reproducibility (D-05/D-07) while keeping the ranked comparison apples-to-apples; rail is the most literal reading of success criterion 3.

---

## Visual style & design system

**Q1 — Component/styling foundation?**

| Option | Description | Selected |
|--------|-------------|----------|
| shadcn/ui + Tailwind | Radix primitives, copy-in components; registry safety gate on init | ✓ |
| Plain Tailwind, hand-rolled | Tailwind only, build components by hand | |
| You decide | Researcher picks | |

**Q2 — Overall look and density?**

| Option | Description | Selected |
|--------|-------------|----------|
| Dense instrument panel | Data-forward, tighter spacing, darker surfaces, semantic palette | ✓ |
| Clean & airy | Light, generous whitespace, calmer | |
| Restrained financial document | Sober, typographic, minimal chrome | |

**Q3 — Heatmap renderer?**

| Option | Description | Selected |
|--------|-------------|----------|
| CSS-grid table-heatmap | Styled CSS grid honoring the locked palette; no extra dep | ✓ |
| visx heatmap | Sanctioned escalation, richer interaction | |
| You decide | Researcher picks | |

**User's choice:** shadcn/ui + Tailwind; dense instrument-panel aesthetic; CSS-grid table-heatmap.
**Notes:** Must stay anti-funnel (no success-green); CSS-grid is the simplest faithful renderer for 24 towns, visx kept as future escalation.

---

## Scenario builder

**Q1 — How to create/edit a scenario; does MockListingsProvider show in the UI?**

| Option | Description | Selected |
|--------|-------------|----------|
| Manual entry only | Pure manual form; listings stay fully walled off | |
| Manual + optional listing prefill | Manual default + optional prefill from mock listing fixtures | ✓ |
| You decide | Planner picks | |

**Q2 — How does the add/edit form surface?**

| Option | Description | Selected |
|--------|-------------|----------|
| Inline expanding editor | Editable row in the comparison table; save re-flies/re-ranks | ✓ |
| Modal dialog | shadcn Dialog over the cockpit | |
| You decide | Planner picks | |

**Q3 — Money/number input + validation?**

| Option | Description | Selected |
|--------|-------------|----------|
| Zod boundary is source of truth | Validate via existing parseScenarioInputs at Server Action boundary; no duplicate UI logic | ✓ |
| Client mirror + server validate | Client formatting/validation mirroring schema, server authoritative | |
| You decide | Planner picks | |

**User's choice:** Manual entry with optional sample-listing prefill; inline expanding editor; existing Zod schema as the single validation boundary.
**Notes:** Optional prefill exercises LIST-02 in-UI while keeping the finances-first/inverted-flow thesis as the default entry point.

---

## Claude's Discretion

- Sensitivity tornado view specifics (bar ordering/labeling; whether sweeps recompute live or behind a "Run").
- First-run / empty states (beyond the verbatim-locked 05-UI-SPEC heatmap copy).
- Server Action / DI-container wiring, App Router route structure, Zustand ephemeral-state boundaries.
- Responsive layout of rail + cockpit + inline editor.

## Deferred Ideas

- visx heatmap (future escalation over the CSS-grid renderer).
- Live/real listings UI (`RealListingsProvider`) — out of scope project-wide.
- Per-scenario assumption overrides (considered and rejected for the shared-working-set model).
- Explicit "Run" trigger for sweep-heavy views.
