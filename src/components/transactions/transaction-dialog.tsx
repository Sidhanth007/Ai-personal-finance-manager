"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  saveTransactionAction,
  type ActionState,
} from "@/server/actions/transactions";
import type {
  CategoryRow,
  TransactionRow,
} from "@/server/services/transactions";
import { fromMinorUnits, minorDigits, todayISO } from "@/lib/format";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const selectClass =
  "border-input h-9 w-full rounded-md border bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: CategoryRow[];
  currency: string;
  timezone: string;
  initial?: TransactionRow | null;
};

export function TransactionDialog({
  open,
  onOpenChange,
  categories,
  currency,
  timezone,
  initial,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        {/* Keyed so each open / each record starts from fresh form state. */}
        <TransactionForm
          key={`${initial?.id ?? "new"}-${open ? "open" : "closed"}`}
          onOpenChange={onOpenChange}
          categories={categories}
          currency={currency}
          timezone={timezone}
          initial={initial}
        />
      </DialogContent>
    </Dialog>
  );
}

function TransactionForm({
  onOpenChange,
  categories,
  currency,
  timezone,
  initial,
}: Omit<Props, "open">) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    saveTransactionAction,
    {},
  );
  const [type, setType] = useState<"income" | "expense">(
    initial?.type ?? "expense",
  );

  useEffect(() => {
    if (state.ok) {
      toast.success(state.message);
      onOpenChange(false);
    } else if (state.error) {
      toast.error(state.error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const filtered = categories.filter((c) => c.type === type);
  const digits = minorDigits(currency);
  const defaultAmount = initial
    ? fromMinorUnits(initial.amount, currency).toFixed(digits)
    : "";

  return (
    <form action={formAction} className="space-y-4">
      <DialogHeader>
        <DialogTitle>
          {initial ? "Edit transaction" : "Add transaction"}
        </DialogTitle>
        <DialogDescription>
          {initial
            ? "Update the details below."
            : "Record an income or expense."}
        </DialogDescription>
      </DialogHeader>

      {initial && <input type="hidden" name="id" value={initial.id} />}

      <div
        className="grid grid-cols-2 gap-2"
        role="radiogroup"
        aria-label="Type"
      >
        {(["expense", "income"] as const).map((t) => (
          <label
            key={t}
            className={cn(
              "flex cursor-pointer items-center justify-center rounded-md border px-3 py-2 text-sm font-medium capitalize",
              type === t
                ? "border-primary bg-primary text-primary-foreground"
                : "hover:bg-muted",
            )}
          >
            <input
              type="radio"
              name="type"
              value={t}
              checked={type === t}
              onChange={() => setType(t)}
              className="sr-only"
            />
            {t}
          </label>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="amount">Amount ({currency})</Label>
          <Input
            id="amount"
            name="amount"
            inputMode="decimal"
            placeholder="0.00"
            defaultValue={defaultAmount}
            required
            autoFocus
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="occurredOn">Date</Label>
          <Input
            id="occurredOn"
            name="occurredOn"
            type="date"
            defaultValue={initial?.occurredOn ?? todayISO(timezone)}
            required
          />
        </div>
      </div>

      <div className="space-y-1">
        <Label htmlFor="categoryId">Category</Label>
        <select
          id="categoryId"
          name="categoryId"
          defaultValue={initial?.categoryId ?? ""}
          className={selectClass}
          key={type}
        >
          <option value="">Uncategorised</option>
          {filtered.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1">
        <Label htmlFor="description">Description</Label>
        <Input
          id="description"
          name="description"
          maxLength={140}
          defaultValue={initial?.description ?? ""}
          required
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="merchant">Merchant (optional)</Label>
          <Input
            id="merchant"
            name="merchant"
            maxLength={80}
            defaultValue={initial?.merchant ?? ""}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="notes">Notes (optional)</Label>
          <Input
            id="notes"
            name="notes"
            maxLength={500}
            defaultValue={initial?.notes ?? ""}
          />
        </div>
      </div>

      <DialogFooter>
        <Button
          type="button"
          variant="ghost"
          onClick={() => onOpenChange(false)}
          disabled={pending}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : initial ? "Save changes" : "Add transaction"}
        </Button>
      </DialogFooter>
    </form>
  );
}
