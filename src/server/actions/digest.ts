"use server";

import { requireUser } from "@/lib/auth/session";
import { rateLimit } from "@/lib/rate-limit";
import { sendDigestTo } from "@/server/services/digest";
import { sendDueReminders } from "@/server/services/reminders";
import type { ActionState } from "./transactions";

/** Lets a user email themselves a digest immediately (max 3 per hour). */
export async function sendDigestNowAction(): Promise<ActionState> {
  const user = await requireUser();
  const rl = await rateLimit(`digest:${user.id}`, 3, 3600);
  if (!rl.ok) return { ok: false, error: `You can request up to 3 digests per hour. Try again in ${Math.ceil(rl.resetInSeconds / 60)} minutes.` };
  const res = await sendDigestTo(user);
  if (!res.ok) return { ok: false, error: res.error ?? "Could not send the digest" };
  return { ok: true, message: `Digest sent to ${user.email}${res.source === "ai" ? " with AI insights" : ""}.` };
}

/** Runs the reminder check for just this user, so reminders can be tested without waiting for the cron. */
export async function sendRemindersNowAction(): Promise<ActionState> {
  const user = await requireUser();
  const rl = await rateLimit(`reminders:${user.id}`, 3, 3600);
  if (!rl.ok) return { ok: false, error: `Try again in ${Math.ceil(rl.resetInSeconds / 60)} minutes.` };
  const r = await sendDueReminders(user.id);
  if (r.emailsSent === 0) return { ok: true, message: "Nothing to remind you about right now, or those reminders were already sent." };
  return { ok: true, message: `Reminder email sent: ${r.itemsReminded} due item${r.itemsReminded === 1 ? "" : "s"}, ${r.budgetAlerts} budget alert${r.budgetAlerts === 1 ? "" : "s"}.` };
}
