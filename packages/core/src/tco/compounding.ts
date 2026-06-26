// Shared within-package compounding helper (Landmine L1 / RESEARCH A6 — LOCKED).
//
// `monthlyGrowthFactor` was a file-private helper inside `rent-vs-buy.ts`. Phase 4's FI
// projection loop (and its oracle) compound a portfolio at the SAME monthly factor the
// rent-vs-buy engine uses. To guarantee the FI loop, the oracle, AND `rentVsBuy` all
// compound through ONE definition — never two subtly-different `(1+r)^(1/12)` derivations —
// the factor is promoted here as the single source of truth, imported within-package.
//
// Dec/Money discipline (the carrying-costs.ts precedent, D-03 / CORE-02): the power lives in
// the frozen `Dec` clone. `Dec` is NOT re-exported from `index.ts` — this helper returns the
// internal `Dec` type, so it is an INTERNAL within-package import only (exporting it would
// leak `Dec` across the public boundary, violating the index.ts rule).
import { Dec } from '../money/decimal-config.js';

/**
 * The monthly compounding factor for an ANNUAL real rate `r`: `(1 + r)^(1/12)`, kept at full
 * `Dec` precision. Monthly compounding of an annual real return (not a naive `r/12`) so the
 * portfolio grows consistently with the annual figure.
 */
export function monthlyGrowthFactor(annualReal: string): InstanceType<typeof Dec> {
  return new Dec(1).plus(new Dec(annualReal)).pow(new Dec(1).div(12));
}
