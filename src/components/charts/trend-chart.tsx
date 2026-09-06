"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { format, parse } from "date-fns";
import { formatMoney } from "@/lib/format";
import { AXIS_TICK, ChartTooltip, EXPENSE_COLOR, GRID_COLOR, INCOME_COLOR, Legend } from "./chart-kit";

type Point = { month: string; income: number; expense: number };

export function TrendChart({ data, currency }: { data: Point[]; currency: string }) {
  const fmt = (n: number) => formatMoney(n, currency, { compact: true });
  const monthLabel = (m: unknown) => format(parse(String(m), "yyyy-MM", new Date()), "MMM yy");
  return (
    <div className="space-y-2">
      <Legend items={[{ label: "Income", color: INCOME_COLOR }, { label: "Expenses", color: EXPENSE_COLOR }]} />
      <div className="h-56 w-full">
        <ResponsiveContainer>
          <BarChart data={data} barGap={2} barCategoryGap="30%" margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke={GRID_COLOR} />
            <XAxis dataKey="month" tickFormatter={monthLabel} tick={AXIS_TICK} axisLine={false} tickLine={false} />
            <YAxis tickFormatter={fmt} tick={AXIS_TICK} axisLine={false} tickLine={false} width={56} />
            <Tooltip cursor={{ fill: "var(--chart-muted)", opacity: 0.35 }} content={<ChartTooltip format={(n) => formatMoney(n, currency)} labelFormat={monthLabel} />} />
            <Bar dataKey="income" name="Income" fill={INCOME_COLOR} radius={[4, 4, 0, 0]} />
            <Bar dataKey="expense" name="Expenses" fill={EXPENSE_COLOR} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
