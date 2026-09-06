"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { isStripeConfigured } from "@/lib/env";
import { todayISO, toMinorUnits } from "@/lib/format";
import { checkoutInputSchema } from "@/lib/validations/payments";
import { createCheckoutSession, recordSandboxPayment } from "@/server/services/payments";
import { getOwnedCategory } from "@/server/services/transactions";
import type { ActionState } from "./transactions";

export async function startCheckoutAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = checkoutInputSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const { amount, description, categoryId } = parsed.data;
  if (categoryId) {
    const cat = await getOwnedCategory(user.id, categoryId);
    if (!cat || cat.type !== "expense") return { ok: false, error: "Choose an expense category" };
  }
  const amountMinor = toMinorUnits(amount, user.currency);

  if (isStripeConfigured) {
    let url: string | null = null;
    try {
      const session = await createCheckoutSession({ userId: user.id, amountMinor, currency: user.currency, description, categoryId: categoryId ?? null });
      url = session.url;
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "Could not start Stripe checkout" };
    }
    if (!url) return { ok: false, error: "Stripe did not return a checkout URL" };
    redirect(url);
  }

  // Simulated mode: no external provider. Records the demo payment directly.
  const ref = `sim:${randomUUID()}`;
  await recordSandboxPayment({ userId: user.id, amountMinor, currency: user.currency, description, categoryId: categoryId ?? null, ref, occurredOn: todayISO(user.timezone) });
  revalidatePath("/transactions");
  revalidatePath("/dashboard");
  redirect(`/sandbox-payment/success?ref=${encodeURIComponent(ref)}`);
}
