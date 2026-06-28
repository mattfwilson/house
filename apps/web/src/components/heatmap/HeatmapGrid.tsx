'use client';
// HeatmapGrid — the towns×metrics table-heatmap (D-13). A pure CSS grid (NO Recharts / NO visx — the
// 05-UI-SPEC renderer-agnostic contract, D-13 defers visx) of one row per town × one column per
// contributing metric, plus a trailing affordability (bucket/composite) summary column and a leading
// town-name column carrying the neutral MA-flag chips. Towns are grouped by bucket (Realistic →
// Stretch → Fantasy → no-data) via a STABLE sort that preserves the core's order within each tier —
// no numeric re-derivation of any score (the bucket/composite/intensity values are all DTO outputs).
//
// Every encoding value (bucket hue, composite intensity, the per-metric explainable breakdown shown in
// each cell's tooltip) is a core output carried through `ScoreboardDTO`. This component performs ZERO
// bucketing/composite math and holds no budget-vs-price comparison (D-12 two-channel separation).
import { useMemo } from 'react';
import type { CSSProperties } from 'react';
import type { Bucket, MaFlag } from '@house/core';
import { TooltipProvider, Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { HeatmapCell, BUCKET_LABEL } from './HeatmapCell';
import type { ScoreboardDTO, TownScoreDTO, MetricContributionDTO } from '@/lib/dto/town';

/** Friendly column headers for the core metric keys (millRate / medianPrice / commute / school / amenities). */
const METRIC_LABEL: Record<string, string> = {
  millRate: 'Mill rate',
  medianPrice: 'Median price',
  commute: 'Commute',
  school: 'Schools',
  amenities: 'Amenities',
};

/** The neutral/informational MA-flag chips (05-UI-SPEC — verbatim labels + expandable bodies). */
const MA_FLAG: Record<MaFlag, { readonly label: string; readonly body: string }> = {
  prop25: {
    label: 'Prop 2½',
    body: "Prop 2½ caps the town's total levy, not your individual tax bill — your assessment can still rise.",
  },
  betterment: {
    label: 'Betterment',
    body: 'This town may impose betterment assessments (special charges for public improvements) on top of regular property tax.',
  },
  title5: {
    label: 'Title 5 septic',
    body: 'Properties on septic must meet Title 5 at transfer; failed systems can require a costly replacement.',
  },
  '40b': {
    label: '40B',
    body: 'Chapter 40B affordable-housing developments may be present; review deed restrictions and any income/resale limits.',
  },
};

/** Bucket sort rank — Realistic first, no-data last. Stable sort keeps core order within a tier. */
const BUCKET_RANK: Record<Bucket, number> = { realistic: 0, stretch: 1, fantasy: 2 };
function rankOf(bucket: Bucket | null): number {
  return bucket === null ? 3 : BUCKET_RANK[bucket];
}

function directionCopy(direction: MetricContributionDTO['direction']): string {
  return direction === 'higherBetter' ? 'higher is better' : 'lower is better';
}

/** The explainable per-metric breakdown the cell tooltip renders verbatim (05-UI-SPEC criterion 3). */
function MetricTooltip({ metric }: { readonly metric: MetricContributionDTO }) {
  const name = METRIC_LABEL[metric.metric] ?? metric.metric;
  if (metric.missing) {
    return (
      <div className="flex flex-col gap-1 text-xs">
        <span className="font-semibold">{name} — No data</span>
        <span>
          This metric is missing for this town and was excluded from the score (not counted as zero).
        </span>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-0.5 text-xs">
      <span className="font-semibold">{name}</span>
      <TooltipRow label="Raw" value={metric.rawValue} />
      <TooltipRow label="Normalized" value={metric.normalizedValue} />
      <TooltipRow label="Direction" value={directionCopy(metric.direction)} />
      <TooltipRow label="Weight" value={metric.weight} />
      <TooltipRow label="Contribution" value={metric.weightedContribution} />
    </div>
  );
}

function TooltipRow({ label, value }: { readonly label: string; readonly value: string | null }) {
  return (
    <span className="flex justify-between gap-3">
      <span className="opacity-70">{label}</span>
      <span className="num-readout">{value ?? '—'}</span>
    </span>
  );
}

/** The affordability summary cell tooltip — the bucket meaning + the normalized composite scalar. */
function CompositeTooltip({ town }: { readonly town: TownScoreDTO }) {
  return (
    <div className="flex flex-col gap-1 text-xs">
      <span className="font-semibold">
        Affordability — {town.bucket === null ? 'No data' : BUCKET_LABEL[town.bucket]}
      </span>
      <TooltipRow label="Composite" value={town.composite} />
      <span className="opacity-80">
        {town.bucket === null
          ? "A contributing metric (median price) is missing, so this town can't be bucketed."
          : BUCKET_MEANING[town.bucket]}
      </span>
    </div>
  );
}

/** Anti-funnel bucket meanings (05-UI-SPEC) — honest disclosures, never a "buy this town" nudge. */
const BUCKET_MEANING: Record<Bucket, string> = {
  realistic: 'Median price is at or below your budget — within reach.',
  stretch: 'Median price is above your budget but within the stretch ceiling — above comfort.',
  fantasy: 'Median price is beyond the stretch ceiling — out of reach.',
};

export interface HeatmapGridProps {
  readonly scoreboard: ScoreboardDTO;
}

export function HeatmapGrid({ scoreboard }: HeatmapGridProps) {
  // Metric columns come from the first town (every town shares the same metric order from the core).
  const metricKeys = useMemo(
    () => scoreboard.towns[0]?.metrics.map((m) => m.metric) ?? [],
    [scoreboard],
  );

  // Group by bucket (stable — preserves the core's within-tier order). No numeric composite compare.
  const towns = useMemo(
    () => [...scoreboard.towns].sort((a, b) => rankOf(a.bucket) - rankOf(b.bucket)),
    [scoreboard],
  );

  // Dense matrix: town-name column (auto) + a fixed 2.75rem cell per metric + an auto summary column.
  const gridStyle: CSSProperties = {
    gridTemplateColumns: `minmax(8rem, auto) repeat(${metricKeys.length}, 2.75rem) minmax(6rem, auto)`,
  };

  return (
    <TooltipProvider delay={120}>
      <div className="overflow-x-auto">
        <div className="grid gap-1" style={gridStyle}>
          {/* ── Header row ─────────────────────────────────────────────── */}
          <div className="flex items-end px-1 pb-1 text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
            Town
          </div>
          {metricKeys.map((key) => (
            <div
              key={key}
              className="flex items-end justify-center pb-1 text-center text-[11px] font-semibold text-muted-foreground"
            >
              {METRIC_LABEL[key] ?? key}
            </div>
          ))}
          <div className="flex items-end px-1 pb-1 text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
            Affordability
          </div>

          {/* ── Town rows ──────────────────────────────────────────────── */}
          {towns.map((town) => (
            <TownRow key={town.town} town={town} metricKeys={metricKeys} />
          ))}
        </div>
      </div>
    </TooltipProvider>
  );
}

function TownRow({
  town,
  metricKeys,
}: {
  readonly town: TownScoreDTO;
  readonly metricKeys: readonly string[];
}) {
  const byKey = new Map(town.metrics.map((m) => [m.metric, m]));
  return (
    <>
      {/* Town name + neutral MA-flag chips. */}
      <div className="flex flex-col gap-1 px-1 py-1">
        <span className="text-sm font-semibold text-foreground">{town.town}</span>
        {town.flags.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {town.flags.map((flag) => (
              <Tooltip key={flag}>
                <TooltipTrigger
                  type="button"
                  className="cursor-default outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label={`${MA_FLAG[flag].label} — Massachusetts disclosure`}
                >
                  <Badge variant="secondary" className="text-[10px]">
                    {MA_FLAG[flag].label}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">{MA_FLAG[flag].body}</TooltipContent>
              </Tooltip>
            ))}
          </div>
        ) : null}
      </div>

      {/* One heatmap cell per metric — hue = bucket, intensity = this metric's normalized scalar. */}
      {metricKeys.map((key) => {
        const metric = byKey.get(key);
        const missing = metric?.missing ?? true;
        const intensity = metric && !metric.missing ? metric.normalizedValue : null;
        const name = METRIC_LABEL[key] ?? key;
        return (
          <HeatmapCell
            key={key}
            bucket={town.bucket}
            intensity={intensity}
            missing={missing}
            ariaLabel={
              missing
                ? `${town.town} — ${name}: no data`
                : `${town.town} — ${name}: ${intensity ?? ''}`
            }
            tooltip={
              metric ? (
                <MetricTooltip metric={metric} />
              ) : (
                <span className="text-xs">No data for {name}.</span>
              )
            }
          />
        );
      })}

      {/* Affordability summary — bucket hue, intensity = the town composite, label = bucket name. */}
      <HeatmapCell
        bucket={town.bucket}
        intensity={town.composite}
        missing={town.bucket === null}
        label={town.bucket === null ? 'No data' : BUCKET_LABEL[town.bucket]}
        ariaLabel={`${town.town} — affordability ${
          town.bucket === null ? 'no data' : BUCKET_LABEL[town.bucket]
        }`}
        tooltip={<CompositeTooltip town={town} />}
      />
    </>
  );
}
