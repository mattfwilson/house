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
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
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
  // Enforce foreign keys EXPLICITLY per-connection (SQLite defaults FK checks OFF and resets
  // them on every new connection). Do NOT rely on this build's better-sqlite3 happening to be
  // compiled with SQLITE_DEFAULT_FOREIGN_KEYS=1: CLAUDE.md sanctions a future swap to
  // `node:sqlite` (FK off by default), which would otherwise silently disable the
  // scenarios->profiles FK with no compile or test failure. This pragma makes the constraint a
  // property of the adapter, not of the driver's compile flags (proven by the negative FK test).
  sqlite.pragma('foreign_keys = ON');
  return drizzle({ client: sqlite, schema });
}

/** The Drizzle DB handle this package's adapters operate on (typed by the schema module). */
export type Db = ReturnType<typeof openDb>;

// The committed migrations live at packages/app/drizzle (a directory of `.sql` files +
// drizzle-kit `meta`). They are committed source, NOT a build artifact.
const MIGRATIONS_SUBPATH = join('packages', 'app', 'drizzle');

/**
 * Resolve the committed `drizzle/` migrations folder via a STABLE, WORKSPACE-ANCHORED walk
 * (Option C, 07-10 build-gate decision) instead of the old
 * `fileURLToPath(new URL('../../../drizzle', import.meta.url))`.
 *
 * WHY THE CHANGE (two failures the module-relative form could not survive):
 *   1. BUILD: a webpack/Next production build statically analyzes
 *      `new URL(<string-literal>, import.meta.url)` and tries to emit the referenced path as a
 *      bundled ASSET. It cannot turn a *directory* of `.sql` migrations into one asset, so
 *      `next build` failed (the 07-05 deferred blocker). Here there is no `new URL(<literal>)`
 *      and no static string passed to the bundler, so webpack never asset-bundles it.
 *   2. RUNTIME: when this module IS bundled into `.next/server/…`, `import.meta.url` points
 *      into the build output, so `../../../drizzle` would resolve to a non-existent path.
 *
 * Resolution strategy: walk UP from runtime anchors (the process CWD first — which under
 * `next dev/build -w apps/web` is `apps/web` and under `vitest`/`tsx` is the repo root — then,
 * as a fallback, this module's own directory computed at runtime from `import.meta.url` WITHOUT
 * a literal path arg, which is safe for tsx/vitest where it is a real `src/` path) until a
 * directory containing `packages/app/drizzle` is found. The first ancestor that owns it is the
 * workspace root, so the lookup is correct from anywhere inside the repo. The result is memoized.
 *
 * `fileURLToPath` (not `URL.pathname`) keeps the OS path real on Windows (`C:\…`, not `/C:/…`).
 */
let migrationsFolderCache: string | undefined;
function resolveMigrationsFolder(): string {
  if (migrationsFolderCache !== undefined) return migrationsFolderCache;

  const anchors: string[] = [process.cwd()];
  try {
    // Runtime-computed module dir — NOT `new URL(<literal>, import.meta.url)`, so no asset bundling.
    anchors.push(dirname(fileURLToPath(import.meta.url)));
  } catch {
    // import.meta.url unavailable in this runtime — the CWD anchor still covers normal use.
  }

  for (const anchor of anchors) {
    let dir = resolve(anchor);
    // Walk up to the filesystem root.
    for (;;) {
      const candidate = join(dir, MIGRATIONS_SUBPATH);
      if (existsSync(candidate)) {
        migrationsFolderCache = candidate;
        return candidate;
      }
      const parent = dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
  }

  // Fail LOUD rather than silently materializing no schema (a silent migration ENOENT would be a
  // worse failure than this clear error — see the 07-10 build-fix decision: never fake a green path).
  throw new Error(
    `Could not locate the drizzle migrations folder ("${MIGRATIONS_SUBPATH}") by walking up from ` +
      `any of: ${anchors.join(', ')}. The persistence adapter cannot run migrations.`,
  );
}

/**
 * Apply the committed drizzle-kit migration SQL to a live DB (D-11 — migrations, never
 * `drizzle-kit push`). Run once at composition (or per fresh `:memory:` DB in tests). This is
 * the load-bearing proof that the schema is materialized: a passing `tsc -b` is a FALSE
 * POSITIVE because Drizzle's row types derive from `schema.ts`, not from the live database.
 */
export function runMigrations(db: Db): void {
  migrate(db, { migrationsFolder: resolveMigrationsFolder() });
}
