// DEFAULT_ASSUMPTIONS — the versioned seed AssumptionSet (D-07).
//
// PURE DATA. No `process`/env reads, no `Date`, no computation — just literal decimal
// strings, so it is trivially reproducible and snapshot-stable (the determinism guard
// would throw if this touched ambient state). These are MA-flavored PLACEHOLDER tunables
// chosen to be plausible for greater-Boston decision modeling; they are NOT authoritative
// tax/mill-rate tables (real per-town tables are a Phase-2 / TCO concern, deliberately
// out of scope here — only the shape + versioning are locked).
//
// Every value is a canonical decimal STRING (D-06) and the whole object satisfies
// `CurrentAssumptionSet` at compile time (so a shape change here is a type error).
import type { CurrentAssumptionSet } from './schema.js';

export const DEFAULT_ASSUMPTIONS: CurrentAssumptionSet = {
  schemaVersion: 1,
  tax: {
    // Blended effective income tax rate (fed + MA 5% flat), placeholder.
    effectiveIncomeRate: '0.27',
    // Placeholder statewide effective property tax rate (~1.1% of value/yr).
    propertyRateAnnual: '0.011',
  },
  dti: {
    // Conventional front-end (housing) and back-end (total debt) qualification ceilings.
    frontEnd: '0.28',
    backEnd: '0.36',
  },
  returns: {
    // Expected REAL (inflation-adjusted) annual return for the opportunity-cost engine.
    realAnnual: '0.05',
  },
  inflation: {
    annual: '0.025',
  },
  maintenance: {
    // Annual maintenance as a fraction of home value (the classic ~1% rule of thumb).
    annualPctOfValue: '0.01',
  },
  swr: {
    // Long-horizon safe withdrawal rate — ~3.3%, NOT the 4% rule (locked SWR decision).
    rate: '0.033',
  },
  pmi: {
    // Annual PMI premium as a fraction of the loan balance; removable at/under 80% LTV.
    annualRateOfLoan: '0.0075',
    dropOffLtv: '0.8',
  },
};
