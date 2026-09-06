"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Archive, ArchiveRestore, CircleCheck, Pencil, Plus, PiggyBank, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteGoalAction, setGoalStatusAction } from "@/server/actions/goals";
import type { GoalRow } from "@/server/services/goals";
import { formatDate, formatMoney } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ContributionDialog } from "./contribution-dialog";
import { GoalDialog } from "./goal-dialog";
import { cn } from "@/lib/utils";

type Props = { goals: GoalRow[]; currency: string; timezone: string; showArchived: boolean };

export function GoalList({ goals, currency, timezone, showArchived }: Props) {
  const [goalOpen, setGoalOpen] = useState(false);
  const [editing, setEditing] = useState<GoalRow | null>(null);
  const [contribFor, setContribFor] = useState<GoalRow | null>(null);
  const [pending, startTransition] = useTransition();

  const run = (fn: () => Promise<{ ok?: boolean; message?: string; error?: string }>) =>
    startTransition(async () => {
      const res = await fn();
      if (res.ok) toast.success(res.message);
      else toast.error(res.error);
    });

  return (
    <>
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Link
          href={showArchived ? "/goals" : "/goals?archived=1"}
          className="text-sm text-muted-foreground underline-offset-4 hover:underline"
        >
          {showArchived ? "Hide archived" : "Show archived"}
        </Link>
        <Button
          onClick={() => {
            setEditing(null);
            setGoalOpen(true);
          }}
        >
          <Plus className="size-4" /> New goal
        </Button>
      </div>

      {goals.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No savings goals yet</CardTitle>
            <CardDescription>Create a goal such as an emergency fund, a trip, or a new laptop, and log contributions as you save.</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {goals.map((g) => (
            <Card key={g.id} size="sm" className={cn(g.status === "archived" && "opacity-70")}>
              <CardContent className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <Link href={`/goals/${g.id}`} className="flex items-center gap-2 font-medium hover:underline">
                      <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: g.color ?? "#10b981" }} aria-hidden />
                      <span className="truncate">{g.name}</span>
                    </Link>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {g.status === "completed" && (
                        <Badge variant="secondary"><CircleCheck className="size-3" /> Completed</Badge>
                      )}
                      {g.status === "archived" && <Badge variant="outline">Archived</Badge>}
                      {g.status === "active" && g.onTrack !== null && (
                        <Badge variant={g.onTrack ? "secondary" : "destructive"}>{g.onTrack ? "On track" : "Behind pace"}</Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button variant="ghost" size="icon-sm" aria-label="Edit goal" onClick={() => { setEditing(g); setGoalOpen(true); }}>
                      <Pencil className="size-4" />
                    </Button>
                    {g.status === "archived" ? (
                      <Button variant="ghost" size="icon-sm" aria-label="Restore goal" disabled={pending} onClick={() => run(() => setGoalStatusAction(g.id, "active"))}>
                        <ArchiveRestore className="size-4" />
                      </Button>
                    ) : (
                      <Button variant="ghost" size="icon-sm" aria-label="Archive goal" disabled={pending} onClick={() => run(() => setGoalStatusAction(g.id, "archived"))}>
                        <Archive className="size-4" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Delete goal"
                      disabled={pending}
                      onClick={() => {
                        if (window.confirm(`Delete "${g.name}" and its contribution history?`)) run(() => deleteGoalAction(g.id));
                      }}
                    >
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </div>
                </div>

                <Progress value={g.pct} className="[&_[data-slot=progress-track]]:h-2" aria-label={`${g.pct}% saved`} />

                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-sm tabular-nums">
                  <span>
                    <span className="font-semibold">{formatMoney(g.currentAmount, currency)}</span>
                    <span className="text-muted-foreground"> of {formatMoney(g.targetAmount, currency)}</span>
                  </span>
                  <span className="text-xs font-medium text-muted-foreground">{g.pct}%</span>
                </div>

                <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <dt>Remaining</dt>
                  <dd className="text-right tabular-nums">{formatMoney(g.remaining, currency)}</dd>
                  {g.targetDate && (
                    <>
                      <dt>Target date</dt>
                      <dd className="text-right">{formatDate(g.targetDate)}</dd>
                      <dt>Needed per month</dt>
                      <dd className="text-right tabular-nums">{g.requiredMonthly !== null ? formatMoney(g.requiredMonthly, currency) : "—"}</dd>
                    </>
                  )}
                  <dt>Recent pace</dt>
                  <dd className="text-right tabular-nums">{g.monthlyPace > 0 ? `${formatMoney(g.monthlyPace, currency)}/mo` : "No contributions in 90 days"}</dd>
                  <dt>Projected finish</dt>
                  <dd className="text-right">{g.projectedDate ? formatDate(g.projectedDate) : "—"}</dd>
                </dl>

                {g.status !== "archived" && (
                  <Button variant="outline" size="sm" className="w-full" onClick={() => setContribFor(g)}>
                    <PiggyBank className="size-4" /> Add contribution
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <GoalDialog open={goalOpen} onOpenChange={setGoalOpen} currency={currency} initial={editing} />
      {contribFor && (
        <ContributionDialog
          open={contribFor !== null}
          onOpenChange={(o) => !o && setContribFor(null)}
          goalId={contribFor.id}
          goalName={contribFor.name}
          currency={currency}
          timezone={timezone}
        />
      )}
    </>
  );
}
