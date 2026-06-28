// Web Vitest project. Runs in a jsdom environment (component/DOM tests) — unlike the core/app
// projects which use 'node'. Uses mergeConfig(defineProject(...), shared) because per-project
// configs CANNOT inherit from the root config (Pitfall 5 / vitest.shared.ts). Boundary + DTO
// tests are the load-bearing ones here; root coverage is scoped to packages/** so the web
// project's component code does not drop the 95/90 core threshold.
import { fileURLToPath } from 'node:url';
import { defineProject, mergeConfig } from 'vitest/config';
import { sharedTest } from '../../vitest.shared.js';

export default mergeConfig(
  defineProject({
    test: {
      ...sharedTest,
      name: 'web',
      environment: 'jsdom',
    },
    // Mirror the Next `@/*` -> `./src/*` path alias (tsconfig.json) so action/DTO tests resolve the
    // SAME specifiers the app uses (`@/lib/dto/...`, `@/app/actions/...`). Per-project Vitest configs
    // cannot inherit the root, so the alias is declared here alongside the project definition.
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
  }),
  {},
);
