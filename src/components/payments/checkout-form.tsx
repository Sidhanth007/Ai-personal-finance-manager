"use client";

import { useActionState, useEffect } from "react";
import { CreditCard, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { startCheckoutAction } from "@/server/actions/payments";
import type { ActionState } from "@/server/actions/transactions";
import type { CategoryRow } from "@/server/services/transactions";
import { TEST_CARDS } from "@/lib/validations/payments";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Field, selectClass } from "@/components/shared/form-field";

type Props = { mode: "stripe-test" | "simulated"; currency: string; categories: CategoryRow[] };

export function CheckoutForm({ mode, currency, categories }: Props) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(startCheckoutAction, {});
  useEffect(() => {
    if (state.error) toast.error(state.error);
  }, [state]);
  const expenseCats = categories.filter((c) => c.type === "expense");

  return (
    <form action={formAction}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="size-4" /> Make a sandbox payment
          </CardTitle>
          <CardDescription>
            {mode === "stripe-test"
              ? "You will be sent to Stripe's hosted test checkout. Use a test card below. No real charge is ever made."
              : "Stripe test keys are not configured, so this runs in simulated mode: the payment is recorded instantly as a demo transaction."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={`Amount (${currency})`} htmlFor="amount">
              <Input id="amount" name="amount" inputMode="decimal" placeholder="499.00" required autoFocus />
            </Field>
            <Field label="Category" htmlFor="categoryId">
              <select id="categoryId" name="categoryId" className={selectClass} defaultValue={expenseCats.find((c) => c.name === "Shopping")?.id ?? ""}>
                <option value="">Uncategorised</option>
                {expenseCats.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="What is it for?" htmlFor="description">
            <Input id="description" name="description" maxLength={100} placeholder="Demo purchase" required />
          </Field>

          {mode === "stripe-test" ? (
            <div className="rounded-md border bg-muted/40 p-3 text-xs">
              <p className="mb-1 font-medium">Stripe test cards (any future expiry, any CVC, any postcode)</p>
              <ul className="space-y-0.5 font-mono">
                {TEST_CARDS.map((c) => (
                  <li key={c.number}>
                    {c.number} <span className="font-sans text-muted-foreground">· {c.label}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="rounded-md border bg-muted/40 p-3 text-xs">
              <p className="mb-1 font-medium">Simulated card</p>
              <p className="font-mono">4242 4242 4242 4242 · 12/34 · 123</p>
              <p className="mt-1 text-muted-foreground">Nothing is charged and no card data is collected. Add Stripe test keys to try the hosted checkout instead.</p>
            </div>
          )}

          <p className="flex items-start gap-2 text-xs text-muted-foreground">
            <ShieldAlert className="mt-0.5 size-3.5 shrink-0" />
            Demonstration only. This app never processes real money and refuses to run with a live Stripe key.
          </p>
        </CardContent>
        <CardFooter className="justify-end">
          <Button type="submit" disabled={pending}>
            {pending ? "Starting…" : mode === "stripe-test" ? "Continue to Stripe test checkout" : "Simulate payment"}
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}
