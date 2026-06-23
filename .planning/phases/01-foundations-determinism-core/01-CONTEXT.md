# Phase 1: Foundations & Determinism Core - Context

**Gathered:** 2026-06-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Lock the existential, expensive-to-retrofit foundations of the calculation engine:

- A pure, framework-agnostic `packages/core` (zero React/Next/DB deps) with a lint boundary rule that fails the build if a framework import appears inside it.
- A decimal-precise `Money` primitive with a documented rounding policy; bare-`number` dollar math is rejected by tests.
- Deterministic core functions — no `Date.now()`, `Math.random()`, env reads, or module-level mutable defaults; `asOf` and all assumptions are explicit parameters.
- An `AssumptionSet` type holding every tunable (tax, DTI, return, inflation, maintenance, SWR, PMI) as versioned, serializable data — nothing hardcoded.
- A reproducibility golden test proving a frozen snapshot recomputes cent-identically, before any persistence exists.

**Nothing computes a real engine result yet.** This phase delivers the substrate every downstream phase imports. It is **core-only** — no `apps/web` scaffolding in this phase.

</domain>

<decisions>
## Implementation Decisions

### Money Primitive & Rounding Policy
- **D-01:** `Money` is an **immutable class wrapping a decimal.js `Decimal`**, exposing a curated API (e.g. `add`/`sub`/`mul`/`percentOf`/`toCents`/`toString`). Raw `Decimal` operations and bare `number` dollar math must not be possible through the public surface — and bare-number money math is rejected by tests (CORE-02).
- **D-02:** The documented rounding policy uses **banker's rounding (HALF_EVEN)** — avoids the systematic upward bias HALF_UP introduces when summing many rounded values across a multi-decade projection.
- **D-03:** **Full decimal precision is retained through all intermediate math** (amortization, compounding). Rounding to cents happens **only at defined output boundaries** (stored results + display) — never per-operation. This is the reason `decimal.js` was chosen over an integer-minor-units approach.

