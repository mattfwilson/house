# Phase 7: Web Shell - Pattern Map

**Mapped:** 2026-06-28
**Files analyzed:** 31 (1 new core entry + 2 core/root modifies + ~6 web config + ~7 server-layer + ~15 client-layer)
**Analogs found:** 13 with in-repo analog / 31 (the remaining 18 are the first React/Next surface — no in-repo analog, follow RESEARCH.md + CLAUDE.md)

> **Read first:** This is the FIRST Next.js/React surface in the repo. The pure-core, service, container, Money, vitest, and eslint files below have strong in-repo analogs and MUST copy their patterns. Every web-layer React file (Server/Client Components, Recharts wrappers, Zustand stores, shadcn copy-in) has **no in-repo analog** — those are flagged explicitly in `## No Analog Found`; ground them in `07-RESEARCH.md` (Patterns 1-5, Code Examples) and the `07-UI-SPEC.md` contract, not a forced match.

---

## File Classification

### Tier A — Pure core + repo-config (strong in-repo analogs)

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `packages/core/src/fi/fi-trajectory.ts` (NEW — Open Q1) | service (pure engine entry) | transform / batch (month series) | `packages/core/src/fi/projection.ts` + `fi/fi-impact.ts` | exact |
| `packages/core/src/index.ts` (MODIFY — add `fiTrajectory` export) | config (barrel) | — | `packages/core/src/index.ts` (self, lines 117-134) | exact |
| `apps/web/vitest.config.ts` (NEW) | config (test project) | — | `packages/app/vitest.config.ts` | exact (env differs: jsdom not node) |
| `vitest.config.ts` (MODIFY — add `apps/web` to `projects`) | config | — | `vitest.config.ts` (self, line 8) | exact |
| `apps/web/package.json` (NEW) | config | — | `packages/app/package.json` | role-match |
| `apps/web/tsconfig.json` (NEW) | config | — | `packages/app/tsconfig.json` | role-match |
| `eslint.config.ts` (MODIFY — add `apps/web` boundary block) | config (boundary) | — | `eslint.config.ts` (self, lines 192-243 app block) | exact |

### Tier B — Server layer (role-analogs in `@house/app`; the `'use server'`/DTO half is new)

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `apps/web/src/lib/container.server.ts` (NEW) | provider (composition root) | — | `packages/app/src/container.ts` (`makeContainer`) | role-match (singleton + `server-only` is new) |
| `apps/web/src/app/actions/scenarios.ts` (NEW) | controller (Server Action) | request-response | `packages/app/src/services/scenario-service.ts` | role-match (thin gather→call-once→return) |
| `apps/web/src/app/actions/profiles.ts` (NEW) | controller (Server Action) | request-response / CRUD | `packages/app/src/services/profile-service.ts` | role-match |
| `apps/web/src/app/actions/towns.ts` (NEW) | controller (Server Action) | request-response | `packages/app/src/services/scenario-service.ts` (thin-wrapper shape) | partial |
| `apps/web/src/app/actions/sensitivity.ts` (NEW) | controller (Server Action) | request-response | `packages/app/src/services/scenario-service.ts` (thin-wrapper shape) | partial |
| `apps/web/src/lib/dto/*.ts` (NEW — Money→string mappers) | utility (transform) | transform | `packages/core/src/money/money.ts` (output boundary) + `packages/app/src/adapters/listings/mock-provider.ts` (Money-boundary usage) | partial (the DTO concept is new; the Money API it calls is exact) |

### Tier C — Client layer (NO in-repo analog — see `## No Analog Found`)

`apps/web/src/lib/format.ts`, `app/layout.tsx`, `app/page.tsx` (cockpit), `app/heatmap/page.tsx`, `app/sensitivity/page.tsx`, `components/cockpit/*`, `components/rail/*`, `components/charts/*`, `components/heatmap/*`, `components/ui/*` (shadcn copy-in), `store/*` (Zustand), `next.config.ts`, `postcss.config.mjs`, `components.json`.

---

## Pattern Assignments

