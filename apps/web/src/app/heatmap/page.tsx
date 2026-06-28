'use client';
// The town affordability heatmap route (D-13 / SC-3). It scores the seeded greater-Boston town table
// against an entered budget + commute anchor and renders the CSS-grid table-heatmap over the LOCKED
// 05-UI-SPEC encoding. It holds ZERO scoring logic: it validates nothing and computes nothing — it
// hands the active assumptions + budget (a canonical decimal STRING — never a bare number) + anchor to
// `scoreTownsAction`, which validates at the core Zod boundary and runs `scoreTowns` once.
//
// CONTEXT INHERITANCE (D-02): the bucketing is driven by the SHARED working-set assumptions the
// cockpit/rail own (the teal "Budget stretch" knob lives there) — this route reads that working set
// and falls back to the engine defaults so the heatmap is also usable standalone. The persistent
// assumptions rail (shared layout, 07-07) sits beside this result. The budget dollar amount is the
// teal budget-input affordance (05-UI-SPEC accent), entered here.
import { useEffect, useState } from 'react';
import type { AssumptionSet, CommuteAnchor } from '@house/core';
import { useWorkingSet } from '@/store/working-set';
import { scoreTownsAction } from '@/app/actions/towns';
import { defaultAssumptionsAction } from '@/app/actions/cockpit';
import type { ScoreboardDTO } from '@/lib/dto/town';
import { HeatmapGrid } from '@/components/heatmap/HeatmapGrid';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

/** The locked commute anchors (05-UI-SPEC "commute to anchor" — no hardcoded default town). */
const ANCHORS: ReadonlyArray<{ value: CommuteAnchor; label: string }> = [
  { value: 'downtownBoston', label: 'Downtown Boston' },
  { value: 'kendallCambridge', label: 'Kendall / Cambridge' },
  { value: 'route128Burlington', label: 'Route 128 / Burlington' },
];

/** Verbatim 05-UI-SPEC heatmap error copy. */
const ERROR_COPY =
  'Couldn’t load the town data. The MA town table failed to load — retry, and if it persists ' +
  'the seed data may be missing or malformed.';

/** The four-state legend swatches (05-UI-SPEC — must cover all four palette states incl. no-data). */
const LEGEND: ReadonlyArray<{ label: string; swatch: string; hatched?: boolean }> = [
  { label: 'Realistic', swatch: '#0F766E' },
  { label: 'Stretch', swatch: '#B45309' },
  { label: 'Fantasy', swatch: '#64748B' },
  { label: 'No data', swatch: '#94A3B8', hatched: true },
];

export default function HeatmapRoute() {
  const workingSet = useWorkingSet((s) => s.assumptions);
  const [defaults, setDefaults] = useState<AssumptionSet | null>(null);
  const [budget, setBudget] = useState('');
  const [anchor, setAnchor] = useState<CommuteAnchor>('downtownBoston');
  const [scoreboard, setScoreboard] = useState<ScoreboardDTO | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // The bucketing assumptions: the shared working set (inherited cockpit context, D-02), else the
  // engine defaults so the heatmap is usable before any scenario is opened.
  const assumptions = workingSet ?? defaults;
  useEffect(() => {
    if (workingSet === null && defaults === null) {
      void defaultAssumptionsAction().then(setDefaults);
    }
  }, [workingSet, defaults]);

  // Live recompute on budget / anchor / assumption edits (debounced ~300ms, D-08 — no "Run" trigger).
  // The budget crosses as the raw decimal string; the action's `Money.of` validates it (D-16). On a
  // transient failure (e.g. a half-typed budget) we keep the last good board rather than blanking it.
  useEffect(() => {
    if (assumptions === null || budget.trim() === '') {
      setScoreboard(null);
      return;
    }
    let active = true;
    const handle = setTimeout(() => {
      setLoading(true);
      void scoreTownsAction({ assumptions, budget: budget.trim(), anchor })
        .then((board) => {
          if (!active) return;
          setScoreboard(board);
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
  }, [assumptions, budget, anchor]);

  const hasBudget = budget.trim() !== '';

  return (
    <main className="flex flex-col gap-4 p-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold">Town heatmap</h1>
        <p className="text-sm text-muted-foreground">
          Which greater-Boston towns are realistic for a given budget — scored across mill rate, median
          price, commute, schools, and amenities.
        </p>
      </div>

      {/* Budget (teal active affordance) + commute anchor — the bucket inputs. */}
      <div className="flex flex-wrap items-end gap-4">
        <div className="grid gap-1.5">
          <Label htmlFor="heatmap-budget" className="text-xs font-semibold">
            Budget
          </Label>
          <Input
            id="heatmap-budget"
            type="text"
            inputMode="decimal"
            placeholder="e.g. 750000"
            value={budget}
            aria-label="Budget"
            onChange={(event) => setBudget(event.target.value)}
            className="num-readout w-40 border-primary focus-visible:ring-primary/50"
          />
        </div>
        <div className="grid gap-1.5">
          <span className="text-xs font-semibold">Commute to anchor</span>
          <div className="flex gap-1">
            {ANCHORS.map((option) => (
              <Button
                key={option.value}
                type="button"
                size="sm"
                variant={anchor === option.value ? 'default' : 'outline'}
                onClick={() => setAnchor(option.value)}
                aria-pressed={anchor === option.value}
              >
                {option.label}
              </Button>
            ))}
          </div>
        </div>
        {loading ? (
          <span className="pb-2 text-[11px] text-muted-foreground" aria-live="polite">
            scoring…
          </span>
        ) : null}
      </div>

      {/* Legend — all four palette states (incl. no-data). */}
      <div className="flex flex-wrap items-center gap-4">
        {LEGEND.map((item) => (
          <span key={item.label} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span
              aria-hidden="true"
              className="inline-block size-3 rounded-sm border border-border/40"
              style={
                item.hatched
                  ? {
                      backgroundImage: `repeating-linear-gradient(45deg, ${item.swatch} 0 2px, transparent 2px 5px)`,
                    }
                  : { backgroundColor: item.swatch }
              }
            />
            {item.label}
          </span>
        ))}
        <span className="text-[11px] text-muted-foreground">Darker = stronger score within a tier</span>
      </div>

      {error ? (
        <p role="alert" className="text-xs leading-snug text-destructive">
          {error}
        </p>
      ) : null}

      {/* Result / empty state (05-UI-SPEC empty copy). */}
      {!hasBudget ? (
        <div className="flex max-w-prose flex-col gap-1 rounded-md border border-border bg-card p-6">
          <h2 className="text-sm font-semibold">Enter a budget to see which towns are realistic</h2>
          <p className="text-sm text-muted-foreground">
            Set a budget above. Towns will sort into Realistic, Stretch, and Fantasy, and the heatmap
            will show how each town scores.
          </p>
        </div>
      ) : scoreboard ? (
        <HeatmapGrid scoreboard={scoreboard} />
      ) : loading ? (
        <p className="text-xs text-muted-foreground">Scoring towns…</p>
      ) : null}
    </main>
  );
}
