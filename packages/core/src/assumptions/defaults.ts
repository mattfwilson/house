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
  schemaVersion: 3,
  tax: {
    // Blended effective income tax rate (fed + MA 5% flat), placeholder.
    effectiveIncomeRate: '0.27',
    // Placeholder statewide effective property tax rate (~1.1% of value/yr).
    propertyRateAnnual: '0.011',
    // [ASSUMED] Assessed value ÷ market value. MA towns assess at ~full fair market value,
    // so 1.0 is the conservative default (D-07) — pending user confirmation.
    assessmentRatio: '1.0',
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
  appreciation: {
    // [ASSUMED] Expected REAL annual home-value appreciation (~0.75%/yr above inflation),
    // a conservative long-horizon figure (D-04) — pending user confirmation.
    realAnnual: '0.0075',
  },
  transaction: {
    // [ASSUMED] Sale-side transaction cost (~6.5% — agent commission + transfer + closing)
    // applied to sale price at the holding horizon (D-05) — pending user confirmation.
    sellCostPct: '0.065',
  },
  rent: {
    // [ASSUMED] Real annual rent growth held at 0% (rent tracks inflation by default)
    // for the rent-vs-buy path (D-06) — pending user confirmation.
    realGrowthAnnual: '0',
  },
  closing: {
    // [ASSUMED] Default one-time closing cost as ~2.5% of purchase price (D-12),
    // overridable per scenario — pending user confirmation.
    rateOfPrice: '0.025',
  },
  sensitivity: {
    // [ASSUMED] The six tornado driver bands (RESEARCH A4 / D-12 — LOCKED values) — pending
    // user confirmation. FIVE are ABSOLUTE ± perturbations on a rate (percentage points):
    // a returnBand of '0.015' perturbs returns.realAnnual by ±1.5pp. The SIXTH,
    // taxBandRelative, is a RELATIVE ±fraction of the tax figure (L6): '0.15' = ±15% of the
    // property-tax line, NOT an absolute rate band.
    returnBand: '0.015', // ± absolute on returns.realAnnual
    inflationBand: '0.01', // ± absolute on inflation.annual
    appreciationBand: '0.01', // ± absolute on appreciation.realAnnual
    maintenanceBand: '0.005', // ± absolute on maintenance.annualPctOfValue
    taxBandRelative: '0.15', // RELATIVE ±15% of the property-tax figure (L6), NOT absolute
    swrBand: '0.005', // ± absolute on swr.rate
  },
  projection: {
    // [ASSUMED] FI-projection termination cap (RESEARCH A3 / D-07) — pending user confirmation.
    // 60 years = 720 months, comfortably past any realistic FI date. Conceptually an INTEGER
    // year count stored as a decStr (no z.number()); calc converts via Number() ONLY at the
    // loop bound (the downPaymentPct .refine Number-comparison precedent), never re-entering
    // as a bare number across the boundary.
    maxHorizonYears: '60',
  },
};
