"use server";

import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { categories, goalContributions, savingsGoals, transactions } from "@/lib/db/schema";
import { requireUser } from "@/lib/auth/session";
import { toMinorUnits } from "@/lib/format";
import { contributionInputSchema, goalInputSchema, goalStatusSchema } from "@/lib/validations/goals";
import { getGoal } from "@/server/services/goals";
import type { ActionState } from "./transactions";

function revalidate() {
  for (const p of ["/goals", "/dashboard", "/transactions", "/reports"]) revalidatePath(p);
}

export async function saveGoalAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = goalInputSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const { id, name, targetAmount, targetDate, color, notes } = parsed.data;
  const values = {
    name,
    targetAmount: toMinorUnits(targetAmount, user.currency),
    targetDate: targetDate ?? null,
    color: color ?? null,
    notes: notes ?? null,
    updatedAt: new Date(),
  };

  if (id) {
    const result = await db
      .update(savingsGoals)
      .set(values)
      .where(and(eq(savingsGoals.id, id), eq(savingsGoals.userId, user.id)))
      .returning({ id: savingsGoals.id });
    if (result.length === 0) return { ok: false, error: "Goal not found" };
    revalidate();
    return { ok: true, message: "Goal updated." };
  }

  await db.insert(savingsGoals).values({ ...values, userId: user.id, color: color ?? "#10b981" });
  revalidate();
  return { ok: true, message: "Goal created." };
}

export async function setGoalStatusAction(id: string, status: string): Promise<ActionState> {
  const user = await requireUser();
  const s = goalStatusSchema.safeParse(status);
  if (!s.success) return { ok: false, error: "Invalid status" };
  const result = await db
    .update(savingsGoals)
    .set({ status: s.data, updatedAt: new Date() })
    .where(and(eq(savingsGoals.id, id), eq(savingsGoals.userId, user.id)))
    .returning({ id: savingsGoals.id });
  if (result.length === 0) return { ok: false, error: "Goal not found" };
  revalidate();
  const label = { active: "Goal reactivated.", completed: "Goal marked complete. Well done!", archived: "Goal archived." }[s.data];
  return { ok: true, message: label };
}

export async function deleteGoalAction(id: string): Promise<ActionState> {
  const user = await requireUser();
  const result = await db
    .delete(savingsGoals)
    .where(and(eq(savingsGoals.id, id), eq(savingsGoals.userId, user.id)))
    .returning({ id: savingsGoals.id });
  if (result.length === 0) return { ok: false, error: "Goal not found" };
  revalidate();
  return { ok: true, message: "Goal deleted." };
}

export async function addContributionAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = contributionInputSchema.safeParse({
    ...Object.fromEntries(formData),
    recordTransaction: formData.get("recordTransaction") ?? false,
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const { goalId, amount, contributedOn, note, recordTransaction } = parsed.data;

  const goal = await getGoal(user.id, goalId);
  if (!goal) return { ok: false, error: "Goal not found" };
  if (goal.status === "archived") return { ok: false, error: "Reactivate the goal before contributing" };

  const minor = toMinorUnits(amount, user.currency);

  let transactionId: string | null = null;
  if (recordTransaction) {
    const [cat] = await db
      .select({ id: categories.id })
      .from(categories)
      .where(and(eq(categories.userId, user.id), eq(categories.type, "expense"), eq(categories.name, "Savings Transfer")))
      .limit(1);
    const [tx] = await db
      .insert(transactions)
      .values({
        userId: user.id,
        type: "expense",
        amount: minor,
        currency: user.currency,
        categoryId: cat?.id ?? null,
        description: `Savings: ${goal.name}`,
        occurredOn: contributedOn,
        source: "manual",
        notes: note ?? null,
      })
      .returning({ id: transactions.id });
    transactionId = tx.id;
  }

  await db.insert(goalContributions).values({
    goalId,
    userId: user.id,
    amount: minor,
    contributedOn,
    note: note ?? null,
    transactionId,
  });

  const newTotal = goal.currentAmount + minor;
  await db
    .update(savingsGoals)
    .set({
      currentAmount: sql`${savingsGoals.currentAmount} + ${minor}`,
      status: newTotal >= goal.targetAmount && goal.status === "active" ? "completed" : goal.status,
      updatedAt: new Date(),
    })
    .where(eq(savingsGoals.id, goalId));

  revalidate();
  return {
    ok: true,
    message: newTotal >= goal.targetAmount ? "Contribution added. Goal reached!" : "Contribution added.",
  };
}

export async function deleteContributionAction(id: string): Promise<ActionState> {
  const user = await requireUser();
  const [row] = await db
    .select()
    .from(goalContributions)
    .where(and(eq(goalContributions.id, id), eq(goalContributions.userId, user.id)))
    .limit(1);
  if (!row) return { ok: false, error: "Contribution not found" };

  await db.delete(goalContributions).where(eq(goalContributions.id, id));
  await db
    .update(savingsGoals)
    .set({ currentAmount: sql`greatest(0, ${savingsGoals.currentAmount} - ${row.amount})`, updatedAt: new Date() })
    .where(eq(savingsGoals.id, row.goalId));
  if (row.transactionId) {
    await db.delete(transactions).where(and(eq(transactions.id, row.transactionId), eq(transactions.userId, user.id)));
  }
  revalidate();
  return { ok: true, message: "Contribution removed." };
}
