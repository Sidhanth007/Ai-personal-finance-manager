"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/session";
import { getRequestMeta } from "@/lib/request";
import { recordAudit, setUserActive } from "@/server/services/admin";
import { recordCronRun } from "@/server/services/cron";
import { sendWeeklyDigests } from "@/server/services/digest";
import { runRecurringEngine } from "@/server/services/recurring";
import { sendDueReminders } from "@/server/services/reminders";
import type { ActionState } from "./transactions";

export async function setUserActiveAction(targetId: string, active: boolean): Promise<ActionState> {
  const admin = await requireAdmin();
  if (targetId === admin.id) return { ok: false, error: "You cannot deactivate your own admin account" };
  const target = await setUserActive(targetId, active);
  if (!target) return { ok: false, error: "User not found" };
  const { ipAddress } = await getRequestMeta();
  await recordAudit({ adminUserId: admin.id, action: active ? "user.reactivate" : "user.deactivate", targetType: "user", targetId, metadata: { email: target.email }, ipAddress });
  revalidatePath("/admin");
  return { ok: true, message: active ? "Account reactivated." : "Account deactivated. Existing sessions will stop working." };
}

export async function runJobNowAction(job: "daily" | "weekly"): Promise<ActionState> {
  const admin = await requireAdmin();
  const { ipAddress } = await getRequestMeta();
  await recordAudit({ adminUserId: admin.id, action: `cron.${job}.manual`, ipAddress });
  const result = await recordCronRun(`${job} (manual)`, async () =>
    job === "daily"
      ? { engine: await runRecurringEngine(), reminders: await sendDueReminders() }
      : { digests: await sendWeeklyDigests() },
  );
  revalidatePath("/admin");
  if (!result.ok) return { ok: false, error: result.error ?? "Job failed" };
  return { ok: true, message: `${job === "daily" ? "Daily" : "Weekly"} job finished: ${JSON.stringify(result.summary)}` };
}
