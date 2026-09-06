import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/session";
import { formatMoney } from "@/lib/format";
import { currentMonthKey } from "@/lib/months";
import { monthKeySchema } from "@/lib/validations/budgets";
import { getBudgetsForMonth } from "@/server/services/budgets";
import { listCategories } from "@/server/services/transactions";
import { PageHeader } from "@/components/shared/page-header";
import { MonthSwitcher } from "@/components/shared/month-switcher";
import { BudgetList } from "@/components/budgets/budget-list";
import { Card, CardContent } from "@/components/ui/card";

export const metadata: Metadata = { title: "Budgets" };

export default async function BudgetsPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const user = await requireUser();
  const current = currentMonthKey(user.timezone);
  const { month: rawMonth } = await searchParams;
  const month = monthKeySchema.safeParse(rawMonth).success ? (rawMonth as string) : current;

  const [data, categories] = await Promise.all([
    getBudgetsForMonth(user.id, month),
    listCategories(user.id),
  ]);

  const budgetedCount = data.categoryBudgets.length + (data.overall ? 1 : 0);
  const tiles = [
    { label: "Spent this month", value: formatMoney(data.totalSpent, user.currency) },
    { label: "Category budgets total", value: formatMoney(data.totalBudgeted, user.currency) },
    { label: "Budgets set", value: String(budgetedCount) },
  ];

  return (
    <>
      <PageHeader
        title="Budgets"
        description="Monthly spending limits per category, with alerts as you approach them."
        actions={<MonthSwitcher month={month} basePath="/budgets" currentMonth={current} />}
      />
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
        <BudgetList
          month={month}
          currency={user.currency}
          overall={data.overall}
          categoryBudgets={data.categoryBudgets}
          totalSpent={data.totalSpent}
          categories={categories}
        />
      </div>
    </>
  );
}
