import "server-only";
import { and, asc, count, desc, eq, gte, ilike, lte, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/lib/db";
import { categories, transactions } from "@/lib/db/schema";
import { toMinorUnits } from "@/lib/format";
import type { TransactionFilters } from "@/lib/validations/transactions";

export const PAGE_SIZE = 25;

export type TransactionRow = {
  id: string;
  type: "income" | "expense";
  amount: number;
  currency: string;
  description: string;
  merchant: string | null;
  notes: string | null;
  occurredOn: string;
  source: "manual" | "recurring" | "import" | "sandbox_payment";
  categoryId: string | null;
  categoryName: string | null;
  categoryColor: string | null;
};

export type TransactionSummary = {
  total: number;
  income: number;
  expense: number;
  net: number;
};

function buildConditions(userId: string, f: TransactionFilters, currency: string): SQL[] {
  const conds: SQL[] = [eq(transactions.userId, userId)];
  if (f.q) {
    const like = `%${f.q.replace(/[%_]/g, "\\$&")}%`;
    conds.push(
      or(
        ilike(transactions.description, like),
        ilike(transactions.merchant, like),
        ilike(transactions.notes, like),
      )!,
    );
  }
  if (f.type) conds.push(eq(transactions.type, f.type));
  if (f.categoryId) conds.push(eq(transactions.categoryId, f.categoryId));
  if (f.from) conds.push(gte(transactions.occurredOn, f.from));
  if (f.to) conds.push(lte(transactions.occurredOn, f.to));
  if (f.min !== undefined) conds.push(gte(transactions.amount, toMinorUnits(f.min, currency)));
  if (f.max !== undefined) conds.push(lte(transactions.amount, toMinorUnits(f.max, currency)));
  return conds;
}

export async function listTransactions(userId: string, filters: TransactionFilters, currency: string) {
  const where = and(...buildConditions(userId, filters, currency));
  const offset = (filters.page - 1) * PAGE_SIZE;

  const [rows, [summary]] = await Promise.all([
    db
      .select({
        id: transactions.id,
        type: transactions.type,
        amount: transactions.amount,
        currency: transactions.currency,
        description: transactions.description,
        merchant: transactions.merchant,
        notes: transactions.notes,
        occurredOn: transactions.occurredOn,
        source: transactions.source,
        categoryId: transactions.categoryId,
        categoryName: categories.name,
        categoryColor: categories.color,
      })
      .from(transactions)
      .leftJoin(categories, eq(transactions.categoryId, categories.id))
      .where(where)
      .orderBy(desc(transactions.occurredOn), desc(transactions.createdAt))
      .limit(PAGE_SIZE)
      .offset(offset),
    db
      .select({
        total: count(),
        income: sql<number>`coalesce(sum(case when ${transactions.type} = 'income' then ${transactions.amount} else 0 end), 0)`.mapWith(Number),
        expense: sql<number>`coalesce(sum(case when ${transactions.type} = 'expense' then ${transactions.amount} else 0 end), 0)`.mapWith(Number),
      })
      .from(transactions)
      .where(where),
  ]);

  return {
    rows: rows as TransactionRow[],
    summary: { ...summary, net: summary.income - summary.expense } as TransactionSummary,
    page: filters.page,
    pageCount: Math.max(1, Math.ceil(summary.total / PAGE_SIZE)),
  };
}

/** Streams all matching rows for export (no pagination). */
export async function listAllTransactionsForExport(userId: string, filters: TransactionFilters, currency: string) {
  const where = and(...buildConditions(userId, filters, currency));
  return db
    .select({
      occurredOn: transactions.occurredOn,
      type: transactions.type,
      amount: transactions.amount,
      currency: transactions.currency,
      category: categories.name,
      description: transactions.description,
      merchant: transactions.merchant,
      notes: transactions.notes,
      source: transactions.source,
    })
    .from(transactions)
    .leftJoin(categories, eq(transactions.categoryId, categories.id))
    .where(where)
    .orderBy(desc(transactions.occurredOn), desc(transactions.createdAt))
    .limit(10_000);
}

export async function getTransaction(userId: string, id: string) {
  const [row] = await db
    .select()
    .from(transactions)
    .where(and(eq(transactions.id, id), eq(transactions.userId, userId)))
    .limit(1);
  return row ?? null;
}

export type CategoryRow = {
  id: string;
  name: string;
  type: "income" | "expense";
  color: string | null;
  icon: string | null;
  isDefault: boolean;
  isArchived: boolean;
};

export async function listCategories(userId: string, opts: { includeArchived?: boolean } = {}) {
  const conds = [eq(categories.userId, userId)];
  if (!opts.includeArchived) conds.push(eq(categories.isArchived, false));
  return db
    .select({
      id: categories.id,
      name: categories.name,
      type: categories.type,
      color: categories.color,
      icon: categories.icon,
      isDefault: categories.isDefault,
      isArchived: categories.isArchived,
    })
    .from(categories)
    .where(and(...conds))
    .orderBy(asc(categories.type), asc(categories.name)) as Promise<CategoryRow[]>;
}

/** Category owned by the user, or null. Used to validate foreign keys from forms. */
export async function getOwnedCategory(userId: string, id: string) {
  const [row] = await db
    .select({ id: categories.id, type: categories.type })
    .from(categories)
    .where(and(eq(categories.id, id), eq(categories.userId, userId)))
    .limit(1);
  return row ?? null;
}
