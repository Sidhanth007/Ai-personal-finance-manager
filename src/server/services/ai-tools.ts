import "server-only";
import { tool } from "ai";
import { z } from "zod";
import { fromMinorUnits } from "@/lib/format";
import { currentMonthKey, monthLabel, shiftMonthKey } from "@/lib/months";
import { monthKeySchema } from "@/lib/validations/budgets";
import { categoryBreakdown, healthScore, monthlyTrend, topMerchants, unusualExpenses } from "./analytics";
import { getBudgetsForMonth } from "./budgets";
import { upcomingObligations, subscriptionMonthlyTotal } from "./bills";
import { listGoals } from "./goals";

type Ctx = { userId: string; currency: string; timezone: string; today: string };

/**
 * Read-only tools bound to one user. Every result is aggregated: no emails,
 * ids, notes, or merchant-level identifiers beyond what the user already sees.
 */
export function buildFinanceTools(ctx: Ctx) {
  const major = (minor: number) => Number(fromMinorUnits(minor, ctx.currency).toFixed(2));
  const thisMonth = currentMonthKey(ctx.timezone);
  const monthArg = z
    .string()
    .optional()
    .describe('Month as YYYY-MM. Defaults to the current month. "previous" means last month.');
  const resolveMonth = (m?: string) => (m === "previous" ? shiftMonthKey(thisMonth, -1) : monthKeySchema.safeParse(m).success ? (m as string) : thisMonth);

  return {
    getSpendingSummary: tool({
      description: "Income, expenses, and net per month for the last N months (most recent last). Use for trends, savings rate, and 'how am I doing' questions.",
      inputSchema: z.object({ months: z.number().int().min(1).max(12).default(6) }),
      execute: async ({ months }) => {
        const rows = await monthlyTrend(ctx.userId, thisMonth, months);
        return rows.map((r) => ({ month: r.month, label: monthLabel(r.month), income: major(r.income), expenses: major(r.expense), net: major(r.net), savingsRatePct: r.income > 0 ? Math.round((r.net / r.income) * 100) : null }));
      },
    }),

    getCategoryBreakdown: tool({
      description: "Expenses by category for a month, with the previous month for comparison and share of total.",
      inputSchema: z.object({ month: monthArg }),
      execute: async ({ month }) => {
        const key = resolveMonth(month);
        const rows = await categoryBreakdown(ctx.userId, key, "expense");
        const merchants = await topMerchants(ctx.userId, key, 5);
        return {
          month: key,
          label: monthLabel(key),
          totalExpenses: major(rows.reduce((s, r) => s + r.amount, 0)),
          categories: rows.map((r) => ({ category: r.name, amount: major(r.amount), previousMonth: major(r.previous), sharePct: r.pct, transactions: r.count })),
          topMerchants: merchants.map((m) => ({ merchant: m.merchant, amount: major(m.amount), transactions: m.count })),
        };
      },
    }),

    getBudgetStatus: tool({
      description: "Budgets for a month: limit, spent, percent used, and status (ok, warning, over).",
      inputSchema: z.object({ month: monthArg }),
      execute: async ({ month }) => {
        const key = resolveMonth(month);
        const b = await getBudgetsForMonth(ctx.userId, key);
        const all = [...(b.overall ? [b.overall] : []), ...b.categoryBudgets];
        return {
          month: key,
          label: monthLabel(key),
          totalSpent: major(b.totalSpent),
          budgets: all.map((x) => ({ category: x.categoryName, limit: major(x.amount), spent: major(x.spent), remaining: major(x.remaining), percentUsed: x.pct, status: x.status, alertAtPct: x.alertThresholdPct })),
        };
      },
    }),

    suggestBudget: tool({
      description: "Deterministic budget suggestion per expense category from the last 3 months of spending. Returns suggested monthly limits the user can edit. Call this when asked to create or improve a budget.",
      inputSchema: z.object({ targetReductionPct: z.number().min(0).max(50).default(10).describe("How much below the 3-month average to suggest for discretionary categories.") }),
      execute: async ({ targetReductionPct }) => {
        const months = [thisMonth, shiftMonthKey(thisMonth, -1), shiftMonthKey(thisMonth, -2)];
        const breakdowns = await Promise.all(months.map((m) => categoryBreakdown(ctx.userId, m, "expense")));
        const totals = new Map<string, { sum: number; monthsSeen: number }>();
        for (const rows of breakdowns) for (const r of rows) {
          const t = totals.get(r.name) ?? { sum: 0, monthsSeen: 0 };
          t.sum += r.amount;
          t.monthsSeen += 1;
          totals.set(r.name, t);
        }
        const essentials = new Set(["Housing", "Utilities", "Groceries", "Health", "Education", "Savings Transfer"]);
        const suggestions = [...totals.entries()]
          .map(([category, t]) => {
            const avg = t.sum / 3;
            const discretionary = !essentials.has(category);
            const suggested = discretionary ? avg * (1 - targetReductionPct / 100) : avg * 1.05;
            return { category, threeMonthAverage: major(Math.round(avg)), suggestedLimit: major(Math.round(suggested / 100) * 100), treatedAs: discretionary ? "discretionary" : "essential" };
          })
          .sort((a, b) => b.threeMonthAverage - a.threeMonthAverage);
        const trend = await monthlyTrend(ctx.userId, thisMonth, 3);
        const avgIncome = trend.reduce((s, m) => s + m.income, 0) / 3;
        return {
          basedOnMonths: months.map(monthLabel),
          averageMonthlyIncome: major(Math.round(avgIncome)),
          suggestedTotal: major(Math.round(suggestions.reduce((s, x) => s + x.suggestedLimit * 100, 0))),
          suggestions,
          note: "Essentials are set slightly above average; discretionary categories are trimmed by the requested percentage. Round numbers are used so they are easy to remember.",
        };
      },
    }),

    getUnusualExpenses: tool({
      description: "Expenses in the last 90 days that are far above the typical size for their category.",
      inputSchema: z.object({}),
      execute: async () => {
        const rows = await unusualExpenses(ctx.userId, ctx.today, 8);
        return rows.map((r) => ({ description: r.description, category: r.categoryName, date: r.occurredOn, amount: major(r.amount), typicalForCategory: major(r.categoryAvg) }));
      },
    }),

    getSavingsGoals: tool({
      description: "Savings goals with progress, recent monthly pace, projected completion date, and the monthly amount needed to hit the target date.",
      inputSchema: z.object({}),
      execute: async () => {
        const goals = await listGoals(ctx.userId, ctx.today);
        return goals.map((g) => ({ name: g.name, status: g.status, target: major(g.targetAmount), saved: major(g.currentAmount), remaining: major(g.remaining), percent: g.pct, targetDate: g.targetDate, recentMonthlyPace: major(g.monthlyPace), projectedFinish: g.projectedDate, neededPerMonthForTargetDate: g.requiredMonthly === null ? null : major(g.requiredMonthly), onTrack: g.onTrack }));
      },
    }),

    getUpcomingBills: tool({
      description: "Bills and subscription renewals due in the next N days, plus the total monthly subscription cost.",
      inputSchema: z.object({ days: z.number().int().min(1).max(90).default(30) }),
      execute: async ({ days }) => {
        const [items, subsMonthly] = await Promise.all([upcomingObligations(ctx.userId, ctx.today, days), subscriptionMonthlyTotal(ctx.userId)]);
        return { days, items: items.map((i) => ({ kind: i.kind, name: i.name, amount: major(i.amount), dueDate: i.dueDate, daysUntil: i.daysUntil, overdue: i.daysUntil < 0 })), totalDue: major(items.reduce((s, i) => s + i.amount, 0)), subscriptionsMonthlyCost: major(subsMonthly) };
      },
    }),

    getHealthScore: tool({
      description: "The app's deterministic financial health score (0-100) with the five factors and how each was computed. Explain it; do not recompute it.",
      inputSchema: z.object({}),
      execute: async () => healthScore(ctx.userId, ctx.timezone, ctx.today),
    }),
  };
}
