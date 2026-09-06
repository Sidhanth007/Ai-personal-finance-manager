import "server-only";
import { and, asc, eq, gte, isNull, lte, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { budgets, categories, transactions } from "@/lib/db/schema";
import { monthRange } from "@/lib/months";

import { budgetStatus, type BudgetStatus } from "@/lib/budget-math";

export type { BudgetStatus };
export { budgetStatus };

export type BudgetRow = {
  id: string;
  categoryId: string | null;
  categoryName: string;
  categoryColor: string | null;
  month: string;
  amount: number;
  spent: number;
  remaining: number;
  pct: number;
  alertThresholdPct: number;
  status: BudgetStatus;
};

/** Expense totals per category for a month, plus the overall total. */
export async function spentByCategory(userId: string, monthKey: string) {
  const { start, end } = monthRange(monthKey);
  const rows = await db
    .select({
      categoryId: transactions.categoryId,
      spent: sql<number>`coalesce(sum(${transactions.amount}), 0)`.mapWith(Number),
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        eq(transactions.type, "expense"),
        gte(transactions.occurredOn, start),
        lte(transactions.occurredOn, end),
      ),
    )
    .groupBy(transactions.categoryId);

  const byCategory = new Map<string | null, number>();
  let total = 0;
  for (const r of rows) {
    byCategory.set(r.categoryId, r.spent);
    total += r.spent;
  }
  return { byCategory, total };
}

export async function getBudgetsForMonth(userId: string, monthKey: string): Promise<{
  overall: BudgetRow | null;
  categoryBudgets: BudgetRow[];
  totalSpent: number;
  totalBudgeted: number;
}> {
  const { start } = monthRange(monthKey);
  const [rows, spent] = await Promise.all([
    db
      .select({
        id: budgets.id,
        categoryId: budgets.categoryId,
        categoryName: categories.name,
        categoryColor: categories.color,
        month: budgets.month,
        amount: budgets.amount,
        alertThresholdPct: budgets.alertThresholdPct,
      })
      .from(budgets)
      .leftJoin(categories, eq(budgets.categoryId, categories.id))
      .where(and(eq(budgets.userId, userId), eq(budgets.month, start)))
      .orderBy(asc(categories.name)),
    spentByCategory(userId, monthKey),
  ]);

  const toRow = (r: (typeof rows)[number]): BudgetRow => {
    const s = r.categoryId ? (spent.byCategory.get(r.categoryId) ?? 0) : spent.total;
    return {
      id: r.id,
      categoryId: r.categoryId,
      categoryName: r.categoryName ?? "All expenses",
      categoryColor: r.categoryColor,
      month: r.month,
      amount: r.amount,
      spent: s,
      remaining: r.amount - s,
      pct: r.amount > 0 ? Math.round((s / r.amount) * 100) : 0,
      alertThresholdPct: r.alertThresholdPct,
      status: budgetStatus(s, r.amount, r.alertThresholdPct),
    };
  };

  const overallRow = rows.find((r) => r.categoryId === null);
  const categoryBudgets = rows.filter((r) => r.categoryId !== null).map(toRow);

  return {
    overall: overallRow ? toRow(overallRow) : null,
    categoryBudgets,
    totalSpent: spent.total,
    totalBudgeted: categoryBudgets.reduce((sum, b) => sum + b.amount, 0),
  };
}

export async function getBudget(userId: string, id: string) {
  const [row] = await db
    .select()
    .from(budgets)
    .where(and(eq(budgets.id, id), eq(budgets.userId, userId)))
    .limit(1);
  return row ?? null;
}

export async function hasOverallBudget(userId: string, monthKey: string) {
  const { start } = monthRange(monthKey);
  const [row] = await db
    .select({ id: budgets.id })
    .from(budgets)
    .where(and(eq(budgets.userId, userId), eq(budgets.month, start), isNull(budgets.categoryId)))
    .limit(1);
  return row ?? null;
}