### `packages/core/src/fi/fi-trajectory.ts` (NEW pure engine entry — Open Q1, HIGH priority)

**Analogs:** `packages/core/src/fi/projection.ts` (the month-by-month loop) + `packages/core/src/fi/fi-impact.ts` (the two-path builder that already feeds that loop).

> This is the only new `@house/core` touch. RESEARCH Open Q1 + Assumption A1: the D-07 hero chart needs a net-worth-over-time **series** the core does not expose today. `projectFiDate` computes month-by-month NW for both paths but **discards every point except the FI crossing**. The fix is a pure series-emitting sibling that REUSES the exact same contribute-then-compound loop and the exact same `buyPath`/`renterBaselinePath` bundles — never re-derives trajectory math (that would violate CORE-01/02 and the "no financial logic in the shell" rule if done in the web layer).

**The loop to reuse verbatim** (`fi/projection.ts` lines 89-99) — emit a point each iteration instead of discarding:
```typescript
for (let month = 1; month <= maxHorizonMonths; month++) {
  // LOCKED convention (L1): contribute at month start, THEN compound one month.
  nw = nw.plus(contributionFor(month));
  nw = nw.times(factor);
  // A5: buy path's comparison NW = liquid side-portfolio + this month's liquidated home equity.
  if (comparisonNw(nw, equityFor, month).greaterThanOrEqualTo(targetDec)) {
    return reached(month);
  }
}
```
The trajectory variant keeps the SAME locked intra-month order (`projection.ts` lines 9-13 comment: contribute-then-compound) and the SAME `comparisonNw` (lines 104-111) so the emitted series and the FI-date crossing agree by construction.

**The path bundles to reuse** (`fi/fi-impact.ts` lines 159-228) — `buyPath` (seed = NW − DP+closing; `contributionFor` = savings − premium; `equityFor` via `buyEquityAt`) and `renterBaselinePath` (seed = NW; full savings; no equity). `fiTrajectory` should accept the same `EngineInput` and build the same two `PathBundle`s `fiImpact` builds (lines 262-267), then run the series-emitting loop on each.

**Result shape (closed, Money-bearing, mirrors `FiImpactResult` discipline — `fi-impact.ts` lines 55-69):**
```typescript
export interface FiTrajectoryResult {
  readonly points: readonly { month: number; buyNetWorth: Money; rentNetWorth: Money }[];
  readonly fiThreshold: Money;          // the FI target line (D-07)
  readonly buyFiMonth: number | null;   // crossover marker; null when unreached
  readonly rentFiMonth: number | null;
}
```
**Money/Dec discipline (copy from `fi-impact.ts` lines 37-39, 271-276):** all compounding in the frozen `Dec` clone; dollars cross OUT as `Money` (build via `Money.of(dec.toFixed())`); `Dec` is NOT re-exported. Determinism: no `Date.now`/`Math.random`; the cap comes from `input.assumptions.projection.maxHorizonYears` (`fi-impact.ts` line 260 — `Number()` only at the loop bound).

**Year-sampling note:** D-07 is a line chart over ~30yr; emitting all 360 months is fine, but a year-sampled variant (every 12th month) is acceptable — decide in the plan. Keep the FI-crossover months exact regardless of sample stride.

**Test analog:** `packages/core/src/fi/projection.test.ts` / `fi-impact.test.ts` (oracle + 0%-return linear anchor). The new entry needs a unit test asserting (a) the last emitted point's month equals `maxHorizonMonths` or the crossing, (b) `buyFiMonth`/`rentFiMonth` match `projectFiDate` on the same input (reconciliation), (c) the series is finite (`canonicalJson`-safe).

---

### `packages/core/src/index.ts` (MODIFY — export the new entry)

**Analog:** itself, the FI block (lines 117-134). Add alongside `fiImpact`/`compareScenarios`/`projectFiDate`:
```typescript
export { fiTrajectory, type FiTrajectoryResult } from './fi/fi-trajectory.js';
```
Follow the block's documented discipline (lines 107-116): closed result type, `Money` dollars, decimal-string deltas, `Dec` NOT re-exported. `.js` specifier (NodeNext + verbatimModuleSyntax).

