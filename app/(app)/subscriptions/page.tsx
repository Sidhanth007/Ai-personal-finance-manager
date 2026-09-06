import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/session";
import { formatMoney, todayISO } from "@/lib/format";
import { listSubscriptions } from "@/server/services/bills";
import { listCategories } from "@/server/services/transactions";
import { PageHeader } from "@/components/shared/page-header";
import { SubscriptionsView } from "@/components/bills/subscriptions-view";
import { Card, CardContent } from "@/components/ui/card";

export const metadata: Metadata = { title: "Subscriptions" };

export default async function SubscriptionsPage() {
  const user = await requireUser();
  const today = todayISO(user.timezone);
  const [subs, categories] = await Promise.all([listSubscriptions(user.id, today), listCategories(user.id)]);

  const active = subs.filter((s) => s.status === "active");
  const monthly = active.reduce((s, x) => s + x.monthlyCost, 0);
  const tiles = [
    { label: "Active subscriptions", value: String(active.length) },
    { label: "Monthly cost", value: formatMoney(monthly, user.currency) },
    { label: "Yearly cost", value: formatMoney(monthly * 12, user.currency) },
  ];

  return (
    <>
      <PageHeader title="Subscriptions" description="Recurring services, what they cost per month, and when they renew." />
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
        <SubscriptionsView subscriptions={subs} categories={categories} currency={user.currency} timezone={user.timezone} />
      </div>
    </>
  );
}
