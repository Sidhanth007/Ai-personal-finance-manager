"use client";

import { useState, useTransition } from "react";
import { Pause, Pencil, Play, Plus, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteRecurringRuleAction, runRecurringNowAction, saveRecurringRuleAction, setRecurringRuleActiveAction } from "@/server/actions/bills";
import type { RecurringRuleRow } from "@/server/services/bills";
import type { CategoryRow } from "@/server/services/transactions";
import { formatDate, formatMoney, fromMinorUnits, minorDigits, todayISO } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ActionDialog } from "@/components/shared/action-dialog";
import { Field, selectClass } from "@/components/shared/form-field";
import { cn } from "@/lib/utils";

type Props = { rules: RecurringRuleRow[]; categories: CategoryRow[]; currency: string; timezone: string };

export function RecurringView({ rules, categories, currency, timezone }: Props) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<RecurringRuleRow | null>(null);
  const [type, setType] = useState<"income" | "expense">("expense");
  const [pending, startTransition] = useTransition();

  const run = (fn: () => Promise<{ ok?: boolean; message?: string; error?: string }>) =>
    startTransition(async () => {
      const r = await fn();
      if (r.ok) toast.success(r.message);
      else toast.error(r.error);
    });

  const formType = editing?.type ?? type;
  const cats = categories.filter((c) => c.type === formType);

  return (
    <>
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="outline" disabled={pending} onClick={() => run(runRecurringNowAction)}>
          <RefreshCw className={cn("size-4", pending && "animate-spin")} /> Process due items now
        </Button>
        <Button onClick={() => { setEditing(null); setType("expense"); setOpen(true); }}>
          <Plus className="size-4" /> Add rule
        </Button>
      </div>

      <div className="overflow-x-auto rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Rule</TableHead>
              <TableHead>Schedule</TableHead>
              <TableHead>Next run</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead className="w-28 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rules.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-12 text-center text-muted-foreground">
                  No recurring rules. Add salary, rent, or any transaction that repeats on a schedule.
                </TableCell>
              </TableRow>
            ) : (
              rules.map((r) => (
                <TableRow key={r.id} className={cn(!r.isActive && "opacity-60")}>
                  <TableCell>
                    <div className="font-medium">{r.description}</div>
                    <div className="text-xs text-muted-foreground">
                      <Badge variant="outline" className="mr-1 h-4 px-1 text-[10px] capitalize">{r.type}</Badge>
                      {r.categoryName ?? "Uncategorised"}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">
                    Every {r.interval > 1 ? `${r.interval} ` : ""}{r.frequency.replace("ly", "")}{r.interval > 1 ? "s" : ""}
                    <div className="text-xs text-muted-foreground">
                      from {formatDate(r.startDate)}{r.endDate && <> to {formatDate(r.endDate)}</>}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">
                    {r.isActive ? formatDate(r.nextRunOn) : <Badge variant="outline">Paused</Badge>}
                    {r.lastRunOn && <div className="text-xs text-muted-foreground">last {formatDate(r.lastRunOn)}</div>}
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {r.type === "income" ? "+" : "−"}{formatMoney(r.amount, currency)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon-sm" aria-label={r.isActive ? "Pause" : "Resume"} disabled={pending} onClick={() => run(() => setRecurringRuleActiveAction(r.id, !r.isActive))}>
                        {r.isActive ? <Pause className="size-4" /> : <Play className="size-4" />}
                      </Button>
                      <Button variant="ghost" size="icon-sm" aria-label="Edit" onClick={() => { setEditing(r); setOpen(true); }}>
                        <Pencil className="size-4" />
                      </Button>
                      <Button variant="ghost" size="icon-sm" aria-label="Delete" disabled={pending} onClick={() => { if (window.confirm(`Delete rule "${r.description}"?`)) run(() => deleteRecurringRuleAction(r.id)); }}>
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <ActionDialog
        open={open}
        onOpenChange={setOpen}
        title={editing ? "Edit recurring rule" : "Add recurring rule"}
        description="A transaction is created automatically each time the schedule comes due."
        submitLabel={editing ? "Save changes" : "Add rule"}
        action={saveRecurringRuleAction}
        formKey={editing?.id ?? "new"}
      >
        {editing && <input type="hidden" name="id" value={editing.id} />}
        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Type">
          {(["expense", "income"] as const).map((t) => (
            <label key={t} className={cn("flex cursor-pointer items-center justify-center rounded-md border px-3 py-2 text-sm font-medium capitalize", formType === t ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted")}>
              <input type="radio" name="type" value={t} checked={formType === t} onChange={() => { setType(t); if (editing) setEditing({ ...editing, type: t, categoryId: null }); }} className="sr-only" />
              {t}
            </label>
          ))}
        </div>
        <Field label="Description" htmlFor="description">
          <Input id="description" name="description" maxLength={140} defaultValue={editing?.description ?? ""} placeholder="Monthly rent" required />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={`Amount (${currency})`} htmlFor="amount">
            <Input id="amount" name="amount" inputMode="decimal" defaultValue={editing ? fromMinorUnits(editing.amount, currency).toFixed(minorDigits(currency)) : ""} required />
          </Field>
          <Field label="Category" htmlFor="categoryId">
            <select id="categoryId" name="categoryId" className={selectClass} defaultValue={editing?.categoryId ?? ""} key={formType}>
              <option value="">Uncategorised</option>
              {cats.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Repeats" htmlFor="frequency">
            <select id="frequency" name="frequency" className={selectClass} defaultValue={editing?.frequency ?? "monthly"}>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
            </select>
          </Field>
          <Field label="Every (interval)" htmlFor="interval" hint="2 with Weekly means every two weeks.">
            <Input id="interval" name="interval" type="number" min={1} max={52} defaultValue={editing?.interval ?? 1} required />
          </Field>
          <Field label="Start date" htmlFor="startDate" hint="Also the first transaction date.">
            <Input id="startDate" name="startDate" type="date" defaultValue={editing?.startDate ?? todayISO(timezone)} required />
          </Field>
          <Field label="End date (optional)" htmlFor="endDate">
            <Input id="endDate" name="endDate" type="date" defaultValue={editing?.endDate ?? ""} />
          </Field>
        </div>
      </ActionDialog>
    </>
  );
}
