"use client";

import { useState, useTransition } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteTransactionAction } from "@/server/actions/transactions";
import type { CategoryRow, TransactionRow } from "@/server/services/transactions";
import { formatDate, formatMoney } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TransactionDialog } from "./transaction-dialog";
import { cn } from "@/lib/utils";

type Props = {
  rows: TransactionRow[];
  categories: CategoryRow[];
  currency: string;
  timezone: string;
};

export function TransactionsTable({ rows, categories, currency, timezone }: Props) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<TransactionRow | null>(null);
  const [pending, startTransition] = useTransition();

  function openNew() {
    setEditing(null);
    setOpen(true);
  }
  function openEdit(row: TransactionRow) {
    setEditing(row);
    setOpen(true);
  }
  function remove(row: TransactionRow) {
    if (!window.confirm(`Delete "${row.description}"? This cannot be undone.`)) return;
    startTransition(async () => {
      const res = await deleteTransactionAction(row.id);
      if (res.ok) toast.success(res.message);
      else toast.error(res.error);
    });
  }

  return (
    <>
      <div className="flex justify-end">
        <Button onClick={openNew}>
          <Plus className="size-4" /> Add transaction
        </Button>
      </div>

      <div className="overflow-x-auto rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-28">Date</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Category</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead className="w-24 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-12 text-center text-muted-foreground">
                  No transactions match. Add one or adjust the filters.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {formatDate(row.occurredOn)}
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{row.description}</div>
                    {(row.merchant || row.source !== "manual") && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        {row.merchant && <span>{row.merchant}</span>}
                        {row.source !== "manual" && (
                          <Badge variant="outline" className="h-4 px-1 text-[10px]">
                            {row.source.replace("_", " ")}
                          </Badge>
                        )}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    {row.categoryName ? (
                      <span className="inline-flex items-center gap-2">
                        <span
                          className="size-2.5 rounded-full"
                          style={{ backgroundColor: row.categoryColor ?? "#64748b" }}
                          aria-hidden
                        />
                        {row.categoryName}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">Uncategorised</span>
                    )}
                  </TableCell>
                  <TableCell
                    className={cn(
                      "whitespace-nowrap text-right font-medium tabular-nums",
                      row.type === "income" ? "text-emerald-600 dark:text-emerald-400" : "",
                    )}
                  >
                    {row.type === "income" ? "+" : "−"}
                    {formatMoney(row.amount, row.currency)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon-sm" aria-label="Edit" onClick={() => openEdit(row)}>
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Delete"
                        disabled={pending}
                        onClick={() => remove(row)}
                      >
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

      <TransactionDialog
        open={open}
        onOpenChange={setOpen}
        categories={categories}
        currency={currency}
        timezone={timezone}
        initial={editing}
      />
    </>
  );
}
