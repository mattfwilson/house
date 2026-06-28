// Web Vitest project. Runs in a jsdom environment (component/DOM tests) — unlike the core/app
// projects which use 'node'. Uses mergeConfig(defineProject(...), shared) because per-project
// configs CANNOT inherit from the root config (Pitfall 5 / vitest.shared.ts). Boundary + DTO
// tests are the load-bearing ones here; root coverage is scoped to packages/** so the web
// project's component code does not drop the 95/90 core threshold.
import { defineProject, mergeConfig } from 'vitest/config';
import { sharedTest } from '../../vitest.shared.js';

export default mergeConfig(
  defineProject({
    test: {
      ...sharedTest,
      name: 'web',
      environment: 'jsdom',
    },
  }),
  {},
);
