// dto/profile.ts — the profile Money→string DTO mapper. A `Profile` is `{ id, name } & Household`;
// every one of its nine money/rate leaves is ALREADY a canonical decimal STRING at the core boundary
// (`decStr`, never a bare float — CORE-02 / D-09), so this mapper is a structural pick that pins the
// serializable shape and guarantees no surprise field leaks across the RSC boundary. It performs NO
// conversion and NO money float-cast (Pitfall 5) — the strings cross verbatim and are formatted only
// at the display edge.
import type { Profile } from '@house/core';

/** The serializable profile shape the client receives — identity + the nine decimal-string leaves. */
export interface ProfileDTO {
  readonly id: string;
  readonly name: string;
  readonly grossAnnualIncome: string;
  readonly existingMonthlyDebt: string;
  readonly targetSavingsRate: string;
  readonly availableNetWorth: string;
  readonly currentRent: string;
  readonly downPaymentCash: string;
  readonly reserve: string;
  readonly currentAnnualSavings: string;
  readonly targetAnnualRetirementSpend: string;
}

/**
 * Map a core `Profile` to its serializable DTO. The nine Household leaves are already decimal
 * strings, so this is an explicit field pick (no conversion) — it documents the exact client-facing
 * shape and ensures only the intended fields cross the boundary.
 */
export function toProfileDTO(profile: Profile): ProfileDTO {
  return {
    id: profile.id,
    name: profile.name,
    grossAnnualIncome: profile.grossAnnualIncome,
    existingMonthlyDebt: profile.existingMonthlyDebt,
    targetSavingsRate: profile.targetSavingsRate,
    availableNetWorth: profile.availableNetWorth,
    currentRent: profile.currentRent,
    downPaymentCash: profile.downPaymentCash,
    reserve: profile.reserve,
    currentAnnualSavings: profile.currentAnnualSavings,
    targetAnnualRetirementSpend: profile.targetAnnualRetirementSpend,
  };
}
