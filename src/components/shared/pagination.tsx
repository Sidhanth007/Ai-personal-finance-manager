import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
  page: number;
  pageCount: number;
  basePath: string;
  params: Record<string, string | undefined>;
};

export function Pagination({ page, pageCount, basePath, params }: Props) {
  if (pageCount <= 1) return null;

  const href = (p: number) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v) sp.set(k, v);
    sp.set("page", String(p));
    return `${basePath}?${sp.toString()}`;
  };
  const disabled = "pointer-events-none opacity-50";

  return (
    <nav className="flex items-center justify-between text-sm" aria-label="Pagination">
      <Link
        href={href(page - 1)}
        aria-disabled={page <= 1}
        className={cn(buttonVariants({ variant: "outline", size: "sm" }), page <= 1 && disabled)}
      >
        Previous
      </Link>
      <span className="text-muted-foreground">
        Page {page} of {pageCount}
      </span>
      <Link
        href={href(page + 1)}
        aria-disabled={page >= pageCount}
        className={cn(buttonVariants({ variant: "outline", size: "sm" }), page >= pageCount && disabled)}
      >
        Next
      </Link>
    </nav>
  );
}
