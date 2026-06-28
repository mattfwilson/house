// Root Vitest 4 config. Uses `test.projects` (the `workspace` key was removed post-3.2);
// each package brings its own vitest.config.ts. Coverage is process-global in Vitest, so it is
// scoped to `packages/**` (the calc core + imperative shell — the product). The web project's
// component code is intentionally OUT of the gate: its boundary/DTO tests are the load-bearing
// ones, and gating React UI at 95% would be noise (PATTERNS decision).
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: ['packages/*', 'apps/*'],
    coverage: {
      provider: 'v8',
      include: ['packages/**'],
      thresholds: { lines: 95, functions: 95, branches: 90, statements: 95 },
    },
  },
});
