"use client";

import { useTransition } from "react";
import { BellRing, Mail } from "lucide-react";
import { toast } from "sonner";
import { sendDigestNowAction, sendRemindersNowAction } from "@/server/actions/digest";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function EmailTools({ email }: { email: string }) {
  const [pending, startTransition] = useTransition();
  const run = (fn: () => Promise<{ ok?: boolean; message?: string; error?: string }>) =>
    startTransition(async () => {
      const r = await fn();
      if (r.ok) toast.success(r.message);
      else toast.error(r.error);
    });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Email tools</CardTitle>
        <CardDescription>
          Automated emails go out on a schedule: reminders daily, the digest every Monday. Use these to send them to {email} right now.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        <Button variant="outline" disabled={pending} onClick={() => run(sendDigestNowAction)}>
          <Mail className="size-4" /> Send my weekly digest now
        </Button>
        <Button variant="outline" disabled={pending} onClick={() => run(sendRemindersNowAction)}>
          <BellRing className="size-4" /> Check reminders now
        </Button>
      </CardContent>
    </Card>
  );
}
