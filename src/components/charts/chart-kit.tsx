"use client";

import type { TooltipContentProps } from "recharts";

/** Categorical palette slots defined as CSS variables in globals.css (light + dark steps). */
export const SERIES = ["var(--series-1)", "var(--series-2)", "var(--series-3)", "var(--series-4)", "var(--series-5)", "var(--series-6)", "var(--series-7)", "var(--series-8)"];
export const INCOME_COLOR = "var(--series-3)";
export const EXPENSE_COLOR = "var(--series-2)";
export const MUTED_COLOR = "var(--chart-muted)";
export const GRID_COLOR = "var(--chart-grid)";
export const AXIS_TICK = { fill: "var(--muted-foreground)", fontSize: 11 } as const;

export type Formatter = (minor: number) => string;

/** Tooltip that keeps text in text tokens and shows a colour swatch for identity. */
export function ChartTooltip({ active, payload, label, format, labelFormat }: Partial<TooltipContentProps<number, string>> & { format: Formatter; labelFormat?: (l: unknown) => string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md">
      <div className="mb-1 font-medium">{labelFormat ? labelFormat(label) : String(label ?? "")}</div>
      {payload.map((p) => (
        <div key={String(p.dataKey)} className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <span className="size-2 rounded-sm" style={{ background: p.color }} aria-hidden />
            {p.name}
          </span>
          <span className="tabular-nums">{p.value === null || p.value === undefined ? "—" : format(Number(p.value))}</span>
        </div>
      ))}
    </div>
  );
}

export function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground" aria-label="Legend">
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm" style={{ background: i.color }} aria-hidden />
          {i.label}
        </li>
      ))}
    </ul>
  );
}
