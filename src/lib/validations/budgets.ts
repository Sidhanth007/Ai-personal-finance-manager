import { z } from "zod";
import { amountSchema } from "./transactions";

const emptyToUndefined = (v: unknown) => (v === "" || v === null ? undefined : v);

/** "YYYY-MM" */
export const monthKeySchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Use a month in YYYY-MM format");

export const budgetInputSchema = z.object({
  id: z.preprocess(emptyToUndefined, z.uuid().optional()),
  /** empty = overall monthly budget */
  categoryId: z.preprocess(emptyToUndefined, z.uuid().optional()),
  month: monthKeySchema,
  amount: amountSchema,
  alertThresholdPct: z.preprocess(
    emptyToUndefined,
    z.coerce.number().int().min(50, "Threshold must be 50–100").max(100, "Threshold must be 50–100").default(80),
  ),
});
export type BudgetInput = z.infer<typeof budgetInputSchema>;

export const copyBudgetsSchema = z.object({
  fromMonth: monthKeySchema,
  toMonth: monthKeySchema,
});
