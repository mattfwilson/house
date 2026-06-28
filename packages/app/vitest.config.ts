// App Vitest project. Runs in a node environment (the imperative shell talks to a
// synchronous SQLite driver, no DOM). Uses mergeConfig(defineProject(...), shared)
// because per-project configs cannot inherit from the root config (Pitfall 5).
// NOTE: app does NOT load core's determinism guard.setup — that throw-guard is
// core-only (the shell is allowed Date.now() for timestamps).
import { defineProject, mergeConfig } from 'vitest/config';
import { sharedTest } from '../../vitest.shared.js';

export default mergeConfig(
  defineProject({
    test: {
      ...sharedTest,
      name: 'app',
      environment: 'node',
    },
  }),
  {},
);
