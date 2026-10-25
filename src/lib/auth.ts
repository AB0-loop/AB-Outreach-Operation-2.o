import "server-only";
import argon2 from "argon2";
import { cookies } from "next/headers";
import { and, eq, gt } from "drizzle-orm";
import { db } from "@/db";
import { sessions, users } from "@/db/schema";
import { hmac, randomToken, sha256 } from "@/lib/crypto";

const SESSION = "aurum_session", CSRF = "aurum_csrf";
export type Role = "owner" | "admin" | "researcher" | "reviewer" | "operator";
const permissions: Record<string, Role[]> = {
  research: ["owner", "admin", "researcher"], review: ["owner", "admin", "reviewer"], operate: ["owner", "admin", "operator"], administer: ["owner", "admin"], owner: ["owner"],
};
export const hashPassword = (password: string) => argon2.hash(password, { type: argon2.argon2id, memoryCost: 19_456, timeCost: 3, parallelism: 1 });
export async function verifyPassword(hash: string, password: string) { try { return await argon2.verify(hash, password); } catch { return false; } }
export async function createSession(userId: string) {
  const token = randomToken(), csrf = randomToken(); const expiresAt = new Date(Date.now() + 7 * 86400_000);
  await db.insert(sessions).values({ userId, tokenHash: hmac(token, "SESSION_PEPPER"), csrfHash: sha256(csrf), expiresAt });
  const jar = await cookies(); const secure = process.env.NODE_ENV === "production";
  jar.set(SESSION, token, { httpOnly: true, secure, sameSite: "strict", path: "/", expires: expiresAt });
  jar.set(CSRF, csrf, { httpOnly: false, secure, sameSite: "strict", path: "/", expires: expiresAt });
}
export async function currentSession() {
  const token = (await cookies()).get(SESSION)?.value; if (!token) return null;
  const rows = await db.select({ id: users.id, email: users.email, displayName: users.displayName, role: users.role, sessionId: sessions.id, csrfHash: sessions.csrfHash }).from(sessions).innerJoin(users, eq(users.id, sessions.userId)).where(and(eq(sessions.tokenHash, hmac(token, "SESSION_PEPPER")), gt(sessions.expiresAt, new Date()), eq(users.active, true))).limit(1);
  return rows[0] ?? null;
}
export async function requirePermission(permission: keyof typeof permissions) {
  const user = await currentSession(); if (!user) throw new Error("Authentication required");
  if (!permissions[permission].includes(user.role)) throw new Error("Permission denied"); return user;
}
export async function requireUser() { const u = await currentSession(); if (!u) throw new Error("Authentication required"); return u; }
export async function requireAny(roles: Role[]) { const u = await requireUser(); if (!roles.includes(u.role)) throw new Error("Permission denied"); return u; }
export function assertCsrf(request: Request, user: { csrfHash: string }) { const value = request.headers.get("x-csrf-token"); if (!value || sha256(value) !== user.csrfHash) throw new Error("CSRF validation failed"); }
export async function destroySession() { const jar = await cookies(); const token = jar.get(SESSION)?.value; if (token) await db.delete(sessions).where(eq(sessions.tokenHash, hmac(token, "SESSION_PEPPER"))); jar.delete(SESSION); jar.delete(CSRF); }
