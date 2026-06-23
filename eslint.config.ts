// ESLint 10 flat config. The packages/core override is the build-time enforcement
// of CORE-01 (no framework in core) and the lint half of CORE-03 (determinism, D-12/D-13).
import tseslint from 'typescript-eslint';
import boundaries from 'eslint-plugin-boundaries';
import importPlugin from 'eslint-plugin-import';

export default tseslint.config(
  // Don't lint build output, deps, or planning docs.
  {
    ignores: ['**/dist/**', '**/node_modules/**', '**/coverage/**', '.planning/**'],
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

      // (D) determinism: forbid Date.now / Math.random / new Date / dynamic import (D-12, D-13).
      'no-restricted-syntax': ['error',
        {
          selector: "CallExpression[callee.object.name='Date'][callee.property.name='now']",
          message: 'Determinism: thread asOf via EngineInput, no Date.now (D-12).',
        },
        {
          selector: "CallExpression[callee.object.name='Math'][callee.property.name='random']",
          message: 'Determinism: core must not use Math.random (D-12).',
        },
        {
          selector: "NewExpression[callee.name='Date']",
          message: 'Core must not touch JS Date — use CalendarDate (D-13).',
        },
        {
          selector: 'ImportExpression',
          message: 'No dynamic import() in core (boundary evasion, Pitfall 2).',
        },
      ],

      // (E) ban env / global hazards (D-12).
      'no-restricted-globals': ['error',
        { name: 'process', message: 'Core must not read env/process (D-12).' },
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
);
