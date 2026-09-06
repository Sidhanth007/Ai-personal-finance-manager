"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { saveBudgetAction } from "@/server/actions/budgets";
import type { ActionState } from "@/server/actions/transactions";
import type { BudgetRow } from "@/server/services/budgets";
import type { CategoryRow } from "@/server/services/transactions";
import { fromMinorUnits, minorDigits } from "@/lib/format";
import { monthLabel } from "@/lib/months";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const selectClass =
  "border-input h-9 w-full rounded-md border bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  month: string;
  currency: string;
  categories: CategoryRow[];
  /** category ids that already have a budget this month */
  taken: Set<string>;
  hasOverall: boolean;
  initial?: BudgetRow | null;
};

export function BudgetDialog(props: Props) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <BudgetForm key={`${props.initial?.id ?? "new"}-${props.open ? "open" : "closed"}`} {...props} />
      </DialogContent>
    </Dialog>
  );
}

function BudgetForm({ onOpenChange, month, currency, categories, taken, hasOverall, initial }: Props) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(saveBudgetAction, {});

  useEffect(() => {
    if (state.ok) {
      toast.success(state.message);
      onOpenChange(false);
    } else if (state.error) toast.error(state.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const options = categories.filter((c) => c.type === "expense" && !c.isArchived && !taken.has(c.id));
  const defaultAmount = initial ? fromMinorUnits(initial.amount, currency).toFixed(minorDigits(currency)) : "";

  return (
    <form action={formAction} className="space-y-4">
      <DialogHeader>
        <DialogTitle>{initial ? `Edit budget: ${initial.categoryName}` : "Add budget"}</DialogTitle>
        <DialogDescription>For {monthLabel(month)}.</DialogDescription>
      </DialogHeader>

      <input type="hidden" name="month" value={month} />
      {initial && <input type="hidden" name="id" value={initial.id} />}

      {!initial && (
        <div className="space-y-1">
          <Label htmlFor="categoryId">Category</Label>
          <select id="categoryId" name="categoryId" className={selectClass} defaultValue={hasOverall ? options[0]?.id ?? "" : ""}>
            {!hasOverall && <option value="">Overall (all expenses)</option>}
            {options.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          {options.length === 0 && hasOverall && (
            <p className="text-xs text-muted-foreground">Every expense category already has a budget this month.</p>
          )}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="amount">Monthly limit ({currency})</Label>
          <Input id="amount" name="amount" inputMode="decimal" placeholder="0.00" defaultValue={defaultAmount} required autoFocus />
        </div>
        <div className="space-y-1">
          <Label htmlFor="alertThresholdPct">Alert at (%)</Label>
          <Input
            id="alertThresholdPct"
            name="alertThresholdPct"
            type="number"
            min={50}
            max={100}
            step={5}
            defaultValue={initial?.alertThresholdPct ?? 80}
            required
          />
        </div>
      </div>

      <DialogFooter>
        <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending || (!initial && options.length === 0 && hasOverall)}>
          {pending ? "Saving…" : initial ? "Save changes" : "Add budget"}
        </Button>
      </DialogFooter>
    </form>
  );
}
