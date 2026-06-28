'use client';
// ScenarioRow — one row of the ranked cockpit comparison table (D-03/D-04). PRESENTATIONAL: it
// renders a single `CompareRowDTO` exactly as the core ranked it (the table never re-sorts — the
// order is core logic, FI-06). The hero per-row metric is the FI-date delta via `fiDeltaLabel`,
// rendered COLOR-HONEST (amber for a delay, neutral for earlier — NEVER success-green, the
// load-bearing anti-funnel rule, 07-UI-SPEC §Color). The keep-renting baseline row is pinned and
// visually distinct (a teal left-border + slate emphasis) but carries NO success styling — when it
// out-ranks every buy that ranking IS the "don't buy" signal (D-05), surfaced as the locked copy.
//
// There is NO `Number()` here: dollars/dates are already finished values from the DTO, and the only
// arithmetic is on the integer month COUNTS on the outcome (not money) to render an absolute FI date.
import { ChevronDown, ChevronRight } from 'lucide-react';
import { TableCell, TableRow } from '@/components/ui/table';
import { fiDeltaLabel, type FiDeltaTone } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { CompareRowDTO } from '@/lib/dto/scenario';

/** The locked anti-funnel copy when the rent baseline out-ranks every buy (D-05). */
export const BASELINE_WINS_COPY =
  'Renting and investing the difference reaches FI soonest — buying any of these delays it.';

/** The locked rent-baseline row label (07-UI-SPEC §Copywriting). */
export const RENT_BASELINE_LABEL = 'Rent & invest the difference';

/** Map the color-honest tone to its emphasis class — amber delay, neutral otherwise. NEVER green. */
const TONE_CLASS: Record<FiDeltaTone, string> = {
  delay: 'text-[#B45309]', // amber caution — buying pushes FI later (honest disclosure)
  earlier: 'text-foreground', // neutral — reaching FI earlier is NOT celebrated with success-green
  none: 'text-muted-foreground',
};

/**
 * An absolute FI-date label from the discriminated outcome (integer month COUNTS only — no money,
 * no `Number()`): a reached path → "FI in {Y} yr {M} mo"; an unreached path → the honest don't-buy
 * disclosure "FI not reached within horizon" (never a fabricated date).
 */
function absoluteFiLabel(row: CompareRowDTO): string {
  if (row.outcomeKind === 'reached' && row.fiMonth !== null) {
    const years = Math.floor(row.fiMonth / 12);
    const months = row.fiMonth % 12;
    return `FI in ${years} yr ${months} mo`;
  }
  return 'FI not reached within horizon';
}

export interface ScenarioRowProps {
  readonly row: CompareRowDTO;
  /** True when this row is the inline-expanded one (D-03). */
  readonly selected: boolean;
  /** True only for the baseline row AND only when it out-ranks every buy (renders the win copy). */
  readonly baselineWins: boolean;
  /** Toggle this row's inline expansion. */
  readonly onToggle: () => void;
}

export function ScenarioRow({ row, selected, baselineWins, onToggle }: ScenarioRowProps) {
  const delta = fiDeltaLabel(row.fiDeltaMonths);
  const isBaseline = row.isBaseline;

  return (
    <TableRow
      data-state={selected ? 'selected' : undefined}
      onClick={onToggle}
      className={cn(
        'cursor-pointer',
        // Pinned, visually distinct baseline — teal left-border + slate emphasis, NO success token.
        isBaseline && 'border-l-2 border-l-primary bg-secondary/40',
        selected && 'bg-secondary/60',
      )}
    >
      <TableCell className="align-top">
        <div className="flex items-start gap-2">
          <button
            type="button"
            aria-label={selected ? 'Collapse scenario' : 'Expand scenario'}
            aria-expanded={selected}
            onClick={(event) => {
              event.stopPropagation();
              onToggle();
            }}
            className="flex size-11 shrink-0 items-center justify-center -m-2.5 text-muted-foreground"
          >
            {selected ? (
              <ChevronDown className="size-4" aria-hidden="true" />
            ) : (
              <ChevronRight className="size-4" aria-hidden="true" />
            )}
          </button>
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-semibold">
              {isBaseline ? RENT_BASELINE_LABEL : row.label}
            </span>
            {isBaseline && baselineWins ? (
              <span className="max-w-xs text-xs leading-snug text-muted-foreground">
                {BASELINE_WINS_COPY}
              </span>
            ) : null}
          </div>
        </div>
      </TableCell>

      {/* Hero metric: the FI-date delta (buy rows) or the absolute reference date (baseline). */}
      <TableCell className="align-top text-right">
        {isBaseline ? (
          <span className="num-readout text-sm text-foreground">{absoluteFiLabel(row)}</span>
        ) : (
          <span className={cn('num-readout text-sm font-semibold', TONE_CLASS[delta.tone])}>
            {delta.text}
          </span>
        )}
      </TableCell>

      {/* Secondary readout: the absolute FI outcome (Geist Mono, tabular-nums). */}
      <TableCell className="align-top text-right">
        <span className="num-readout text-xs text-muted-foreground">{absoluteFiLabel(row)}</span>
      </TableCell>
    </TableRow>
  );
}
