import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { formatDate, formatMoney, todayISO } from "@/lib/format";
import { listContributions, listGoals } from "@/server/services/goals";
import { PageHeader } from "@/components/shared/page-header";
import { ContributionList } from "@/components/goals/contribution-list";
import { GoalList } from "@/components/goals/goal-list";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Goal" };

export default async function GoalDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const today = todayISO(user.timezone);
  const goals = await listGoals(user.id, today, { includeArchived: true });
  const goal = goals.find((g) => g.id === id);
  if (!goal) notFound();
  const contributions = await listContributions(user.id, goal.id);

  return (
    <>
      <PageHeader
        title={goal.name}
        description={`${formatMoney(goal.currentAmount, user.currency)} of ${formatMoney(goal.targetAmount, user.currency)} saved${goal.targetDate ? ` · target ${formatDate(goal.targetDate)}` : ""}`}
        actions={
          <Link href="/goals" className={cn(buttonVariants({ variant: "outline" }))}>
            All goals
          </Link>
        }
      />
      <div className="space-y-6">
        <GoalList goals={[goal]} currency={user.currency} timezone={user.timezone} showArchived />
        <div>
          <h2 className="mb-3 text-lg font-semibold">Contributions</h2>
          <ContributionList rows={contributions} currency={user.currency} />
        </div>
      </div>
    </>
  );
}
