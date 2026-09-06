"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { bills, recurringRules, subscriptions } from "@/lib/db/schema";
import { requireUser } from "@/lib/auth/session";
import { todayISO, toMinorUnits } from "@/lib/format";
import { billInputSchema, recurringRuleInputSchema, subscriptionInputSchema, subscriptionStatusSchema } from "@/lib/validations/bills";
import { payBill, runRecurringEngine } from "@/server/services/recurring";
import { getOwnedCategory } from "@/server/services/transactions";
import type { ActionState } from "./transactions";

function revalidate() {
  for (const p of ["/bills", "/subscriptions", "/transactions", "/transactions/recurring", "/dashboard", "/reports"]) revalidatePath(p);
}

async function checkCategory(userId: string, categoryId: string | undefined, type: "income" | "expense") {
  if (!categoryId) return null;
  const cat = await getOwnedCategory(userId, categoryId);
  if (!cat) return "Category not found";
  if (cat.type !== type) return `Choose a${type === "income" ? "n income" : "n expense"} category`;
  return null;
}

// ---------- bills ----------
export async function saveBillAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = billInputSchema.safeParse({ ...Object.fromEntries(formData), autoCreateTransaction: formData.get("autoCreateTransaction") ?? false });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const { id, name, amount, dueDate, frequency, categoryId, reminderDaysBefore, autoCreateTransaction, notes } = parsed.data;
  const catErr = await checkCategory(user.id, categoryId, "expense");
  if (catErr) return { ok: false, error: catErr };

  const values = {
    name,
    amount: toMinorUnits(amount, user.currency),
    dueDate,
    frequency,
    categoryId: categoryId ?? null,
    reminderDaysBefore,
    autoCreateTransaction,
    notes: notes ?? null,
    updatedAt: new Date(),
  };
  if (id) {
    const r = await db
      .update(bills)
      .set({ ...values, status: "upcoming", lastRemindedAt: null })
      .where(and(eq(bills.id, id), eq(bills.userId, user.id)))
      .returning({ id: bills.id });
    if (r.length === 0) return { ok: false, error: "Bill not found" };
    revalidate();
    return { ok: true, message: "Bill updated." };
  }
  await db.insert(bills).values({ ...values, userId: user.id });
  revalidate();
  return { ok: true, message: "Bill added." };
}

export async function deleteBillAction(id: string): Promise<ActionState> {
  const user = await requireUser();
  const r = await db.delete(bills).where(and(eq(bills.id, id), eq(bills.userId, user.id))).returning({ id: bills.id });
  if (r.length === 0) return { ok: false, error: "Bill not found" };
  revalidate();
  return { ok: true, message: "Bill deleted." };
}

export async function markBillPaidAction(id: string): Promise<ActionState> {
  const user = await requireUser();
  const res = await payBill({ userId: user.id, billId: id, paidOn: todayISO(user.timezone), currency: user.currency });
  if (!res.ok) return { ok: false, error: res.error };
  revalidate();
  return { ok: true, message: res.rolled ? "Paid. Next due date set." : "Bill marked paid." };
}

// ---------- subscriptions ----------
export async function saveSubscriptionAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = subscriptionInputSchema.safeParse({ ...Object.fromEntries(formData), autoCreateTransaction: formData.get("autoCreateTransaction") ?? false });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const { id, name, amount, billingCycle, nextBillingDate, startedOn, categoryId, reminderDaysBefore, autoCreateTransaction, notes } = parsed.data;
  const catErr = await checkCategory(user.id, categoryId, "expense");
  if (catErr) return { ok: false, error: catErr };

  const values = {
    name,
    amount: toMinorUnits(amount, user.currency),
    billingCycle,
    nextBillingDate,
    startedOn: startedOn ?? null,
    categoryId: categoryId ?? null,
    reminderDaysBefore,
    autoCreateTransaction,
    notes: notes ?? null,
    updatedAt: new Date(),
  };
  if (id) {
    const r = await db
      .update(subscriptions)
      .set({ ...values, lastRemindedAt: null })
      .where(and(eq(subscriptions.id, id), eq(subscriptions.userId, user.id)))
      .returning({ id: subscriptions.id });
    if (r.length === 0) return { ok: false, error: "Subscription not found" };
    revalidate();
    return { ok: true, message: "Subscription updated." };
  }
  await db.insert(subscriptions).values({ ...values, userId: user.id });
  revalidate();
  return { ok: true, message: "Subscription added." };
}

