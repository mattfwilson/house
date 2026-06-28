'use client';
// TornadoChart — the FI-05 sensitivity instrument: a horizontal Recharts bar chart of each driver's
// FI-date SWING (in months), rows already ranked DESC by the core (`tornado`). The top-3 drivers are
// emphasized in amber (the honest "this moves your FI date" tone); the remaining drivers are muted
// slate. NO success-green appears anywhere (anti-funnel — a bigger swing is a bigger risk, not a win).
//
// THE SANCTIONED FLOAT RE-ENTRY SITE (RESEARCH Pitfall 5 / 07-01 eslint rule): `swingMonths` arrives
// from the core as a FINITE number already (the DTO asserts finiteness — never Infinity, FI-05/L3).
// The `Number()` coercion of the chart bar data lives HERE and ONLY here — one of the two sanctioned
// money→float edges (components/charts/** + lib/format.ts). Nothing converted here re-enters a
// calculation; it feeds the bar geometry only.
import {
  Bar,
  BarChart,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { TornadoDTO } from '@/lib/dto/sensitivity';
import type { TornadoDriver } from '@house/core';

/** Friendly driver labels (the core emits plain literals; Phase 7 owns the wording — UI-SPEC). */
export const DRIVER_LABEL: Record<TornadoDriver, string> = {
  return: 'Real return',
  inflation: 'Inflation',
  appreciation: 'Home appreciation',
  maintenance: 'Maintenance',
  tax: 'Property tax',
  swr: 'Withdrawal rate',
};

const AMBER = '#B45309'; // top-driver emphasis (delay tone)
const SLATE = '#64748B'; // muted non-top drivers (never success-green)

export interface TornadoChartProps {
  /** The ranked tornado DTO (rows DESC by swing; finite swings guaranteed by the DTO). */
  readonly data: TornadoDTO;
}

export function TornadoChart({ data }: TornadoChartProps) {
  const topDrivers = new Set<TornadoDriver>(data.topDrivers);

  // THE single money/quantity→float coercion (Pitfall 5): finite swingMonths → chart numbers, here.
  const bars = data.rows.map((row) => ({
    driver: DRIVER_LABEL[row.driver] ?? row.driver,
    swing: Number(row.swingMonths),
    top: topDrivers.has(row.driver),
  }));

  const height = 64 + bars.length * 40;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart layout="vertical" data={bars} margin={{ top: 8, right: 48, bottom: 8, left: 8 }}>
        <XAxis
          type="number"
          stroke="#94A3B8"
          fontSize={12}
          tickFormatter={(value: number) => `${value} mo`}
        />
        <YAxis
          type="category"
          dataKey="driver"
          stroke="#94A3B8"
          fontSize={12}
          width={132}
          tickLine={false}
        />
        <Tooltip
          cursor={{ fill: '#1E293B' }}
          formatter={(value) => [`${Number(value)} mo FI-date swing`, 'Swing']}
          contentStyle={{ background: '#1E293B', border: '1px solid #334155', color: '#F8FAFC' }}
        />
        <Bar dataKey="swing" radius={[0, 3, 3, 0]} isAnimationActive={false}>
          {bars.map((bar) => (
            <Cell key={bar.driver} fill={bar.top ? AMBER : SLATE} />
          ))}
          <LabelList
            dataKey="swing"
            position="right"
            formatter={(value) => `${value} mo`}
            fill="#94A3B8"
            fontSize={11}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
