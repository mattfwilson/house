'use client';
// ComparisonTable — the flagship cockpit surface (D-03): the ranked-by-FI-date comparison table that
// IS the landing view. It renders the `recompareAction` / `toCompareDTO` rows IN THE EXACT ORDER THE
// CORE RETURNS THEM (the keep-renting baseline is row 0; a buy that beats renting sorts above one that
// delays; the unreached "don't buy" rows sort last — FI-06). It NEVER re-sorts client-side: the ranking
// is core logic, not a view concern. Selecting a row expands it inline (D-03) via the `renderExpanded`
// slot; "Add scenario" opens the inline editor row (D-15) via `addingEditor`.
//
// Bank affordability appears ONLY as the amber "gap" caution beneath the table (D-06) — never as
// headroom, never as a target, never success-green. There is no float cast here (formatting goes
// through `lib/format.ts`).
import { Fragment, type ReactNode } from 'react';
import { Plus } from 'lucide-react';
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
  TableCell,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { formatUSD } from '@/lib/format';
import type { CompareRowDTO, GapDTO } from '@/lib/dto/scenario';
import { ScenarioRow } from './ScenarioRow';

/** The sentinel expand-key for the baseline row (it has no saved scenario id behind it). */
export const BASELINE_KEY = '__baseline__';

/** A ranked row paired with the saved scenario id behind it (null for the baseline / unsaved). */
export interface RankedScenarioRow {
  readonly row: CompareRowDTO;
  /** The saved scenario id this buy row maps to (matched by label upstream); null for the baseline. */
  readonly scenarioId: string | null;
}

/** The expand-key for a ranked row (the scenario id, or the baseline sentinel). */
export function rowKey(r: RankedScenarioRow): string {
  return r.scenarioId ?? BASELINE_KEY;
}

export interface ComparisonTableProps {
  readonly rows: readonly RankedScenarioRow[];
  /** The bank-vs-true gap (D-06) — rendered as the amber caution only when the bank exceeds the FI plan. */
  readonly gap: GapDTO | null;
  /** The currently inline-expanded row key (D-03), or null. */
  readonly expandedKey: string | null;
  readonly onToggleRow: (key: string) => void;
  /** Render the expanded panel for a row (the instruments + trajectory chart, or the inline editor). */
  readonly renderExpanded: (r: RankedScenarioRow) => ReactNode;
  readonly onAddScenario: () => void;
  /** When non-null, the inline add-editor row content (D-15) is rendered at the foot of the table. */
  readonly addingEditor: ReactNode | null;
}

export function ComparisonTable({
  rows,
  gap,
  expandedKey,
  onToggleRow,
  renderExpanded,
  onAddScenario,
  addingEditor,
}: ComparisonTableProps) {
  // "The baseline wins #1" (D-05): no buy row beats renting (none has a negative — earlier — delta).
  const buyRows = rows.filter((r) => !r.row.isBaseline);
  const baselineWins =
    buyRows.length > 0 &&
    !buyRows.some((r) => r.row.fiDeltaMonths !== null && r.row.fiDeltaMonths < 0);

  // The amber bank-gap caution (D-06) — shown ONLY when a bank would approve MORE than the FI plan.
  const showGap = gap !== null && gap.verdict === 'bankExceedsTrue';

  return (
    <div className="flex flex-col gap-3">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Scenario</TableHead>
            <TableHead className="text-right">FI-date delta vs renting</TableHead>
            <TableHead className="text-right">FI date</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => {
            const key = rowKey(r);
            const selected = expandedKey === key;
            return (
              <Fragment key={key}>
                <ScenarioRow
                  row={r.row}
                  selected={selected}
                  baselineWins={baselineWins}
                  onToggle={() => onToggleRow(key)}
                />
                {selected ? (
                  <TableRow className="bg-background hover:bg-background">
                    <TableCell colSpan={3} className="p-0">
                      {renderExpanded(r)}
                    </TableCell>
                  </TableRow>
                ) : null}
              </Fragment>
            );
          })}

          {addingEditor !== null ? (
            <TableRow className="bg-background hover:bg-background">
              <TableCell colSpan={3} className="p-0">
                {addingEditor}
              </TableCell>
            </TableRow>
          ) : null}
        </TableBody>
      </Table>

      <div className="flex items-center justify-between gap-3">
        <Button type="button" variant="outline" size="sm" onClick={onAddScenario}>
          <Plus className="size-4" aria-hidden="true" />
          Add scenario
        </Button>
      </div>

      {showGap ? (
        <p className="text-xs leading-snug text-[#B45309]" role="note">
          A bank would approve ~{formatUSD(gap.signedGap)} more than your FI plan can absorb.
        </p>
      ) : null}
    </div>
  );
}
