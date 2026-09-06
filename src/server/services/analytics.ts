import "server-only";
import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { bills, categories, savingsGoals, transactions } from "@/lib/db/schema";
import { computeHealthScore, type HealthScore } from "@/lib/health-score";
import { currentMonthKey, monthRange, shiftMonthKey } from "@/lib/months";
import { getBudgetsForMonth } from "./budgets";

export type MonthTotals = { month: string; income: number; expense: number; net: number };

export async function monthTotals(userId: string, monthKey: string): Promise<MonthTotals> {
  const { start, end } = monthRange(monthKey);
  const [row] = await db
    .select({
      income: sql<number>`coalesce(sum(case when ${transactions.type} = 'income' then ${transactions.amount} else 0 end), 0)`.mapWith(Number),
      expense: sql<number>`coalesce(sum(case when ${transactions.type} = 'expense' then ${transactions.amount} else 0 end), 0)`.mapWith(Number),
    })
    .from(transactions)
    .where(and(eq(transactions.userId, userId), gte(transactions.occurredOn, start), lte(transactions.occurredOn, end)));
  return { month: monthKey, income: row.income, expense: row.expense, net: row.income - row.expense };
}

/** Income and expense per month for the `months` months ending at `endMonth` (inclusive). */
export async function monthlyTrend(userId: string, endMonth: string, months = 12): Promise<MonthTotals[]> {
  const startMonth = shiftMonthKey(endMonth, -(months - 1));
  const { start } = monthRange(startMonth);
  const { end } = monthRange(endMonth);
  const rows = await db
    .select({
      month: sql<string>`to_char(${transactions.occurredOn}, 'YYYY-MM')`,
      income: sql<number>`coalesce(sum(case when ${transactions.type} = 'income' then ${transactions.amount} else 0 end), 0)`.mapWith(Number),
      expense: sql<number>`coalesce(sum(case when ${transactions.type} = 'expense' then ${transactions.amount} else 0 end), 0)`.mapWith(Number),
    })
    .from(transactions)
    .where(and(eq(transactions.userId, userId), gte(transactions.occurredOn, start), lte(transactions.occurredOn, end)))
    .groupBy(sql`to_char(${transactions.occurredOn}, 'YYYY-MM')`);
  const map = new Map(rows.map((r) => [r.month, r]));
  const out: MonthTotals[] = [];
  for (let i = 0; i < months; i++) {
    const m = shiftMonthKey(startMonth, i);
    const r = map.get(m);
    out.push({ month: m, income: r?.income ?? 0, expense: r?.expense ?? 0, net: (r?.income ?? 0) - (r?.expense ?? 0) });
  }
  return out;
}

export type CategoryShare = {
  categoryId: string | null;
  name: string;
  color: string | null;
  amount: number;
  previous: number;
  pct: number;
  count: number;
};

export async function categoryBreakdown(userId: string, monthKey: string, type: "expense" | "income" = "expense"): Promise<CategoryShare[]> {
  const cur = monthRange(monthKey);
  const prev = monthRange(shiftMonthKey(monthKey, -1));
  const query = (r: { start: string; end: string }) =>
    db
      .select({
        categoryId: transactions.categoryId,
        name: categories.name,
        color: categories.color,
        amount: sql<number>`coalesce(sum(${transactions.amount}), 0)`.mapWith(Number),
        count: sql<number>`count(*)`.mapWith(Number),
      })
      .from(transactions)
      .leftJoin(categories, eq(transactions.categoryId, categories.id))
      .where(and(eq(transactions.userId, userId), eq(transactions.type, type), gte(transactions.occurredOn, r.start), lte(transactions.occurredOn, r.end)))
      .groupBy(transactions.categoryId, categories.name, categories.color);
  const [current, previous] = await Promise.all([query(cur), query(prev)]);
  const prevMap = new Map(previous.map((p) => [p.categoryId, p.amount]));
  const total = current.reduce((s, c) => s + c.amount, 0);
  return current
    .map((c) => ({
      categoryId: c.categoryId,
      name: c.name ?? "Uncategorised",
      color: c.color,
      amount: c.amount,
      previous: prevMap.get(c.categoryId) ?? 0,
      pct: total > 0 ? Math.round((c.amount / total) * 1000) / 10 : 0,
      count: c.count,
    }))
    .sort((a, b) => b.amount - a.amount);
}

export type DailyPoint = { day: number; current: number | null; previous: number };