### AssumptionSet Structure & Versioning
- **D-04:** `AssumptionSet` is **nested by domain** — namespaced groups (`tax`, `dti`, `returns`, `inflation`, `maintenance`, `swr`, `pmi`, …) rather than a flat map. Each downstream module reads its own slice; avoids key collisions as tunables accumulate across phases.
- **D-05:** Versioned by an **integer `schemaVersion`** with a per-version **Zod** schema and an explicit `migrate(old) -> current` path. Monotonic and simple; snapshot replay can gate on version match.
- **D-06:** Numeric assumption values (rates, percentages, thresholds) are serialized as **canonical decimal strings** (e.g. `"0.035"`), parsed to `Decimal` on use. Keeps floating-point out of the serialized boundary and reinforces the no-bare-number discipline end to end.
- **D-07:** A single **versioned defaults module** in the core holds the seed `AssumptionSet` (pure data, no env reads). (Claude's discretion on exact default values; structure/versioning per above.)

### Reproducibility Harness
- **D-08:** The golden test exercises a **deterministic "canary" computation** — real `Decimal` compounding + banker's rounding + an `AssumptionSet` read — **plus** a snapshot **serialize → deserialize round-trip**. Proves both computation determinism AND data reproducibility before the real engine exists.
- **D-09:** The frozen golden master is a **committed JSON fixture** in the core test directory, regenerated **only via a deliberate, gated command** (e.g. `UPDATE_GOLDEN=1`). A regeneration produces a reviewable diff — silent drift is impossible to miss. (NOT Vitest `toMatchSnapshot`, which auto-writes and can be re-blessed silently.)
- **D-10:** Cent-identical equality is asserted by **deep-equal on canonical JSON** — money serialized as decimal strings, object keys sorted — structurally compared against the master. Human-diffable on failure.

### Determinism Enforcement
- **D-11:** Time and assumptions are threaded via a **single immutable `EngineInput` object** (`{ asOf, assumptions, ...scenarioInputs }`) passed to top-level engine functions. That object **is** the shape a snapshot captures — the function signature and the reproducibility unit are the same thing.
- **D-12:** Ambient nondeterminism is rejected by **both** a **CI lint rule** (ESLint `no-restricted-globals`/`no-restricted-syntax`, scoped to `packages/core`, forbidding `Date.now`, `Math.random`, env reads) **and** a **runtime test guard** that makes those throw if ever reached. Belt-and-suspenders for a correctness-critical core.
- **D-13:** `asOf` is a **branded ISO `YYYY-MM-DD` `CalendarDate` string** — the core never touches a JS `Date` (timezone/locale/mutable nondeterminism hazard). Serializes trivially into snapshots.
- **D-14:** `decimal.js` precision/rounding is configured via a **frozen `Decimal.clone({ precision, rounding })` constant** used everywhere; the global `Decimal` is never mutated via `Decimal.set`. Honors the "no module-level mutable defaults" criterion.

### Claude's Discretion
- Monorepo bootstrap mechanics: npm workspaces layout, root vs per-package `tsconfig` (core `tsconfig` has no DOM lib / no JSX), Vitest `projects` wiring, coverage gating for the core.
- Choice of lint-boundary mechanism (`import/no-restricted-paths` vs `eslint-plugin-boundaries`) implementing the "no framework in core" rule — as long as it fails the build in CI.
- Exact shape/identifiers of the `Money` API, the `EngineInput` type, the canary computation's specific formula, and the seed default assumption values.
- Internal `decimal.js` precision level (significant digits) for the configured clone.
- Whether to use `drizzle-zod` later; for this phase Zod validates the `AssumptionSet`/snapshot at the serialization boundary only.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Stack & Architecture (binding)
- `CLAUDE.md` — The prescriptive stack and rationale: `decimal.js` (vs big.js/dinero), Vitest 4 with `projects`, npm-workspaces monorepo (`packages/core` + `apps/web`), Zod 4 at boundaries, the "no framework deps in core" rule, and the "What NOT to Use" list (no bare `number` for money, no dinero.js inside the core, no calc logic in React).

### Requirements & Scope
- `.planning/REQUIREMENTS.md` — Requirements addressed by this phase: **CORE-01, CORE-02, CORE-03, ASMP-01, PROF-04**.
- `.planning/ROADMAP.md` §"Phase 1: Foundations & Determinism Core" — Goal and the 5 success criteria (verbatim acceptance bar for this phase).
- `.planning/PROJECT.md` — Core value (the anti-funnel guarantee), constraints (pure core, local SQLite, FI math reconciled against an existing retirement model as a test oracle), and Key Decisions table.
- `affordability-engine-gsd-brief.md` — Original project brief (background context).

No external ADRs/specs exist yet — foundational decisions are captured in the `<decisions>` block above plus `CLAUDE.md`.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- None — greenfield repository. Only `CLAUDE.md` and the project brief exist; no `package.json`, `packages/`, or `apps/` yet. This phase scaffolds the monorepo and `packages/core`.

### Established Patterns
- None in-repo. The binding patterns are prescribed by `CLAUDE.md` (monorepo layout, pure-core boundary, decimal-first money math).

### Integration Points
- This phase produces the primitives (`Money`, `AssumptionSet`, `EngineInput`, `CalendarDate`, configured `Decimal` clone, reproducibility harness) that **all** later phases (TCO, Affordability, FI-Impact, Town Scoring, Persistence) import. Stability of these signatures is the whole point of front-loading them.

</code_context>

<specifics>
## Specific Ideas

- The FI projection math will later be reconciled against an **existing retirement model used as a golden-master/oracle** (FI-05, future phase). This phase's reproducibility harness is the substrate that makes that oracle test trustworthy — the canary computation should be representative enough (real compounding + rounding) to prove the machinery, not a trivial echo.
- "Flight simulator for a house purchase" mental model (PROJECT.md): determinism is non-negotiable because the user must be able to replay a scenario and trust the instruments.

</specifics>

<deferred>
## Deferred Ideas

- **`apps/web` scaffolding** — not in this phase; core-only. A later phase (Web Shell) introduces the Next.js shell.
- **Persistence (SQLite / Drizzle migrations)** — explicitly deferred; the reproducibility golden test must work *before* persistence exists (success criterion 5). Persistence arrives in a later phase.
- **Sensitivity analysis (ASMP-02)** and the real FI engine (FI-*) — depend on these foundations but are out of Phase 1 scope.
- **Exact seed mill-rate / tax tables** — Phase 2 (TCO) concern; only the `AssumptionSet` *shape* is locked here.

None of the discussion drifted outside phase scope — these are natural downstream dependencies, not scope creep.

</deferred>

---

*Phase: 1-foundations-determinism-core*
*Context gathered: 2026-06-23*
