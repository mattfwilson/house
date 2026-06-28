// Repository PORTS — the persistence contracts the core DEFINES and the app IMPLEMENTS (D-02
// dependency inversion). The side that defines the NEED owns the interface: locking these here
// lets the Wave-2/3 SQLite adapters be written against a known shape. This is a PURE-interface
// module: no Zod, no concrete impl, NO persistence-driver/ORM import — the `boundaries/external`
// deny-by-default guard would fail the build otherwise (D-02), keeping the core zero-framework.
//
// The methods are SYNCHRONOUS (D-08): the SQLite driver is synchronous, so async signatures
// would be cosmetic. `ProfileRepository.count()` feeds the service-layer ≤2-profiles guard (D-10).
import type { Profile } from '../types/profile.js';
import type { SavedScenario, SavedScenarioMeta } from '../types/saved-scenario.js';

/**
 * The saved-scenario persistence port. `load` rebuilds the FROZEN embedded `EngineInput` snapshot
 * (re-parsed through the existing Zod boundary, never re-joined to the live profile — PROF-04);
 * `listByProfile` returns the thin `SavedScenarioMeta` projection (no heavy blobs, D-06).
 */
export interface ScenarioRepository {
  save(s: SavedScenario): void;
  load(id: string): SavedScenario | null;
  listByProfile(profileId: string): SavedScenarioMeta[];
  delete(id: string): void;
}

/**
 * The profile persistence port. `count()` is the service-layer ≤2-profiles invariant's input
 * (D-10) — a real guard even without the UI.
 */
export interface ProfileRepository {
  save(p: Profile): void;
  load(id: string): Profile | null;
  list(): Profile[];
  count(): number;
}
