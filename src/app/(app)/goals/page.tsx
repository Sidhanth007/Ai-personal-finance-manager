import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/session";
import { formatMoney, todayISO } from "@/lib/format";
import { goalsSummary, listGoals } from "@/server/services/goals";
import { PageHeader } from "@/components/shared/page-header";
import { GoalList } from "@/components/goals/goal-list";
import { Card, CardContent } from "@/components/ui/card";

export const metadata: Metadata = { title: "Savings goals" };

export default async function GoalsPage({ searchParams }: { searchParams: Promise<{ archived?: string }> }) {
  const user = await requireUser();
  const { archived } = await searchParams;
  const showArchived = archived === "1";
  const today = todayISO(user.timezone);
  const [goals, summary] = await Promise.all([
    listGoals(user.id, today, { includeArchived: showArchived }),
    goalsSummary(user.id),
  ]);

  const tiles = [
    { label: "Active goals", value: String(summary.active) },
    { label: "Total saved", value: formatMoney(summary.saved, user.currency) },
    { label: "Active targets", value: formatMoney(summary.target, user.currency) },
  ];

  return (
    <>
      <PageHeader title="Savings goals" description="Plan what you are saving for and track progress toward it." />
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
        <GoalList goals={goals} currency={user.currency} timezone={user.timezone} showArchived={showArchived} />
      </div>
    </>
  );
}
