"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { saveGoalAction } from "@/server/actions/goals";
import type { ActionState } from "@/server/actions/transactions";
import type { GoalRow } from "@/server/services/goals";
import { fromMinorUnits, minorDigits } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currency: string;
  initial?: GoalRow | null;
};

export function GoalDialog(props: Props) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <GoalForm key={`${props.initial?.id ?? "new"}-${props.open ? "open" : "closed"}`} {...props} />
      </DialogContent>
    </Dialog>
  );
}

function GoalForm({ onOpenChange, currency, initial }: Props) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(saveGoalAction, {});
  useEffect(() => {
    if (state.ok) {
      toast.success(state.message);
      onOpenChange(false);
    } else if (state.error) toast.error(state.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const defaultTarget = initial ? fromMinorUnits(initial.targetAmount, currency).toFixed(minorDigits(currency)) : "";

  return (
    <form action={formAction} className="space-y-4">
      <DialogHeader>
        <DialogTitle>{initial ? "Edit goal" : "New savings goal"}</DialogTitle>
        <DialogDescription>Give it a name, a target, and optionally a date to aim for.</DialogDescription>
      </DialogHeader>
      {initial && <input type="hidden" name="id" value={initial.id} />}
      <div className="flex items-end gap-2">
        <div className="flex-1 space-y-1">
          <Label htmlFor="name">Name</Label>
          <Input id="name" name="name" maxLength={80} defaultValue={initial?.name ?? ""} placeholder="Emergency fund" required autoFocus />
        </div>
        <div className="space-y-1">
          <Label htmlFor="color">Colour</Label>
          <input id="color" type="color" name="color" defaultValue={initial?.color ?? "#10b981"} className="size-9 cursor-pointer rounded-md border bg-transparent p-1" />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="targetAmount">Target ({currency})</Label>
          <Input id="targetAmount" name="targetAmount" inputMode="decimal" placeholder="0.00" defaultValue={defaultTarget} required />
        </div>
        <div className="space-y-1">
          <Label htmlFor="targetDate">Target date (optional)</Label>
          <Input id="targetDate" name="targetDate" type="date" defaultValue={initial?.targetDate ?? ""} />
        </div>
      </div>
      <div className="space-y-1">
        <Label htmlFor="notes">Notes (optional)</Label>
        <Input id="notes" name="notes" maxLength={500} defaultValue={initial?.notes ?? ""} />
      </div>
      <DialogFooter>
        <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : initial ? "Save changes" : "Create goal"}
        </Button>
      </DialogFooter>
    </form>
  );
}
