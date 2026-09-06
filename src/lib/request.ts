import "server-only";
import { headers } from "next/headers";

export async function getRequestMeta() {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  const ipAddress = forwarded?.split(",")[0]?.trim() || h.get("x-real-ip") || null;
  const userAgent = h.get("user-agent");
  return { ipAddress, userAgent };
}
