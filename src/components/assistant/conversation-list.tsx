"use client";

import Link from "next/link";
import { useTransition } from "react";
import { MessageSquarePlus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteConversationAction } from "@/server/actions/ai";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Row = { id: string; title: string; updatedAt: Date };

export function ConversationList({ conversations, activeId }: { conversations: Row[]; activeId: string | null }) {
  const [pending, startTransition] = useTransition();
  return (
    <div className="space-y-2">
      <Link href="/assistant" className={cn(buttonVariants({ variant: activeId ? "outline" : "default", size: "sm" }), "w-full")}>
        <MessageSquarePlus className="size-4" /> New conversation
      </Link>
      <ul className="space-y-1">
        {conversations.map((c) => (
          <li key={c.id} className={cn("group flex items-center gap-1 rounded-md text-sm", c.id === activeId ? "bg-muted" : "hover:bg-muted/60")}>
            <Link href={`/assistant?c=${c.id}`} className="min-w-0 flex-1 truncate px-2 py-1.5" title={c.title}>
              {c.title}
            </Link>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Delete conversation"
              className="opacity-0 group-hover:opacity-100 focus:opacity-100"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const r = await deleteConversationAction(c.id);
                  if (r.ok) toast.success(r.message);
                  else toast.error(r.error);
                })
              }
            >
              <Trash2 className="size-3.5" />
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
