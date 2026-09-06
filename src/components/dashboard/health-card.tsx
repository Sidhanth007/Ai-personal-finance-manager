import { HeartPulse } from "lucide-react";
import type { HealthScore } from "@/lib/health-score";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

export function HealthCard({ health, compact = false }: { health: HealthScore; compact?: boolean }) {
  const tone =
    health.score >= 80 ? "text-emerald-600 dark:text-emerald-400" : health.score >= 60 ? "text-sky-600 dark:text-sky-400" : health.score >= 40 ? "text-amber-600 dark:text-amber-400" : "text-rose-600 dark:text-rose-400";
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <HeartPulse className="size-4" /> Financial health score
        </CardTitle>
        <CardDescription>A transparent score built from five habits. Educational, not advice.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-baseline gap-3">
          <span className="text-5xl font-semibold leading-none">{health.score}</span>
          <span className="text-sm text-muted-foreground">/ 100</span>
          <span className={cn("ml-auto text-sm font-medium", tone)}>{health.grade}</span>
        </div>
        <ul className="space-y-3">
          {health.factors.map((f) => (
            <li key={f.key} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span>{f.label}</span>
                <span className="tabular-nums text-muted-foreground">
                  {f.points}/{f.max}
                </span>
              </div>
              <Progress value={(f.points / f.max) * 100} aria-label={`${f.label}: ${f.points} of ${f.max}`} />
              {!compact && <p className="text-xs text-muted-foreground">{f.detail}</p>}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
