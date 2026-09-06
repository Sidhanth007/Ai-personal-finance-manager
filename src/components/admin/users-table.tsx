"use client";

import { useState, useTransition } from "react";
import { UserCheck, UserX } from "lucide-react";
import { toast } from "sonner";
import { setUserActiveAction } from "@/server/actions/admin";
import type { AdminUserRow } from "@/server/services/admin";
import { formatDateTime } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

export function UsersTable({ users, adminId, timezone }: { users: AdminUserRow[]; adminId: string; timezone: string }) {
  const [q, setQ] = useState("");
  const [pending, startTransition] = useTransition();
  const rows = users.filter((u) => !q || u.email.includes(q.toLowerCase()) || (u.name ?? "").toLowerCase().includes(q.toLowerCase()));

  function toggle(u: AdminUserRow) {
    const verb = u.isActive ? "Deactivate" : "Reactivate";
    if (!window.confirm(`${verb} ${u.email}?`)) return;
    startTransition(async () => {
      const r = await setUserActiveAction(u.id, !u.isActive);
      if (r.ok) toast.success(r.message);
      else toast.error(r.error);
    });
  }

  return (
    <div className="space-y-3">
      <Input placeholder="Filter by email or name" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-xs" />
      <div className="overflow-x-auto rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Joined</TableHead>
              <TableHead>Last login</TableHead>
              <TableHead className="text-right">Transactions</TableHead>
              <TableHead className="text-right">AI msgs</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-32 text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((u) => (
              <TableRow key={u.id} className={cn(!u.isActive && "opacity-60")}>
                <TableCell>
                  <div className="font-medium">{u.name ?? "—"}</div>
                  <div className="text-xs text-muted-foreground">{u.email}{u.id === adminId && " (you)"}</div>
                </TableCell>
                <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{formatDateTime(u.createdAt, timezone)}</TableCell>
                <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{u.lastLoginAt ? formatDateTime(u.lastLoginAt, timezone) : "never"}</TableCell>
                <TableCell className="text-right tabular-nums">{u.transactionCount}</TableCell>
                <TableCell className="text-right tabular-nums">{u.aiMessageCount}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Badge variant={u.isActive ? "secondary" : "destructive"}>{u.isActive ? "active" : "deactivated"}</Badge>
                    {!u.emailVerified && <Badge variant="outline">unverified</Badge>}
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  {u.id !== adminId && (
                    <Button variant="outline" size="sm" disabled={pending} onClick={() => toggle(u)}>
                      {u.isActive ? <><UserX className="size-4" /> Deactivate</> : <><UserCheck className="size-4" /> Reactivate</>}
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
