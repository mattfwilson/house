// NEGATIVE FIXTURE — this file MUST fail `eslint .` (determinism proof, D-12).
//
// It reads the high-res clock via performance.now in both the direct and globalThis-qualified
// form, which the flat config rejects via `no-restricted-syntax` (and `no-restricted-globals`
// for performance/globalThis). Proven by boundary.test.ts. Do NOT "fix" — the point is failure.
const a = performance.now();
const b = globalThis.performance.now();
void a;
void b;
