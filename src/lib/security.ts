import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { appEnvironment, requiredSecret } from "@/lib/env";
import { hmac } from "@/lib/crypto";

export function assertOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) { if (appEnvironment() !== "development") throw new Error("Origin header is required"); return; }
  const expected = process.env.APP_BASE_URL ? new URL(process.env.APP_BASE_URL).origin : new URL(request.url).origin;
  if (new URL(origin).origin !== expected) throw new Error("Origin rejected");
}
export function requestAddress(request: Request) {
  if (appEnvironment() === "development") return "development";
  if (process.env.TRUST_PROXY_HEADERS !== "true") throw new Error("Trusted proxy configuration is required");
  const chain = request.headers.get("x-forwarded-for");
  if (!chain) throw new Error("Trusted proxy did not provide client address");
  return chain.split(",")[0].trim();
}
export async function rateLimit(request: Request, action: string, limit: number, windowSeconds: number) {
  const key = hmac(`${requestAddress(request)}:${action}`, "RATE_LIMIT_PEPPER");
  const reset = new Date(Date.now() + windowSeconds * 1000);
  const result = await db.execute(sql`
    insert into aurum_acquisition.rate_limits (key_hash, action, window_start, expires_at, count)
    values (${key}, ${action}, now(), ${reset}, 1)
    on conflict (key_hash, action) do update set
      count = case when aurum_acquisition.rate_limits.expires_at <= now() then 1 else aurum_acquisition.rate_limits.count + 1 end,
      window_start = case when aurum_acquisition.rate_limits.expires_at <= now() then now() else aurum_acquisition.rate_limits.window_start end,
      expires_at = case when aurum_acquisition.rate_limits.expires_at <= now() then ${reset} else aurum_acquisition.rate_limits.expires_at end
    returning count, expires_at
  `);
  const row = result.rows[0] as { count: number; expires_at: Date };
  if (Number(row.count) > limit) throw new Error("Too many requests");
  return { remaining: limit - Number(row.count), resetAt: row.expires_at };
}
export const fingerprintPepper = () => requiredSecret("CONTACT_FINGERPRINT_PEPPER");
