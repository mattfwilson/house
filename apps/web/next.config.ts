import type { NextConfig } from 'next';

// @house/core and @house/app publish RAW TypeScript (their package `exports` point at
// `src/index.ts`, not a built `dist/`). Next must transpile them through its own pipeline —
// hence `transpilePackages`. RESEARCH Pattern 1 / Pitfall 3.
//
// CRITICAL (Pitfall 3, T-7-03): better-sqlite3 is a native module that @house/app depends on.
// It is NOT listed here and NOT listed in `serverExternalPackages` — Next 16.1+ auto-externalizes
// it transitively through @house/app on the server, and listing it in BOTH lists makes Next throw
// ("transpilePackages conflict with serverExternalPackages"). Leaving it auto-externalized keeps
// the native binary on the server and out of the client bundle (T-7-02).
const nextConfig: NextConfig = {
  transpilePackages: ['@house/core', '@house/app'],
};

export default nextConfig;
