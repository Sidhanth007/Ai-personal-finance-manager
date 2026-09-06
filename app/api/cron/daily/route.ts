import { NextResponse } from "next/server";
import { isAuthorizedCron, recordCronRun } from "@/server/services/cron";
import { runRecurringEngine } from "@/server/services/recurring";
import { sendDueReminders } from "@/server/services/reminders";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Daily job (Vercel Cron): process recurring rules and subscription charges,
 * flag overdue bills, then send reminder emails.
 */
export async function GET(req: Request) {
  if (!isAuthorizedCron(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const result = await recordCronRun("daily", async () => {
    const engine = await runRecurringEngine();
    const reminders = await sendDueReminders();
    return { engine, reminders };
  });

  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}