export async function setSubscriptionStatusAction(id: string, status: string): Promise<ActionState> {
  const user = await requireUser();
  const s = subscriptionStatusSchema.safeParse(status);
  if (!s.success) return { ok: false, error: "Invalid status" };
  const r = await db
    .update(subscriptions)
    .set({ status: s.data, updatedAt: new Date() })
    .where(and(eq(subscriptions.id, id), eq(subscriptions.userId, user.id)))
    .returning({ id: subscriptions.id });
  if (r.length === 0) return { ok: false, error: "Subscription not found" };
  revalidate();
  return { ok: true, message: `Subscription ${s.data}.` };
}

export async function deleteSubscriptionAction(id: string): Promise<ActionState> {
  const user = await requireUser();
  const r = await db.delete(subscriptions).where(and(eq(subscriptions.id, id), eq(subscriptions.userId, user.id))).returning({ id: subscriptions.id });
  if (r.length === 0) return { ok: false, error: "Subscription not found" };
  revalidate();
  return { ok: true, message: "Subscription deleted." };
}

// ---------- recurring rules ----------
export async function saveRecurringRuleAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = recurringRuleInputSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const { id, type, amount, description, categoryId, frequency, interval, startDate, endDate } = parsed.data;
  if (endDate && endDate < startDate) return { ok: false, error: "End date must be after the start date" };
  const catErr = await checkCategory(user.id, categoryId, type);
  if (catErr) return { ok: false, error: catErr };

  const values = {
    type,
    amount: toMinorUnits(amount, user.currency),
    description,
    categoryId: categoryId ?? null,
    frequency,
    interval,
    startDate,
    endDate: endDate ?? null,
    updatedAt: new Date(),
  };
  if (id) {
    const r = await db
      .update(recurringRules)
      .set(values)
      .where(and(eq(recurringRules.id, id), eq(recurringRules.userId, user.id)))
      .returning({ id: recurringRules.id });
    if (r.length === 0) return { ok: false, error: "Rule not found" };
    revalidate();
    return { ok: true, message: "Recurring rule updated." };
  }
  await db.insert(recurringRules).values({ ...values, userId: user.id, nextRunOn: startDate, isActive: true });
  revalidate();
  return { ok: true, message: "Recurring rule added. Transactions are created automatically on each due date." };
}

export async function setRecurringRuleActiveAction(id: string, active: boolean): Promise<ActionState> {
  const user = await requireUser();
  const r = await db
    .update(recurringRules)
    .set({ isActive: active, updatedAt: new Date() })
    .where(and(eq(recurringRules.id, id), eq(recurringRules.userId, user.id)))
    .returning({ id: recurringRules.id });
  if (r.length === 0) return { ok: false, error: "Rule not found" };
  revalidate();
  return { ok: true, message: active ? "Rule resumed." : "Rule paused." };
}

export async function deleteRecurringRuleAction(id: string): Promise<ActionState> {
  const user = await requireUser();
  const r = await db.delete(recurringRules).where(and(eq(recurringRules.id, id), eq(recurringRules.userId, user.id))).returning({ id: recurringRules.id });
  if (r.length === 0) return { ok: false, error: "Rule not found" };
  revalidate();
  return { ok: true, message: "Rule deleted. Existing transactions are kept." };
}

/** Lets a user catch up recurring items immediately instead of waiting for the daily job. */
export async function runRecurringNowAction(): Promise<ActionState> {
  const user = await requireUser();
  const r = await runRecurringEngine(user.id);
  revalidate();
  const parts = [
    r.recurringCreated ? `${r.recurringCreated} recurring transaction${r.recurringCreated === 1 ? "" : "s"}` : null,
    r.subscriptionsCharged ? `${r.subscriptionsCharged} subscription charge${r.subscriptionsCharged === 1 ? "" : "s"}` : null,
    r.billsMarkedOverdue ? `${r.billsMarkedOverdue} bill${r.billsMarkedOverdue === 1 ? "" : "s"} marked overdue` : null,
  ].filter(Boolean);
  return { ok: true, message: parts.length ? `Processed: ${parts.join(", ")}.` : "Everything is already up to date." };
}
