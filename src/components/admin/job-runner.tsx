"use client";

import { useTransition } from "react";
import { Play } from "lucide-react";
import { toast } from "sonner";
import { runJobNowAction } from "@/server/actions/admin";
import { Button } from "@/components/ui/button";

export function JobRunner() {
  const [pending, startTransition] = useTransition();
  const run = (job: "daily" | "weekly") =>
    startTransition(async () => {
      const r = await runJobNowAction(job);
      if (r.ok) toast.success(r.message, { duration: 8000 });
      else toast.error(r.error);
    });
  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" size="sm" disabled={pending} onClick={() => run("daily")}>
        <Play className="size-4" /> Run daily job now
      </Button>
      <Button variant="outline" size="sm" disabled={pending} onClick={() => run("weekly")}>
        <Play className="size-4" /> Run weekly digest now
      </Button>
    </div>
  );
}
