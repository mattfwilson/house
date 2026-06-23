// The SINGLE configured Decimal constructor for the whole core (D-14).
//
// We `Decimal.clone(...)` once and export the resulting constructor (`Dec`). Every
// Money / calc uses `Dec`, never the global `Decimal`. The global is NEVER mutated via
// `Decimal.set` — that would be a module-level mutable default and could be clobbered
// by any other importer of decimal.js. `clone` returns an independent constructor.
//
//   - precision: SIGNIFICANT DIGITS (not decimal places — Pitfall 3). 34 == IEEE-754
//     decimal128 width: ample headroom for multi-decade monthly compounding ((1+r)^360)
//     plus summation, at negligible cost. Cents-rounding is a separate boundary op.
//   - rounding: ROUND_HALF_EVEN (=== 6), banker's rounding (D-02). The decimal.js
//     DEFAULT is ROUND_HALF_UP (=== 4), which introduces a systematic upward bias when
//     summing many rounded values across a long projection — explicitly NOT what we want.
// Named import (not default): decimal.js merges a class + namespace under one symbol;
// the named `Decimal` binding exposes the static `clone`/`ROUND_HALF_EVEN` members,
// whereas the synthesized default collapses to the module-namespace type under
// NodeNext + verbatimModuleSyntax.
import { Decimal } from 'decimal.js';

export const Dec = Decimal.clone({
  precision: 34,
  rounding: Decimal.ROUND_HALF_EVEN, // === 6 (banker's). NOT ROUND_HALF_UP (the default).
});

export type DecimalInstance = InstanceType<typeof Dec>;
