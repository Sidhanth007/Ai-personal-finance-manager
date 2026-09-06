import { z } from "zod";
import { amountSchema } from "./transactions";

const emptyToUndefined = (v: unknown) => (v === "" || v === null ? undefined : v);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a date in YYYY-MM-DD format");

export const goalInputSchema = z.object({
  id: z.preprocess(emptyToUndefined, z.uuid().optional()),
  name: z.string().trim().min(1, "Enter a goal name").max(80),
  targetAmount: amountSchema,
  targetDate: z.preprocess(emptyToUndefined, isoDate.optional()),
  color: z.preprocess(emptyToUndefined, z.string().regex(/^#[0-9a-fA-F]{6}$/).optional()),
  notes: z.preprocess(emptyToUndefined, z.string().trim().max(500).optional()),
});

export const contributionInputSchema = z.object({
  goalId: z.uuid(),
  amount: amountSchema,
  contributedOn: isoDate,
  note: z.preprocess(emptyToUndefined, z.string().trim().max(200).optional()),
  /** Also record an expense transaction in the "Savings Transfer" category. */
  recordTransaction: z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean()),
});

export const goalStatusSchema = z.enum(["active", "completed", "archived"]);
