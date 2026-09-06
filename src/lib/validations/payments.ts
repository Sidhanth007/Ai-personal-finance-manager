import { z } from "zod";
import { amountSchema } from "./transactions";

const emptyToUndefined = (v: unknown) => (v === "" || v === null ? undefined : v);

export const checkoutInputSchema = z.object({
  amount: amountSchema.refine((n) => n <= 100000, "Sandbox payments are capped at 100,000"),
  description: z.string().trim().min(1, "Enter what this payment is for").max(100),
  categoryId: z.preprocess(emptyToUndefined, z.uuid().optional()),
});

/** Stripe test cards. Only the number matters in test mode. */
export const TEST_CARDS = [
  { number: "4242 4242 4242 4242", label: "Succeeds" },
  { number: "4000 0025 0000 3155", label: "Requires 3D Secure step" },
  { number: "4000 0000 0000 9995", label: "Declined (insufficient funds)" },
];
