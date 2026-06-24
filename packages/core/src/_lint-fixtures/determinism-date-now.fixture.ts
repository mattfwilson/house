// NEGATIVE FIXTURE — this file MUST fail `eslint .` (determinism proof, D-12).
//
// It reads the wall clock via both the direct and the globalThis-qualified form, which the
// flat config rejects via `no-restricted-syntax` (and `no-restricted-globals` for globalThis).
// boundary.test.ts shells out to eslint against this file and asserts a NON-zero exit.
// Do NOT "fix" these reads — the violation is the point (see _lint-fixtures/README.md).
const a = Date.now();
const b = globalThis.Date.now();
void a;
void b;
