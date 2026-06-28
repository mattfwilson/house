# Phase 6: Persistence & Listings Adapter - Pattern Map

**Mapped:** 2026-06-27
**Files analyzed:** 24 (new package scaffold + core ports/types + root-config edits)
**Analogs found:** 22 / 24 (2 new-territory files have only partial analogs)

> The single most load-bearing finding (from RESEARCH): **the save/load persistence path is not new engineering — it is `roundTrip()` in `packages/core/src/golden.test.ts:310-333` promoted from test helper to production code.** Every new persisted file mirrors an existing in-repo idiom: `decStr` + `.strict()` Zod boundary, `canonicalJson` serialization, the eslint-boundary negative test, and the `mergeConfig(defineProject, sharedTest)` vitest project shape. Phase 6 adds plumbing, not logic.

---

## File Classification

### New files in `packages/core` (pure — interfaces + types only)

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `packages/core/src/ports/listings.ts` | port (interface) | request-response | `engine/engine-input.ts` (interface+schema idiom) | role-match |
| `packages/core/src/ports/repositories.ts` | port (interface) | CRUD | `engine/engine-input.ts` | role-match |
| `packages/core/src/types/listing.ts` | model (type+Zod) | transform/boundary | `engine/engine-input.ts` `ScenarioInputs`+`ScenarioInputsSchema` | exact |
| `packages/core/src/types/profile.ts` | model (type+Zod) | transform/boundary | `engine/engine-input.ts` `Household`+`HouseholdSchema` | exact |
| `packages/core/src/types/saved-scenario.ts` | model (snapshot type) | transform/boundary | `golden.test.ts:310-333` roundTrip snapshot shape | exact |
| `packages/core/src/index.ts` (modify) | barrel | — | existing `index.ts` export blocks | exact |

### New files in `packages/app` (imperative shell — first non-core package)

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `packages/app/package.json` | config | — | `packages/core/package.json` + root `package.json` workspaces | exact |
| `packages/app/tsconfig.json` | config | — | `packages/core/tsconfig.json` | exact (adapt `types`) |
| `packages/app/vitest.config.ts` | config | — | `packages/core/vitest.config.ts` | exact |
| `packages/app/drizzle.config.ts` | config | — | RESEARCH sketch (no in-repo analog) | no analog |
| `packages/app/src/index.ts` | barrel | — | `packages/core/src/index.ts` | role-match |
| `packages/app/src/container.ts` | provider (DI root) | — | RESEARCH Pattern 4 (no in-repo analog) | partial |
| `packages/app/src/services/scenario-service.ts` | service | CRUD + transform | `golden.test.ts` roundTrip (save/load path) | role-match |
| `packages/app/src/services/profile-service.ts` | service | CRUD | `golden.test.ts` roundTrip + Zod guard idiom | role-match |
| `packages/app/src/adapters/persistence/db.ts` | utility (driver factory) | file-I/O | RESEARCH Drizzle sketch (no in-repo analog) | no analog |
| `packages/app/src/adapters/persistence/schema.ts` | model (drizzle tables) | CRUD | RESEARCH schema sketch; field names from `Household` | partial |
| `packages/app/src/adapters/persistence/scenario-repo.ts` | adapter (repository) | CRUD | `golden.test.ts` roundTrip (the save/load body) | role-match |
| `packages/app/src/adapters/persistence/profile-repo.ts` | adapter (repository) | CRUD | scenario-repo (sibling) + `parseHousehold` boundary | role-match |
| `packages/app/src/adapters/listings/mock-provider.ts` | adapter (provider) | request-response | RESEARCH Pattern 2 + `town-table.ts` data idiom | role-match |
| `packages/app/src/adapters/listings/fixtures.ts` | data fixtures | — | `towns/town-table.ts` `TOWN_RATE_TABLE` literal array | exact |
| `packages/app/src/adapters/persistence/repository-contract.test.ts` | test (shared factory) | — | `golden.test.ts` gated `expect(produced).toBe(stored)` style | role-match |
| `packages/app/src/boundary.test.ts` | test (lint-as-test) | — | `packages/core/src/boundary.test.ts` | exact |
| `packages/app/drizzle/*.sql` + `_journal` | migration | — | RESEARCH (drizzle-kit generated) | no analog (generated) |

