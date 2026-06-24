// NEGATIVE FIXTURE — this file MUST fail `eslint .` (determinism proof, D-13).
//
// It constructs a JS Date in both the bare and globalThis-qualified form, which the flat
// config rejects via `no-restricted-syntax` (NewExpression Date). Core must use CalendarDate.
// Proven by boundary.test.ts. Do NOT "fix" — the violation is the point.
const a = new Date();
const b = new globalThis.Date();
void a;
void b;
