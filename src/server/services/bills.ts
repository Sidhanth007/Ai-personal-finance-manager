import "server-only";
import { and, asc, eq, gte, lte, ne } from "drizzle-orm";
import { db } from "@/lib/db";
import { bills, categories, recurringRules, subscriptions } from "@/lib/db/schema";
import { daysUntil, monthlyEquivalent } from "@/lib/schedule";
import { addDays, format, parseISO } from "date-fns";

export type BillRow = {
  id: string;
  name: string;
  amount: number;
  dueDate: string;
  frequency: "once" | "weekly" | "monthly" | "yearly";
  status: "upcoming" | "paid" | "overdue";
  categoryId: string | null;
  categoryName: string | null;
  categoryColor: string | null;
  reminderDaysBefore: number;
  autoCreateTransaction: boolean;
  notes: string | null;
  paidAt: Date | null;
  daysUntilDue: number;
};

export type SubscriptionRow = {
  id: string;
  name: string;
  amount: number;
  billingCycle: "weekly" | "monthly" | "yearly";
  nextBillingDate: string;
  startedOn: string | null;
  status: "active" | "paused" | "cancelled";
  categoryId: string | null;
  categoryName: string | null;
  categoryColor: string | null;
  reminderDaysBefore: number;
  autoCreateTransaction: boolean;
  notes: string | null;
  daysUntilRenewal: number;
  monthlyCost: number;
};

export type RecurringRuleRow = {
  id: string;
  type: "income" | "expense";
  amount: number;
  description: string;
  categoryId: string | null;
  categoryName: string | null;
  frequency: "daily" | "weekly" | "monthly" | "yearly";
  interval: number;
  startDate: string;
  endDate: string | null;
  nextRunOn: string;
  lastRunOn: string | null;
  isActive: boolean;
};

export async function listBills(userId: string, today: string): Promise<BillRow[]> {
  const rows = await db
    .select({
      id: bills.id,
      name: bills.name,
      amount: bills.amount,
      dueDate: bills.dueDate,
      frequency: bills.frequency,
      status: bills.status,
      categoryId: bills.categoryId,
      categoryName: categories.name,
      categoryColor: categories.color,
      reminderDaysBefore: bills.reminderDaysBefore,
      autoCreateTransaction: bills.autoCreateTransaction,
      notes: bills.notes,
      paidAt: bills.paidAt,
    })
    .from(bills)
    .leftJoin(categories, eq(bills.categoryId, categories.id))
    .where(eq(bills.userId, userId))
    .orderBy(asc(bills.status), asc(bills.dueDate));

  return rows.map((r) => {
    const d = daysUntil(r.dueDate, today);
    const status = r.status === "upcoming" && d < 0 ? "overdue" : r.status;
    return { ...r, status, daysUntilDue: d };
  });
}

export async function listSubscriptions(userId: string, today: string): Promise<SubscriptionRow[]> {
  const rows = await db
    .select({
      id: subscriptions.id,
      name: subscriptions.name,
      amount: subscriptions.amount,
      billingCycle: subscriptions.billingCycle,
      nextBillingDate: subscriptions.nextBillingDate,
      startedOn: subscriptions.startedOn,
      status: subscriptions.status,
      categoryId: subscriptions.categoryId,
      categoryName: categories.name,
      categoryColor: categories.color,
      reminderDaysBefore: subscriptions.reminderDaysBefore,
      autoCreateTransaction: subscriptions.autoCreateTransaction,
      notes: subscriptions.notes,
    })
    .from(subscriptions)
    .leftJoin(categories, eq(subscriptions.categoryId, categories.id))
    .where(eq(subscriptions.userId, userId))
    .orderBy(asc(subscriptions.status), asc(subscriptions.nextBillingDate));

  return rows.map((r) => ({
    ...r,
    daysUntilRenewal: daysUntil(r.nextBillingDate, today),
    monthlyCost: monthlyEquivalent(r.amount, r.billingCycle),
  }));
}

export async function listRecurringRules(userId: string): Promise<RecurringRuleRow[]> {
  return db
    .select({
      id: recurringRules.id,
      type: recurringRules.type,
      amount: recurringRules.amount,
      description: recurringRules.description,
      categoryId: recurringRules.categoryId,
      categoryName: categories.name,
      frequency: recurringRules.frequency,
      interval: recurringRules.interval,
      startDate: recurringRules.startDate,
      endDate: recurringRules.endDate,
      nextRunOn: recurringRules.nextRunOn,
      lastRunOn: recurringRules.lastRunOn,
      isActive: recurringRules.isActive,
    })
    .from(recurringRules)
    .leftJoin(categories, eq(recurringRules.categoryId, categories.id))
    .where(eq(recurringRules.userId, userId))
    .orderBy(asc(recurringRules.nextRunOn));
}

/** Bills and active subscriptions due within the next `days` days (inclusive of overdue bills). */
export async function upcomingObligations(userId: string, today: string, days = 14) {
  const until = format(addDays(parseISO(today), days), "yyyy-MM-dd");
  const [b, s] = await Promise.all([
    db
      .select({ id: bills.id, name: bills.name, amount: bills.amount, dueDate: bills.dueDate })
      .from(bills)
      .where(and(eq(bills.userId, userId), ne(bills.status, "paid"), lte(bills.dueDate, until)))
      .orderBy(asc(bills.dueDate)),
    db
      .select({ id: subscriptions.id, name: subscriptions.name, amount: subscriptions.amount, dueDate: subscriptions.nextBillingDate })
      .from(subscriptions)
      .where(and(eq(subscriptions.userId, userId), eq(subscriptions.status, "active"), gte(subscriptions.nextBillingDate, today), lte(subscriptions.nextBillingDate, until)))
      .orderBy(asc(subscriptions.nextBillingDate)),
  ]);
  return [
    ...b.map((x) => ({ ...x, kind: "bill" as const, daysUntil: daysUntil(x.dueDate, today) })),
    ...s.map((x) => ({ ...x, kind: "subscription" as const, daysUntil: daysUntil(x.dueDate, today) })),
  ].sort((x, y) => x.dueDate.localeCompare(y.dueDate));
}

export async function subscriptionMonthlyTotal(userId: string) {
  const rows = await db
    .select({ amount: subscriptions.amount, billingCycle: subscriptions.billingCycle })
    .from(subscriptions)
    .where(and(eq(subscriptions.userId, userId), eq(subscriptions.status, "active")));
  return rows.reduce((sum, r) => sum + monthlyEquivalent(r.amount, r.billingCycle), 0);
}
