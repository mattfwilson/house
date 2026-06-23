// Root Vitest 4 config. Uses `test.projects` (the `workspace` key was removed post-3.2);
// each package brings its own vitest.config.ts. Coverage is process-global in Vitest,
// so these thresholds effectively gate the core (the only project this phase).
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: ['packages/*'],
    coverage: {
      provider: 'v8',
      thresholds: { lines: 95, functions: 95, branches: 90, statements: 95 },
    },
  },
});