### Root config edits (modify)

| Modified File | Role | Closest Analog | Match Quality |
|---------------|------|----------------|---------------|
| `tsconfig.json` (root) | config | existing `references` array | exact |
| `eslint.config.ts` | config | existing `packages/core/src` boundary override | exact |
| `vitest.config.ts` (root) | config | already globs `packages/*` (no change OR per-project coverage) | exact |
| `.gitignore` | config | existing entries | exact |

---

## Pattern Assignments

### `packages/core/src/types/profile.ts` (model, boundary) — analog: `engine-input.ts` Household

**This is the highest-confidence reuse in the phase.** `Household` already has exactly the PROF-01 fields (net worth, income, savings rate, debt, rent) with `decStr` + `.strict()`. Model `Profile` as `{ id, name } & Household`-derived (RESEARCH Open Question 3 recommendation) — do NOT author a parallel money schema.

**Interface + Zod-mirror + parse-fn triad to copy verbatim** (`engine-input.ts:116-200`):
```typescript
export interface Household {
  readonly grossAnnualIncome: string;     // dollar string, never bare number
  readonly existingMonthlyDebt: string;
  readonly targetSavingsRate: string;     // [0,1) refine
  readonly availableNetWorth: string;
  readonly currentRent: string;
  // ...
}

export const HouseholdSchema = z
  .object({
    grossAnnualIncome: decStr,
    existingMonthlyDebt: decStr,
    targetSavingsRate: decStr.refine(
      (s) => { const n = Number(s); return n >= 0 && n < 1; },
      { message: 'targetSavingsRate must be in [0,1)' },
    ),
    availableNetWorth: decStr,
    // ...
  })
  .strict();   // T-03-V5: reject unknown keys — forged snapshot can't smuggle fields

export function parseHousehold(input: unknown): Household {
  return HouseholdSchema.parse(input) as Household;
}
```
**Rules the new `Profile` schema MUST follow:** every dollar leaf is `decStr` (import from `../assumptions/schema.js`), every ratio leaf gets the `[0,1)` `.refine`, `.strict()` closes the object, and a `parseProfile(input: unknown): Profile` function is the ONLY load entry point (mirror `parseHousehold` — never an `as` cast).

---

### `packages/core/src/types/listing.ts` (model, boundary) — analog: `engine-input.ts` ScenarioInputs

Same interface + `Schema` + `parse` triad. `Listing.listPrice` and any money field is `decStr` (D-09 — never `z.number()`). `Listing.town` is `z.string().min(1)` and should align with `town-table.ts` names where sensible (D-09).

