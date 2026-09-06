import { z } from "zod";
import { CURRENCY_CODES } from "@/lib/format";

const checkbox = z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean());

export const profileSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(80),
  currency: z.enum(CURRENCY_CODES, { message: "Choose a supported currency" }),
  timezone: z
    .string()
    .refine((tz) => Intl.supportedValuesOf("timeZone").includes(tz), "Choose a valid timezone"),
  weeklyDigestEnabled: checkbox,
  remindersEnabled: checkbox,
});

export type ProfileInput = z.infer<typeof profileSchema>;
