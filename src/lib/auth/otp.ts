import "server-only";
import { and, count, desc, eq, gt, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { otpCodes } from "@/lib/db/schema";
import { sendOtpEmail } from "@/server/services/email";
import { generateOtpCode, hashOtp, safeEqual } from "./crypto";

export type OtpPurpose = "signup" | "login";

const OTP_TTL_MINUTES = 10;
const MAX_VERIFY_ATTEMPTS = 5;
const MAX_CODES_PER_WINDOW = 3;
const WINDOW_MINUTES = 10;

type Result = { ok: true } | { ok: false; error: string };

export async function issueOtp(args: {
  email: string;
  purpose: OtpPurpose;
  ipAddress: string | null;
}): Promise<Result> {
  const { email, purpose, ipAddress } = args;
  const windowStart = new Date(Date.now() - WINDOW_MINUTES * 60 * 1000);

  const [recent] = await db
    .select({ n: count() })
    .from(otpCodes)
    .where(and(eq(otpCodes.email, email), gt(otpCodes.createdAt, windowStart)));

  if (recent.n >= MAX_CODES_PER_WINDOW) {
    return {
      ok: false,
      error: `Too many codes requested. Please wait ${WINDOW_MINUTES} minutes and try again.`,
    };
  }

  // Any earlier unconsumed code for this email becomes invalid.
  await db
    .update(otpCodes)
    .set({ consumedAt: new Date() })
    .where(and(eq(otpCodes.email, email), isNull(otpCodes.consumedAt)));

  const code = generateOtpCode();
  await db.insert(otpCodes).values({
    email,
    purpose,
    codeHash: hashOtp(email, code),
    expiresAt: new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000),
    ipAddress,
  });

  const sent = await sendOtpEmail(email, code, purpose);
  if (!sent.ok) {
    return { ok: false, error: `Could not send the code: ${sent.error}` };
  }
  return { ok: true };
}

export async function verifyOtp(args: {
  email: string;
  code: string;
  purpose: OtpPurpose;
}): Promise<Result> {
  const { email, code, purpose } = args;

  const [row] = await db
    .select()
    .from(otpCodes)
    .where(
      and(
        eq(otpCodes.email, email),
        eq(otpCodes.purpose, purpose),
        isNull(otpCodes.consumedAt),
        gt(otpCodes.expiresAt, new Date()),
      ),
    )
    .orderBy(desc(otpCodes.createdAt))
    .limit(1);

  if (!row) {
    return { ok: false, error: "That code has expired or was not found. Request a new one." };
  }
  if (row.attempts >= MAX_VERIFY_ATTEMPTS) {
    return { ok: false, error: "Too many incorrect attempts. Request a new code." };
  }

  if (!safeEqual(row.codeHash, hashOtp(email, code))) {
    const attempts = row.attempts + 1;
    await db.update(otpCodes).set({ attempts }).where(eq(otpCodes.id, row.id));
    const left = MAX_VERIFY_ATTEMPTS - attempts;
    return {
      ok: false,
      error: left > 0 ? `Incorrect code. ${left} attempt${left === 1 ? "" : "s"} left.` : "Too many incorrect attempts. Request a new code.",
    };
  }

  await db.update(otpCodes).set({ consumedAt: new Date() }).where(eq(otpCodes.id, row.id));
  return { ok: true };
}
