import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { transactions } from "@/lib/db/schema";
import { env, isStripeConfigured } from "@/lib/env";

const STRIPE_API = "https://api.stripe.com/v1";

/** Zero-decimal currencies per Stripe. */
const ZERO_DECIMAL = new Set(["JPY", "KRW", "VND", "CLP", "PYG", "UGX", "XAF", "XOF", "RWF", "GNF", "KMF", "MGA", "BIF", "DJF", "XPF"]);

function assertTestKey() {
  if (!env.STRIPE_SECRET_KEY?.startsWith("sk_test_")) {
    throw new Error("Refusing to run: STRIPE_SECRET_KEY must be a test-mode key (sk_test_...). This app never takes real payments.");
  }
}

async function stripe<T>(path: string, init: { method?: "GET" | "POST"; form?: Record<string, string> } = {}): Promise<T> {
  assertTestKey();
  const res = await fetch(`${STRIPE_API}${path}`, {
    method: init.method ?? (init.form ? "POST" : "GET"),
    headers: {
      authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
      ...(init.form ? { "content-type": "application/x-www-form-urlencoded" } : {}),
      "stripe-version": "2024-06-20",
    },
    body: init.form ? new URLSearchParams(init.form).toString() : undefined,
    cache: "no-store",
  });
  const json = (await res.json()) as T & { error?: { message?: string } };
  if (!res.ok) throw new Error(json.error?.message ?? `Stripe ${res.status}`);
  return json;
}

export type CheckoutSession = { id: string; url: string | null; payment_status: string; amount_total: number | null; currency: string; metadata: Record<string, string> };

export async function createCheckoutSession(args: { userId: string; amountMinor: number; currency: string; description: string; categoryId: string | null }) {
  const cur = args.currency.toLowerCase();
  const unitAmount = ZERO_DECIMAL.has(args.currency) ? args.amountMinor : args.amountMinor; // both already minor units
  return stripe<CheckoutSession>("/checkout/sessions", {
    form: {
      mode: "payment",
      "line_items[0][quantity]": "1",
      "line_items[0][price_data][currency]": cur,
      "line_items[0][price_data][unit_amount]": String(unitAmount),
      "line_items[0][price_data][product_data][name]": `Sandbox: ${args.description}`,
      success_url: `${env.NEXT_PUBLIC_APP_URL}/sandbox-payment/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${env.NEXT_PUBLIC_APP_URL}/sandbox-payment?cancelled=1`,
      "metadata[userId]": args.userId,
      "metadata[description]": args.description,
      "metadata[categoryId]": args.categoryId ?? "",
      "metadata[sandbox]": "true",
    },
  });
}

export async function retrieveCheckoutSession(id: string) {
  return stripe<CheckoutSession>(`/checkout/sessions/${encodeURIComponent(id)}`);
}

/** Verifies a Stripe-Signature header (t=...,v1=...) against the raw body. */
export function verifyStripeSignature(rawBody: string, header: string | null, secret: string, toleranceSeconds = 300): boolean {
  if (!header) return false;
  const parts = Object.fromEntries(header.split(",").map((kv) => kv.split("=") as [string, string]));
  const t = Number(parts.t);
  const v1 = parts.v1;
  if (!t || !v1) return false;
  if (Math.abs(Date.now() / 1000 - t) > toleranceSeconds) return false;
  const expected = createHmac("sha256", secret).update(`${t}.${rawBody}`).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(v1);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Records a sandbox payment as an expense transaction exactly once per reference.
 * Used by the simulated flow, the Stripe success page, and the Stripe webhook.
 */
export async function recordSandboxPayment(args: { userId: string; amountMinor: number; currency: string; description: string; categoryId: string | null; ref: string; occurredOn: string }) {
  const [existing] = await db
    .select({ id: transactions.id })
    .from(transactions)
    .where(and(eq(transactions.userId, args.userId), eq(transactions.externalRef, args.ref)))
    .limit(1);
  if (existing) return { id: existing.id, created: false };

  const [row] = await db
    .insert(transactions)
    .values({
      userId: args.userId,
      type: "expense",
      amount: args.amountMinor,
      currency: args.currency,
      categoryId: args.categoryId,
      description: args.description,
      merchant: args.ref.startsWith("stripe:") ? "Stripe test mode" : "Simulated payment",
      notes: "Sandbox demo payment. No real money moved.",
      occurredOn: args.occurredOn,
      source: "sandbox_payment",
      externalRef: args.ref,
    })
    .returning({ id: transactions.id });
  return { id: row.id, created: true };
}

export const paymentsMode = (): "stripe-test" | "simulated" => (isStripeConfigured ? "stripe-test" : "simulated");
