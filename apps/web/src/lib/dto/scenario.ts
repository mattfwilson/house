// DTO mappers — the SINGLE server-side boundary that converts core `Money` results into plain,
// RSC-serializable objects (RESEARCH Pattern 3 / Pitfall 1). This file is the ONLY place in the web
// layer that calls the `Money` closed-API exits (`.toDecimalString()` — canonical, full precision,
// for the chart edge). It NEVER float-casts a money value — that lossy step is confined to the
// display edge (`components/charts/**` + `lib/format.ts`, Pitfall 5), enforced by the eslint guard.
//
// Two hard rules hold here, and the boundary tests pin them:
//   1. No `Money`/class instance crosses back to the client — a `Money` would JSON.stringify to `{}`
//      and strip the value (Pitfall 1). Every dollar leaf becomes a canonical decimal STRING.
//   2. The mapper adds NO financial logic — it preserves the core's ordering (FI-06 ranking) and
//      flattens the discriminated `FiOutcome` union for table rendering, nothing more.
import type {
  CompareResult,
  EvaluateScenarioResult,
  AffordabilityGapResult,
  AffordabilityVerdict,
  BindingRatio,
  BindingConstraint,
  FiImpactResult,
  FiOutcome,
} from '@house/core';

/**
 * The flattened FI outcome the comparison table renders. The core `FiOutcome` is a discriminated
 * union (`reached` carries `month`/`years`; `unreached` carries `cappedAtMonth`); the table wants a
 * single flat shape, so we widen each variant's fields to `| null` and key off `outcomeKind`. No
 * numeric sentinel is invented (L3) — `unreached` simply leaves `fiMonth`/`fiYears` null.
 */
export interface FiOutcomeDTO {
  readonly outcomeKind: 'reached' | 'unreached';
  /** `reached` → the 1-based FI month; `null` when unreached. */
  readonly fiMonth: number | null;
  /** `reached` → FI years as a decimal STRING; `null` when unreached. */
  readonly fiYears: string | null;
  /** `unreached` → the horizon cap month; `null` when reached. */
  readonly cappedAtMonth: number | null;
}

/** One ranked row of the comparison DTO (the flattened outcome + the deltas + the baseline flag). */
export interface CompareRowDTO extends FiOutcomeDTO {
  readonly label: string;
  /** `0` (baseline), the owner−renter delay in months (reached buy), or `null` (unreached buy). */
  readonly fiDeltaMonths: number | null;
  /** The same delta in years as a decimal STRING; `null` when undefined. */
  readonly fiDeltaYears: string | null;
  /** True only for row 0 (the keep-renting baseline). */
  readonly isBaseline: boolean;
}

/** The comparison DTO — the ranked rows, baseline first, unreached last (FI-06, order preserved). */
export interface CompareDTO {
  readonly rows: readonly CompareRowDTO[];
}

/** The four FI targets, every `Money` mapped to a canonical decimal STRING (D-02 visibility). */
export interface FiTargetsDTO {
  readonly renterTarget: string;
  readonly ownerTarget: string;
  readonly renterHousingAnnual: string;
  readonly ownerHousingAnnual: string;
}

/** The FI-impact DTO — both flattened outcomes, the deltas, and the Money targets as strings. */
export interface FiImpactDTO {
  readonly baseline: FiOutcomeDTO;
  readonly buy: FiOutcomeDTO;
  readonly fiDeltaMonths: number | null;
  readonly fiDeltaYears: string | null;
  readonly targets: FiTargetsDTO;
}

/** The per-scenario evaluate REPORT DTO — every field is already a string/boolean (pass-through). */
export interface EvaluateDTO {
  readonly frontEndRatio: string;
  readonly backEndRatio: string;
  readonly frontEndPass: boolean;
  readonly backEndPass: boolean;
  readonly savingsRateImpact: string;
  readonly headroom: string;
}

