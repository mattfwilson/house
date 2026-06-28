'use client';
// HeatmapCell — one cell of the towns×metrics table-heatmap (D-13 / 05-UI-SPEC Heatmap Encoding
// Contract). It renders the LOCKED bucket palette as the categorical hue (Realistic teal / Stretch
// amber / Fantasy slate) and the normalized [0,1] composite scalar as the sequential lightness
// intensity within that hue. A data-less cell (missing metric OR null scalar) draws the explicit
// hatched-gray "no data" marker — NEVER a silent 0/blank/imputed value (05-UI-SPEC Missing-data).
//
// NO bucketing / composite math lives here: `bucket` and `intensity` are core outputs handed down
// through the DTO. The intensity drives the hue-fill via a CSS custom property, so the decimal STRING
// is consumed by CSS directly and NO `Number()`/float cast enters this file — the money→float edge
// stays confined to components/charts/** + lib/format.ts (the 07-01 eslint guard).
import type { CSSProperties, ReactNode } from 'react';
import type { Bucket } from '@house/core';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

/** The LOCKED 05-UI-SPEC bucket palette (verbatim hex) — the primary categorical encoding. */
const BUCKET_HUE: Record<Bucket, string> = {
  realistic: '#0F766E', // teal — "within reach" (NOT success-green, NOT "you should buy")
  stretch: '#B45309', // amber — honest "above comfort" caution
  fantasy: '#64748B', // slate — out of reach, muted/de-emphasized (never red-as-error)
};

/** The explicit "no data" marker hue (05-UI-SPEC) — rendered as a hatch, never a silent fill. */
const NO_DATA_HUE = '#94A3B8';

/** The verbatim bucket labels (05-UI-SPEC — fixed copy). */
export const BUCKET_LABEL: Record<Bucket, string> = {
  realistic: 'Realistic',
  stretch: 'Stretch',
  fantasy: 'Fantasy',
};

export interface HeatmapCellProps {
  /** The town's budget-overlay bucket (categorical hue); `null` falls back to the neutral no-data hue. */
  readonly bucket: Bucket | null;
  /** The normalized [0,1] composite/metric scalar as a decimal STRING (CSS consumes it — no Number()). */
  readonly intensity: string | null;
  /** Explicit no-data marker — when true (or `intensity` is null) the hatched "no data" cell is drawn. */
  readonly missing: boolean;
  /** Accessible description of the cell (the metric/town + state). */
  readonly ariaLabel: string;
  /** Optional short readout rendered inside the cell (e.g. the bucket label for the summary column). */
  readonly label?: string;
  /** The explainable breakdown rendered in the tooltip (the 05-UI-SPEC per-metric contract). */
  readonly tooltip: ReactNode;
}

export function HeatmapCell({ bucket, intensity, missing, ariaLabel, label, tooltip }: HeatmapCellProps) {
  const noData = missing || intensity === null;
  const hue = bucket === null ? NO_DATA_HUE : BUCKET_HUE[bucket];

  // The hue-fill layer: a data-less cell is the explicit 45° hatch (never a silent block); a cell with
  // data fills the bucket hue at an opacity scaled by the normalized scalar (darker/stronger = better),
  // monotonic + continuous so towns are rankable by shade within a bucket (05-UI-SPEC Score intensity).
  const fillStyle: CSSProperties = noData
    ? {
        backgroundImage: `repeating-linear-gradient(45deg, ${NO_DATA_HUE} 0 2px, transparent 2px 7px)`,
        opacity: 0.55,
      }
    : { backgroundColor: hue, opacity: 'calc(0.18 + 0.82 * var(--cell-intensity))' };

  // The normalized scalar crosses to CSS as a custom property (a plain decimal string) — never Number().
  const cellVars = noData ? undefined : ({ '--cell-intensity': intensity } as CSSProperties);

  return (
    <Tooltip>
      <TooltipTrigger
        type="button"
        aria-label={ariaLabel}
        style={cellVars}
        className="relative grid h-11 min-w-11 cursor-default place-items-center overflow-hidden rounded-sm border border-border/40 outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span aria-hidden="true" className="absolute inset-0" style={fillStyle} />
        {label ? (
          <span className="num-readout relative z-10 px-1 text-[11px] font-semibold text-foreground">
            {label}
          </span>
        ) : null}
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">{tooltip}</TooltipContent>
    </Tooltip>
  );
}