---

### `apps/web/vitest.config.ts` (NEW)

**Analog:** `packages/app/vitest.config.ts` (exact structure; only `environment` and `name` change).

Copy verbatim, swapping `node` → `jsdom` (component tests) and the name:
```typescript
import { defineProject, mergeConfig } from 'vitest/config';
import { sharedTest } from '../../vitest.shared.js';

export default mergeConfig(
  defineProject({
    test: {
      ...sharedTest,        // { globals: false } — vitest.shared.ts
      name: 'web',
      environment: 'jsdom', // (or 'happy-dom'); the app/core projects use 'node'
    },
  }),
  {},
);
```
**Key constraint (vitest.shared.ts comment + CLAUDE.md):** per-project configs CANNOT `extends` the root — shared options come from `../../vitest.shared.js` via `mergeConfig`. `globals: false` is the repo convention (explicit imports).

**Then MODIFY root `vitest.config.ts` line 8:** `projects: ['packages/*']` → `projects: ['packages/*', 'apps/*']`. The root coverage thresholds (lines 9-12, lines/functions 95, branches 90) are process-global — the plan should decide whether the web project is included in or excluded from that gate (RESEARCH §Sampling Rate keeps core at 95%+; web boundary tests are the load-bearing ones).

---

### `apps/web/package.json` (NEW)

**Analog:** `packages/app/package.json` (the workspace-package shape: `private`, `type: module`, `exports`, `scripts.test = vitest run`, `@house/core` as `*`).

Differences from the analog (RESEARCH §Standard Stack + §Already-present):
- Add `@house/core: "*"`, `@house/app: "*"` (workspace links), `next`, `react`, `react-dom`, `recharts ^3.9.0`, `zustand ^5.0.14`, `lucide-react`, `server-only`, `tailwindcss ^4.3.1`, `@tailwindcss/postcss`.
- **Do NOT** add `better-sqlite3` (RESEARCH §Already-present + A3: Next 16.1+ resolves it transitively through `@house/app`).
- Unlike the analog, this package is consumed by Next (a Next app), so it has `scripts.dev/build/start` instead of a library `exports` barrel.

---

### `apps/web/tsconfig.json` (NEW)

**Analog:** `packages/app/tsconfig.json` (extends `../../tsconfig.base.json`, `composite: true`, `references` the packages it consumes).

Adapt: `references` should point to BOTH `../../packages/core` and `../../packages/app` (this app consumes both); `lib` must include `DOM`/`DOM.Iterable` (unlike core/app); `jsx` per Next; `types` includes `node`. Keep `extends: ../../tsconfig.base.json` for repo-wide strictness.

---

### `apps/web/src/lib/container.server.ts` (NEW)

**Analog:** `packages/app/src/container.ts` — specifically the `makeContainer(dbPath): Container` contract (lines 52-62) and the lifecycle warnings in its doc comment.

**What to copy / honor (container.ts lines 52-62 + Container.close lines 37-44):**
- `makeContainer` opens the DB, **runs migrations at construction** (line 53-54), shares ONE connection across both repo adapters, returns a **port-typed** `Container` (consumers see only ports — D-03).
- `Container.close` (lines 37-44) checkpoints the WAL and frees handles; on Windows an unclosed handle blocks DB-file deletion. → The web singleton must NOT call `makeContainer` per request.

**New (no in-repo analog; from RESEARCH Pattern 1 + Pattern 4):** the `import 'server-only'` guard and the process-level singleton (optionally stashed on `globalThis` for dev hot-reload):
```typescript
import 'server-only';                 // build error if a client component imports this
import { makeContainer, type Container } from '@house/app';
let _c: Container | undefined;
export function container(): Container {
  if (!_c) _c = makeContainer(process.env.HOUSE_DB_PATH ?? './house.sqlite');
  return _c;
}
```
**Anti-pattern (RESEARCH Pitfall 2/4):** importing `@house/app` (or this file) into any `'use client'` module drags `better-sqlite3` into the client bundle → build failure. `server-only` turns that into a compile-time error.

