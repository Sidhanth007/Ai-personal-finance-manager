"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import type { ActionState } from "@/server/actions/transactions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  submitLabel: string;
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  /** Changes force a fresh form (e.g. the record id being edited). */
  formKey: string;
  children: React.ReactNode;
  className?: string;
};

/** Generic dialog wrapping a server action form with toast feedback. */
export function ActionDialog(props: Props) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className={props.className ?? "sm:max-w-lg"}>
        <ActionForm key={`${props.formKey}-${props.open ? "open" : "closed"}`} {...props} />
      </DialogContent>
    </Dialog>
  );
}

function ActionForm({ onOpenChange, title, description, submitLabel, action, children }: Props) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(action, {});
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
        <DialogTitle>{title}</DialogTitle>
        {description && <DialogDescription>{description}</DialogDescription>}
      </DialogHeader>
      {children}
      <DialogFooter>
        <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : submitLabel}
        </Button>
      </DialogFooter>
    </form>
  );
}
