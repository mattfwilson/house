# Deferred Items — Phase 04 (FI-Impact Engine & Sensitivity)

Out-of-scope discoveries logged during execution (NOT fixed — per the executor SCOPE BOUNDARY rule:
only auto-fix issues DIRECTLY caused by the current task's changes).

## Pre-existing lint error (unrelated file)

- **File:** `packages/core/src/tco/rent-vs-buy.test.ts:23`
- **Error:** `'computeTco' is defined but never used (@typescript-eslint/no-unused-vars)`
- **Status:** PRE-EXISTING — present at the base commit before Plan 04-04 (last touched by an
  unrelated `quick-260625` commit `d4d0ac2`). Not caused by, and not in the scope of, Plan 04-04
  (sensitivity tornado / FI golden). The fix is a one-line import cleanup but belongs to a TCO-engine
  touch-up, not this FI plan.
- **Suggested resolution:** drop the unused `computeTco` import from `rent-vs-buy.test.ts` in a
  follow-up `/gsd-quick` or the next time that file is legitimately edited.

## Inert assumption: `tax.propertyRateAnnual` (FI / sensitivity tax driver)

- **File:** `packages/core/src/assumptions/schema.ts` (the `tax.propertyRateAnnual` leaf) + its
  consumer-less status across the calc engine.
- **Observation:** `tax.propertyRateAnnual` is NOT read by any calculation. Property tax flows through
  the resolved TOWN mill rate (`tco.resolvedMillRate` → `assessedValueAt` / `annualPropertyTax`), not
  this assumption. The Plan 04-04 tornado tax driver (L6) therefore perturbs `propertyRateAnnual`
  RELATIVELY as the plan specifies, but — because the assumption is inert — the tax row's FI-date
  swing is currently 0 for typical scenarios.
- **Status:** OUT OF SCOPE for Plan 04-04. The relative-band MACHINERY (L6) is implemented and tested;
  making the tax driver bite requires wiring the resolved mill rate to a perturbable rate (an
  architectural change to the TCO property-tax path, Rule 4 territory), which is beyond this plan's
  charter.
- **Suggested resolution:** a follow-up that either (a) routes the property-tax bill through a
  perturbable rate the FI tornado can move, or (b) extends the tornado to perturb the resolved mill
  rate directly. Track as a future enhancement to the sensitivity engine.
