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
  experimental: {
    // @house/core / @house/app are authored NodeNext — their INTERNAL relative re-exports carry
    // explicit `.js` specifiers (e.g. `./affordability/bank-affordability.js`) that resolve to the
    // sibling `.ts` source on disk (the locked "raw TypeScript, no build step" decision — 07-01 /
    // CLAUDE.md). The web app must therefore remap a `.js` import to its `.ts`/`.tsx` source when
    // it transpiles these workspace packages. `extensionAlias` (the webpack `resolve.extensionAlias`)
    // does exactly that. Turbopack does NOT honor an extension alias for symlinked node_modules
    // workspace packages, so the bundler engine is webpack here (next dev/build --webpack) — the
    // moment a client component pulls the list Server Actions → @house/core into the build graph
    // (07-05 Header onward), Turbopack fails to resolve every `.js` re-export. This keeps the
    // no-build-step architecture intact; only the bundler engine changes. Pitfall 3 / RESEARCH P1.
    extensionAlias: {
      '.js': ['.ts', '.tsx', '.js', '.jsx'],
      '.mjs': ['.mts', '.mjs'],
      '.cjs': ['.cts', '.cjs'],
    },
  },
};

export default nextConfig;
