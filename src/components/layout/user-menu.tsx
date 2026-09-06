"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { LogOut, Settings, ShieldCheck } from "lucide-react";
import { logoutAction } from "@/server/actions/auth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type Props = {
  name: string | null;
  email: string;
  initials: string;
  isAdmin: boolean;
};

export function UserMenu({ name, email, initials, isAdmin }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="ghost" size="icon" className="rounded-full" aria-label="Account menu" />}
      >
        <Avatar className="size-8">
          <AvatarFallback className="text-xs">{initials}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="flex flex-col">
          <span className="truncate font-medium">{name ?? "Account"}</span>
          <span className="truncate text-xs font-normal text-muted-foreground">{email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => router.push("/settings")}>
          <Settings className="size-4" /> Settings
        </DropdownMenuItem>
        {isAdmin && (
          <DropdownMenuItem onClick={() => router.push("/admin")}>
            <ShieldCheck className="size-4" /> Admin dashboard
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          disabled={pending}
          onClick={() => startTransition(() => logoutAction())}
        >
          <LogOut className="size-4" /> {pending ? "Logging out…" : "Log out"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
