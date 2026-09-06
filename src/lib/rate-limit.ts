import "server-only";
import { env, isRedisConfigured } from "@/lib/env";

export type RateLimitResult = { ok: boolean; remaining: number; resetInSeconds: number };

/**
 * Fixed-window rate limiter. Uses Upstash Redis via REST when configured,
 * otherwise an in-process map (fine for a single dev server; resets on restart).
 */
const memory = new Map<string, { count: number; resetAt: number }>();

async function upstash(cmds: (string | number)[][]): Promise<{ result: unknown }[]> {
  const res = await fetch(`${env.UPSTASH_REDIS_REST_URL}/pipeline`, {
    method: "POST",
    headers: { authorization: `Bearer ${env.UPSTASH_REDIS_REST_TOKEN}`, "content-type": "application/json" },
    body: JSON.stringify(cmds),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Upstash ${res.status}`);
  return res.json();
}

export async function rateLimit(key: string, limit: number, windowSeconds: number): Promise<RateLimitResult> {
  const now = Date.now();
  const windowId = Math.floor(now / 1000 / windowSeconds);
  const resetInSeconds = (windowId + 1) * windowSeconds - Math.floor(now / 1000);
  const fullKey = `rl:${key}:${windowId}`;

  if (isRedisConfigured) {
    try {
      const [incr] = await upstash([["INCR", fullKey], ["EXPIRE", fullKey, windowSeconds + 1]]);
      const count = Number(incr.result);
      return { ok: count <= limit, remaining: Math.max(0, limit - count), resetInSeconds };
    } catch {
      // fall through to memory on Redis trouble rather than blocking users
    }
  }

  const entry = memory.get(fullKey);
  if (!entry || entry.resetAt <= now) {
    memory.set(fullKey, { count: 1, resetAt: (windowId + 1) * windowSeconds * 1000 });
    if (memory.size > 5000) for (const [k, v] of memory) if (v.resetAt <= now) memory.delete(k);
    return { ok: true, remaining: limit - 1, resetInSeconds };
  }
  entry.count++;
  return { ok: entry.count <= limit, remaining: Math.max(0, limit - entry.count), resetInSeconds };
}
