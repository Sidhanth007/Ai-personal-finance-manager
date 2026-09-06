"use client";

import { useActionState, useEffect, useState } from "react";
import { Upload } from "lucide-react";
import { toast } from "sonner";
import { importTransactionsAction, type ImportState } from "@/server/actions/transactions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const SAMPLE =
  "date,type,amount,category,description,merchant,notes\n" +
  "2026-09-01,income,75000.00,Salary,September salary,Employer,\n" +
  "2026-09-02,expense,2450.00,Groceries,Weekly groceries,BigBasket,\n" +
  "2026-09-03,expense,649.00,Subscriptions,Music streaming,Spotify,Family plan\n";

export function ImportDialog() {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<ImportState, FormData>(importTransactionsAction, {});

  useEffect(() => {
    if (state.ok) toast.success(state.message);
    else if (state.error) toast.error(state.error);
  }, [state]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" />}>
        <Upload className="size-4" /> Import CSV
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <form action={formAction} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Import transactions from CSV</DialogTitle>
            <DialogDescription>
              Columns: date (YYYY-MM-DD), type (income or expense), amount, category, description,
              merchant, notes. Unknown categories are created automatically. Up to 2,000 rows.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-1">
            <Label htmlFor="file">CSV file</Label>
            <Input id="file" name="file" type="file" accept=".csv,text/csv" required />
          </div>

          <a
            href={`data:text/csv;charset=utf-8,${encodeURIComponent(SAMPLE)}`}
            download="sample-transactions.csv"
            className="text-sm text-muted-foreground underline-offset-4 hover:underline"
          >
            Download a sample CSV
          </a>

          {state.ok && (
            <div className="rounded-md border p-3 text-sm">
              <p>
                Imported <strong>{state.imported}</strong>, skipped <strong>{state.skipped}</strong>.
              </p>
              {state.errors && state.errors.length > 0 && (
                <ul className="mt-2 max-h-40 list-disc space-y-1 overflow-auto pl-5 text-xs text-muted-foreground">
                  {state.errors.map((e, i) => (
                    <li key={i}>{e}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
              Close
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Importing…" : "Import"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
