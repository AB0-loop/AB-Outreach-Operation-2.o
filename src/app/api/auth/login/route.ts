import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { auditEvents, users } from "@/db/schema";
import { createSession, verifyPassword } from "@/lib/auth";
import { jsonError } from "@/lib/api";
import { assertOrigin, rateLimit } from "@/lib/security";
const input = z.object({ email: z.string().email().transform(v => v.toLowerCase()), password: z.string().min(1).max(256) });
export async function POST(request: Request) { try { assertOrigin(request); await rateLimit(request, "login", 5, 900); const data = input.parse(await request.json()); const [user] = await db.select().from(users).where(eq(users.email, data.email)).limit(1); if (!user || !user.active || !(await verifyPassword(user.passwordHash, data.password))) throw new Error("Invalid email or password"); await createSession(user.id); await db.insert(auditEvents).values({ actorId: user.id, action: "auth.login", entityType: "user", entityId: user.id, summary: "User signed in" }); return Response.json({ ok: true }); } catch (error) { return jsonError(error, "Login failed"); } }
