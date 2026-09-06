"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { addContributionAction } from "@/server/actions/goals";
import type { ActionState } from "@/server/actions/transactions";
import { todayISO } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  goalId: string;
  goalName: string;
  currency: string;
  timezone: string;
};

export function ContributionDialog(props: Props) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <ContributionForm key={`${props.goalId}-${props.open ? "open" : "closed"}`} {...props} />
      </DialogContent>
    </Dialog>
  );
}

function ContributionForm({ onOpenChange, goalId, goalName, currency, timezone }: Props) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(addContributionAction, {});
  useEffect(() => {
    if (state.ok) {
      toast.success(state.message);
      onOpenChange(false);
    } else if (state.error) toast.error(state.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <form action={formAction} className="space-y-4">
      <DialogHeader>
        <DialogTitle>Add to {goalName}</DialogTitle>
        <DialogDescription>Log money you have set aside for this goal.</DialogDescription>
      </DialogHeader>
      <input type="hidden" name="goalId" value={goalId} />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="amount">Amount ({currency})</Label>
          <Input id="amount" name="amount" inputMode="decimal" placeholder="0.00" required autoFocus />
        </div>
        <div className="space-y-1">
          <Label htmlFor="contributedOn">Date</Label>
          <Input id="contributedOn" name="contributedOn" type="date" defaultValue={todayISO(timezone)} required />
        </div>
      </div>
      <div className="space-y-1">
        <Label htmlFor="note">Note (optional)</Label>
        <Input id="note" name="note" maxLength={200} />
      </div>
      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" name="recordTransaction" defaultChecked className="mt-0.5 size-4 accent-primary" />
        <span>
          <span className="font-medium">Also record as an expense</span>
          <span className="block text-muted-foreground">
            Adds a &ldquo;Savings Transfer&rdquo; transaction so your monthly cash flow reflects the money set aside.
          </span>
        </span>
      </label>
      <DialogFooter>
        <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Add contribution"}
        </Button>
      </DialogFooter>
    </form>
  );
}
