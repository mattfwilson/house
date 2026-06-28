import 'server-only'; // build error if a 'use client' module ever imports this (T-7-02, Pitfall 2)
import { makeContainer, type Container } from '@house/app';

// The ONE composition root for the web shell. `makeContainer` opens the SQLite connection and
// RUNS MIGRATIONS at construction (container.ts:53-54) and must therefore be built ONCE per
// process — never per request (re-running migrations + leaking file handles, which on Windows
// blocks DB-file deletion — Pitfall 4 / container.ts:37-44).
//
// Stash the singleton on `globalThis` so Next dev's module hot-reload reuses the SAME container
// (and the SAME connection) across reloads instead of constructing a fresh one each time. In
// production this is simply a module-scoped process singleton.
const globalForContainer = globalThis as unknown as {
  __houseContainer?: Container;
};

export function container(): Container {
  if (!globalForContainer.__houseContainer) {
    globalForContainer.__houseContainer = makeContainer(
      process.env.HOUSE_DB_PATH ?? './house.sqlite',
    );
  }
  return globalForContainer.__houseContainer;
}
