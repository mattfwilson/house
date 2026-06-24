# `_lint-fixtures/` — negative test assets (these MUST fail the build)

These files are **intentional violations**. They are NOT production code and are
**not** part of the `@house/core` public exports (`src/index.ts`). Their job is to
prove that the build-time enforcement actually rejects the things Phase 1 forbids.

| File | Violates | Proven by | Expected outcome |
|------|----------|-----------|------------------|
| `framework-import.fixture.ts` | CORE-01 — `import 'react'` in core | `boundary.test.ts` (shells out to eslint via `execSync`) | `eslint` exits **non-zero** on this file (`boundaries/external` and/or `no-restricted-imports`). |
| `external-import.fixture.ts` | CORE-01 — `import 'node:fs'` (arbitrary non-allowlisted external) | `boundary.test.ts` | `eslint` exits **non-zero** (`boundaries/external` deny-by-default). Guards against silent removal of the deprecated `boundaries/external` rule (WR-04). |
| `dom-global.fixture.ts` | A DOM global (`document`) in the no-DOM core | `tsc -b` | `@ts-expect-error` is **satisfied** only because the no-DOM lib makes `document` an error → `tsc -b` stays **green**. Adding `"dom"` to the lib makes the suppression unused → `tsc` **fails** (TS2578). |
| `determinism-date-now.fixture.ts` | D-12 — `Date.now()` and `globalThis.Date.now()` | `boundary.test.ts` | `eslint` exits **non-zero** (`no-restricted-syntax`). |
| `determinism-math-random.fixture.ts` | D-12 — `Math.random()` and `globalThis.Math.random()` | `boundary.test.ts` | `eslint` exits **non-zero** (`no-restricted-syntax`). |
| `determinism-new-date.fixture.ts` | D-13 — `new Date()` and `new globalThis.Date()` | `boundary.test.ts` | `eslint` exits **non-zero** (`no-restricted-syntax`). |
| `determinism-performance-now.fixture.ts` | D-12 — `performance.now()` and `globalThis.performance.now()` | `boundary.test.ts` | `eslint` exits **non-zero** (`no-restricted-syntax` / `no-restricted-globals`). |
| `determinism-crypto-random.fixture.ts` | D-12 — `crypto.getRandomValues()` and `globalThis.crypto.getRandomValues()` | `boundary.test.ts` | `eslint` exits **non-zero** (`no-restricted-syntax` / `no-restricted-globals`). |

The determinism fixtures each exercise BOTH the direct form and the `globalThis`-qualified
evasion form (WR-03), so a regression in either selector flips the corresponding test red.

## Why they live in `src/`

The boundary guards are scoped to `packages/core/src/**`. To prove the guards trip,
the fixtures must sit *inside* that scope. They are quarantined in `_lint-fixtures/`
and excluded from the public surface so no real code can import them.

## Do not "fix" these files

A green `eslint .` on `framework-import.fixture.ts`, or a failing `tsc -b` caused by
`dom-global.fixture.ts`, means the enforcement regressed — fix the **config**, not
the fixtures.
