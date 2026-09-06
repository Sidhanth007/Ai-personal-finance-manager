import { z } from "zod";

export const emailSchema = z
  .email("Enter a valid email address")
  .transform((e) => e.trim().toLowerCase());

export const nameSchema = z
  .string()
  .trim()
  .min(2, "Name must be at least 2 characters")
  .max(80, "Name must be 80 characters or fewer");

export const otpCodeSchema = z
  .string()
  .trim()
  .regex(/^\d{6}$/, "Enter the 6-digit code");

export const purposeSchema = z.enum(["signup", "login"]);

export const requestOtpSchema = z.object({
  purpose: purposeSchema,
  email: emailSchema,
  name: z.string().optional(),
});

export const verifyOtpSchema = z.object({
  purpose: purposeSchema,
  email: emailSchema,
  name: z.string().optional(),
  code: otpCodeSchema,
  next: z.string().optional(),
});
