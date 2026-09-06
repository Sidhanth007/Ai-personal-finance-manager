import { z } from "zod";
import { amountSchema, transactionTypeSchema } from "./transactions";

const emptyToUndefined = (v: unknown) => (v === "" || v === null ? undefined : v);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a date in YYYY-MM-DD format");
const checkbox = z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean());
const reminderDays = z.preprocess(emptyToUndefined, z.coerce.number().int().min(0).max(30).default(3));

export const billFrequencySchema = z.enum(["once", "weekly", "monthly", "yearly"]);
export const billingCycleSchema = z.enum(["weekly", "monthly", "yearly"]);
export const frequencySchema = z.enum(["daily", "weekly", "monthly", "yearly"]);

export const billInputSchema = z.object({
  id: z.preprocess(emptyToUndefined, z.uuid().optional()),
  name: z.string().trim().min(1, "Enter a name").max(80),
  amount: amountSchema,
  dueDate: isoDate,
  frequency: billFrequencySchema,
  categoryId: z.preprocess(emptyToUndefined, z.uuid().optional()),
  reminderDaysBefore: reminderDays,
  autoCreateTransaction: checkbox,
  notes: z.preprocess(emptyToUndefined, z.string().trim().max(500).optional()),
});

export const subscriptionInputSchema = z.object({
  id: z.preprocess(emptyToUndefined, z.uuid().optional()),
  name: z.string().trim().min(1, "Enter a name").max(80),
  amount: amountSchema,
  billingCycle: billingCycleSchema,
  nextBillingDate: isoDate,
  startedOn: z.preprocess(emptyToUndefined, isoDate.optional()),
  categoryId: z.preprocess(emptyToUndefined, z.uuid().optional()),
  reminderDaysBefore: reminderDays,
  autoCreateTransaction: checkbox,
  notes: z.preprocess(emptyToUndefined, z.string().trim().max(500).optional()),
});

export const subscriptionStatusSchema = z.enum(["active", "paused", "cancelled"]);

export const recurringRuleInputSchema = z.object({
  id: z.preprocess(emptyToUndefined, z.uuid().optional()),
  type: transactionTypeSchema,
  amount: amountSchema,
  description: z.string().trim().min(1, "Enter a description").max(140),
  categoryId: z.preprocess(emptyToUndefined, z.uuid().optional()),
  frequency: frequencySchema,
  interval: z.preprocess(emptyToUndefined, z.coerce.number().int().min(1).max(52).default(1)),
  startDate: isoDate,
  endDate: z.preprocess(emptyToUndefined, isoDate.optional()),
});
