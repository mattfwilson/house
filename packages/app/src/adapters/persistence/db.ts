// SQLite connection + Drizzle wiring + programmatic migrator for the persistence adapter.
//
// MIGRATOR IMPORT PATH (RESEARCH A1, confirmed against installed drizzle-orm@0.45.2):
// `drizzle-orm/better-sqlite3/migrator` exists at
//   node_modules/drizzle-orm/better-sqlite3/migrator.{js,d.ts}
// and exports `migrate(db, { migrationsFolder }): void` (sync, matching better-sqlite3). The
// ASSUMED subpath is therefore verified, not guessed.
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { fileURLToPath } from 'node:url';
import * as schema from './schema.js';

/**
 * Open a Drizzle-wrapped better-sqlite3 connection.
 *
 * @param source A file path (e.g. `./house.sqlite`) OR `':memory:'` (tests use the latter for
 *   a fast, isolated, throwaway DB). WAL journaling is requested for file-backed DBs; SQLite
 *   silently ignores it for `:memory:`, which has no on-disk journal.
 */
export function openDb(source: string) {
  const sqlite = new Database(source);
  sqlite.pragma('journal_mode = WAL');
  return drizzle({ client: sqlite, schema });
}

/** The Drizzle DB handle this package's adapters operate on (typed by the schema module). */
export type Db = ReturnType<typeof openDb>;

// Resolve the committed `drizzle/` migrations folder relative to THIS module, so it works
// identically under tsx/vitest (src) and the built dist output. `fileURLToPath` is used (not
// `URL.pathname`) so the path is a real OS path on Windows (`C:\...`, not `/C:/...`).
// db.ts lives at packages/app/src/adapters/persistence/ → three `..` reach packages/app/.
const MIGRATIONS_FOLDER = fileURLToPath(new URL('../../../drizzle', import.meta.url));

/**
 * Apply the committed drizzle-kit migration SQL to a live DB (D-11 — migrations, never
 * `drizzle-kit push`). Run once at composition (or per fresh `:memory:` DB in tests). This is
 * the load-bearing proof that the schema is materialized: a passing `tsc -b` is a FALSE
 * POSITIVE because Drizzle's row types derive from `schema.ts`, not from the live database.
 */
export function runMigrations(db: Db): void {
  migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
}
