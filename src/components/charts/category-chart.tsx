"use client";

import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatMoney } from "@/lib/format";
import { AXIS_TICK, ChartTooltip, SERIES } from "./chart-kit";

type Row = { name: string; amount: number; color: string | null; pct: number };

const MAX_BARS = 7;

/** Horizontal bars, largest first; beyond seven categories the rest fold into "Other". */
export function CategoryChart({ data, currency }: { data: Row[]; currency: string }) {
  const top = data.slice(0, MAX_BARS);
  const rest = data.slice(MAX_BARS);
  const rows = rest.length
    ? [...top, { name: "Other", amount: rest.reduce((s, r) => s + r.amount, 0), color: null, pct: rest.reduce((s, r) => s + r.pct, 0) }]
    : top;
  if (rows.length === 0) return <p className="py-8 text-center text-sm text-muted-foreground">No expenses this month.</p>;

  return (
    <div className="w-full" style={{ height: 32 * rows.length + 16 }}>
      <ResponsiveContainer>
        <BarChart data={rows} layout="vertical" margin={{ top: 0, right: 56, bottom: 0, left: 0 }} barCategoryGap={6}>
          <XAxis type="number" hide />
          <YAxis type="category" dataKey="name" width={110} tick={AXIS_TICK} axisLine={false} tickLine={false} />
          <Tooltip cursor={{ fill: "var(--chart-muted)", opacity: 0.35 }} content={<ChartTooltip format={(n) => formatMoney(n, currency)} />} />
          <Bar dataKey="amount" name="Spent" radius={[0, 4, 4, 0]} label={{ position: "right", fontSize: 11, fill: "var(--muted-foreground)", formatter: (v: unknown) => formatMoney(Number(v), currency, { compact: true }) }}>
            {rows.map((r, i) => (
              <Cell key={r.name} fill={r.name === "Other" ? "var(--chart-muted)" : r.color ?? SERIES[i % SERIES.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
