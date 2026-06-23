// Vitest setupFile for the core test project (wired in packages/core/vitest.config.ts).
//
// Installs the runtime determinism guard (D-12 runtime half) before any core test runs,
// so that reaching for Date.now / Math.random anywhere in production core code during a
// test throws loudly. Tests that legitimately need to assert on the guard itself
// (guard.test.ts) save/restore the real globals around their own explicit install.
import { installDeterminismGuard } from './guard.js';

installDeterminismGuard();
