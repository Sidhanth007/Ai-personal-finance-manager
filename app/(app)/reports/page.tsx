import type { Metadata } from "next";
import Link from "next/link";
import { Download } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { formatDate, formatMoney, todayISO } from "@/lib/format";
import { currentMonthKey, monthLabel, monthRange, shiftMonthKey } from "@/lib/months";
import { monthKeySchema } from "@/lib/validations/budgets";
import { categoryBreakdown, dailyCumulative, healthScore, monthTotals, monthlyTrend, topMerchants, unusualExpenses } from "@/server/services/analytics";
import { getBudgetsForMonth } from "@/server/services/budgets";
import { PageHeader } from "@/components/shared/page-header";
import { MonthSwitcher } from "@/components/shared/month-switcher";
import { HealthCard } from "@/components/dashboard/health-card";
import { KpiTiles, deltaText } from "@/components/dashboard/kpi-tiles";
import { TrendChart } from "@/components/charts/trend-chart";
import { CategoryChart } from "@/components/charts/category-chart";
import { DailyChart } from "@/components/charts/daily-chart";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Reports" };

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const user = await requireUser();
  const today = todayISO(user.timezone);
  const current = currentMonthKey(user.timezone);
  const { month: raw } = await searchParams;
  const month = monthKeySchema.safeParse(raw).success ? (raw as string) : current;
  const cur = user.currency;

  const [totals, prevTotals, trend, expenseCats, incomeCats, daily, merchants, budgets, unusual, health] = await Promise.all([
    monthTotals(user.id, month),
    monthTotals(user.id, shiftMonthKey(month, -1)),
    monthlyTrend(user.id, month, 12),
    categoryBreakdown(user.id, month, "expense"),
    categoryBreakdown(user.id, month, "income"),
    dailyCumulative(user.id, month, today),
    topMerchants(user.id, month, 5),
    getBudgetsForMonth(user.id, month),
    unusualExpenses(user.id, today, 5),
    healthScore(user.id, user.timezone, today),
  ]);

  const savingsRate = totals.income > 0 ? Math.round((totals.net / totals.income) * 100) : null;
  const range = monthRange(month);
  const exportHref = `/api/transactions/export?from=${range.start}&to=${range.end}`;
  const allBudgets = [...(budgets.overall ? [budgets.overall] : []), ...budgets.categoryBudgets];
  const avgDaily = totals.expense / Number(range.end.slice(8, 10));

  return (
    <>
      <PageHeader
        title="Reports"
        description={`Monthly summary for ${monthLabel(month)}.`}
        actions={
          <>
            <MonthSwitcher month={month} basePath="/reports" currentMonth={current} />
            <a href={exportHref} className={cn(buttonVariants({ variant: "outline" }))}>
              <Download className="size-4" /> Export month
            </a>
          </>
        }
      />
      <div className="space-y-4">
        <KpiTiles
          items={[
            { label: "Income", value: formatMoney(totals.income, cur), delta: deltaText(totals.income, prevTotals.income, true) },
            { label: "Expenses", value: formatMoney(totals.expense, cur), delta: deltaText(totals.expense, prevTotals.expense, false) },
            { label: "Net", value: formatMoney(totals.net, cur, { signed: true }), delta: { text: savingsRate === null ? "No income" : `${savingsRate}% savings rate`, good: savingsRate === null ? null : savingsRate >= 20 } },
            { label: "Average daily spend", value: formatMoney(Math.round(avgDaily), cur), delta: { text: `${expenseCats.reduce((s, c) => s + c.count, 0)} expense transactions`, good: null } },
          ]}
        />

        <Card>
          <CardHeader>
            <CardTitle>Twelve-month trend</CardTitle>
            <CardDescription>Income and expenses per month, ending {monthLabel(month)}.</CardDescription>
          </CardHeader>
          <CardContent>
            <TrendChart data={trend} currency={cur} />
          </CardContent>
        </Card>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Expenses by category</CardTitle>
              <CardDescription>Share of this month&rsquo;s spending.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <CategoryChart data={expenseCats} currency={cur} />
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Category</TableHead>
                      <TableHead className="text-right">This month</TableHead>
                      <TableHead className="text-right">Last month</TableHead>
                      <TableHead className="text-right">Change</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {expenseCats.length === 0 && (
                      <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">No expenses this month.</TableCell></TableRow>
                    )}
                    {expenseCats.map((c) => {
                      const change = c.previous > 0 ? Math.round(((c.amount - c.previous) / c.previous) * 100) : null;
                      return (
                        <TableRow key={c.categoryId ?? "none"}>
                          <TableCell>
                            <span className="inline-flex items-center gap-2">
                              <span className="size-2 rounded-full" style={{ backgroundColor: c.color ?? "#64748b" }} aria-hidden />
                              {c.name} <span className="text-xs text-muted-foreground">{c.pct}%</span>
                            </span>
                          </TableCell>
                          <TableCell className="text-right tabular-nums">{formatMoney(c.amount, cur)}</TableCell>
                          <TableCell className="text-right tabular-nums text-muted-foreground">{formatMoney(c.previous, cur)}</TableCell>
                          <TableCell className={cn("text-right tabular-nums text-xs", change === null ? "text-muted-foreground" : change > 0 ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400")}>
                            {change === null ? "new" : `${change > 0 ? "+" : ""}${change}%`}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Spending pace</CardTitle>
                <CardDescription>Cumulative by day versus the previous month.</CardDescription>
              </CardHeader>
              <CardContent>
                <DailyChart data={daily} currency={cur} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Income sources</CardTitle>
              </CardHeader>
              <CardContent>
                {incomeCats.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No income this month.</p>
                ) : (
                  <ul className="space-y-1 text-sm">
                    {incomeCats.map((c) => (
                      <li key={c.categoryId ?? "none"} className="flex justify-between">
                        <span>{c.name}</span>
                        <span className="tabular-nums">{formatMoney(c.amount, cur)} <span className="text-xs text-muted-foreground">{c.pct}%</span></span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Top merchants</CardTitle>
            </CardHeader>
            <CardContent>
              {merchants.length === 0 ? (
                <p className="text-sm text-muted-foreground">No merchants recorded this month.</p>
              ) : (
                <ul className="space-y-1 text-sm">
                  {merchants.map((m) => (
                    <li key={m.merchant} className="flex justify-between">
                      <span className="truncate">{m.merchant} <span className="text-xs text-muted-foreground">×{m.count}</span></span>
                      <span className="tabular-nums">{formatMoney(m.amount, cur)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Budget performance</CardTitle>
              <CardDescription><Link href={`/budgets?month=${month}`} className="underline-offset-4 hover:underline">Manage budgets</Link></CardDescription>
            </CardHeader>
            <CardContent>
              {allBudgets.length === 0 ? (
                <p className="text-sm text-muted-foreground">No budgets for this month.</p>
              ) : (
                <ul className="space-y-1 text-sm">
                  {allBudgets.map((b) => (
                    <li key={b.id} className="flex justify-between">
                      <span className="truncate">{b.categoryName}</span>
                      <span className={cn("tabular-nums", b.status === "over" ? "text-rose-600 dark:text-rose-400" : b.status === "warning" ? "text-amber-600 dark:text-amber-400" : "")}>
                        {b.pct}% <span className="text-xs text-muted-foreground">of {formatMoney(b.amount, cur)}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Unusual expenses</CardTitle>
              <CardDescription>Last 90 days, well above the category&rsquo;s usual size.</CardDescription>
            </CardHeader>
            <CardContent>
              {unusual.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nothing stands out.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {unusual.map((u) => (
                    <li key={u.id}>
                      <div className="flex justify-between">
                        <span className="truncate">{u.description}</span>
                        <span className="tabular-nums">{formatMoney(u.amount, cur)}</span>
                      </div>
                      <div className="text-xs text-muted-foreground">{u.categoryName} · {formatDate(u.occurredOn)} · typical {formatMoney(u.categoryAvg, cur)}</div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        <HealthCard health={health} />
      </div>
    </>
  );
}
