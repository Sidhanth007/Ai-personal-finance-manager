import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import { and, eq, gt, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { sessions, users, type User } from "@/lib/db/schema";
import { env } from "@/lib/env";
import { getRequestMeta } from "@/lib/request";
import { generateSessionToken, sha256 } from "./crypto";

export const SESSION_COOKIE = "fm_session";
const SESSION_DAYS = 30;

const secretKey = () => new TextEncoder().encode(env.AUTH_SECRET);

export async function createSession(userId: string): Promise<void> {
  const token = generateSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  const { ipAddress, userAgent } = await getRequestMeta();

  await db.insert(sessions).values({
    userId,
    tokenHash: sha256(token),
    expiresAt,
    ipAddress,
    userAgent,
  });

  const jwt = await new SignJWT({ t: token })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expiresAt)
    .sign(secretKey());

  (await cookies()).set(SESSION_COOKIE, jwt, {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

async function readSessionToken(): Promise<string | null> {
  const jwt = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!jwt) return null;
  try {
    const { payload } = await jwtVerify(jwt, secretKey());
    return typeof payload.t === "string" ? payload.t : null;
  } catch {
    return null;
  }
}

/** Current user for this request, or null. Cached per request. */
export const getCurrentUser = cache(async (): Promise<User | null> => {
  const token = await readSessionToken();
  if (!token) return null;

  const rows = await db
    .select({ user: users })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(
      and(
        eq(sessions.tokenHash, sha256(token)),
        isNull(sessions.revokedAt),
        gt(sessions.expiresAt, new Date()),
        eq(users.isActive, true),
      ),
    )
    .limit(1);

  return rows[0]?.user ?? null;
});

/** Use in server components and actions that must be authenticated. */
export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export function isAdmin(user: Pick<User, "email">): boolean {
  return user.email.toLowerCase() === env.ADMIN_EMAIL;
}

export async function requireAdmin(): Promise<User> {
  const user = await requireUser();
  if (!isAdmin(user)) redirect("/dashboard");
  return user;
}

export async function destroySession(): Promise<void> {
  const token = await readSessionToken();
  if (token) {
    await db
      .update(sessions)
      .set({ revokedAt: new Date() })
      .where(eq(sessions.tokenHash, sha256(token)));
  }
  (await cookies()).delete(SESSION_COOKIE);
}