---

### `apps/web/src/app/actions/scenarios.ts` (NEW Server Action)

**Analog:** `packages/app/src/services/scenario-service.ts` — the **Pattern-1 thin-wrapper shape** (gather validated input → call the pure engine/service ONCE → return), header comment lines 6-16.

**What the analog teaches (scenario-service.ts lines 40-58):** a service is a 3-line body — call the engine once, return the record; NO math, NO re-validation logic beyond the one engine call. The Server Action is the same shape with TWO additions the analog does not have (both from RESEARCH, no in-repo analog):

1. **`'use server'` + validate-through-core-Zod boundary (D-16, RESEARCH Pattern 2 + Pitfall 7):** every action parses raw input through the EXISTING core schemas before touching the engine — `parseScenarioInputs` / `parseHousehold` / `parseAssumptionSet` (exported `packages/core/src/index.ts` lines 37-46, 25-31). No duplicated UI schema. Field errors surface from the parse result.
2. **DTO mapping before return (RESEARCH Pattern 3 + Pitfall 1):** the result's `Money`/`Decimal` fields map to strings via a `lib/dto/*` mapper BEFORE returning — class instances can't cross the RSC boundary.

```typescript
'use server';
import { parseHousehold, parseAssumptionSet, engineInput, compareScenarios } from '@house/core';
import { container } from '@/lib/container.server';
import { toCompareDTO } from '@/lib/dto/scenario';

export async function recompareAction(raw: { household: unknown; assumptions: unknown; /* ... */ }) {
  const household   = parseHousehold(raw.household);     // D-16 — core Zod, field errors out
  const assumptions = parseAssumptionSet(raw.assumptions);
  // ... build EngineInputs via engineInput(...) ...
  const result = compareScenarios(baseline, inputs);     // ONE pure call — no math here
  return toCompareDTO(result);                            // plain serializable DTO
}
```
This file wraps the save/load/list/delete services too — call `container().scenarios` and the `@house/app` service functions (`computeAndSaveScenario` etc., index.ts lines 11-17). `computeAndSaveScenario` freezes the working set into the snapshot (D-09 / PROF-04) — the action must NOT mutate snapshots in place.

---

### `apps/web/src/app/actions/profiles.ts` (NEW Server Action)

**Analog:** `packages/app/src/services/profile-service.ts` (the ≤2-cap invariant lives in `saveProfile`, lines 28-37 — DO NOT re-check the cap in the UI). Same `'use server'` + parse-through-`parseProfile`/`parseHousehold` + container-call shape as `scenarios.ts`. `MAX_PROFILES` is exported (index.ts line 7) for display copy only; enforcement stays in the service.

---

### `apps/web/src/app/actions/towns.ts` and `sensitivity.ts` (NEW Server Actions)

**Analog:** the thin-wrapper shape of `scenario-service.ts` (gather → one pure call → DTO).
- `towns.ts` → `scoreTowns(input)` (index.ts lines 143-153); budget crosses in as `Money.of(decimalString)`; result is `TownScoreboard` (`composite`/`budget` already decimal STRINGS — `score-towns.ts` lines 52-70 — so the DTO map is mostly a pass-through; `Bucket`/`MaFlag` are plain string enums, RSC-safe).
- `sensitivity.ts` → `tornado(input)` (index.ts lines 129-134); `TornadoResult` carries finite `swingMonths` + discriminated `FiOutcome`s (`sensitivity.ts` lines 46-68) — already plain-serializable, but the DTO test must assert no `Infinity` (RESEARCH test map FI-05). The tornado runs `fiImpact` ~12×; RESEARCH Open Q2 leaves live-vs-"Run" cadence to the planner.

---

### `apps/web/src/lib/dto/*.ts` (NEW Money→string mappers)

**Analogs:** `packages/core/src/money/money.ts` (the closed output boundary, lines 77-89) + `packages/app/src/adapters/listings/mock-provider.ts` (lines 16-23 — the in-repo precedent for using the `Money` boundary, never a float).