**Excerpt to mirror** (`engine-input.ts:73-105`):
```typescript
export const ScenarioInputsSchema = z
  .object({
    label: z.string().min(1),
    price: decStr,
    town: z.string().min(1),
    termMonths: z.number().int().positive(),   // counts are bare numbers; money is decStr
    closingCostsOverride: decStr.optional(),    // exactOptionalPropertyTypes: .optional()
  })
  .strict();

export function parseScenarioInputs(input: unknown): ScenarioInputs {
  return ScenarioInputsSchema.parse(input) as ScenarioInputs;
}
```
**Listing field set (D-09, Claude's discretion within shape):** `id`, `address`, `town`, `listPrice` (decStr), `beds` (int), `baths` (decStr or number — half-baths), `livingSqft` (int), `propertyType` (string/enum). `ListingsQuery` filter fields (`town?`, `minPrice?`, `maxPrice?`) are decStr where monetary.

---

### `packages/core/src/ports/listings.ts` (port) — analog: RESEARCH Pattern 2 + interface idiom

Pure `interface` only — NO better-sqlite3/drizzle import (D-02, enforced by `boundaries/external`). **D-08 mandates SYNCHRONOUS methods** (overrides ARCHITECTURE's `Promise<…>` sketch):
```typescript
export interface ListingsProvider {
  getListings(query: ListingsQuery): Listing[];        // sync — no I/O in the mock
  getListingById(id: string): Listing | null;
}
export interface ListingsQuery {
  readonly town?: string;
  readonly minPrice?: string;   // canonical decimal string (never bare number)
  readonly maxPrice?: string;
}
```

### `packages/core/src/ports/repositories.ts` (port) — analog: same interface idiom

Pure interfaces. RESEARCH Open Question 1 + Pitfall 5 recommendation: **synchronous repo methods** (better-sqlite3 is sync; async would be cosmetic). Keep `container.ts`, services, and contract tests consistent with whatever shape is chosen.
```typescript
export interface ScenarioRepository {
  save(s: SavedScenario): void;          // or SavedScenario id-returning
  load(id: string): SavedScenario | null;
  listByProfile(profileId: string): SavedScenarioMeta[];   // thin columns (D-06)
  delete(id: string): void;
}
export interface ProfileRepository {
  save(p: Profile): void;
  load(id: string): Profile | null;
  list(): Profile[];
  count(): number;                       // service-layer ≤2 guard reads this (D-10)
}
```

---

### `packages/core/src/index.ts` (barrel, modify) — analog: existing export blocks

Append new export blocks following the existing commented-block style (`index.ts:37-46` is the closest template — type + schema + parse-fn grouped with a rationale comment). Add: ports (`ListingsProvider`, `ListingsQuery`, `ScenarioRepository`, `ProfileRepository`), types (`Listing`, `Profile`, `SavedScenario` + their `parse*`/`*Schema`). Keep the "Raw `Dec` stays unexported / dollars cross as decimal strings" discipline note.

---

### `packages/app/src/adapters/persistence/scenario-repo.ts` (adapter, CRUD) — analog: `golden.test.ts:310-333` roundTrip

**This is Pattern 3 — the reproducibility load-bearing path.** The SAVE body serializes via `canonicalJson`; the LOAD body re-parses EVERY leaf through Zod (never `as`). Copy the roundTrip structure exactly, swapping the in-memory rebuild for a SQLite row write/read:

**SAVE (serialize → TEXT blob):**
```typescript
const blob = canonicalJson({
  asOf: input.asOf,                 // CalendarDate serializes to its string
  assumptions: input.assumptions,   // AssumptionSet V4 (embedded — D-07)
  scenario: input.scenario,
  ...(input.household ? { household: input.household } : {}),  // exactOptionalPropertyTypes — OMIT, never set undefined/null (Pitfall 2)
});
// db.insert(scenarios).values({ id, profileId, name, snapshot: blob, createdAt, updatedAt })
```

**LOAD (TEXT → JSON.parse → re-validate through Zod):**
```typescript
const raw = JSON.parse(row.snapshot) as { asOf: string; assumptions: unknown; scenario: unknown; household?: unknown };
const input = engineInput({
  asOf: calendarDate(raw.asOf),
  assumptions: parseAssumptionSet(raw.assumptions) as CurrentAssumptionSet,
  scenario: parseScenarioInputs(raw.scenario),
  ...(raw.household !== undefined ? { household: parseHousehold(raw.household) } : {}),
});
```
**Anti-patterns (RESEARCH):** never `as ScenarioInputs` on load; never store money as SQLite `REAL`; never set an optional snapshot field to `undefined`/`null` (changes the canonical bytes). The reproducibility assertion is `canonicalJson(roundTripped) === storedBlob` (byte-identical).

---

### `packages/app/src/adapters/persistence/schema.ts` (drizzle tables) — analog: RESEARCH sketch + Household field names

Money columns are TEXT holding canonical decimal strings (never `real()`). Field names borrowed from `Household`. Unique-name-per-profile index (D-11). Timestamps are `integer` epoch-ms set in the app layer, NEVER in core (core forbids `Date.now()`):
```typescript
export const profiles = sqliteTable('profiles', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  netWorth: text('net_worth').notNull(),            // decimal STRING in TEXT
  grossAnnualIncome: text('gross_annual_income').notNull(),
  // ... currentRent, targetSavingsRate, existingMonthlyDebt
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});
export const scenarios = sqliteTable('scenarios', {
  id: text('id').primaryKey(),
  profileId: text('profile_id').notNull().references(() => profiles.id),
  name: text('name').notNull(),
  snapshot: text('snapshot').notNull(),             // canonicalJson blob — source of truth (D-05)
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
}, (t) => ({
  uniqNamePerProfile: uniqueIndex('uniq_scenario_name_per_profile').on(t.profileId, t.name),  // D-11
}));
```

---

### `packages/app/src/adapters/persistence/db.ts` (driver factory, file-I/O) — analog: RESEARCH Drizzle wiring (no in-repo analog)

No in-repo SQLite code exists yet. Follow the RESEARCH sketch verbatim; A1 flags the programmatic migrator import path (`drizzle-orm/better-sqlite3/migrator`) as ASSUMED — confirm against installed `drizzle-orm@0.45.2` types before coding:
```typescript
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
export function openDb(source: string) {           // source = file path OR ':memory:'
  const sqlite = new Database(source);
  sqlite.pragma('journal_mode = WAL');
  return drizzle({ client: sqlite, schema });
}
```
Tests use `:memory:` (fast, isolated), never the dev DB (Pitfall 4).

---

### `packages/app/src/services/scenario-service.ts` (service, CRUD) — analog: ARCHITECTURE Pattern 1 / roundTrip

Imperative shell: depend on the PORT interface (`import type { ScenarioRepository } from '@house/core'`), call the pure engine once, persist. Timestamps generated HERE (the shell), never passed into core. RESEARCH Pattern 1:
```typescript
import type { ScenarioRepository } from '@house/core';   // PORT, not concrete
import { fiImpact } from '@house/core';                   // PURE calc
export function loadScenario(repo: ScenarioRepository, id: string) {
  const snapshot = repo.load(id);     // I/O → VALIDATED snapshot
  return fiImpact(snapshot.engineInput);  // PURE recompute
}
```

### `packages/app/src/services/profile-service.ts` (service, CRUD) — analog: Pattern 1 + ≤2 guard

D-10 lean-toward-service-layer: `saveProfile` counts existing rows via `repo.count()` and throws on the 3rd (a real invariant without the UI). Test it (RESEARCH Pitfall 6a).

---

### `packages/app/src/adapters/listings/fixtures.ts` (data, exact analog: `town-table.ts`)

`town-table.ts:50` `TOWN_RATE_TABLE: readonly TownRateRow[] = [...]` is the exact idiom: a `readonly Listing[]` literal array, pure data, no ambient state, every money value a canonical decimal STRING literal. Towns drawn from the curated town-table set (D-09).

### `packages/app/src/adapters/listings/mock-provider.ts` (adapter) — analog: RESEARCH Pattern 2

```typescript
export class MockListingsProvider implements ListingsProvider {
  constructor(private readonly fixtures: readonly Listing[]) {}
  getListings(q: ListingsQuery): Listing[] { return this.fixtures.filter(/* town/price */); }
  getListingById(id: string): Listing | null { return this.fixtures.find(l => l.id === id) ?? null; }
}
```

---

### `packages/app/src/container.ts` (DI root) — analog: RESEARCH Pattern 4 (partial; no in-repo analog)

The ONLY file naming concrete adapter types (D-03). Exposes ports only. Follow RESEARCH Pattern 4 sketch (`06-RESEARCH.md:262-287`). Note `.js` extension imports (NodeNext, `verbatimModuleSyntax`).

---

## Config-file Patterns (copy from existing, adapt one or two fields)

### `packages/app/package.json` — analog: `packages/core/package.json`
Same shape (`"type": "module"`, `exports: { ".": "./src/index.ts" }`, `scripts.test`/`typecheck`). Name `@house/app`. Deps add `@house/core: "*"` (workspace), `better-sqlite3: "^12.11.1"`, `drizzle-orm: "^0.45.2"`; devDeps `drizzle-kit: "^0.31.10"`, `@types/better-sqlite3`.

### `packages/app/tsconfig.json` — analog: `packages/core/tsconfig.json`
Copy verbatim, with ONE change: core uses `"types": []` (no ambient types); app needs `"types": ["node", "better-sqlite3"]`. Keep `extends: ../../tsconfig.base.json`, `rootDir: src`, `outDir: dist`, `composite: true`, and `exclude` test files. The base config already enforces `exactOptionalPropertyTypes: true` (Pitfall 2) and NodeNext.

### `packages/app/vitest.config.ts` — analog: `packages/core/vitest.config.ts` (exact)
```typescript
import { defineProject, mergeConfig } from 'vitest/config';
import { sharedTest } from '../../vitest.shared.js';
export default mergeConfig(
  defineProject({ test: { ...sharedTest, name: 'app', environment: 'node' } }),
  {},
);
```
Per-project configs CANNOT `extends` the root (Vitest 4) — use `mergeConfig(defineProject, sharedTest)`. App does NOT need core's `setupFiles: guard.setup.ts` (that determinism guard is core-only).

### Root `tsconfig.json` (modify) — analog: existing `references` array
Add `{ "path": "./packages/app" }` to the `references` array (Wave 0 gap).

### Root `vitest.config.ts` (modify?) — already globs `packages/*`
`projects: ['packages/*']` auto-includes `packages/app`. **Pitfall 1:** global coverage thresholds (lines 95/functions 95/branches 90/statements 95) now gate app code — plan for high app coverage from the start (contract + round-trip tests cover most paths) OR scope thresholds per-project. Planner decides.

### `.gitignore` (modify) — analog: existing entries
Add `*.sqlite`, `*.sqlite-wal`, `*.sqlite-shm`, `*.db` (Pitfall 4). **Do commit** `packages/app/drizzle/` migration SQL (reproducibility — D-11).

---

## Shared Patterns

### Zod-`.strict()`-at-every-boundary (no-silent-default)
**Source:** `engine-input.ts:73-105` (`ScenarioInputsSchema`), `assumptions/schema.ts:32-77` (`decStr`, `.strict()`)
**Apply to:** every new persisted type — `Profile`, `Listing`, `SavedScenario` wrapper. Import `decStr` from `../assumptions/schema.js`; every dollar leaf is `decStr` (never `z.number()`), every object `.strict()`, every load path goes through a `parse*` function, never an `as` cast.
```typescript
export const decStr = z.string().regex(CANONICAL_DECIMAL_RE, 'must be a canonical decimal string (e.g. "0.035")');
const group = <Shape extends z.ZodRawShape>(shape: Shape) => z.object(shape).strict();
```

### Canonical-JSON snapshot serialization
**Source:** `serialize/canonical-json.ts` (`canonicalJson`), `assumptions/assumption-set.ts:45-47` (`serializeAssumptionSet`)
**Apply to:** `scenario-repo.ts` SAVE path and the round-trip test. `canonicalJson` recursively key-sorts and emits every `Money` as a decimal string — SQLite/JSON insertion order cannot perturb the bytes. **Reuse it; do not hand-roll a key-sorter** (RESEARCH Don't-Hand-Roll).

### Boundary-as-test (lint-as-test) enforcement
**Source:** `packages/core/src/boundary.test.ts:35-43` — shells out to `npx eslint --no-ignore <fixture>`, asserts NON-zero exit + an attributable rule message.
**Apply to:** `packages/app/src/boundary.test.ts` for D-03 ("services never import concrete adapters"). Add an `eslint-plugin-boundaries` `app`/`adapters` element + a rule disallowing `services/**` imports of concrete adapter modules (only `container.ts` may import them), plus a negative fixture and a test asserting it trips. Mirror the gated, greppable style.
```typescript
function runEslint(targetFile: string): { code: number; output: string } {
  try { const out = execSync(`npx eslint --no-ignore "${targetFile}"`, { cwd: repoRoot, stdio: 'pipe', encoding: 'utf8' }); return { code: 0, output: out }; }
  catch (err: unknown) { /* capture status + stdout/stderr; return non-zero */ }
}
expect(code).not.toBe(0);
```

### eslint boundary override (config)
**Source:** `eslint.config.ts:31-137` — the `packages/core/src` override with `boundaries/elements`, `boundaries/external` deny-by-default, scoped `files`.
**Apply to:** add a NEW override block for `packages/app/src/**` defining `app`/`services`/`adapters`/`container` elements. Do NOT touch the existing deprecated-but-pinned `boundaries/external` core rule (State of the Art — it has a negative-test safety net; "fixing" the deprecation is out of scope this phase).

### Repository contract-test factory (Claude's-discretion recommendation)
**Source:** `golden.test.ts` gated reproducibility style — plain `expect(produced).toBe(stored)`, NOT `toMatchSnapshot` (auto-re-blesses).
**Apply to:** one shared `describe` factory `repositoryContract(makeRepo: () => ScenarioRepository)` invoked twice — once against `SqliteScenarioRepository(openDb(':memory:'))` (migrated), once against an `InMemoryScenarioRepository` fake. Both pass identical assertions (save/load/list/delete/unique-name/round-trip). The fake proves the contract is adapter-agnostic; the SQLite run proves the adapter honors it.

### exactOptionalPropertyTypes conditional-spread idiom
**Source:** `engine-input.ts:241-243`, `golden.test.ts:319` — `...(x ? { household: x } : {})`
**Apply to:** anywhere an optional snapshot field is written. NEVER `{ household: undefined }` — omit the key entirely (it's a type error AND changes the canonical bytes — Pitfall 2).

---

## No Analog Found

Files genuinely in new territory (planner uses RESEARCH sketches, not an in-repo analog):

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `packages/app/drizzle.config.ts` | config | — | First Drizzle config in repo; use RESEARCH sketch (`dialect:'sqlite'`, `schema`, `out`, `dbCredentials.url`) — A5 verified against current docs. |
| `packages/app/src/adapters/persistence/db.ts` | utility | file-I/O | First better-sqlite3/Drizzle wiring; RESEARCH sketch — A1 (programmatic migrator import path) flagged ASSUMED, confirm against installed types. |
| `packages/app/drizzle/*.sql` + `meta/_journal.json` | migration | — | drizzle-kit-GENERATED; not hand-authored. Run `drizzle-kit generate`, commit output (D-11). |

`container.ts` and `schema.ts` are listed as **partial** above (DI/table idioms have RESEARCH sketches but no exact in-repo predecessor).

---

## Metadata

**Analog search scope:** `packages/core/src/**` (engine, serialize, assumptions, money, towns, boundary/golden tests), root configs (`tsconfig*.json`, `eslint.config.ts`, `vitest.config.ts`, `vitest.shared.ts`, `.gitignore`, `package.json`).
**Files scanned:** golden.test.ts, canonical-json.ts, engine-input.ts, index.ts, assumptions/schema.ts, assumption-set.ts, town-table.ts, money.ts, boundary.test.ts, eslint.config.ts, vitest.config.ts (root + core), vitest.shared.ts, tsconfig.base.json, tsconfig.json (root + core), package.json (root + core), .gitignore.
**Key reuse insight:** `Household`/`ScenarioInputs` schemas + `roundTrip()` + `canonicalJson` cover ~80% of the new persisted-type and save/load surface. The risk is re-solving canonicalization/validation slightly differently and breaking byte-identity — reuse the core primitives verbatim.
**Pattern extraction date:** 2026-06-27
