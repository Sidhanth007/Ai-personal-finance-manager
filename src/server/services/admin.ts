import "server-only";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { adminAuditLog, aiMessages, notifications, transactions, users } from "@/lib/db/schema";

const daysAgo = (n: number) => new Date(Date.now() - n * 86400000);
/** Raw sql fragments need a string parameter, not a Date. */
const ago = (n: number) => daysAgo(n).toISOString();

/**
 * Aggregate, privacy-preserving analytics. Nothing here returns a user's
 * transaction amounts, categories, notes, goals, or budgets.
 */
export async function adminOverview() {
  const [u] = await db
    .select({
      total: sql<number>`count(*)`.mapWith(Number),
      active: sql<number>`count(*) filter (where ${users.isActive})`.mapWith(Number),
      new7d: sql<number>`count(*) filter (where ${users.createdAt} >= ${ago(7)})`.mapWith(Number),
      new30d: sql<number>`count(*) filter (where ${users.createdAt} >= ${ago(30)})`.mapWith(Number),
      loggedIn7d: sql<number>`count(*) filter (where ${users.lastLoginAt} >= ${ago(7)})`.mapWith(Number),
      loggedIn30d: sql<number>`count(*) filter (where ${users.lastLoginAt} >= ${ago(30)})`.mapWith(Number),
    })
    .from(users);

  const [t] = await db
    .select({
      total: sql<number>`count(*)`.mapWith(Number),
      last30d: sql<number>`count(*) filter (where ${transactions.createdAt} >= ${ago(30)})`.mapWith(Number),
      imported: sql<number>`count(*) filter (where ${transactions.source} = 'import')`.mapWith(Number),
      recurring: sql<number>`count(*) filter (where ${transactions.source} = 'recurring')`.mapWith(Number),
      sandbox: sql<number>`count(*) filter (where ${transactions.source} = 'sandbox_payment')`.mapWith(Number),
    })
    .from(transactions);

  const [ai] = await db
    .select({
      messages30d: sql<number>`count(*) filter (where ${aiMessages.role} = 'user' and ${aiMessages.createdAt} >= ${ago(30)})`.mapWith(Number),
      inputTokens30d: sql<number>`coalesce(sum(${aiMessages.inputTokens}) filter (where ${aiMessages.createdAt} >= ${ago(30)}), 0)`.mapWith(Number),
      outputTokens30d: sql<number>`coalesce(sum(${aiMessages.outputTokens}) filter (where ${aiMessages.createdAt} >= ${ago(30)}), 0)`.mapWith(Number),
      usersUsingAi30d: sql<number>`count(distinct ${aiMessages.userId}) filter (where ${aiMessages.createdAt} >= ${ago(30)})`.mapWith(Number),
    })
    .from(aiMessages);

  const emails = await db
    .select({
      type: notifications.type,
      sent: sql<number>`count(*) filter (where ${notifications.status} = 'sent')`.mapWith(Number),
      failed: sql<number>`count(*) filter (where ${notifications.status} = 'failed')`.mapWith(Number),
    })
    .from(notifications)
    .where(and(eq(notifications.channel, "email"), gte(notifications.createdAt, daysAgo(30))))
    .groupBy(notifications.type)
    .orderBy(notifications.type);

  return { users: u, transactions: t, ai, emails };
}

export async function signupsPerDay(days = 30) {
  const rows = await db
    .select({ day: sql<string>`to_char(${users.createdAt}, 'YYYY-MM-DD')`, n: sql<number>`count(*)`.mapWith(Number) })
    .from(users)
    .where(gte(users.createdAt, daysAgo(days)))
    .groupBy(sql`to_char(${users.createdAt}, 'YYYY-MM-DD')`);
  const map = new Map(rows.map((r) => [r.day, r.n]));
  const out: { day: string; signups: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = daysAgo(i).toISOString().slice(0, 10);
    out.push({ day: d, signups: map.get(d) ?? 0 });
  }
  return out;
}

export type AdminUserRow = {
  id: string;
  email: string;
  name: string | null;
  createdAt: Date;
  lastLoginAt: Date | null;
  isActive: boolean;
  emailVerified: boolean;
  transactionCount: number;
  aiMessageCount: number;
};

/** Account-level facts only. Never joins amounts or content. */
export async function listUsersForAdmin(limit = 200): Promise<AdminUserRow[]> {
  return db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      createdAt: users.createdAt,
      lastLoginAt: users.lastLoginAt,
      isActive: users.isActive,
      emailVerified: sql<boolean>`${users.emailVerifiedAt} is not null`,
      transactionCount: sql<number>`(select count(*) from ${transactions} where ${transactions.userId} = ${users.id})`.mapWith(Number),
      aiMessageCount: sql<number>`(select count(*) from ${aiMessages} where ${aiMessages.userId} = ${users.id} and ${aiMessages.role} = 'user')`.mapWith(Number),
    })
    .from(users)
    .orderBy(desc(users.createdAt))
    .limit(limit);
}

export async function recentAudit(limit = 30) {
  return db
    .select({
      id: adminAuditLog.id,
      action: adminAuditLog.action,
      targetType: adminAuditLog.targetType,
      targetId: adminAuditLog.targetId,
      metadata: adminAuditLog.metadata,
      createdAt: adminAuditLog.createdAt,
      adminEmail: users.email,
    })
    .from(adminAuditLog)
    .leftJoin(users, eq(adminAuditLog.adminUserId, users.id))
    .orderBy(desc(adminAuditLog.createdAt))
    .limit(limit);
}

export async function recordAudit(args: { adminUserId: string; action: string; targetType?: string; targetId?: string; metadata?: Record<string, unknown>; ipAddress?: string | null }) {
  await db.insert(adminAuditLog).values({
    adminUserId: args.adminUserId,
    action: args.action,
    targetType: args.targetType,
    targetId: args.targetId,
    metadata: args.metadata,
    ipAddress: args.ipAddress ?? null,
  });
}

export async function setUserActive(targetId: string, active: boolean) {
  const r = await db.update(users).set({ isActive: active, updatedAt: new Date() }).where(eq(users.id, targetId)).returning({ id: users.id, email: users.email });
  return r[0] ?? null;
}
