// Core Vitest project. Runs in a node environment (no DOM — matches the no-DOM tsconfig).
// Uses mergeConfig(defineProject(...), shared) because per-project configs cannot
// inherit from the root config (Pitfall 5).
import { defineProject, mergeConfig } from 'vitest/config';
import { sharedTest } from '../../vitest.shared.js';

export default mergeConfig(
  defineProject({
    test: {
      ...sharedTest,
      name: 'core',
      environment: 'node',
      // TODO(Plan 01-02): add the runtime determinism guard setup file here:
      //   setupFiles: ['./src/determinism/guard.setup.ts']
      // (installs the Date.now/Math.random throw-guard — D-12 runtime half).
    },
  }),
  {},
);
