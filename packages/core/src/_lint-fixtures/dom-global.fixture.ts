// NEGATIVE FIXTURE / no-DOM regression guard.
//
// The core tsconfig has `lib: ["ES2023"]` with NO "dom", so DOM globals like
// `document` are type errors. The `@ts-expect-error` below ASSERTS that error
// exists. Consequences:
//   - Correctly configured (no DOM lib)  -> `document` errors -> @ts-expect-error is
//     satisfied -> `tsc -b` stays GREEN.
//   - Misconfigured (someone adds "dom") -> `document` resolves -> @ts-expect-error is
//     UNUSED -> `tsc -b` FAILS (TS2578).
// So this file turns "no DOM lib" into a compile-time regression test.
//
// @ts-expect-error -- DOM lib is intentionally absent from the core tsconfig (CORE-01 compile-time complement).
const _domProbe: unknown = document;
void _domProbe;
