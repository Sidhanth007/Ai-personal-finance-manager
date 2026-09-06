import "server-only";
import { and, asc, desc, eq, gte, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { aiConversations, aiMessages } from "@/lib/db/schema";

export async function listConversations(userId: string, limit = 30) {
  return db
    .select({ id: aiConversations.id, title: aiConversations.title, updatedAt: aiConversations.updatedAt })
    .from(aiConversations)
    .where(eq(aiConversations.userId, userId))
    .orderBy(desc(aiConversations.updatedAt))
    .limit(limit);
}

export async function getConversation(userId: string, id: string) {
  const [row] = await db
    .select()
    .from(aiConversations)
    .where(and(eq(aiConversations.id, id), eq(aiConversations.userId, userId)))
    .limit(1);
  return row ?? null;
}

export async function createConversation(userId: string, title: string) {
  const [row] = await db
    .insert(aiConversations)
    .values({ userId, title: title.slice(0, 80) })
    .returning({ id: aiConversations.id });
  return row.id;
}

export async function getMessages(userId: string, conversationId: string) {
  return db
    .select({ id: aiMessages.id, role: aiMessages.role, content: aiMessages.content, createdAt: aiMessages.createdAt })
    .from(aiMessages)
    .where(and(eq(aiMessages.userId, userId), eq(aiMessages.conversationId, conversationId)))
    .orderBy(asc(aiMessages.createdAt));
}

export async function saveMessage(args: {
  userId: string;
  conversationId: string;
  role: "user" | "assistant";
  content: string;
  inputTokens?: number;
  outputTokens?: number;
}) {
  await db.insert(aiMessages).values(args);
  await db.update(aiConversations).set({ updatedAt: new Date() }).where(eq(aiConversations.id, args.conversationId));
}

export async function deleteConversation(userId: string, id: string) {
  const r = await db
    .delete(aiConversations)
    .where(and(eq(aiConversations.id, id), eq(aiConversations.userId, userId)))
    .returning({ id: aiConversations.id });
  return r.length > 0;
}

/** Messages a user sent in the last `hours` hours (for quota display). */
export async function userMessagesSince(userId: string, hours: number) {
  const since = new Date(Date.now() - hours * 3600 * 1000);
  const [row] = await db
    .select({ n: sql<number>`count(*)`.mapWith(Number) })
    .from(aiMessages)
    .where(and(eq(aiMessages.userId, userId), eq(aiMessages.role, "user"), gte(aiMessages.createdAt, since)));
  return row.n;
}
