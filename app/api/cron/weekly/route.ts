import { NextResponse } from "next/server";
import { isAuthorizedCron, recordCronRun } from "@/server/services/cron";
import { sendWeeklyDigests } from "@/server/services/digest";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Weekly job (Vercel Cron, Monday): send the financial digest to every opted-in user. */
export async function GET(req: Request) {
  if (!isAuthorizedCron(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const result = await recordCronRun("weekly", async () => ({ digests: await sendWeeklyDigests() }));
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}
