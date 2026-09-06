import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { monthLabel, shiftMonthKey } from "@/lib/months";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
  month: string;
  basePath: string;
  currentMonth: string;
};

export function MonthSwitcher({ month, basePath, currentMonth }: Props) {
  const href = (m: string) => `${basePath}?month=${m}`;
  return (
    <div className="flex items-center gap-1">
      <Link
        href={href(shiftMonthKey(month, -1))}
        aria-label="Previous month"
        className={cn(buttonVariants({ variant: "outline", size: "icon-sm" }))}
      >
        <ChevronLeft className="size-4" />
      </Link>
      <span className="min-w-36 text-center text-sm font-medium">{monthLabel(month)}</span>
      <Link
        href={href(shiftMonthKey(month, 1))}
        aria-label="Next month"
        className={cn(buttonVariants({ variant: "outline", size: "icon-sm" }))}
      >
        <ChevronRight className="size-4" />
      </Link>
      {month !== currentMonth && (
        <Link href={href(currentMonth)} className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
          Today
        </Link>
      )}
    </div>
  );
}
