'use client';
// AssumptionsRail — the persistent docked assumptions rail (D-10). A slate-800 sidebar of tunable
// knobs, mounted once in the shared layout so it is echoed on every route (cockpit, heatmap,
// sensitivity). Each knob reads its current decimal-string value from the shared working set and
// emits edits back through `updateKnob` — the rail holds NO validation and NO money math (D-16 /
// T-7-04): the values are opaque decimal strings the core's Zod boundary validates at the recompute
// Server Action.
//
// Editing a knob re-flies the instruments LIVE with no Apply button (D-08): the edit updates the
// shared working set, then schedules `requestRecompute` on the ~300ms-debounced, latest-wins
// coordinator (07-06). The debounced thunk calls the `recompareAction` Server Action with the fresh
// working-set assumptions plus the comparison context (household + baseline + scenarios) the cockpit
// populates in `useComparisonInput`. A burst of edits coalesces to one issued recompute, and a stale
// out-of-order result is discarded by the coordinator's monotonic request-id guard (T-7-09). A
// subtle "recomputing…" affordance reflects the store `pending` flag (the synchronous core makes the
// round-trip cheap — no blocking spinner). A failed recompute surfaces the UI-SPEC error copy and
// keeps the last good result.
import { useState } from 'react';
import { useWorkingSet } from '@/store/working-set';
import { useComparisonInput } from '@/store/comparison-input';
import { useRecompute } from '@/store/recompute';
import { recompareAction } from '@/app/actions/scenarios';
import { KnobRow } from './KnobRow';

/** UI-SPEC error-state copy for a failed recompute / Server Action (07-UI-SPEC §Microcopy). */
const RECOMPUTE_ERROR =
  "Couldn't run the numbers. The calculation didn't complete — check your inputs and try again. " +
  'If it persists, the saved snapshot may be malformed.';

/** The projection / FI knobs (V3/V4 leaves) — plain decimal-string dot-paths into the AssumptionSet. */
const KNOBS: ReadonlyArray<{ label: string; path: string; hint: string }> = [
  { label: 'Real return', path: 'returns.realAnnual', hint: 'annual, real (0.05 = 5%)' },
  { label: 'Safe withdrawal rate', path: 'swr.rate', hint: 'annual (0.04 = 4%)' },
  { label: 'Inflation', path: 'inflation.annual', hint: 'annual (0.025 = 2.5%)' },
  { label: 'Home appreciation', path: 'appreciation.realAnnual', hint: 'annual, real' },
  { label: 'Maintenance', path: 'maintenance.annualPctOfValue', hint: 'fraction of value / yr' },
  { label: 'Income tax rate', path: 'tax.effectiveIncomeRate', hint: 'effective, blended' },
];

/** The budget control bounding the heatmap "stretch" bucket — the teal-accented active affordance. */
const BUDGET_KNOB = {
  label: 'Budget stretch',
  path: 'townScoring.bucket.stretchFactor',
  hint: 'heatmap stretch multiplier',
};

/**
 * Read a decimal-string leaf out of the plain DTO working set by dot-path, returning '' when the
 * leaf is absent (so the controlled input never goes uncontrolled). No interpretation — opaque string.
 */
function getKnobValue(node: unknown, path: string): string {
  const value = path
    .split('.')
    .reduce<unknown>(
      (acc, key) => (acc == null ? undefined : (acc as Record<string, unknown>)[key]),
      node,
    );
  return typeof value === 'string' ? value : '';
}

export function AssumptionsRail() {
  const assumptions = useWorkingSet((state) => state.assumptions);
  const updateKnob = useWorkingSet((state) => state.updateKnob);
  const requestRecompute = useRecompute((state) => state.requestRecompute);
  const pending = useRecompute((state) => state.pending);
  const [error, setError] = useState<string | null>(null);

  // A knob edit: update the shared working set, then schedule the debounced live recompute (D-08).
  const handleChange = (path: string, value: string): void => {
    updateKnob(path, value);
    // Read the FRESH state (the selector value above is stale within this same handler tick).
    const nextAssumptions = useWorkingSet.getState().assumptions;
    const context = useComparisonInput.getState().input;
    if (nextAssumptions === null || context === null) return; // no comparison assembled yet — nothing to re-fly
    requestRecompute(async () => {
      try {
        const result = await recompareAction({
          asOf: context.asOf,
          household: context.household,
          assumptions: nextAssumptions,
          baseline: context.baseline,
          scenarios: context.scenarios,
        });
        setError(null);
        return result;
      } catch {
        // Surface the error without rejecting (the coordinator has no catch); keep the last good
        // result so a transient failure doesn't blank the instruments, and clear the pending flag.
        setError(RECOMPUTE_ERROR);
        return useRecompute.getState().result;
      }
    });
  };

  return (
    <aside
      aria-label="Assumptions"
      className="w-72 shrink-0 border-r border-border bg-card text-card-foreground"
    >
      <div className="sticky top-14 flex flex-col gap-3 p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Assumptions
          </h2>
          {pending ? (
            <span className="text-[11px] text-muted-foreground" aria-live="polite">
              recomputing…
            </span>
          ) : null}
        </div>

        {assumptions === null ? (
          <p className="text-xs text-muted-foreground">Open a scenario to edit assumptions.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {KNOBS.map((knob) => (
              <KnobRow
                key={knob.path}
                label={knob.label}
                path={knob.path}
                hint={knob.hint}
                value={getKnobValue(assumptions, knob.path)}
                onChange={handleChange}
              />
            ))}
            <KnobRow
              accent
              label={BUDGET_KNOB.label}
              path={BUDGET_KNOB.path}
              hint={BUDGET_KNOB.hint}
              value={getKnobValue(assumptions, BUDGET_KNOB.path)}
              onChange={handleChange}
            />
          </div>
        )}

        {error ? (
          <p role="alert" className="text-xs leading-snug text-destructive">
            {error}
          </p>
        ) : null}
      </div>
    </aside>
  );
}
