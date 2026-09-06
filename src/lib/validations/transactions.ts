import { z } from "zod";

const emptyToUndefined = (v: unknown) => (v === "" || v === null ? undefined : v);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a date in YYYY-MM-DD format");

export const transactionTypeSchema = z.enum(["income", "expense"]);

/** Amount entered in major units, e.g. "1,250.50". Converted to minor units in the action. */
export const amountSchema = z
  .string()
  .trim()
  .min(1, "Enter an amount")
  .transform((s) => Number(s.replace(/[,\s]/g, "")))
  .refine((n) => Number.isFinite(n) && n > 0, "Amount must be greater than zero")
  .refine((n) => n < 1_000_000_000, "Amount is too large");

export const transactionInputSchema = z.object({
  id: z.preprocess(emptyToUndefined, z.uuid().optional()),
  type: transactionTypeSchema,
  amount: amountSchema,
  categoryId: z.preprocess(emptyToUndefined, z.uuid().optional()),
  description: z.string().trim().min(1, "Enter a description").max(140),
  merchant: z.preprocess(emptyToUndefined, z.string().trim().max(80).optional()),
  notes: z.preprocess(emptyToUndefined, z.string().trim().max(500).optional()),
  occurredOn: isoDate,
});
export type TransactionInput = z.infer<typeof transactionInputSchema>;

export const transactionFiltersSchema = z.object({
  q: z.preprocess(emptyToUndefined, z.string().trim().max(100).optional()),
  type: z.preprocess(emptyToUndefined, transactionTypeSchema.optional()),
  categoryId: z.preprocess(emptyToUndefined, z.uuid().optional()),
  from: z.preprocess(emptyToUndefined, isoDate.optional()),
  to: z.preprocess(emptyToUndefined, isoDate.optional()),
  min: z.preprocess(emptyToUndefined, z.coerce.number().nonnegative().optional()),
  max: z.preprocess(emptyToUndefined, z.coerce.number().nonnegative().optional()),
  page: z.preprocess(emptyToUndefined, z.coerce.number().int().min(1).default(1)),
});
export type TransactionFilters = z.infer<typeof transactionFiltersSchema>;

export const categoryInputSchema = z.object({
  id: z.preprocess(emptyToUndefined, z.uuid().optional()),
  name: z.string().trim().min(1, "Enter a category name").max(40),
  type: transactionTypeSchema,
  color: z.preprocess(
    emptyToUndefined,
    z.string().regex(/^#[0-9a-fA-F]{6}$/, "Pick a color").optional(),
  ),
});
export type CategoryInput = z.infer<typeof categoryInputSchema>;

/** Expected CSV columns for import (header row, case-insensitive). */
export const CSV_COLUMNS = ["date", "type", "amount", "category", "description", "merchant", "notes"] as const;

export const csvRowSchema = z.object({
  date: isoDate,
  type: z.preprocess((v) => String(v ?? "").trim().toLowerCase(), transactionTypeSchema),
  amount: amountSchema,
  category: z.string().trim().max(40).optional().default(""),
  description: z.string().trim().min(1, "description is required").max(140),
  merchant: z.string().trim().max(80).optional().default(""),
  notes: z.string().trim().max(500).optional().default(""),
});