/** Cumulative expense by day of month for the month and the previous month. */
export async function dailyCumulative(userId: string, monthKey: string, today: string): Promise<DailyPoint[]> {
  const cur = monthRange(monthKey);
  const prev = monthRange(shiftMonthKey(monthKey, -1));
  const rows = await db
    .select({
      day: transactions.occurredOn,
      amount: sql<number>`coalesce(sum(${transactions.amount}), 0)`.mapWith(Number),
    })
    .from(transactions)
    .where(and(eq(transactions.userId, userId), eq(transactions.type, "expense"), gte(transactions.occurredOn, prev.start), lte(transactions.occurredOn, cur.end)))
    .groupBy(transactions.occurredOn);

  const byDay = (start: string) => {
    const m = new Map<number, number>();
    for (const r of rows) if (r.day.startsWith(start.slice(0, 7))) m.set(Number(r.day.slice(8, 10)), r.amount);
    return m;
  };
  const curMap = byDay(cur.start);
  const prevMap = byDay(prev.start);
  const daysInMonth = Number(cur.end.slice(8, 10));
  const isCurrentMonth = today.startsWith(monthKey);
  const todayDay = isCurrentMonth ? Number(today.slice(8, 10)) : daysInMonth;

  const out: DailyPoint[] = [];
  let c = 0;
  let p = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    c += curMap.get(d) ?? 0;
    p += prevMap.get(d) ?? 0;
    out.push({ day: d, current: d <= todayDay ? c : null, previous: p });
  }
  return out;
}

export async function topMerchants(userId: string, monthKey: string, limit = 5) {
  const { start, end } = monthRange(monthKey);
  return db
    .select({
      merchant: transactions.merchant,
      amount: sql<number>`coalesce(sum(${transactions.amount}), 0)`.mapWith(Number),
      count: sql<number>`count(*)`.mapWith(Number),
    })
    .from(transactions)
    .where(and(eq(transactions.userId, userId), eq(transactions.type, "expense"), gte(transactions.occurredOn, start), lte(transactions.occurredOn, end), sql`${transactions.merchant} is not null and ${transactions.merchant} <> ''`))
    .groupBy(transactions.merchant)
    .orderBy(desc(sql`sum(${transactions.amount})`))
    .limit(limit);
}

export async function recentTransactions(userId: string, limit = 8) {
  return db
    .select({
      id: transactions.id,
      type: transactions.type,
      amount: transactions.amount,
      description: transactions.description,
      occurredOn: transactions.occurredOn,
      categoryName: categories.name,
      categoryColor: categories.color,
    })
    .from(transactions)
    .leftJoin(categories, eq(transactions.categoryId, categories.id))
    .where(eq(transactions.userId, userId))
    .orderBy(desc(transactions.occurredOn), desc(transactions.createdAt))
    .limit(limit);
}

/** Detects expenses well above the category's typical size over the last 90 days. */
export async function unusualExpenses(userId: string, today: string, limit = 5) {
  const rows = await db.execute(sql`
    with recent as (
      select t.id, t.description, t.merchant, t.amount, t.occurred_on, t.category_id, c.name as category_name
      from transactions t left join categories c on c.id = t.category_id
      where t.user_id = ${userId} and t.type = 'expense' and t.occurred_on >= (${today}::date - interval '90 days')
    ),
    stats as (
      select category_id, avg(amount) as mean, stddev_pop(amount) as sd, count(*) as n
      from recent group by category_id
    )
    select r.id, r.description, r.merchant, r.amount::bigint as amount, r.occurred_on, r.category_name,
           round(s.mean)::bigint as category_avg
    from recent r join stats s on s.category_id is not distinct from r.category_id
    where s.n >= 4 and r.amount > s.mean + 2 * coalesce(s.sd, 0) and r.amount > s.mean * 1.5
    order by (r.amount - s.mean) desc
    limit ${limit}`);
  return (rows as unknown as { id: string; description: string; merchant: string | null; amount: string; occurred_on: string; category_name: string | null; category_avg: string }[]).map((r) => ({
    id: r.id,
    description: r.description,
    merchant: r.merchant,
    amount: Number(r.amount),
    occurredOn: r.occurred_on,
    categoryName: r.category_name ?? "Uncategorised",
    categoryAvg: Number(r.category_avg),
  }));
}

export async function healthScore(userId: string, timezone: string, today: string): Promise<HealthScore> {
  const monthKey = currentMonthKey(timezone);
  const [trend, budgets, overdue, goals] = await Promise.all([
    monthlyTrend(userId, monthKey, 6),
    getBudgetsForMonth(userId, monthKey),
    db
      .select({ n: sql<number>`count(*)`.mapWith(Number) })
      .from(bills)
      .where(and(eq(bills.userId, userId), sql`${bills.status} <> 'paid'`, sql`${bills.dueDate} < ${today}`)),
    db
      .select({ saved: sql<number>`coalesce(sum(${savingsGoals.currentAmount}), 0)`.mapWith(Number) })
      .from(savingsGoals)
      .where(and(eq(savingsGoals.userId, userId), sql`${savingsGoals.status} <> 'archived'`)),
  ]);
  const last3 = trend.slice(-3);
  const allBudgets = [...(budgets.overall ? [budgets.overall] : []), ...budgets.categoryBudgets];
  return computeHealthScore({
    income3m: last3.reduce((s, m) => s + m.income, 0),
    expense3m: last3.reduce((s, m) => s + m.expense, 0),
    monthlyExpenses: trend.map((m) => m.expense),
    budgetsTotal: allBudgets.length,
    budgetsOver: allBudgets.filter((b) => b.status === "over").length,
    overdueBills: overdue[0]?.n ?? 0,
    savingsBalance: goals[0]?.saved ?? 0,
  });
}
