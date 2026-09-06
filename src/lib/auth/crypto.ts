import "server-only";
import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";

/** Six-digit numeric code, zero padded, from a CSPRNG. */
export function generateOtpCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

/** Opaque random session token. Only its hash is stored. */
export function generateSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

export function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

/** OTP codes are hashed with a keyed HMAC so a database leak alone cannot reveal them. */
export function hashOtp(email: string, code: string): string {
  return createHmac("sha256", env.AUTH_SECRET).update(`${email}:${code}`).digest("hex");
}

export function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}
