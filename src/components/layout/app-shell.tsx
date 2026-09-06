import Link from "next/link";
import type { User } from "@/lib/db/schema";
import { initials } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { MobileNav } from "./mobile-nav";
import { SidebarNav } from "./sidebar-nav";
import { ThemeToggle } from "./theme-toggle";
import { UserMenu } from "./user-menu";

type Props = {
  user: User;
  isAdmin: boolean;
  children: React.ReactNode;
};

export function AppShell({ user, isAdmin, children }: Props) {
  return (
    <div className="flex min-h-full flex-1">
      <aside className="hidden w-60 shrink-0 flex-col border-r bg-card md:flex">
        <div className="flex h-14 items-center border-b px-4">
          <Link href="/dashboard" className="flex items-center gap-2 font-semibold tracking-tight">
            <span className="size-2.5 rounded-full bg-primary shadow-[0_0_0_4px] shadow-primary/15" aria-hidden />
            Finance Manager
          </Link>
        </div>
        <SidebarNav isAdmin={isAdmin} className="p-3" />
        <p className="mt-auto p-4 text-[11px] leading-snug text-muted-foreground">
          For educational and personal budgeting purposes only. Not professional financial advice.
        </p>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 flex h-14 items-center gap-2 border-b bg-background/95 px-4 backdrop-blur">
          <MobileNav isAdmin={isAdmin} />
          <Link href="/dashboard" className="font-semibold tracking-tight md:hidden">
            Finance Manager
          </Link>
          <div className="ml-auto flex items-center gap-1">
            {isAdmin && (
              <Badge variant="outline" className="mr-1 hidden sm:inline-flex">
                Admin
              </Badge>
            )}
            <ThemeToggle />
            <UserMenu
              name={user.name}
              email={user.email}
              initials={initials(user.name, user.email)}
              isAdmin={isAdmin}
            />
          </div>
        </header>
        <main className="page-enter mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6">{children}</main>
      </div>
    </div>
  );
}
