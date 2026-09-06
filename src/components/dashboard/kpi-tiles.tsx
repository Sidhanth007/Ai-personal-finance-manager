import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type Kpi = { label: string; value: string; delta?: { text: string; good: boolean | null } };

export function KpiTiles({ items }: { items: Kpi[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {items.map((k, i) => (
        <Card key={k.label} size="sm" className="page-enter" style={{ animationDelay: `${i * 60}ms` }}>
          <CardContent>
            <div className="text-sm text-muted-foreground">{k.label}</div>
            <div className="mt-1 truncate text-xl font-semibold">{k.value}</div>
            {k.delta && (
              <div className={cn("mt-1 text-xs", k.delta.good === null ? "text-muted-foreground" : k.delta.good ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400")}>
                {k.delta.text}
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function deltaText(current: number, previous: number, upIsGood: boolean): Kpi["delta"] {
  if (previous === 0) return { text: "No data last month", good: null };
  const change = ((current - previous) / previous) * 100;
  const sign = change >= 0 ? "+" : "";
  return { text: `${sign}${change.toFixed(0)}% vs last month`, good: change === 0 ? null : change > 0 === upIsGood };
}
