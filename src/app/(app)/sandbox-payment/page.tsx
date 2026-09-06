import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/session";
import { paymentsMode } from "@/server/services/payments";
import { listCategories } from "@/server/services/transactions";
import { PageHeader } from "@/components/shared/page-header";
import { CheckoutForm } from "@/components/payments/checkout-form";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = { title: "Sandbox payment" };

export default async function SandboxPaymentPage({ searchParams }: { searchParams: Promise<{ cancelled?: string }> }) {
  const user = await requireUser();
  const { cancelled } = await searchParams;
  const categories = await listCategories(user.id);
  const mode = paymentsMode();

  return (
    <>
      <PageHeader
        title="Sandbox payment"
        description="A demo checkout that records a transaction in your history. No real money is involved."
        actions={<Badge variant="outline">{mode === "stripe-test" ? "Stripe test mode" : "Simulated mode"}</Badge>}
      />
      <div className="max-w-2xl space-y-4">
        {cancelled && <p className="rounded-md border p-3 text-sm text-muted-foreground">Checkout cancelled. Nothing was recorded.</p>}
        <CheckoutForm mode={mode} currency={user.currency} categories={categories} />
      </div>
    </>
  );
}
