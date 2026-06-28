// Public surface of @house/app — the imperative shell Phase-7 `apps/web` imports. It exposes the
// service functions (the Pattern-1 shell) and the DI container's `makeContainer` + the port-typed
// `Container` interface. Consumers receive ONLY ports (D-03): the concrete SQLite adapters and the
// MockListingsProvider are named exclusively inside `container.ts`, never re-exported here.

// Profile lifecycle services — the ≤2-profile guard (D-10) lives in saveProfile.
export { saveProfile, listProfiles, MAX_PROFILES } from './services/profile-service.js';

// Saved-scenario lifecycle services — the Pattern-1 shell (recompute once, persist with
// service-stamped timestamps).
export {
  computeAndSaveScenario,
  loadScenario,
  listScenarios,
  deleteScenario,
  type ComputeAndSaveParams,
} from './services/scenario-service.js';

// The single composition root: builds the concrete adapters and returns a port-typed Container.
export { makeContainer, type Container } from './container.js';
