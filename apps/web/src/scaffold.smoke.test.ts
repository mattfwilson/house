// Trivial smoke test so the 'web' Vitest project has at least one spec and `vitest run apps/web`
// exits 0 (the scaffold has no component tests yet — those arrive with the cockpit/chart waves).
// It deliberately does NOT import container.server.ts: that module imports `server-only`, which
// throws outside a React Server Component environment.
import { describe, expect, it } from 'vitest';

describe('web scaffold', () => {
  it('runs the web vitest project', () => {
    expect(1 + 1).toBe(2);
  });
});
