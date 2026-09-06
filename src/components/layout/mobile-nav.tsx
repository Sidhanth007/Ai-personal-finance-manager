"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { SidebarNav } from "./sidebar-nav";

export function MobileNav({ isAdmin }: { isAdmin: boolean }) {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={<Button variant="ghost" size="icon" className="md:hidden" aria-label="Open menu" />}
      >
        <Menu className="size-5" />
      </SheetTrigger>
      <SheetContent side="left" className="w-72 p-4">
        <SheetHeader className="p-0 text-left">
          <SheetTitle>AI Personal Finance Manager</SheetTitle>
          <SheetDescription className="sr-only">Main navigation</SheetDescription>
        </SheetHeader>
        <SidebarNav isAdmin={isAdmin} onNavigate={() => setOpen(false)} className="mt-4" />
      </SheetContent>
    </Sheet>
  );
}
