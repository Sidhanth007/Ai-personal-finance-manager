import type { Metadata } from "next";
import Link from "next/link";
import { CircleCheck, CircleX } from "lucide-react";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { transactions } from "@/lib/db/schema";
import { requireUser } from "@/lib/auth/session";
import { isStripeConfigured } from "@/lib/env";
import { formatDate, formatMoney } from "@/lib/format";
import { recordSandboxPayment, retrieveCheckoutSession } from "@/server/services/payments";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Payment result" };

export default async function SuccessPage({ searchParams }: { searchParams: Promise<{ session_id?: string; ref?: string }> }) {
  const user = await requireUser();
  const { session_id, ref } = await searchParams;

  let externalRef: string | null = ref ?? null;
  let problem: string | null = null;

  // Stripe return: confirm with Stripe directly so local dev works without webhooks.
  if (session_id && isStripeConfigured) {
    try {
      const s = await retrieveCheckoutSession(session_id);
      if (s.metadata?.userId !== user.id) problem = "This checkout session belongs to a different account.";
      else if (s.payment_status !== "paid") problem = `Payment status is "${s.payment_status}". Nothing was recorded.`;
      else {
        externalRef = `stripe:${s.id}`;
        await recordSandboxPayment({
          userId: user.id,
          amountMinor: s.amount_total ?? 0,
          currency: (s.currency ?? user.currency).toUpperCase(),
          description: s.metadata?.description || "Sandbox payment",
          categoryId: s.metadata?.categoryId || null,
          ref: externalRef,
          occurredOn: new Date().toISOString().slice(0, 10),
        });
      }
    } catch (err) {
      problem = err instanceof Error ? err.message : "Could not verify the Stripe session";
    }
  }

  const [tx] = externalRef
    ? await db.select().from(transactions).where(and(eq(transactions.userId, user.id), eq(transactions.externalRef, externalRef))).limit(1)
    : [];

  return (
    <>
      <PageHeader title="Sandbox payment result" />
      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {tx ? <CircleCheck className="size-5 text-emerald-600" /> : <CircleX className="size-5 text-destructive" />}
            {tx ? "Demo payment recorded" : "No payment recorded"}
          </CardTitle>
          <CardDescription>{problem ?? (tx ? "This was a sandbox transaction. No real money moved." : "We could not find a matching sandbox payment.")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {tx && (
            <dl className="grid grid-cols-2 gap-y-1">
              <dt className="text-muted-foreground">Amount</dt>
              <dd className="text-right tabular-nums">{formatMoney(tx.amount, tx.currency)}</dd>
              <dt className="text-muted-foreground">Description</dt>
              <dd className="text-right">{tx.description}</dd>
              <dt className="text-muted-foreground">Date</dt>
              <dd className="text-right">{formatDate(tx.occurredOn)}</dd>
              <dt className="text-muted-foreground">Provider</dt>
              <dd className="text-right">{tx.merchant}</dd>
              <dt className="text-muted-foreground">Reference</dt>
              <dd className="truncate text-right font-mono text-xs">{tx.externalRef}</dd>
            </dl>
          )}
          <div className="flex gap-2 pt-2">
            <Link href="/transactions" className={cn(buttonVariants())}>View transactions</Link>
            <Link href="/sandbox-payment" className={cn(buttonVariants({ variant: "outline" }))}>Another payment</Link>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
