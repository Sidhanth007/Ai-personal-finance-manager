"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { isUniqueViolation } from "@/lib/db/errors";
import { budgets } from "@/lib/db/schema";
import { requireUser } from "@/lib/auth/session";
import { toMinorUnits } from "@/lib/format";
import { monthRange } from "@/lib/months";
import { budgetInputSchema, copyBudgetsSchema } from "@/lib/validations/budgets";
import { getOwnedCategory } from "@/server/services/transactions";
import { hasOverallBudget } from "@/server/services/budgets";
import type { ActionState } from "./transactions";

function revalidate() {
  for (const p of ["/budgets", "/dashboard", "/reports"]) revalidatePath(p);
}

export async function saveBudgetAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = budgetInputSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const { id, categoryId, month, amount, alertThresholdPct } = parsed.data;

  if (categoryId) {
    const cat = await getOwnedCategory(user.id, categoryId);
    if (!cat) return { ok: false, error: "Category not found" };
    if (cat.type !== "expense") return { ok: false, error: "Budgets apply to expense categories only" };
  }

  const values = {
    amount: toMinorUnits(amount, user.currency),
    alertThresholdPct,
    updatedAt: new Date(),
  };

  try {
    if (id) {
      const result = await db
        .update(budgets)
        .set(values)
        .where(and(eq(budgets.id, id), eq(budgets.userId, user.id)))
        .returning({ id: budgets.id });
      if (result.length === 0) return { ok: false, error: "Budget not found" };
      revalidate();
      return { ok: true, message: "Budget updated." };
    }

    // The unique index treats NULL category ids as distinct, so guard the overall budget manually.
    if (!categoryId && (await hasOverallBudget(user.id, month))) {
      return { ok: false, error: "An overall budget already exists for this month. Edit it instead." };
    }

    await db.insert(budgets).values({
      ...values,
      userId: user.id,
      categoryId: categoryId ?? null,
      month: monthRange(month).start,
    });
    revalidate();
    return { ok: true, message: "Budget added." };
  } catch (err) {
    if (isUniqueViolation(err)) {
      return { ok: false, error: "A budget for this category already exists this month. Edit it instead." };
    }
    throw err;
  }
}

export async function deleteBudgetAction(id: string): Promise<ActionState> {
  const user = await requireUser();
  const result = await db
    .delete(budgets)
    .where(and(eq(budgets.id, id), eq(budgets.userId, user.id)))
    .returning({ id: budgets.id });
  if (result.length === 0) return { ok: false, error: "Budget not found" };
  revalidate();
  return { ok: true, message: "Budget deleted." };
}

/** Copies every budget from one month into another, skipping ones that already exist. */
export async function copyBudgetsAction(fromMonth: string, toMonth: string): Promise<ActionState> {
  const user = await requireUser();
  const parsed = copyBudgetsSchema.safeParse({ fromMonth, toMonth });
  if (!parsed.success) return { ok: false, error: "Invalid month" };
  if (fromMonth === toMonth) return { ok: false, error: "Choose a different month" };

  const source = await db
    .select()
    .from(budgets)
    .where(and(eq(budgets.userId, user.id), eq(budgets.month, monthRange(fromMonth).start)));
  if (source.length === 0) return { ok: false, error: "No budgets found in the source month" };

  const target = await db
    .select({ categoryId: budgets.categoryId })
    .from(budgets)
    .where(and(eq(budgets.userId, user.id), eq(budgets.month, monthRange(toMonth).start)));
  const existing = new Set(target.map((t) => t.categoryId));

  const toInsert = source
    .filter((b) => !existing.has(b.categoryId))
    .map((b) => ({
      userId: user.id,
      categoryId: b.categoryId,
      month: monthRange(toMonth).start,
      amount: b.amount,
      alertThresholdPct: b.alertThresholdPct,
    }));

  if (toInsert.length === 0) return { ok: false, error: "All of those budgets already exist in the target month" };
  await db.insert(budgets).values(toInsert).onConflictDoNothing();
  revalidate();
  return { ok: true, message: `Copied ${toInsert.length} budget${toInsert.length === 1 ? "" : "s"}.` };
}
