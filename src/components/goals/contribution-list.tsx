"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteContributionAction } from "@/server/actions/goals";
import type { ContributionRow } from "@/server/services/goals";
import { formatDate, formatMoney } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export function ContributionList({ rows, currency }: { rows: ContributionRow[]; currency: string }) {
  const [pending, startTransition] = useTransition();

  function remove(row: ContributionRow) {
    if (!window.confirm("Remove this contribution? Any linked expense transaction is removed too.")) return;
    startTransition(async () => {
      const res = await deleteContributionAction(row.id);
      if (res.ok) toast.success(res.message);
      else toast.error(res.error);
    });
  }

  return (
    <div className="overflow-x-auto rounded-lg border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-32">Date</TableHead>
            <TableHead>Note</TableHead>
            <TableHead className="text-right">Amount</TableHead>
            <TableHead className="w-16" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4} className="py-10 text-center text-muted-foreground">
                No contributions yet.
              </TableCell>
            </TableRow>
          ) : (
            rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="text-muted-foreground">{formatDate(r.contributedOn)}</TableCell>
                <TableCell>
                  {r.note ?? <span className="text-muted-foreground">—</span>}
                  {r.transactionId && (
                    <Badge variant="outline" className="ml-2 h-4 px-1 text-[10px]">expense recorded</Badge>
                  )}
                </TableCell>
                <TableCell className="text-right font-medium tabular-nums">{formatMoney(r.amount, currency)}</TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon-sm" aria-label="Remove contribution" disabled={pending} onClick={() => remove(r)}>
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
