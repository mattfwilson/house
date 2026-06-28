'use client';
// TrajectoryChart — the D-07 hero chart: net-worth trajectory of THIS scenario (buy) vs the
// rent-and-invest baseline, with the FI-threshold line and the FI-date crossover markers on both
// paths. The DIVERGENCE between the two lines IS the cost of the house (07-UI-SPEC §Hero chart).
//
// THE SINGLE FLOAT RE-ENTRY SITE (RESEARCH Pitfall 5): every dollar arrived from the core as a
// canonical decimal STRING (`Money.toDecimalString()` through `toTrajectoryDTO`). The lossy
// `Number(decimalString)` conversion happens HERE and ONLY here, at the very last step of building
// the Recharts data, after ALL math is done in the core. The eslint money→float guard confines
// `Number(` to `components/charts/**` + `lib/format.ts`; this is one of those two sanctioned edges.
// Nothing converted here ever re-enters a calculation — it feeds the chart geometry only.
//
// Color honesty (anti-funnel): the buy line is amber (#B45309 — the honest "this delays FI" tone),
// the rent baseline is neutral slate, the FI threshold a muted dashed reference. NO success-green.
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { TrajectoryDTO } from '@/lib/dto/trajectory';

/** Compact USD axis/tooltip formatter (chart edge — `Number` is sanctioned in components/charts/**). */
const USD_COMPACT = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  notation: 'compact',
  maximumFractionDigits: 1,
});

const USD_FULL = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

export interface TrajectoryChartProps {
  /** The FI-trajectory DTO (decimal-string dollars) — converted to floats ONCE, here. */
  readonly data: TrajectoryDTO;
}

export function TrajectoryChart({ data }: TrajectoryChartProps) {
  // THE single money→float conversion (Pitfall 5): decimal strings → chart numbers, last step.
  const points = data.points.map((point) => ({
    month: point.month,
    buy: Number(point.buyNetWorth),
    rent: Number(point.rentNetWorth),
  }));
  const fiThreshold = Number(data.fiThreshold);

  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={points} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
        <CartesianGrid stroke="#334155" strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="month"
          tickFormatter={(month: number) => `${Math.round(month / 12)}y`}
          stroke="#94A3B8"
          fontSize={12}
        />
        <YAxis
          tickFormatter={(value: number) => USD_COMPACT.format(value)}
          stroke="#94A3B8"
          fontSize={12}
          width={64}
        />
        <Tooltip
          formatter={(value, name) => [
            USD_FULL.format(Number(value)),
            name === 'buy' ? 'Buy' : 'Rent & invest',
          ]}
          labelFormatter={(label) => `~${Math.round(Number(label) / 12)} yr`}
          contentStyle={{ background: '#1E293B', border: '1px solid #334155', color: '#F8FAFC' }}
        />
        {/* Rent baseline — neutral slate (the reference path). */}
        <Line type="monotone" dataKey="rent" stroke="#94A3B8" dot={false} strokeWidth={2} />
        {/* This scenario (buy) — amber; the gap below the baseline IS the cost of the house. */}
        <Line type="monotone" dataKey="buy" stroke="#B45309" dot={false} strokeWidth={2} />
        {/* FI-threshold line (D-07) — muted dashed reference, never an accent/success token. */}
        <ReferenceLine y={fiThreshold} stroke="#64748B" strokeDasharray="4 4" />
        {/* FI-date crossover markers on each reached path. */}
        {data.buyFiMonth !== null ? (
          <ReferenceDot x={data.buyFiMonth} y={fiThreshold} r={4} fill="#B45309" stroke="none" />
        ) : null}
        {data.rentFiMonth !== null ? (
          <ReferenceDot x={data.rentFiMonth} y={fiThreshold} r={4} fill="#94A3B8" stroke="none" />
        ) : null}
      </LineChart>
    </ResponsiveContainer>
  );
}
