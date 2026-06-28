'use client';
// AssumptionsRail — the persistent docked assumptions rail (D-10). A slate-800 sidebar of tunable
// knobs, mounted once in the shared layout so it is echoed on every route (cockpit, heatmap,
// sensitivity). Each knob reads its current decimal-string value from the shared working set and
// emits edits back through `updateKnob` — the rail holds NO validation and NO money math (D-16 /
// T-7-04): the values are opaque decimal strings the core's Zod boundary validates at the recompute
// Server Action. Editing a knob will also trigger the live debounced recompute (Task 2 wiring).
import { useWorkingSet } from '@/store/working-set';
import { KnobRow } from './KnobRow';

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

  const handleChange = (path: string, value: string): void => {
    updateKnob(path, value);
  };

  return (
    <aside
      aria-label="Assumptions"
      className="w-72 shrink-0 border-r border-border bg-card text-card-foreground"
    >
      <div className="sticky top-14 flex flex-col gap-3 p-4">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Assumptions
        </h2>

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
      </div>
    </aside>
  );
}
