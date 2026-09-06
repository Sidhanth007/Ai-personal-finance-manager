"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { updateProfileAction, type SettingsState } from "@/server/actions/settings";
import { CURRENCIES } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

type Props = {
  user: {
    name: string | null;
    email: string;
    currency: string;
    timezone: string;
    weeklyDigestEnabled: boolean;
    remindersEnabled: boolean;
  };
  timezones: string[];
};

const selectClass =
  "border-input h-9 w-full rounded-md border bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30";

export function SettingsForm({ user, timezones }: Props) {
  const [state, formAction, pending] = useActionState<SettingsState, FormData>(updateProfileAction, {});

  useEffect(() => {
    if (state.ok) toast.success(state.message);
    else if (state.error) toast.error(state.error);
  }, [state]);

  return (
    <form action={formAction}>
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>Your display name, currency, timezone, and email preferences.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" name="name" defaultValue={user.name ?? ""} required minLength={2} maxLength={80} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" value={user.email} disabled readOnly />
          </div>
          <div className="space-y-2">
            <Label htmlFor="currency">Currency</Label>
            <select id="currency" name="currency" defaultValue={user.currency} className={selectClass}>
              {CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="timezone">Timezone</Label>
            <select id="timezone" name="timezone" defaultValue={user.timezone} className={selectClass}>
              {timezones.map((tz) => (
                <option key={tz} value={tz}>
                  {tz}
                </option>
              ))}
            </select>
          </div>
          <label className="flex items-start gap-3 text-sm sm:col-span-2">
            <input
              type="checkbox"
              name="weeklyDigestEnabled"
              defaultChecked={user.weeklyDigestEnabled}
              className="mt-0.5 size-4 accent-primary"
            />
            <span>
              <span className="font-medium">Weekly financial digest</span>
              <span className="block text-muted-foreground">
                A weekly email summarising spending, income, savings progress, upcoming bills, and AI insights.
              </span>
            </span>
          </label>
          <label className="flex items-start gap-3 text-sm sm:col-span-2">
            <input
              type="checkbox"
              name="remindersEnabled"
              defaultChecked={user.remindersEnabled}
              className="mt-0.5 size-4 accent-primary"
            />
            <span>
              <span className="font-medium">Bill and subscription reminders</span>
              <span className="block text-muted-foreground">
                Email reminders a few days before each bill or subscription renewal is due.
              </span>
            </span>
          </label>
        </CardContent>
        <CardFooter className="justify-end">
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : "Save changes"}
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}
