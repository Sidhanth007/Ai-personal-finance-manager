"use client";

import { useState, useTransition } from "react";
import { Pause, Pencil, Play, Plus, Trash2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { deleteSubscriptionAction, saveSubscriptionAction, setSubscriptionStatusAction } from "@/server/actions/bills";
import type { SubscriptionRow } from "@/server/services/bills";
import type { CategoryRow } from "@/server/services/transactions";
import { formatDate, formatMoney, fromMinorUnits, minorDigits, todayISO } from "@/lib/format";
import { describeDue } from "@/lib/schedule";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ActionDialog } from "@/components/shared/action-dialog";
import { Checkbox, Field, selectClass } from "@/components/shared/form-field";
import { cn } from "@/lib/utils";

type Props = { subscriptions: SubscriptionRow[]; categories: CategoryRow[]; currency: string; timezone: string };

export function SubscriptionsView({ subscriptions, categories, currency, timezone }: Props) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<SubscriptionRow | null>(null);
  const [pending, startTransition] = useTransition();
  const expenseCats = categories.filter((c) => c.type === "expense");

  const run = (fn: () => Promise<{ ok?: boolean; message?: string; error?: string }>) =>
    startTransition(async () => {
      const r = await fn();
      if (r.ok) toast.success(r.message);
      else toast.error(r.error);
    });

  return (
    <>
      <div className="flex justify-end">
        <Button onClick={() => { setEditing(null); setOpen(true); }}>
          <Plus className="size-4" /> Add subscription
        </Button>
      </div>

      {subscriptions.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            No subscriptions yet. Add streaming, software, gym, or any recurring service.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {subscriptions.map((s) => (
            <Card key={s.id} size="sm" className={cn(s.status !== "active" && "opacity-70")}>
              <CardContent className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate font-medium">{s.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {formatMoney(s.amount, currency)} / {s.billingCycle.replace("ly", "")}
                      {s.categoryName && <> · {s.categoryName}</>}
                    </div>
                  </div>
                  <Badge variant={s.status === "active" ? "secondary" : s.status === "paused" ? "outline" : "destructive"}>
                    {s.status}
                  </Badge>
                </div>
                <dl className="grid grid-cols-2 gap-y-1 text-xs text-muted-foreground">
                  <dt>Monthly cost</dt>
                  <dd className="text-right tabular-nums">{formatMoney(s.monthlyCost, currency)}</dd>
                  <dt>Next renewal</dt>
                  <dd className="text-right">{formatDate(s.nextBillingDate)}</dd>
                  {s.status === "active" && (
                    <>
                      <dt />
                      <dd className={cn("text-right", s.daysUntilRenewal <= s.reminderDaysBefore ? "text-amber-600 dark:text-amber-400" : "")}>
                        {describeDue(s.daysUntilRenewal).replace("Due", "Renews")}
                      </dd>
                    </>
                  )}
                </dl>
                <div className="flex justify-end gap-1">
                  {s.status === "active" ? (
                    <Button variant="ghost" size="icon-sm" aria-label="Pause" disabled={pending} onClick={() => run(() => setSubscriptionStatusAction(s.id, "paused"))}>
                      <Pause className="size-4" />
                    </Button>
                  ) : (
                    <Button variant="ghost" size="icon-sm" aria-label="Resume" disabled={pending} onClick={() => run(() => setSubscriptionStatusAction(s.id, "active"))}>
                      <Play className="size-4" />
                    </Button>
                  )}
                  {s.status !== "cancelled" && (
                    <Button variant="ghost" size="icon-sm" aria-label="Cancel subscription" disabled={pending} onClick={() => run(() => setSubscriptionStatusAction(s.id, "cancelled"))}>
                      <XCircle className="size-4" />
                    </Button>
                  )}
                  <Button variant="ghost" size="icon-sm" aria-label="Edit" onClick={() => { setEditing(s); setOpen(true); }}>
                    <Pencil className="size-4" />
                  </Button>
                  <Button variant="ghost" size="icon-sm" aria-label="Delete" disabled={pending} onClick={() => { if (window.confirm(`Delete "${s.name}"?`)) run(() => deleteSubscriptionAction(s.id)); }}>
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <ActionDialog
        open={open}
        onOpenChange={setOpen}
        title={editing ? "Edit subscription" : "Add subscription"}
        description="Renewals are charged automatically on the billing date when enabled."
        submitLabel={editing ? "Save changes" : "Add subscription"}
        action={saveSubscriptionAction}
        formKey={editing?.id ?? "new"}
      >
        {editing && <input type="hidden" name="id" value={editing.id} />}
        <Field label="Name" htmlFor="name">
          <Input id="name" name="name" maxLength={80} defaultValue={editing?.name ?? ""} placeholder="Netflix" required autoFocus />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={`Amount (${currency})`} htmlFor="amount">
            <Input id="amount" name="amount" inputMode="decimal" defaultValue={editing ? fromMinorUnits(editing.amount, currency).toFixed(minorDigits(currency)) : ""} required />
          </Field>
          <Field label="Billing cycle" htmlFor="billingCycle">
            <select id="billingCycle" name="billingCycle" className={selectClass} defaultValue={editing?.billingCycle ?? "monthly"}>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
            </select>
          </Field>
          <Field label="Next billing date" htmlFor="nextBillingDate">
            <Input id="nextBillingDate" name="nextBillingDate" type="date" defaultValue={editing?.nextBillingDate ?? todayISO(timezone)} required />
          </Field>
          <Field label="Started on (optional)" htmlFor="startedOn">
            <Input id="startedOn" name="startedOn" type="date" defaultValue={editing?.startedOn ?? ""} />
          </Field>
          <Field label="Category" htmlFor="categoryId">
            <select id="categoryId" name="categoryId" className={selectClass} defaultValue={editing?.categoryId ?? expenseCats.find((c) => c.name === "Subscriptions")?.id ?? ""}>
              <option value="">Uncategorised</option>
              {expenseCats.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Remind me (days before)" htmlFor="reminderDaysBefore">
            <Input id="reminderDaysBefore" name="reminderDaysBefore" type="number" min={0} max={30} defaultValue={editing?.reminderDaysBefore ?? 3} required />
          </Field>
        </div>
        <Checkbox name="autoCreateTransaction" label="Record an expense on each renewal" defaultChecked={editing?.autoCreateTransaction ?? true} />
        <Field label="Notes (optional)" htmlFor="notes">
          <Input id="notes" name="notes" maxLength={500} defaultValue={editing?.notes ?? ""} />
        </Field>
      </ActionDialog>
    </>
  );
}
