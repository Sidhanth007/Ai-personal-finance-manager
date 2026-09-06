import Link from "next/link";
import type { TransactionFilters } from "@/lib/validations/transactions";
import type { CategoryRow } from "@/server/services/transactions";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const selectClass =
  "border-input h-9 w-full rounded-md border bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30";

export function TransactionFilters({
  filters,
  categories,
}: {
  filters: TransactionFilters;
  categories: CategoryRow[];
}) {
  return (
    <form method="get" action="/transactions" className="rounded-lg border bg-card p-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <div className="space-y-1 lg:col-span-2">
          <Label htmlFor="q">Search</Label>
          <Input id="q" name="q" placeholder="Description, merchant, notes" defaultValue={filters.q ?? ""} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="type">Type</Label>
          <select id="type" name="type" defaultValue={filters.type ?? ""} className={selectClass}>
            <option value="">All</option>
            <option value="income">Income</option>
            <option value="expense">Expense</option>
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="categoryId">Category</Label>
          <select id="categoryId" name="categoryId" defaultValue={filters.categoryId ?? ""} className={selectClass}>
            <option value="">All</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.type})
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="from">From</Label>
          <Input id="from" name="from" type="date" defaultValue={filters.from ?? ""} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="to">To</Label>
          <Input id="to" name="to" type="date" defaultValue={filters.to ?? ""} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="min">Min amount</Label>
          <Input id="min" name="min" type="number" min="0" step="0.01" defaultValue={filters.min ?? ""} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="max">Max amount</Label>
          <Input id="max" name="max" type="number" min="0" step="0.01" defaultValue={filters.max ?? ""} />
        </div>
        <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-4 lg:justify-end">
          <Link href="/transactions" className={cn(buttonVariants({ variant: "ghost" }))}>
            Clear
          </Link>
          <Button type="submit">Apply filters</Button>
        </div>
      </div>
    </form>
  );
}
