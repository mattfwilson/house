// Shared Vitest test options. Per-project configs CANNOT `extends` the root config
// (Pitfall 5 — Vitest 4), so shared options live here and are spread via mergeConfig.
export const sharedTest = {
  globals: false,
} as const;
