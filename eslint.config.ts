// ESLint 10 flat config. The packages/core override is the build-time enforcement
// of CORE-01 (no framework in core) and the lint half of CORE-03 (determinism, D-12/D-13).
import tseslint from 'typescript-eslint';
import boundaries from 'eslint-plugin-boundaries';
import importPlugin from 'eslint-plugin-import';

export default tseslint.config(
  // Don't lint build output, deps, or planning docs.
  //
  // _lint-fixtures/** are INTENTIONAL violations (negative test assets). They are
  // ignored from the everyday repo-wide `eslint .` so the CI lint gate stays green for
  // real code — but boundary.test.ts lints them directly with `--no-ignore` to prove
  // the guards still trip. Removing this ignore makes `npm run lint` permanently red.
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '**/coverage/**',
      '.planning/**',
      'packages/core/src/_lint-fixtures/**',
    ],
  },

  ...tseslint.configs.recommended,

  // ── packages/core/src: zero framework, fully deterministic ──────────────
  // Scoped to src/** (production core code) — NOT the package's own tooling configs
  // (vitest.config.ts), which legitimately import the test runner. The override
  // intentionally does NOT ignore src/_lint-fixtures/**, so the negative fixtures
  // remain lint-able by Task 3b's boundary test.
  {
    files: ['packages/core/src/**/*.ts'],
    plugins: { boundaries, import: importPlugin },
    settings: {
      'boundaries/elements': [{ type: 'core', pattern: 'packages/core/src/**' }],
    },
    rules: {
      // (A) DENY-BY-DEFAULT external imports — only decimal.js & zod allowed.
      //     Covers static AND dynamic imports. This is the real CORE-01 guard
      //     (import/no-restricted-paths does NOT block npm package names — Pitfall 1).
      'boundaries/external': ['error', {
        default: 'disallow',
        rules: [{ from: ['core'], allow: ['decimal.js', 'zod'] }],
      }],

      // (B) explicit framework ban (static imports) — defense in depth.
      'no-restricted-imports': ['error', {
        paths: [
          { name: 'react', message: 'No framework in core (CORE-01).' },
          { name: 'react-dom', message: 'No framework in core (CORE-01).' },
          { name: 'next', message: 'No framework in core (CORE-01).' },
        ],
        patterns: [{ group: ['next/*', 'react/*', 'react-dom/*'] }],
      }],

      // (C) ban relative imports into apps/** (path zones — the ONE thing this rule is for).
      'import/no-restricted-paths': ['error', {
        zones: [
          { target: './packages/core', from: './apps', message: 'core may not import app code.' },
        ],
      }],

      // (D) determinism: forbid Date.now / Math.random / new Date / performance.now /
      //     crypto.getRandomValues / dynamic import (D-12, D-13).
      //
      // Selectors match BOTH the direct form (`Date.now()`) and the globalThis-qualified
      // member form (`globalThis.Date.now()`, `globalThis.Math.random()`), which previously
      // slipped past the `callee.object.name` checks (WR-03). `performance` / `crypto` are
      // matched as the callee object directly (and also via globalThis), and `new Date` is
      // caught both bare and as `new globalThis.Date()`.
      'no-restricted-syntax': ['error',
        {
          // Date.now() and globalThis.Date.now()
          selector:
            "CallExpression[callee.property.name='now'][callee.object.object.name='globalThis'][callee.object.property.name='Date']," +
            "CallExpression[callee.object.name='Date'][callee.property.name='now']",
          message: 'Determinism: thread asOf via EngineInput, no Date.now (D-12).',
        },
        {
          // Math.random() and globalThis.Math.random()
          selector:
            "CallExpression[callee.property.name='random'][callee.object.object.name='globalThis'][callee.object.property.name='Math']," +
            "CallExpression[callee.object.name='Math'][callee.property.name='random']",
          message: 'Determinism: core must not use Math.random (D-12).',
        },
        {
          // performance.now() and globalThis.performance.now()
          selector:
            "CallExpression[callee.property.name='now'][callee.object.name='performance']," +
            "CallExpression[callee.property.name='now'][callee.object.object.name='globalThis'][callee.object.property.name='performance']",
          message: 'Determinism: core must not read the high-res clock (performance.now, D-12).',
        },
        {
          // crypto.getRandomValues(...) and globalThis.crypto.getRandomValues(...)
          selector:
            "CallExpression[callee.property.name='getRandomValues'][callee.object.name='crypto']," +
            "CallExpression[callee.property.name='getRandomValues'][callee.object.object.name='globalThis'][callee.object.property.name='crypto']",
          message: 'Determinism: core must not use crypto entropy (crypto.getRandomValues, D-12).',
        },
        {
          // new Date(...) and new globalThis.Date(...)
          selector:
            "NewExpression[callee.name='Date']," +
            "NewExpression[callee.object.name='globalThis'][callee.property.name='Date']",
          message: 'Core must not touch JS Date — use CalendarDate (D-13).',
        },
        {
          selector: 'ImportExpression',
          message: 'No dynamic import() in core (boundary evasion, Pitfall 2).',
        },
      ],

      // (E) ban env / global hazards (D-12). `process` (env), plus the nondeterminism
      //     globals `performance` / `crypto` and the `globalThis` escape hatch used to
      //     re-qualify them past the syntax selectors above (WR-03).
      'no-restricted-globals': ['error',
        { name: 'process', message: 'Core must not read env/process (D-12).' },
        { name: 'performance', message: 'Core must not read the high-res clock (D-12).' },
        { name: 'crypto', message: 'Core must not use crypto entropy (D-12).' },
        { name: 'globalThis', message: 'Core must not reach globals via globalThis (determinism evasion, D-12).' },
      ],
      'no-restricted-properties': ['error',
        { object: 'process', property: 'env', message: 'No env reads in core (D-12).' },
      ],
    },
  },

  // Test files are the *consumers/verifiers* of the core, not production core code.
  // They legitimately need node built-ins (node:fs, node:child_process), the vitest
  // runner, and process.env.UPDATE_GOLDEN (the gated golden harness). Relax the
  // boundary + determinism rules for *.test.ts so the guards apply to production core
  // code only. The negative fixtures (_lint-fixtures/*.fixture.ts) are NOT .test.ts,
  // so they remain under the strict core override and the boundary test can prove they fail.
  {
    files: ['packages/core/src/**/*.test.ts'],
    rules: {
      'boundaries/external': 'off',
      'no-restricted-syntax': 'off',
      'no-restricted-properties': 'off',
      'no-restricted-globals': 'off',
      'no-restricted-imports': 'off',
    },
  },

  // ── golden.test.ts: the gated reproducibility harness (PROF-04, T-04-04) ──
  // This is the ONE file in the package permitted to read an environment variable, and only
  // `process.env.UPDATE_GOLDEN` — the explicit, reviewable regeneration gate (NOT
  // toMatchSnapshot, which auto-re-blesses). The core runtime env ban (Plan 01-01, D-12)
  // is unchanged for production code; this narrowly-scoped, documented exception keeps the
  // env-read surface auditable to a single file rather than widening it package-wide.
  // (It overlaps the broad *.test.ts relaxation above, but is stated explicitly so the
  // sanctioned UPDATE_GOLDEN read has a named, greppable home — defense against silent
  // scope creep, T-04-04.)
  {
    files: ['packages/core/**/golden.test.ts'],
    rules: {
      'no-restricted-globals': 'off',
      'no-restricted-properties': 'off',
    },
  },
);
