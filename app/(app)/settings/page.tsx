import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/shared/page-header";
import { SettingsForm } from "@/components/settings/settings-form";
import { EmailTools } from "@/components/settings/email-tools";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const user = await requireUser();
  const timezones = Intl.supportedValuesOf("timeZone");

  return (
    <>
      <PageHeader
        title="Settings"
        description="Manage your profile and email preferences."
        actions={
          <Link href="/settings/categories" className={cn(buttonVariants({ variant: "outline" }))}>
            Manage categories
          </Link>
        }
      />
      <div className="max-w-2xl space-y-6">
        <EmailTools email={user.email} />
        <SettingsForm
          user={{
            name: user.name,
            email: user.email,
            currency: user.currency,
            timezone: user.timezone,
            weeklyDigestEnabled: user.weeklyDigestEnabled,
            remindersEnabled: user.remindersEnabled,
          }}
          timezones={timezones}
        />
      </div>
    </>
  );
}
