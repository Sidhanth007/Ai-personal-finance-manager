"use client";

import { useState, useTransition } from "react";
import { AlertTriangle, CircleCheck, CircleX, Copy, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { copyBudgetsAction, deleteBudgetAction } from "@/server/actions/budgets";
import type { BudgetRow } from "@/server/services/budgets";
import type { CategoryRow } from "@/server/services/transactions";
import { formatMoney } from "@/lib/format";
import { shiftMonthKey } from "@/lib/months";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { BudgetDialog } from "./budget-dialog";
import { cn } from "@/lib/utils";

type Props = {
  month: string;
  currency: string;
  overall: BudgetRow | null;
  categoryBudgets: BudgetRow[];
  totalSpent: number;
  categories: CategoryRow[];
};

const STATUS = {
  ok: { label: "On track", icon: CircleCheck, text: "text-emerald-600 dark:text-emerald-400", bar: "[&_[data-slot=progress-indicator]]:bg-emerald-500" },
  warning: { label: "Near limit", icon: AlertTriangle, text: "text-amber-600 dark:text-amber-400", bar: "[&_[data-slot=progress-indicator]]:bg-amber-500" },
  over: { label: "Over budget", icon: CircleX, text: "text-rose-600 dark:text-rose-400", bar: "[&_[data-slot=progress-indicator]]:bg-rose-500" },
} as const;

export function BudgetList({ month, currency, overall, categoryBudgets, totalSpent, categories }: Props) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<BudgetRow | null>(null);
  const [pending, startTransition] = useTransition();

  const taken = new Set(categoryBudgets.map((b) => b.categoryId!).filter(Boolean));

  function openNew() {
    setEditing(null);
    setOpen(true);
  }
  function openEdit(b: BudgetRow) {
    setEditing(b);
    setOpen(true);
  }
  function remove(b: BudgetRow) {
    if (!window.confirm(`Delete the ${b.categoryName} budget for this month?`)) return;
    startTransition(async () => {
      const res = await deleteBudgetAction(b.id);
      if (res.ok) toast.success(res.message);
      else toast.error(res.error);
    });
  }
  function copyLastMonth() {
    startTransition(async () => {
      const res = await copyBudgetsAction(shiftMonthKey(month, -1), month);
      if (res.ok) toast.success(res.message);
      else toast.error(res.error);
    });
  }

  const all = overall ? [overall, ...categoryBudgets] : categoryBudgets;

  return (
    <>
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="outline" onClick={copyLastMonth} disabled={pending}>
          <Copy className="size-4" /> Copy last month
        </Button>
        <Button onClick={openNew}>
          <Plus className="size-4" /> Add budget
        </Button>
      </div>

      {all.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No budgets for this month</CardTitle>
            <CardDescription>
              Add a limit for a category, or an overall monthly limit, to track spending against it.
              {totalSpent > 0 && <> You have spent {formatMoney(totalSpent, currency)} so far this month.</>}
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {all.map((b) => {
            const s = STATUS[b.status];
            const Icon = s.icon;
            return (
              <Card key={b.id} size="sm" className={cn(b.categoryId === null && "md:col-span-2")}>
                <CardContent className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span
                        className="size-2.5 rounded-full"
                        style={{ backgroundColor: b.categoryColor ?? "#64748b" }}
                        aria-hidden
                      />
                      <span className="font-medium">{b.categoryName}</span>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon-sm" aria-label="Edit budget" onClick={() => openEdit(b)}>
                        <Pencil className="size-4" />
                      </Button>
                      <Button variant="ghost" size="icon-sm" aria-label="Delete budget" disabled={pending} onClick={() => remove(b)}>
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    </div>
                  </div>

                  <Progress
                    value={Math.min(100, b.pct)}
                    className={cn("[&_[data-slot=progress-track]]:h-2", s.bar)}
                    aria-label={`${b.pct}% of budget used`}
                  />

                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-sm">
                    <span className="tabular-nums">
                      <span className="font-semibold">{formatMoney(b.spent, currency)}</span>
                      <span className="text-muted-foreground"> of {formatMoney(b.amount, currency)}</span>
                    </span>
                    <span className={cn("inline-flex items-center gap-1 text-xs font-medium", s.text)}>
                      <Icon className="size-3.5" aria-hidden /> {s.label} · {b.pct}%
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {b.remaining >= 0
                      ? `${formatMoney(b.remaining, currency)} remaining`
                      : `${formatMoney(-b.remaining, currency)} over`}{" "}
                    · alert at {b.alertThresholdPct}%
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <BudgetDialog
        open={open}
        onOpenChange={setOpen}
        month={month}
        currency={currency}
        categories={categories}
        taken={taken}
        hasOverall={overall !== null}
        initial={editing}
      />
    </>
  );
}
