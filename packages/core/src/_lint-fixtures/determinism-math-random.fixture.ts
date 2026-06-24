// NEGATIVE FIXTURE — this file MUST fail `eslint .` (determinism proof, D-12).
//
// It reads entropy via Math.random in both the direct and globalThis-qualified form, which
// the flat config rejects via `no-restricted-syntax` (and `no-restricted-globals` for
// globalThis). Proven by boundary.test.ts. Do NOT "fix" — the violation is the point.
const a = Math.random();
const b = globalThis.Math.random();
void a;
void b;
