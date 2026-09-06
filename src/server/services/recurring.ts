import "server-only";
import { and, eq, lte, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { bills, recurringRules, subscriptions, transactions, users } from "@/lib/db/schema";
import { todayISO } from "@/lib/format";
import { advanceDate } from "@/lib/schedule";

export type EngineResult = {
  recurringCreated: number;
  subscriptionsCharged: number;
  billsMarkedOverdue: number;
};

/**
 * Creates transactions for recurring rules whose next run date has arrived,
 * charges active subscriptions whose billing date has arrived (advancing it),
 * and flags overdue bills. Safe to run repeatedly: each rule/subscription only
 * advances past dates that are already due.
 *
 * Runs for a single user when `userId` is given, otherwise for everyone,
 * each evaluated on "today" in their own timezone.
 */
export async function runRecurringEngine(userId?: string): Promise<EngineResult> {
  const result: EngineResult = { recurringCreated: 0, subscriptionsCharged: 0, billsMarkedOverdue: 0 };

  const userRows = await db
    .select({ id: users.id, timezone: users.timezone, currency: users.currency })
    .from(users)
    .where(and(eq(users.isActive, true), userId ? eq(users.id, userId) : undefined));

  for (const u of userRows) {
    const today = todayISO(u.timezone);

    // 1. recurring rules
    const rules = await db
      .select()
      .from(recurringRules)
      .where(and(eq(recurringRules.userId, u.id), eq(recurringRules.isActive, true), lte(recurringRules.nextRunOn, today)));

    for (const rule of rules) {
      let next = rule.nextRunOn;
      let last = rule.lastRunOn;
      let guard = 0;
      while (next <= today && guard < 400) {
        if (rule.endDate && next > rule.endDate) break;
        await db.insert(transactions).values({
          userId: u.id,
          type: rule.type,
          amount: rule.amount,
          currency: u.currency,
          categoryId: rule.categoryId,
          description: rule.description,
          occurredOn: next,
          source: "recurring",
          recurringRuleId: rule.id,
        });
        result.recurringCreated++;
        last = next;
        next = advanceDate(next, rule.frequency, rule.interval);
        guard++;
      }
      const finished = rule.endDate !== null && next > rule.endDate;
      await db
        .update(recurringRules)
        .set({ nextRunOn: next, lastRunOn: last, isActive: !finished, updatedAt: new Date() })
        .where(eq(recurringRules.id, rule.id));
    }

    // 2. subscriptions
    const subs = await db
      .select()
      .from(subscriptions)
      .where(and(eq(subscriptions.userId, u.id), eq(subscriptions.status, "active"), lte(subscriptions.nextBillingDate, today)));

    for (const sub of subs) {
      let next = sub.nextBillingDate;
      let guard = 0;
      while (next <= today && guard < 120) {
        if (sub.autoCreateTransaction) {
          await db.insert(transactions).values({
            userId: u.id,
            type: "expense",
            amount: sub.amount,
            currency: u.currency,
            categoryId: sub.categoryId,
            description: `${sub.name} subscription`,
            merchant: sub.name,
            occurredOn: next,
            source: "recurring",
            externalRef: `subscription:${sub.id}:${next}`,
          });
          result.subscriptionsCharged++;
        }
        next = advanceDate(next, sub.billingCycle);
        guard++;
      }
      await db
        .update(subscriptions)
        .set({ nextBillingDate: next, lastRemindedAt: null, updatedAt: new Date() })
        .where(eq(subscriptions.id, sub.id));
    }

    // 3. overdue bills
    const overdue = await db
      .update(bills)
      .set({ status: "overdue", updatedAt: new Date() })
      .where(and(eq(bills.userId, u.id), eq(bills.status, "upcoming"), sql`${bills.dueDate} < ${today}`))
      .returning({ id: bills.id });
    result.billsMarkedOverdue += overdue.length;
  }

  return result;
}

/** Marks a bill paid, optionally records the expense, and rolls recurring bills forward. */
export async function payBill(args: { userId: string; billId: string; paidOn: string; currency: string }) {
  const { userId, billId, paidOn, currency } = args;
  const [bill] = await db
    .select()
    .from(bills)
    .where(and(eq(bills.id, billId), eq(bills.userId, userId)))
    .limit(1);
  if (!bill) return { ok: false as const, error: "Bill not found" };
  if (bill.status === "paid") return { ok: false as const, error: "This bill is already marked paid" };

  if (bill.autoCreateTransaction) {
    await db.insert(transactions).values({
      userId,
      type: "expense",
      amount: bill.amount,
      currency,
      categoryId: bill.categoryId,
      description: bill.name,
      occurredOn: paidOn,
      source: "recurring",
      externalRef: `bill:${bill.id}:${bill.dueDate}`,
    });
  }

  if (bill.frequency === "once") {
    await db
      .update(bills)
      .set({ status: "paid", paidAt: new Date(), updatedAt: new Date() })
      .where(eq(bills.id, bill.id));
  } else {
    let next = advanceDate(bill.dueDate, bill.frequency);
    let guard = 0;
    while (next < paidOn && guard < 120) {
      next = advanceDate(next, bill.frequency);
      guard++;
    }
    await db
      .update(bills)
      .set({ status: "upcoming", dueDate: next, paidAt: new Date(), lastRemindedAt: null, updatedAt: new Date() })
      .where(eq(bills.id, bill.id));
  }
  return { ok: true as const, rolled: bill.frequency !== "once" };
}