/** The bank-vs-true GAP DTO (SC-4) — the Money ceilings + signed gap as strings, verdict as the enum. */
export interface GapDTO {
  readonly bankMaxPrice: string;
  readonly trueMaxPrice: string;
  readonly signedGap: string;
  readonly bankBindingRatio: BindingRatio;
  readonly trueBindingConstraint: BindingConstraint;
  readonly verdict: AffordabilityVerdict;
}

/** Flatten the discriminated `FiOutcome` into the table-friendly `FiOutcomeDTO` (no sentinel, L3). */
function flattenOutcome(outcome: FiOutcome): FiOutcomeDTO {
  if (outcome.kind === 'reached') {
    return {
      outcomeKind: 'reached',
      fiMonth: outcome.month,
      fiYears: outcome.years,
      cappedAtMonth: null,
    };
  }
  return {
    outcomeKind: 'unreached',
    fiMonth: null,
    fiYears: null,
    cappedAtMonth: outcome.cappedAtMonth,
  };
}

/**
 * Map the core `CompareResult` to the serializable `CompareDTO`, PRESERVING the core ranking (the
 * baseline is row 0, unreached buys sort last — FI-06). `CompareResult` carries no `Money` (the deltas
 * are already a `number`/decimal-string/`null`), so this is a structural flatten with zero conversion.
 */
export function toCompareDTO(result: CompareResult): CompareDTO {
  return {
    rows: result.rows.map((row) => ({
      label: row.label,
      ...flattenOutcome(row.outcome),
      fiDeltaMonths: row.fiDeltaMonths,
      fiDeltaYears: row.fiDeltaYears,
      isBaseline: row.isBaseline,
    })),
  };
}

/**
 * Map the FI-impact result: flatten both outcomes and convert the four `Money` targets to canonical
 * decimal strings (the ONLY conversion site). The deltas are already serializable (number/string/null).
 */
export function toFiImpactDTO(result: FiImpactResult): FiImpactDTO {
  return {
    baseline: flattenOutcome(result.baseline),
    buy: flattenOutcome(result.buy),
    fiDeltaMonths: result.fiDeltaMonths,
    fiDeltaYears: result.fiDeltaYears,
    targets: {
      renterTarget: result.targets.renterTarget.toDecimalString(),
      ownerTarget: result.targets.ownerTarget.toDecimalString(),
      renterHousingAnnual: result.targets.renterHousingAnnual.toDecimalString(),
      ownerHousingAnnual: result.targets.ownerHousingAnnual.toDecimalString(),
    },
  };
}

/**
 * Map the per-scenario evaluate REPORT. Every field on `EvaluateScenarioResult` is already a decimal
 * STRING or a boolean (the core returns ratios/headroom as `Dec.toFixed()` strings) — so this is a
 * pass-through that pins the serializable shape and proves no `Money` instance is present.
 */
export function toEvaluateDTO(result: EvaluateScenarioResult): EvaluateDTO {
  return {
    frontEndRatio: result.frontEndRatio,
    backEndRatio: result.backEndRatio,
    frontEndPass: result.frontEndPass,
    backEndPass: result.backEndPass,
    savingsRateImpact: result.savingsRateImpact,
    headroom: result.headroom,
  };
}

/**
 * Map the bank-vs-true GAP (SC-4): the two `Money` ceilings and the signed gap become canonical
 * decimal strings; the verdict + binding fields are already plain string enums (RSC-safe). This is
 * the "the gap" framing the cockpit surfaces as a warning — no `Money` survives the boundary.
 */
export function toGapDTO(result: AffordabilityGapResult): GapDTO {
  return {
    bankMaxPrice: result.bankMaxPrice.toDecimalString(),
    trueMaxPrice: result.trueMaxPrice.toDecimalString(),
    signedGap: result.signedGap.toDecimalString(),
    bankBindingRatio: result.bankBindingRatio,
    trueBindingConstraint: result.trueBindingConstraint,
    verdict: result.verdict,
  };
}
