"use client";

import { useState, useTransition } from "react";
import { CircleCheck, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteBillAction, markBillPaidAction, saveBillAction } from "@/server/actions/bills";
import type { BillRow } from "@/server/services/bills";
import type { CategoryRow } from "@/server/services/transactions";
import { formatDate, formatMoney, fromMinorUnits, minorDigits, todayISO } from "@/lib/format";
import { describeDue } from "@/lib/schedule";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ActionDialog } from "@/components/shared/action-dialog";
import { Checkbox, Field, selectClass } from "@/components/shared/form-field";
import { cn } from "@/lib/utils";

type Props = { bills: BillRow[]; categories: CategoryRow[]; currency: string; timezone: string };

const STATUS: Record<BillRow["status"], { label: string; variant: "secondary" | "destructive" | "outline" }> = {
  upcoming: { label: "Upcoming", variant: "secondary" },
  overdue: { label: "Overdue", variant: "destructive" },
  paid: { label: "Paid", variant: "outline" },
};

export function BillsView({ bills, categories, currency, timezone }: Props) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<BillRow | null>(null);
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
          <Plus className="size-4" /> Add bill
        </Button>
      </div>

      <div className="overflow-x-auto rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Bill</TableHead>
              <TableHead>Due</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead className="w-40 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {bills.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-12 text-center text-muted-foreground">
                  No bills yet. Add rent, utilities, loan payments, or anything with a due date.
                </TableCell>
              </TableRow>
            ) : (
              bills.map((b) => {
                const s = STATUS[b.status];
                return (
                  <TableRow key={b.id} className={cn(b.status === "paid" && "opacity-60")}>
                    <TableCell>
                      <div className="font-medium">{b.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {b.frequency === "once" ? "One-time" : `Every ${b.frequency.replace("ly", "")}`}
                        {b.categoryName && <> · {b.categoryName}</>}
                        {b.autoCreateTransaction && <> · auto-records expense</>}
                      </div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <div>{formatDate(b.dueDate)}</div>
                      {b.status !== "paid" && (
                        <div className={cn("text-xs", b.daysUntilDue < 0 ? "text-destructive" : b.daysUntilDue <= b.reminderDaysBefore ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground")}>
                          {describeDue(b.daysUntilDue)}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={s.variant}>{s.label}</Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">{formatMoney(b.amount, currency)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {b.status !== "paid" && (
                          <Button variant="outline" size="sm" disabled={pending} onClick={() => run(() => markBillPaidAction(b.id))}>
                            <CircleCheck className="size-4" /> Paid
                          </Button>
                        )}
                        <Button variant="ghost" size="icon-sm" aria-label="Edit bill" onClick={() => { setEditing(b); setOpen(true); }}>
                          <Pencil className="size-4" />
                        </Button>
                        <Button variant="ghost" size="icon-sm" aria-label="Delete bill" disabled={pending} onClick={() => { if (window.confirm(`Delete "${b.name}"?`)) run(() => deleteBillAction(b.id)); }}>
                          <Trash2 className="size-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <ActionDialog
        open={open}
        onOpenChange={setOpen}
        title={editing ? "Edit bill" : "Add bill"}
        description="Bills can be one-time or repeat on a schedule."
        submitLabel={editing ? "Save changes" : "Add bill"}
        action={saveBillAction}
        formKey={editing?.id ?? "new"}
      >
        {editing && <input type="hidden" name="id" value={editing.id} />}
        <Field label="Name" htmlFor="name">
          <Input id="name" name="name" maxLength={80} defaultValue={editing?.name ?? ""} placeholder="Electricity" required autoFocus />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={`Amount (${currency})`} htmlFor="amount">
            <Input id="amount" name="amount" inputMode="decimal" defaultValue={editing ? fromMinorUnits(editing.amount, currency).toFixed(minorDigits(currency)) : ""} required />
          </Field>
          <Field label="Due date" htmlFor="dueDate">
            <Input id="dueDate" name="dueDate" type="date" defaultValue={editing?.dueDate ?? todayISO(timezone)} required />
          </Field>
          <Field label="Repeats" htmlFor="frequency">
            <select id="frequency" name="frequency" className={selectClass} defaultValue={editing?.frequency ?? "monthly"}>
              <option value="once">One-time</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
            </select>
          </Field>
          <Field label="Category" htmlFor="categoryId">
            <select id="categoryId" name="categoryId" className={selectClass} defaultValue={editing?.categoryId ?? ""}>
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
        <Checkbox name="autoCreateTransaction" label="Record an expense when marked paid" defaultChecked={editing?.autoCreateTransaction ?? true} />
        <Field label="Notes (optional)" htmlFor="notes">
          <Input id="notes" name="notes" maxLength={500} defaultValue={editing?.notes ?? ""} />
        </Field>
      </ActionDialog>
    </>
  );
}
