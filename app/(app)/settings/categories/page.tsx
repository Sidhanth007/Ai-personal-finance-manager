import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { listCategories } from "@/server/services/transactions";
import { PageHeader } from "@/components/shared/page-header";
import { CategoryManager } from "@/components/categories/category-manager";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Categories" };

export default async function CategoriesPage() {
  const user = await requireUser();
  const categories = await listCategories(user.id, { includeArchived: true });

  return (
    <>
      <PageHeader
        title="Categories"
        description="Rename, recolour, or archive categories. Archived categories stay on old transactions but are hidden from new ones."
        actions={
          <Link href="/transactions" className={cn(buttonVariants({ variant: "outline" }))}>
            Back to transactions
          </Link>
        }
      />
      <CategoryManager categories={categories} />
    </>
  );
}
