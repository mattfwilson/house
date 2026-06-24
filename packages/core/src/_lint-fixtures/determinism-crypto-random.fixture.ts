// NEGATIVE FIXTURE — this file MUST fail `eslint .` (determinism proof, D-12).
//
// It pulls entropy via crypto.getRandomValues in both the direct and globalThis-qualified
// form, which the flat config rejects via `no-restricted-syntax` (and `no-restricted-globals`
// for crypto/globalThis). Proven by boundary.test.ts. Do NOT "fix" — failure is the point.
const a = crypto.getRandomValues(new Uint8Array(4));
const b = globalThis.crypto.getRandomValues(new Uint8Array(4));
void a;
void b;
