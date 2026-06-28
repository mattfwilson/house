// container.ts — the SINGLE composition root (Pattern 4 / D-03). This is the ONLY module in the
// app that imports and instantiates the CONCRETE adapters (`SqliteScenarioRepository`,
// `SqliteProfileRepository`, `MockListingsProvider`); every other file (services, future
// apps/web) depends only on the PORT interfaces exposed by `Container`. The eslint app boundary
// in this plan fails the build if a `services/**` file reaches for a concrete adapter — the
// container is the sanctioned exception.
//
// Construction wires the persistence stack: open the SQLite connection, RUN MIGRATIONS so the
// schema is materialized at construction (Open Question 2 — a passing `tsc -b` is a false positive
// because Drizzle's row types come from `schema.ts`, not the live DB), then hand the live `Db` to
// both repository adapters (they share ONE connection, required for the scenarios→profiles foreign
// key). The profile adapter is given the REAL wall clock (the 06-05 hand-off: the locked `Profile`
// port carries no timestamps, so the app shell owns the clock; tests inject a fixed one instead).
//
// `.js` extension imports throughout (NodeNext + verbatimModuleSyntax).
import {
  type ListingsProvider,
  type ProfileRepository,
  type ScenarioRepository,
} from '@house/core';
import { openDb, runMigrations } from './adapters/persistence/db.js';
import { SqliteScenarioRepository } from './adapters/persistence/scenario-repo.js';
import { SqliteProfileRepository } from './adapters/persistence/profile-repo.js';
import { MockListingsProvider } from './adapters/listings/mock-provider.js';
import { LISTING_FIXTURES } from './adapters/listings/fixtures.js';

/**
 * The application's port-typed dependency bundle. Every field is an ABSTRACT port (D-03): a
 * concrete-type leak in this interface would be a compile error, and downstream consumers can only
 * ever see the port surface. Swapping `MockListingsProvider` for a future `RealListingsProvider`,
 * or SQLite for another driver, is a change confined to `makeContainer` below.
 */
export interface Container {
  readonly scenarios: ScenarioRepository;
  readonly profiles: ProfileRepository;
  readonly listings: ListingsProvider;
  /**
   * Dispose the persistence stack: close the single shared SQLite connection, which checkpoints
   * the WAL into the main DB file and releases the file (and WAL/SHM) handles. Without this the
   * connection leaks for the process lifetime and, on Windows, an open handle blocks deletion of
   * the DB file. Composition roots / shutdown hooks (and tests) MUST call this when done. Not a
   * port method — it is a lifecycle hook on the bundle the composition root owns.
   */
  readonly close: () => void;
}

/**
 * Build the composition root over a SQLite database at `dbPath` (a file path, or `':memory:'` for
 * a throwaway test DB). Migrations are applied at construction so the schema is live before any
 * repository call. Returns the adapters typed strictly as ports.
 */
export function makeContainer(dbPath: string): Container {
  const db = openDb(dbPath);
  runMigrations(db);
  return {
    scenarios: new SqliteScenarioRepository(db),
    profiles: new SqliteProfileRepository(db, () => Date.now()),
    listings: new MockListingsProvider(LISTING_FIXTURES),
    // Deterministic disposal of the one shared connection (checkpoints WAL, frees handles).
    close: () => db.$client.close(),
  };
}
