"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatMoney } from "@/lib/format";
import { AXIS_TICK, ChartTooltip, EXPENSE_COLOR, GRID_COLOR, Legend, MUTED_COLOR } from "./chart-kit";

type Point = { day: number; current: number | null; previous: number };

export function DailyChart({ data, currency }: { data: Point[]; currency: string }) {
  const fmt = (n: number) => formatMoney(n, currency, { compact: true });
  return (
    <div className="space-y-2">
      <Legend items={[{ label: "This month", color: EXPENSE_COLOR }, { label: "Last month", color: MUTED_COLOR }]} />
      <div className="h-56 w-full">
        <ResponsiveContainer>
          <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke={GRID_COLOR} />
            <XAxis dataKey="day" tick={AXIS_TICK} axisLine={false} tickLine={false} interval={4} />
            <YAxis tickFormatter={fmt} tick={AXIS_TICK} axisLine={false} tickLine={false} width={56} />
            <Tooltip content={<ChartTooltip format={(n) => formatMoney(n, currency)} labelFormat={(d) => `Day ${String(d)}`} />} />
            <Line type="monotone" dataKey="previous" name="Last month" stroke={MUTED_COLOR} strokeWidth={2} dot={false} strokeDasharray="4 3" isAnimationActive={false} />
            <Line type="monotone" dataKey="current" name="This month" stroke={EXPENSE_COLOR} strokeWidth={2} dot={false} connectNulls={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
