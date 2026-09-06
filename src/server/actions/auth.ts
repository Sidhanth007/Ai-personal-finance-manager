"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { seedDefaultCategories } from "@/lib/db/defaults";
import { users } from "@/lib/db/schema";
import { isEmailConfigured } from "@/lib/env";
import { issueOtp, verifyOtp } from "@/lib/auth/otp";
import { createSession, destroySession } from "@/lib/auth/session";
import { getRequestMeta } from "@/lib/request";
import { rateLimit } from "@/lib/rate-limit";
import { nameSchema, requestOtpSchema, verifyOtpSchema } from "@/lib/validations/auth";

export type AuthFormState = {
  step: "email" | "code";
  purpose: "signup" | "login";
  email?: string;
  name?: string;
  error?: string;
  message?: string;
  /** True when the code was printed to the server console instead of emailed. */
  devConsole?: boolean;
};

function firstIssue(err: { issues: { message: string }[] }) {
  return err.issues[0]?.message ?? "Invalid input";
}

function safeNext(next: string | undefined): string {
  if (next && next.startsWith("/") && !next.startsWith("//")) return next;
  return "/dashboard";
}

export async function authAction(prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const intent = formData.get("intent");
  if (intent === "verify") return verifyStep(prev, formData);
  if (intent === "change-email") return { step: "email", purpose: prev.purpose, email: prev.email, name: prev.name };
  return requestStep(prev, formData);
}

async function requestStep(prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = requestOtpSchema.safeParse({
    purpose: formData.get("purpose") ?? prev.purpose,
    email: formData.get("email") ?? prev.email,
    name: formData.get("name") ?? prev.name,
  });
  if (!parsed.success) {
    return { step: "email", purpose: prev.purpose, error: firstIssue(parsed.error) };
  }
  const { purpose, email } = parsed.data;
  let name: string | undefined;

  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);

  if (purpose === "signup") {
    const nameParsed = nameSchema.safeParse(parsed.data.name ?? "");
    if (!nameParsed.success) {
      return { step: "email", purpose, email, error: firstIssue(nameParsed.error) };
    }
    name = nameParsed.data;
    if (existing) {
      return { step: "email", purpose, email, name, error: "An account with this email already exists. Please log in instead." };
    }
  } else if (!existing) {
    return { step: "email", purpose, email, error: "No account found for this email. Please sign up first." };
  }

  const { ipAddress } = await getRequestMeta();
  const ipLimit = await rateLimit(`otp:req:${ipAddress ?? "unknown"}`, 10, 15 * 60);
  if (!ipLimit.ok) {
    return { step: "email", purpose, email, name, error: `Too many code requests from this network. Try again in ${Math.ceil(ipLimit.resetInSeconds / 60)} minutes.` };
  }
  const issued = await issueOtp({ email, purpose, ipAddress });
  if (!issued.ok) {
    return { step: "email", purpose, email, name, error: issued.error };
  }

  return {
    step: "code",
    purpose,
    email,
    name,
    message: isEmailConfigured
      ? `We sent a 6-digit code to ${email}.`
      : "Email is not configured yet, so the 6-digit code was printed in the server terminal.",
    devConsole: !isEmailConfigured,
  };
}

async function verifyStep(prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = verifyOtpSchema.safeParse({
    purpose: formData.get("purpose") ?? prev.purpose,
    email: formData.get("email") ?? prev.email,
    name: formData.get("name") ?? prev.name,
    code: formData.get("code"),
    next: formData.get("next") ?? undefined,
  });
  if (!parsed.success) {
    return { ...prev, step: "code", error: firstIssue(parsed.error) };
  }
  const { purpose, email, code, name } = parsed.data;

  const { ipAddress } = await getRequestMeta();
  const ipLimit = await rateLimit(`otp:verify:${ipAddress ?? "unknown"}`, 30, 15 * 60);
  if (!ipLimit.ok) {
    return { ...prev, step: "code", email, error: `Too many attempts from this network. Try again in ${Math.ceil(ipLimit.resetInSeconds / 60)} minutes.` };
  }

  const verified = await verifyOtp({ email, code, purpose });
  if (!verified.ok) {
    return { ...prev, step: "code", email, error: verified.error };
  }

  let userId: string;
  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);

  if (existing) {
    userId = existing.id;
    await db.update(users).set({ lastLoginAt: new Date(), updatedAt: new Date() }).where(eq(users.id, userId));
  } else {
    if (purpose !== "signup") {
      return { step: "email", purpose, email, error: "No account found for this email. Please sign up first." };
    }
    const [created] = await db
      .insert(users)
      .values({ email, name: name ?? null, emailVerifiedAt: new Date(), lastLoginAt: new Date() })
      .returning({ id: users.id });
    userId = created.id;
    await seedDefaultCategories(userId);
  }

  await createSession(userId);
  redirect(safeNext(parsed.data.next));
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect("/login");
}
