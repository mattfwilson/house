// NEGATIVE FIXTURE — this file MUST fail `eslint .` (it is the CORE-01 proof).
//
// It intentionally imports a framework package into packages/core/src, which the
// flat config rejects via `boundaries/external` (deny-by-default) AND
// `no-restricted-imports`. boundary.test.ts shells out to eslint against this file
// and asserts a NON-zero exit. Do NOT "fix" this import — it is a test asset.
//
// eslint-disable rules are deliberately NOT applied here; the violation is the point.
import 'react';
