import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { recordSandboxPayment, verifyStripeSignature } from "@/server/services/payments";

export const dynamic = "force-dynamic";

type StripeEvent = {
  id: string;
  type: string;
  livemode: boolean;
  data: { object: { id: string; payment_status?: string; amount_total?: number | null; currency?: string; metadata?: Record<string, string>; created?: number } };
};

/** Stripe test-mode webhook: records completed sandbox checkouts. Live-mode events are rejected. */
export async function POST(req: Request) {
  const raw = await req.text();
  const secret = env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });
  if (!verifyStripeSignature(raw, req.headers.get("stripe-signature"), secret)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const event = JSON.parse(raw) as StripeEvent;
  if (event.livemode) return NextResponse.json({ error: "Live mode events are not accepted" }, { status: 400 });

  if (event.type === "checkout.session.completed") {
    const s = event.data.object;
    const userId = s.metadata?.userId;
    if (s.payment_status === "paid" && userId && s.amount_total) {
      await recordSandboxPayment({
        userId,
        amountMinor: s.amount_total,
        currency: (s.currency ?? "inr").toUpperCase(),
        description: s.metadata?.description || "Sandbox payment",
        categoryId: s.metadata?.categoryId || null,
        ref: `stripe:${s.id}`,
        occurredOn: new Date((s.created ?? Date.now() / 1000) * 1000).toISOString().slice(0, 10),
      });
    }
  }
  return NextResponse.json({ received: true });
}
