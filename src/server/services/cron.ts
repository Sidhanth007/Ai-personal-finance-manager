import "server-only";
import { desc, eq } from "drizzle-orm";
import { timingSafeEqual } from "node:crypto";
import { db } from "@/lib/db";
import { cronRuns } from "@/lib/db/schema";
import { env } from "@/lib/env";

/** Vercel Cron sends `Authorization: Bearer <CRON_SECRET>`. Manual runs may use the same header. */
export function isAuthorizedCron(req: Request): boolean {
  const secret = env.CRON_SECRET;
  if (!secret) return env.NODE_ENV !== "production"; // allow local runs when no secret is set
  const header = req.headers.get("authorization") ?? "";
  const provided = header.startsWith("Bearer ") ? header.slice(7) : "";
  const a = Buffer.from(provided);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Wraps a job with a cron_runs record so the admin dashboard can show health. */
export async function recordCronRun<T extends Record<string, unknown>>(job: string, fn: () => Promise<T>): Promise<{ ok: boolean; summary?: T; error?: string }> {
  const [run] = await db.insert(cronRuns).values({ job }).returning({ id: cronRuns.id });
  try {
    const summary = await fn();
    await db.update(cronRuns).set({ status: "success", finishedAt: new Date(), summary }).where(eq(cronRuns.id, run.id));
    return { ok: true, summary };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    await db.update(cronRuns).set({ status: "failed", finishedAt: new Date(), error }).where(eq(cronRuns.id, run.id));
    return { ok: false, error };
  }
}

export async function recentCronRuns(limit = 20) {
  return db.select().from(cronRuns).orderBy(desc(cronRuns.startedAt)).limit(limit);
}
