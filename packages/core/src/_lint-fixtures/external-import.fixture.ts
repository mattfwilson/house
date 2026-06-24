// NEGATIVE FIXTURE — this file MUST fail `eslint .` (CORE-01 deny-by-default proof).
//
// It imports an ARBITRARY external module that is NOT on the core allowlist (decimal.js,
// zod). The flat config rejects it via `boundaries/external` (deny-by-default). This proves
// the guard covers more than just framework names — any non-allowlisted external trips it.
// If `boundaries/external` is ever removed/disabled (it is deprecated, WR-04), this fixture
// stops failing and boundary.test.ts goes red, surfacing the regression LOUDLY instead of
// silently un-guarding the core. Do NOT "fix" this import — the violation is the point.
import 'node:fs';
