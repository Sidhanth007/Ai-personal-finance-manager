import type { Metadata } from "next";
import Link from "next/link";
import { Download, Repeat, Tags } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { transactionFiltersSchema, type TransactionFilters } from "@/lib/validations/transactions";
import { listCategories, listTransactions } from "@/server/services/transactions";
import { PageHeader } from "@/components/shared/page-header";
import { Pagination } from "@/components/shared/pagination";
import { SummaryTiles } from "@/components/transactions/summary-tiles";
import { TransactionFilters as FiltersBar } from "@/components/transactions/transaction-filters";
import { TransactionsTable } from "@/components/transactions/transactions-table";
import { ImportDialog } from "@/components/transactions/import-dialog";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Transactions" };

type SearchParams = Record<string, string | string[] | undefined>;

function firstValues(sp: SearchParams): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(sp)) out[k] = Array.isArray(v) ? v[0] : v;
  return out;
}

export default async function TransactionsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requireUser();
  const raw = firstValues(await searchParams);
  const parsed = transactionFiltersSchema.safeParse(raw);
  const filters: TransactionFilters = parsed.success ? parsed.data : { page: 1 };

  const [result, categories] = await Promise.all([
    listTransactions(user.id, filters, user.currency),
    listCategories(user.id),
  ]);

  const exportParams = new URLSearchParams();
  for (const [k, v] of Object.entries(raw)) if (v && k !== "page") exportParams.set(k, v);

  return (
    <>
      <PageHeader
        title="Transactions"
        description="Your full income and expense history."
        actions={
          <>
            <Link href="/transactions/recurring" className={cn(buttonVariants({ variant: "outline" }))}>
              <Repeat className="size-4" /> Recurring
            </Link>
            <Link href="/settings/categories" className={cn(buttonVariants({ variant: "outline" }))}>
              <Tags className="size-4" /> Categories
            </Link>
            <ImportDialog />
            <a
              href={`/api/transactions/export?${exportParams.toString()}`}
              className={cn(buttonVariants({ variant: "outline" }))}
            >
              <Download className="size-4" /> Export CSV
            </a>
          </>
        }
      />

      <div className="space-y-4">
        {!parsed.success && (
          <p className="text-sm text-destructive">Some filters were invalid and have been ignored.</p>
        )}
        <SummaryTiles {...result.summary} currency={user.currency} />
        <FiltersBar filters={filters} categories={categories} />
        <TransactionsTable
          rows={result.rows}
          categories={categories}
          currency={user.currency}
          timezone={user.timezone}
        />
        <Pagination page={result.page} pageCount={result.pageCount} basePath="/transactions" params={raw} />
      </div>
    </>
  );
}
