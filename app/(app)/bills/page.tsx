import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/session";
import { formatMoney, todayISO } from "@/lib/format";
import { listBills } from "@/server/services/bills";
import { listCategories } from "@/server/services/transactions";
import { PageHeader } from "@/components/shared/page-header";
import { BillsView } from "@/components/bills/bills-view";
import { Card, CardContent } from "@/components/ui/card";

export const metadata: Metadata = { title: "Bills" };

export default async function BillsPage() {
  const user = await requireUser();
  const today = todayISO(user.timezone);
  const [bills, categories] = await Promise.all([listBills(user.id, today), listCategories(user.id)]);

  const open = bills.filter((b) => b.status !== "paid");
  const overdue = open.filter((b) => b.status === "overdue");
  const dueSoon = open.filter((b) => b.status === "upcoming" && b.daysUntilDue <= 7);
  const tiles = [
    { label: "Open bills", value: `${open.length} · ${formatMoney(open.reduce((s, b) => s + b.amount, 0), user.currency)}` },
    { label: "Overdue", value: `${overdue.length} · ${formatMoney(overdue.reduce((s, b) => s + b.amount, 0), user.currency)}` },
    { label: "Due in 7 days", value: `${dueSoon.length} · ${formatMoney(dueSoon.reduce((s, b) => s + b.amount, 0), user.currency)}` },
  ];

  return (
    <>
      <PageHeader title="Bills" description="Track due dates, mark bills paid, and get reminders before they are due." />
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {tiles.map((t) => (
            <Card key={t.label} size="sm">
              <CardContent>
                <div className="text-sm text-muted-foreground">{t.label}</div>
                <div className="mt-1 truncate text-xl font-semibold">{t.value}</div>
              </CardContent>
            </Card>
          ))}
        </div>
        <BillsView bills={bills} categories={categories} currency={user.currency} timezone={user.timezone} />
      </div>
    </>
  );
}