**The three sanctioned exits (money.ts lines 77-89) — the ONLY way dollars leave a Money:**
```typescript
toCents(): bigint            // exact integer cents (banker's rounding) — THE rounding boundary
toDecimalString(): string    // full-precision canonical (for chart-data conversion)
toString(): string           // 2dp DISPLAY string (banker's rounding) — display only, never math
```
**The mapper rule (RESEARCH Pattern 3):** the DTO mapper is the SINGLE server-side place that calls these. Every `Money` field → `.toDecimalString()` (canonical, for the chart edge) or `.toString()` (2dp display). NEVER `Number(money.toDecimalString())` on the server — float conversion happens ONLY at the chart edge in `components/charts/*` (RESEARCH Pitfall 5). Already-serializable fields pass through: `CompareRow.fiDeltaMonths` (`number|null`) / `fiDeltaYears` (`string|null`) (`compare.ts` lines 35-46) and the discriminated `FiOutcome` (`projection.ts` lines 48-50) carry NO `Money` — the mapper flattens the discriminated union for the table but adds no conversion.

**Mapper test (RESEARCH test map Pitfall 1 + D-04/D-05):** assert `JSON.parse(JSON.stringify(dto))` deep-equals the DTO (no method-bearing field survives) and that `toCompareDTO` preserves the core ranking (`rows[0].isBaseline`, unreached rows last — `compare.ts` lines 102-131).

---

### `eslint.config.ts` (MODIFY — add an `apps/web` boundary block)

**Analog:** the existing `packages/app/src/` boundary block (lines 192-243) — the `boundaries/element-types` deny-rule pattern that forbids `services/** → adapters/**`, plus its `*.test.ts` relaxation (lines 238-243).

**Adapt to the web tiers (RESEARCH test map Pitfall 2 + CORE-01/02 shell half):**
- A `boundaries` rule forbidding `@house/app` / `container.server` from any `'use client'` module (the client-bundle-leak guard — mirror the element-types disallow shape, lines 218-229).
- A `no-restricted-syntax`/grep gate confining `Number(` to `components/charts/**` (the single float-conversion edge — RESEARCH Pitfall 5). Mirror the core `no-restricted-syntax` selector style (lines 101-141).
- Add `apps/web/.next/**` to the top-level `ignores` (lines 14-26).

---

## Shared Patterns

### Validate-through-core-Zod at every Server Action boundary (D-16)
**Source:** `packages/core/src/index.ts` lines 37-46 (`parseScenarioInputs`, `parseHousehold`) + lines 25-31 (`parseAssumptionSet`); precedent in every `@house/app` service.
**Apply to:** ALL `app/actions/*.ts`. Parse raw client input through the existing core schemas FIRST; surface field errors from the parse; never duplicate validation in components; never accept bare-`number` money (RESEARCH Pitfall 7 — Server Actions are public POST endpoints).

### Money never crosses as a class instance (RSC serialization)
**Source:** `packages/core/src/money/money.ts` lines 77-89 (the three string/bigint exits); `mock-provider.ts` lines 16-23 (Money-boundary precedent).
**Apply to:** ALL `lib/dto/*` mappers and any Server Action/Component returning core results. Map `Money`→string before return; `Decimal` never leaves the core at all (it is not exported — index.ts lines 7-9).

### Thin shell, zero financial logic (Pattern 1)
**Source:** `packages/app/src/services/scenario-service.ts` lines 6-16, 40-58 (gather → one pure call → return).
**Apply to:** ALL `app/actions/*.ts`. One engine/service call per action; no math, no ranking, no bucketing, no gap arithmetic in the web layer — every number is a core output (`compareScenarios`, `evaluateScenario`, `tornado`, `scoreTowns`, `fiTrajectory`). RESEARCH §Don't-Hand-Roll: "anything that looks like math is a signal you're in the wrong tier."

### Container as a port-typed process singleton
**Source:** `packages/app/src/container.ts` lines 33-62 (`makeContainer`, migrations-at-construction, `close` lifecycle).
**Apply to:** `lib/container.server.ts` only. Build once per process (`server-only`); never per-request (re-runs migrations, leaks handles — RESEARCH Pitfall 4). Consumers receive only the `Container` port surface (D-03).

