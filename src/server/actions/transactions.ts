"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { categories, transactions } from "@/lib/db/schema";
import { requireUser } from "@/lib/auth/session";
import { parseCsv } from "@/lib/csv";
import { toMinorUnits } from "@/lib/format";
import { CSV_COLUMNS, csvRowSchema, transactionInputSchema } from "@/lib/validations/transactions";
import { getOwnedCategory } from "@/server/services/transactions";

export type ActionState = { ok?: boolean; error?: string; message?: string };

const TX_PATHS = ["/transactions", "/dashboard", "/budgets", "/reports"];
function revalidateTx() {
  for (const p of TX_PATHS) revalidatePath(p);
}

export async function saveTransactionAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = transactionInputSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const { id, type, amount, categoryId, description, merchant, notes, occurredOn } = parsed.data;

  if (categoryId) {
    const cat = await getOwnedCategory(user.id, categoryId);
    if (!cat) return { ok: false, error: "Category not found" };
    if (cat.type !== type) return { ok: false, error: `Choose a${type === "income" ? "n income" : "n expense"} category` };
  }

  const values = {
    type,
    amount: toMinorUnits(amount, user.currency),
    currency: user.currency,
    categoryId: categoryId ?? null,
    description,
    merchant: merchant ?? null,
    notes: notes ?? null,
    occurredOn,
    updatedAt: new Date(),
  };

  if (id) {
    const result = await db
      .update(transactions)
      .set(values)
      .where(and(eq(transactions.id, id), eq(transactions.userId, user.id)))
      .returning({ id: transactions.id });
    if (result.length === 0) return { ok: false, error: "Transaction not found" };
    revalidateTx();
    return { ok: true, message: "Transaction updated." };
  }

  await db.insert(transactions).values({ ...values, userId: user.id, source: "manual" });
  revalidateTx();
  return { ok: true, message: "Transaction added." };
}

export async function deleteTransactionAction(id: string): Promise<ActionState> {
  const user = await requireUser();
  const result = await db
    .delete(transactions)
    .where(and(eq(transactions.id, id), eq(transactions.userId, user.id)))
    .returning({ id: transactions.id });
  if (result.length === 0) return { ok: false, error: "Transaction not found" };
  revalidateTx();
  return { ok: true, message: "Transaction deleted." };
}

export type ImportState = ActionState & {
  imported?: number;
  skipped?: number;
  errors?: string[];
};

const MAX_IMPORT_ROWS = 2000;

export async function importTransactionsAction(_prev: ImportState, formData: FormData): Promise<ImportState> {
  const user = await requireUser();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Choose a CSV file" };
  if (file.size > 2 * 1024 * 1024) return { ok: false, error: "File must be 2 MB or smaller" };

  const rows = parseCsv(await file.text());
  if (rows.length < 2) return { ok: false, error: "The file has no data rows" };

  const header = rows[0].map((h) => h.trim().toLowerCase());
  const missing = ["date", "type", "amount", "description"].filter((c) => !header.includes(c));
  if (missing.length) return { ok: false, error: `Missing required column(s): ${missing.join(", ")}` };
  const idx = Object.fromEntries(CSV_COLUMNS.map((c) => [c, header.indexOf(c)])) as Record<
    (typeof CSV_COLUMNS)[number],
    number
  >;

  const dataRows = rows.slice(1, MAX_IMPORT_ROWS + 1);
  const existing = await db
    .select({ id: categories.id, name: categories.name, type: categories.type })
    .from(categories)
    .where(eq(categories.userId, user.id));
  const catKey = (name: string, type: string) => `${type}:${name.toLowerCase()}`;
  const catMap = new Map(existing.map((c) => [catKey(c.name, c.type), c.id]));

  const errors: string[] = [];
  const toInsert: (typeof transactions.$inferInsert)[] = [];

  for (let i = 0; i < dataRows.length; i++) {
    const r = dataRows[i];
    const get = (c: (typeof CSV_COLUMNS)[number]) => (idx[c] >= 0 ? (r[idx[c]] ?? "") : "");
    const parsed = csvRowSchema.safeParse({
      date: get("date").trim(),
      type: get("type"),
      amount: get("amount"),
      category: get("category"),
      description: get("description"),
      merchant: get("merchant"),
      notes: get("notes"),
    });
    if (!parsed.success) {
      errors.push(`Row ${i + 2}: ${parsed.error.issues[0]?.message}`);
      continue;
    }
    const d = parsed.data;
    let categoryId: string | null = null;
    if (d.category) {
      const key = catKey(d.category, d.type);
      let cid = catMap.get(key);
      if (!cid) {
        const [created] = await db
          .insert(categories)
          .values({ userId: user.id, name: d.category, type: d.type, color: "#64748b" })
          .onConflictDoNothing()
          .returning({ id: categories.id });
        cid = created?.id;
        if (cid) catMap.set(key, cid);
      }
      categoryId = cid ?? null;
    }
    toInsert.push({
      userId: user.id,
      type: d.type,
      amount: toMinorUnits(d.amount, user.currency),
      currency: user.currency,
      categoryId,
      description: d.description,
      merchant: d.merchant || null,
      notes: d.notes || null,
      occurredOn: d.date,
      source: "import",
    });
  }

  if (toInsert.length) {
    for (let i = 0; i < toInsert.length; i += 500) {
      await db.insert(transactions).values(toInsert.slice(i, i + 500));
    }
  }
  revalidateTx();

  const truncated = rows.length - 1 > MAX_IMPORT_ROWS ? [`Only the first ${MAX_IMPORT_ROWS} rows were processed.`] : [];
  return {
    ok: true,
    imported: toInsert.length,
    skipped: errors.length,
    errors: [...truncated, ...errors.slice(0, 20)],
    message: `Imported ${toInsert.length} transaction${toInsert.length === 1 ? "" : "s"}${errors.length ? `, skipped ${errors.length}` : ""}.`,
  };
}
