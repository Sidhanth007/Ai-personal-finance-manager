"use server";

import { and, eq, ne, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { isUniqueViolation } from "@/lib/db/errors";
import { categories } from "@/lib/db/schema";
import { requireUser } from "@/lib/auth/session";
import { categoryInputSchema } from "@/lib/validations/transactions";
import type { ActionState } from "./transactions";

function revalidate() {
  for (const p of ["/settings/categories", "/transactions", "/budgets"]) revalidatePath(p);
}

function duplicateError(type: "income" | "expense", name: string): ActionState {
  return {
    ok: false,
    error: `You already have a${type === "income" ? "n income" : "n expense"} category named "${name}"`,
  };
}

export async function saveCategoryAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = categoryInputSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const { id, name, type, color } = parsed.data;

  // Case-insensitive duplicate check (the DB index is case-sensitive).
  const clash = await db
    .select({ id: categories.id, name: categories.name })
    .from(categories)
    .where(
      and(
        eq(categories.userId, user.id),
        eq(categories.type, type),
        sql`lower(${categories.name}) = lower(${name})`,
        id ? ne(categories.id, id) : undefined,
      ),
    )
    .limit(1);
  if (clash.length) return duplicateError(type, clash[0].name);

  try {
    if (id) {
      const result = await db
        .update(categories)
        .set({ name, color: color ?? null, updatedAt: new Date() })
        .where(and(eq(categories.id, id), eq(categories.userId, user.id)))
        .returning({ id: categories.id });
      if (result.length === 0) return { ok: false, error: "Category not found" };
      revalidate();
      return { ok: true, message: "Category updated." };
    }
    await db.insert(categories).values({ userId: user.id, name, type, color: color ?? "#64748b" });
    revalidate();
    return { ok: true, message: "Category added." };
  } catch (err) {
    if (isUniqueViolation(err)) return duplicateError(type, name);
    throw err;
  }
}

export async function setCategoryArchivedAction(id: string, archived: boolean): Promise<ActionState> {
  const user = await requireUser();
  const result = await db
    .update(categories)
    .set({ isArchived: archived, updatedAt: new Date() })
    .where(and(eq(categories.id, id), eq(categories.userId, user.id)))
    .returning({ id: categories.id });
  if (result.length === 0) return { ok: false, error: "Category not found" };
  revalidate();
  return { ok: true, message: archived ? "Category archived." : "Category restored." };
}
