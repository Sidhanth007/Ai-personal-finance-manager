import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { listRecurringRules } from "@/server/services/bills";
import { listCategories } from "@/server/services/transactions";
import { PageHeader } from "@/components/shared/page-header";
import { RecurringView } from "@/components/bills/recurring-view";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Recurring transactions" };

export default async function RecurringPage() {
  const user = await requireUser();
  const [rules, categories] = await Promise.all([listRecurringRules(user.id), listCategories(user.id)]);

  return (
    <>
      <PageHeader
        title="Recurring transactions"
        description="Rules that create transactions automatically on a schedule. A daily job processes them, or you can run it now."
        actions={
          <Link href="/transactions" className={cn(buttonVariants({ variant: "outline" }))}>
            Back to transactions
          </Link>
        }
      />
      <div className="space-y-4">
        <RecurringView rules={rules} categories={categories} currency={user.currency} timezone={user.timezone} />
      </div>
    </>
  );
}
