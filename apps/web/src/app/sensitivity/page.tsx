'use client';
// The sensitivity route (FI-05 / SC-3/SC-4). It renders the FI-date tornado for the active scenario:
// which assumptions move the FI date most, top drivers labeled, ALWAYS as a range — the route leads
// with the locked anti-funnel framing "No headline number without a range." It holds ZERO sensitivity
// logic: it hands the active scenario + household + working-set assumptions to `tornadoAction`, which
// validates at the core Zod boundary and runs `tornado` once (the core sweeps ~12 perturbations).
//
// CONTEXT INHERITANCE (D-02): the household + scenarios + as-of come from the `comparison-input` bridge
// the cockpit populates (07-07/07-08); the editable assumptions come from the shared working set the
// rail owns. Editing a rail knob mutates the working set, which re-flies the tornado LIVE (debounced
// ~300ms, D-08 — no separate "Run" trigger). The persistent rail (shared layout) sits beside the
// result. When no comparison has been assembled yet, the route prompts the user to open the cockpit.
import { useEffect, useMemo, useState } from 'react';
import type { AssumptionSet } from '@house/core';
import { useWorkingSet } from '@/store/working-set';
import { useComparisonInput } from '@/store/comparison-input';
import { tornadoAction } from '@/app/actions/sensitivity';
import type { TornadoDTO } from '@/lib/dto/sensitivity';
import { TornadoChart, DRIVER_LABEL } from '@/components/charts/TornadoChart';
import { Button } from '@/components/ui/button';

/** UI-SPEC error-state copy for a failed Server Action (07-UI-SPEC §Microcopy). */
const ERROR_COPY =
  "Couldn't run the numbers. The calculation didn't complete — check your inputs and try again. " +
  'If it persists, the saved snapshot may be malformed.';

/** Read a scenario DTO's display label (the scenarios cross as opaque DTOs — label only, for the picker). */
function scenarioLabel(scenario: unknown, index: number): string {
  const label = (scenario as { label?: unknown }).label;
  return typeof label === 'string' && label.length > 0 ? label : `Scenario ${index + 1}`;
}

export default function SensitivityRoute() {
  const workingSet = useWorkingSet((s) => s.assumptions);
  const context = useComparisonInput((s) => s.input);

  const [activeIndex, setActiveIndex] = useState(0);
  const [tornado, setTornado] = useState<TornadoDTO | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const scenarios = context?.scenarios ?? [];
  const activeScenario = scenarios[Math.min(activeIndex, scenarios.length - 1)] ?? null;
  const topDriverLabels = useMemo(
    () => (tornado ? tornado.topDrivers.map((driver) => DRIVER_LABEL[driver] ?? driver) : []),
    [tornado],
  );

  // Live recompute (debounced ~300ms, D-08): re-fly the tornado whenever the working-set assumptions,
  // the chosen scenario, or the comparison context change. Keep the last good board on transient error.
  useEffect(() => {
    if (workingSet === null || context === null || activeScenario === null) {
      setTornado(null);
      return;
    }
    let active = true;
    const handle = setTimeout(() => {
      setLoading(true);
      void tornadoAction({
        asOf: context.asOf,
        household: context.household,
        assumptions: workingSet as AssumptionSet,
        scenario: activeScenario,
      })
        .then((result) => {
          if (!active) return;
          setTornado(result);
          setError(null);
        })
        .catch(() => {
          if (active) setError(ERROR_COPY);
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }, 300);
    return () => {
      active = false;
      clearTimeout(handle);
    };
  }, [workingSet, context, activeScenario]);

  const ready = context !== null && scenarios.length > 0;

  return (
    <main className="flex flex-col gap-4 p-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold">Sensitivity</h1>
        {/* FI-05 — the load-bearing anti-funnel framing, rendered verbatim. */}
        <p className="text-sm font-semibold text-foreground">No headline number without a range.</p>
        <p className="max-w-prose text-sm text-muted-foreground">
          The tornado shows how far your FI date swings when each assumption moves across its band —
          longest bars are the drivers your plan is most sensitive to. There is no single FI date,
          only a range.
        </p>
      </div>

      {!ready ? (
        <div className="flex max-w-prose flex-col gap-2 rounded-md border border-border bg-card p-6">
          <h2 className="text-sm font-semibold">Open a scenario to see its sensitivity</h2>
          <p className="text-sm text-muted-foreground">
            Add or open a house in the cockpit first. The sensitivity tornado runs against the active
            scenario and the assumptions in the rail.
          </p>
          <div>
            <Button type="button" variant="outline" size="sm" render={<a href="/">Go to cockpit</a>} />
          </div>
        </div>
      ) : (
        <>
          {/* Scenario picker (the tornado is per-scenario). */}
          {scenarios.length > 1 ? (
            <div className="flex flex-wrap items-center gap-1">
              <span className="mr-1 text-xs font-semibold text-muted-foreground">Scenario</span>
              {scenarios.map((scenario, index) => (
                <Button
                  key={scenarioLabel(scenario, index)}
                  type="button"
                  size="sm"
                  variant={index === activeIndex ? 'default' : 'outline'}
                  onClick={() => setActiveIndex(index)}
                  aria-pressed={index === activeIndex}
                >
                  {scenarioLabel(scenario, index)}
                </Button>
              ))}
            </div>
          ) : null}

          {error ? (
            <p role="alert" className="text-xs leading-snug text-destructive">
              {error}
            </p>
          ) : null}

          {tornado ? (
            <div className="flex flex-col gap-3">
              {topDriverLabels.length > 0 ? (
                <p className="text-xs text-muted-foreground" aria-live="polite">
                  Top drivers:{' '}
                  <span className="num-readout font-semibold text-foreground">
                    {topDriverLabels.join(', ')}
                  </span>
                </p>
              ) : null}
              <div className="rounded-md border border-border bg-card p-4">
                <TornadoChart data={tornado} />
              </div>
            </div>
          ) : loading ? (
            <p className="text-xs text-muted-foreground" aria-live="polite">
              Running the numbers…
            </p>
          ) : null}
        </>
      )}
    </main>
  );
}
