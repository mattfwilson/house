'use client';
// ExpandedScenario — the inline panel shown when a comparison row is selected (D-03). For a BUY row
// it is the scenario's flight instruments: the Display-role hero FI-date delta (color-honest), the FI
// instruments (FI date, FI target net worth, net-worth-at-horizon for both paths, DTI ratios), and the
// D-07 trajectory-vs-baseline hero chart. For the pinned RENT baseline row it is the plain
// rent-and-invest reference (no buy chart — there is no house to project).
//
// Every dollar arrives from the core as a decimal STRING and is formatted through `lib/format.ts`
// (`formatUSD`). There is NO float cast here: the single money→float conversion lives in the chart
// (`components/charts/TrajectoryChart.tsx`). The trajectory + evaluate readouts come straight from the
// Server Actions (`fiTrajectoryAction` / `evaluateAction`) — no math in this component.
import { useEffect, useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import type { ScenarioInputs, AssumptionSet } from '@house/core';
import { Button } from '@/components/ui/button';
import { fiTrajectoryAction } from '@/app/actions/trajectory';
import { evaluateAction } from '@/app/actions/scenarios';
import { formatUSD, fiDeltaLabel } from '@/lib/format';
import type { CompareRowDTO } from '@/lib/dto/scenario';
import type { TrajectoryDTO } from '@/lib/dto/trajectory';
import type { EvaluateDTO } from '@/lib/dto/scenario';
import { TrajectoryChart } from '@/components/charts/TrajectoryChart';
import { TONE_CLASS, absoluteFiLabel } from './ScenarioRow';

/** UI-SPEC error-state copy for a failed Server Action (07-UI-SPEC §Microcopy). */
const ERROR_COPY =
  "Couldn't run the numbers. The calculation didn't complete — check your inputs and try again. " +
  'If it persists, the saved snapshot may be malformed.';

export interface ExpandedScenarioProps {
  readonly row: CompareRowDTO;
  /** The scenario's frozen inputs to project; null for the rent baseline (no buy chart). */
  readonly scenario: ScenarioInputs | null;
  /** The active household (opaque DTO validated at the action's Zod boundary). */
  readonly household: unknown;
  /** The shared working-set assumptions (D-09). */
  readonly assumptions: AssumptionSet;
  readonly asOf: string;
  readonly onEdit?: (() => void) | undefined;
  readonly onDelete?: (() => void) | undefined;
}

/** A single labelled instrument readout (Geist Mono value, muted label). */
function Instrument({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="num-readout text-sm">{value}</span>
    </div>
  );
}

export function ExpandedScenario({
  row,
  scenario,
  household,
  assumptions,
  asOf,
  onEdit,
  onDelete,
}: ExpandedScenarioProps) {
  const [trajectory, setTrajectory] = useState<TrajectoryDTO | null>(null);
  const [evaluation, setEvaluation] = useState<EvaluateDTO | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (scenario === null) return; // baseline row — no buy projection to fetch
    let active = true;
    setLoading(true);
    setError(null);
    const payload = { asOf, household, assumptions, scenario };
    void Promise.all([fiTrajectoryAction(payload), evaluateAction(payload)])
      .then(([traj, evalu]) => {
        if (!active) return;
        setTrajectory(traj);
        setEvaluation(evalu);
      })
      .catch(() => {
        if (active) setError(ERROR_COPY);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [scenario, household, assumptions, asOf]);

  const delta = fiDeltaLabel(row.fiDeltaMonths);
  const lastPoint = trajectory?.points.at(-1) ?? null;

  return (
    <div className="flex flex-col gap-4 bg-secondary/20 p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          {row.isBaseline ? (
            <span className="text-[28px] font-semibold leading-tight num-readout">
              {absoluteFiLabel(row)}
            </span>
          ) : (
            <span className={`text-[28px] font-semibold leading-tight num-readout ${TONE_CLASS[delta.tone]}`}>
              {delta.text}
            </span>
          )}
          <span className="text-xs text-muted-foreground">
            {row.isBaseline
              ? 'Keep renting and invest the difference — the zero-point every buy is measured against.'
              : 'FI-date impact of buying this house vs renting and investing the difference.'}
          </span>
        </div>
        {scenario !== null && (onEdit || onDelete) ? (
          <div className="flex items-center gap-2">
            {onEdit ? (
              <Button type="button" variant="outline" size="sm" onClick={onEdit}>
                <Pencil className="size-4" aria-hidden="true" />
                Edit
              </Button>
            ) : null}
            {onDelete ? (
              <Button type="button" variant="ghost" size="sm" onClick={onDelete} aria-label="Delete scenario">
                <Trash2 className="size-4 text-destructive" aria-hidden="true" />
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>

      {scenario === null ? null : error ? (
        <p role="alert" className="text-xs leading-snug text-destructive">
          {error}
        </p>
      ) : loading ? (
        <p className="text-xs text-muted-foreground" aria-live="polite">
          Running the numbers…
        </p>
      ) : trajectory && evaluation ? (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Instrument label="FI date" value={absoluteFiLabel(row)} />
            <Instrument label="FI target net worth" value={formatUSD(trajectory.fiThreshold)} />
            <Instrument
              label="Buy net worth at horizon"
              value={lastPoint ? formatUSD(lastPoint.buyNetWorth) : '—'}
            />
            <Instrument
              label="Rent net worth at horizon"
              value={lastPoint ? formatUSD(lastPoint.rentNetWorth) : '—'}
            />
            <Instrument
              label="Front-end DTI"
              value={`${evaluation.frontEndRatio}${evaluation.frontEndPass ? '' : ' (over)'}`}
            />
            <Instrument
              label="Back-end DTI"
              value={`${evaluation.backEndRatio}${evaluation.backEndPass ? '' : ' (over)'}`}
            />
            <Instrument label="Savings-rate impact" value={evaluation.savingsRateImpact} />
            <Instrument label="DTI margin" value={evaluation.headroom} />
          </div>
          <TrajectoryChart data={trajectory} />
        </>
      ) : null}
    </div>
  );
}
