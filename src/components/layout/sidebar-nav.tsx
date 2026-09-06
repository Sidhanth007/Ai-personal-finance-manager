"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS } from "@/lib/nav";
import { cn } from "@/lib/utils";

type Props = {
  isAdmin: boolean;
  onNavigate?: () => void;
  className?: string;
};

export function SidebarNav({ isAdmin, onNavigate, className }: Props) {
  const pathname = usePathname();

  return (
    <nav className={cn("flex flex-col gap-1", className)} aria-label="Main">
      {NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin).map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "group relative flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-all duration-200",
              active
                ? "bg-primary/10 text-primary before:absolute before:inset-y-2 before:left-0 before:w-0.5 before:rounded-full before:bg-primary"
                : "text-muted-foreground hover:translate-x-0.5 hover:bg-muted hover:text-foreground",
            )}
          >
            <Icon className={cn("size-4 shrink-0 transition-transform duration-200", !active && "group-hover:scale-110")} aria-hidden />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
