"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { format, parseISO } from "date-fns";
import { AXIS_TICK, ChartTooltip, GRID_COLOR, SERIES } from "./chart-kit";

export function SignupsChart({ data }: { data: { day: string; signups: number }[] }) {
  const label = (d: unknown) => format(parseISO(String(d)), "d MMM");
  return (
    <div className="h-48 w-full">
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke={GRID_COLOR} />
          <XAxis dataKey="day" tickFormatter={label} tick={AXIS_TICK} axisLine={false} tickLine={false} interval={6} />
          <YAxis allowDecimals={false} tick={AXIS_TICK} axisLine={false} tickLine={false} width={28} />
          <Tooltip cursor={{ fill: "var(--chart-muted)", opacity: 0.35 }} content={<ChartTooltip format={(n) => String(n)} labelFormat={label} />} />
          <Bar dataKey="signups" name="Signups" fill={SERIES[0]} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