### Per-project vitest config via mergeConfig (no `extends`)
**Source:** `packages/app/vitest.config.ts` + `vitest.shared.ts`.
**Apply to:** `apps/web/vitest.config.ts`. Spread `sharedTest` via `mergeConfig`; add the project to root `vitest.config.ts` `projects` array.

---

## No Analog Found

These are the first React/Next surface in the repo. Use `07-RESEARCH.md` (named patterns/examples) + `07-UI-SPEC.md` (visual/interaction contract), NOT a forced in-repo match.

| File(s) | Role | Data Flow | Guidance source |
|---------|------|-----------|-----------------|
| `apps/web/next.config.ts` | config | — | RESEARCH Pattern 1 (`transpilePackages: ['@house/core','@house/app']`; do NOT also list `better-sqlite3`) |
| `apps/web/postcss.config.mjs`, `components.json` | config | — | RESEARCH §Standard Stack (Tailwind v4 `@tailwindcss/postcss`; shadcn New York/slate/dark, `shadcn@canary init`) |
| `apps/web/src/lib/format.ts` | utility (display edge) | transform | RESEARCH §Code Examples (`Intl.NumberFormat` over decimal strings; `Number()` is the LAST step, feeds only the formatter; `fiDeltaLabel` color-honest copy) |
| `apps/web/src/app/layout.tsx` | provider/component | — | UI-SPEC §Design System (Geist fonts, dark slate base, persistent profile+scenario header D-02) |
| `apps/web/src/app/page.tsx` (cockpit) | component (RSC + client table) | request-response | UI-SPEC §Key Interaction Contracts (D-03 cockpit=comparison); RESEARCH diagram |
| `apps/web/src/app/heatmap/page.tsx` | component | — | UI-SPEC + inherited 05-UI-SPEC encoding contract (D-13) |
| `apps/web/src/app/sensitivity/page.tsx` | component | — | UI-SPEC (FI-05 "no headline number without a range") |
| `apps/web/src/components/cockpit/*` (comparison table, expanded scenario, inline editor) | component | — | UI-SPEC D-03/D-04/D-05/D-15; consumes `toCompareDTO` |
| `apps/web/src/components/rail/*` (assumptions rail) | component | event-driven (debounced) | UI-SPEC D-10; RESEARCH Pattern 5 + Pitfall 6 (latest-wins debounce) |
| `apps/web/src/components/charts/*` (Recharts trajectory + tornado) | component (`'use client'`) | transform (number[]) | RESEARCH §Code Examples (`TrajectoryChart`); the ONLY `Number()` site (Pitfall 5) |
| `apps/web/src/components/heatmap/*` (CSS-grid) | component | — | UI-SPEC D-13 + 05-UI-SPEC bucket palette (verbatim) |
| `apps/web/src/components/ui/*` (shadcn copy-in) | component | — | UI-SPEC §Registry Safety (official blocks only; gate at `shadcn init`) |
| `apps/web/src/store/*` (Zustand) | store | event-driven | RESEARCH Pattern 5 + Open Q3 (working-set keyed to active scenario; persist only on Save-freeze) |

---

## Metadata

**Analog search scope:** `packages/core/src/{fi,money,towns,affordability,tco,engine}`, `packages/core/src/index.ts`, `packages/app/src/{container.ts,services,adapters}`, `packages/app/src/index.ts`, root `vitest.config.ts` + `vitest.shared.ts` + `package.json`, `packages/app/{package.json,tsconfig.json,vitest.config.ts}`, `eslint.config.ts`.
**Files scanned (read this session):** 16.
**Pattern extraction date:** 2026-06-28
**Open Q1 flag:** `fiTrajectory` touches `packages/core` — surfaces an existing engine capability (the discarded month series), not a new financial RULE. Plan it as an early "core capability" task the cockpit chart wave depends on; flag for user confirmation per RESEARCH Open Q1.
