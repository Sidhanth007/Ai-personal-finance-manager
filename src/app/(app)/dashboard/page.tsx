import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { formatDate, formatMoney, todayISO } from "@/lib/format";
import { currentMonthKey, monthLabel, shiftMonthKey } from "@/lib/months";
import { describeDue } from "@/lib/schedule";
import { categoryBreakdown, dailyCumulative, healthScore, monthTotals, monthlyTrend, recentTransactions } from "@/server/services/analytics";
import { getBudgetsForMonth } from "@/server/services/budgets";
import { upcomingObligations } from "@/server/services/bills";
import { listGoals } from "@/server/services/goals";
import { PageHeader } from "@/components/shared/page-header";
import { HealthCard } from "@/components/dashboard/health-card";
import { KpiTiles, deltaText } from "@/components/dashboard/kpi-tiles";
import { TrendChart } from "@/components/charts/trend-chart";
import { CategoryChart } from "@/components/charts/category-chart";
import { DailyChart } from "@/components/charts/daily-chart";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const user = await requireUser();
  const today = todayISO(user.timezone);
  const month = currentMonthKey(user.timezone);
  const cur = user.currency;

  const [thisMonth, lastMonth, trend, categories, daily, budgets, upcoming, goals, recent, health] = await Promise.all([
    monthTotals(user.id, month),
    monthTotals(user.id, shiftMonthKey(month, -1)),
    monthlyTrend(user.id, month, 6),
    categoryBreakdown(user.id, month),
    dailyCumulative(user.id, month, today),
    getBudgetsForMonth(user.id, month),
    upcomingObligations(user.id, today, 14),
    listGoals(user.id, today),
    recentTransactions(user.id, 6),
    healthScore(user.id, user.timezone, today),
  ]);

  const savingsRate = thisMonth.income > 0 ? Math.round((thisMonth.net / thisMonth.income) * 100) : null;
  const kpis = [
    { label: `Income · ${monthLabel(month)}`, value: formatMoney(thisMonth.income, cur), delta: deltaText(thisMonth.income, lastMonth.income, true) },
    { label: "Expenses", value: formatMoney(thisMonth.expense, cur), delta: deltaText(thisMonth.expense, lastMonth.expense, false) },
    { label: "Net cash flow", value: formatMoney(thisMonth.net, cur, { signed: true }), delta: { text: savingsRate === null ? "No income yet" : `${savingsRate}% of income kept`, good: savingsRate === null ? null : savingsRate >= 20 } },
    { label: "Health score", value: `${health.score} / 100`, delta: { text: health.grade, good: health.score >= 60 ? true : health.score >= 40 ? null : false } },
  ];

  const allBudgets = [...(budgets.overall ? [budgets.overall] : []), ...budgets.categoryBudgets];
  const activeGoals = goals.filter((g) => g.status === "active").slice(0, 3);

  return (
    <>
      <PageHeader title={`Welcome${user.name ? `, ${user.name.split(" ")[0]}` : ""}`} description={`Here is your money at a glance for ${monthLabel(month)}.`} />
      <div className="space-y-4">
        <KpiTiles items={kpis} />

        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Income vs expenses</CardTitle>
              <CardDescription>Last six months.</CardDescription>
            </CardHeader>
            <CardContent>
              <TrendChart data={trend} currency={cur} />
            </CardContent>
          </Card>
          <HealthCard health={health} compact />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Spending by category</CardTitle>
              <CardDescription>{monthLabel(month)} · <Link href="/reports" className="underline-offset-4 hover:underline">full report</Link></CardDescription>
            </CardHeader>
            <CardContent>
              <CategoryChart data={categories} currency={cur} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Spending pace</CardTitle>
              <CardDescription>Cumulative expenses by day, compared with last month.</CardDescription>
            </CardHeader>
            <CardContent>
              <DailyChart data={daily} currency={cur} />
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Budgets</CardTitle>
              <CardDescription><Link href="/budgets" className="underline-offset-4 hover:underline">{allBudgets.length ? `${allBudgets.length} set this month` : "Set a budget"}</Link></CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {allBudgets.length === 0 && <p className="text-sm text-muted-foreground">No budgets yet.</p>}
              {allBudgets.slice(0, 5).map((b) => (
                <div key={b.id} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="truncate">{b.categoryName}</span>
                    <span className={cn("tabular-nums text-xs", b.status === "over" ? "text-rose-600 dark:text-rose-400" : b.status === "warning" ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground")}>{b.pct}%</span>
                  </div>
                  <Progress value={Math.min(100, b.pct)} className={cn(b.status === "over" && "[&_[data-slot=progress-indicator]]:bg-rose-500", b.status === "warning" && "[&_[data-slot=progress-indicator]]:bg-amber-500")} />
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Upcoming in 14 days</CardTitle>
              <CardDescription><Link href="/bills" className="underline-offset-4 hover:underline">Bills</Link> and <Link href="/subscriptions" className="underline-offset-4 hover:underline">subscriptions</Link></CardDescription>
            </CardHeader>
            <CardContent>
              {upcoming.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nothing due in the next two weeks.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {upcoming.slice(0, 6).map((u) => (
                    <li key={`${u.kind}-${u.id}`} className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate">{u.name}</div>
                        <div className={cn("text-xs", u.daysUntil < 0 ? "text-rose-600 dark:text-rose-400" : "text-muted-foreground")}>{describeDue(u.daysUntil)} · {formatDate(u.dueDate)}</div>
                      </div>
                      <span className="shrink-0 tabular-nums">{formatMoney(u.amount, cur)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Savings goals</CardTitle>
              <CardDescription><Link href="/goals" className="underline-offset-4 hover:underline">{activeGoals.length ? "Active goals" : "Create a goal"}</Link></CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {activeGoals.length === 0 && <p className="text-sm text-muted-foreground">No active goals.</p>}
              {activeGoals.map((g) => (
                <div key={g.id} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="truncate">{g.name}</span>
                    <span className="tabular-nums text-xs text-muted-foreground">{g.pct}%</span>
                  </div>
                  <Progress value={g.pct} />
                  <div className="text-xs text-muted-foreground">{formatMoney(g.currentAmount, cur)} of {formatMoney(g.targetAmount, cur)}</div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Recent transactions</CardTitle>
            <CardDescription><Link href="/transactions" className="underline-offset-4 hover:underline">See all</Link></CardDescription>
          </CardHeader>
          <CardContent>
            {recent.length === 0 ? (
              <p className="text-sm text-muted-foreground">No transactions yet. <Link href="/transactions" className="underline">Add your first one</Link>.</p>
            ) : (
              <ul className="divide-y text-sm">
                {recent.map((t) => (
                  <li key={t.id} className="flex items-center justify-between gap-3 py-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: t.categoryColor ?? "#64748b" }} aria-hidden />
                      <span className="truncate">{t.description}</span>
                      <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">{t.categoryName ?? "Uncategorised"} · {formatDate(t.occurredOn)}</span>
                    </div>
                    <span className={cn("shrink-0 tabular-nums", t.type === "income" && "text-emerald-600 dark:text-emerald-400")}>{t.type === "income" ? "+" : "−"}{formatMoney(t.amount, cur)}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
