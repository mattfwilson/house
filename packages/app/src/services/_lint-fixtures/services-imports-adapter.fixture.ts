// NEGATIVE FIXTURE — this file MUST fail eslint (it is the D-03 proof).
//
// It lives under the `services` element and imports a CONCRETE adapter
// (`MockListingsProvider` from adapters/**), which the app boundary override rejects via
// `boundaries/element-types` (services may NOT import adapters — only container.ts may).
// packages/app/src/boundary.test.ts shells out to eslint against this file with `--no-ignore`
// and asserts a NON-zero exit. Do NOT "fix" this import — the violation is the point.
//
// It is ignored from the everyday `eslint .` (top-level ignores in eslint.config.ts) so the CI
// lint gate stays green for real code; only the boundary test lints it explicitly.
//
// The import is written extensionless (not `.js`) so the installed `node` import resolver maps it
// back to the adapter's `.ts` source and boundaries can classify the import edge as `adapters` —
// the violation the rule must catch. The file is excluded from `tsc -b` (a negative lint asset, not
// production code), so the extensionless form never reaches the NodeNext compiler.
import { MockListingsProvider } from '../../adapters/listings/mock-provider';

// Reference the import so it is not elided — the boundary violation is in the import edge above.
export const leaked = MockListingsProvider;
