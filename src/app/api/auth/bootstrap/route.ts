import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { auditEvents, settings, sources, users } from "@/db/schema";
import { createSession, hashPassword } from "@/lib/auth";
import { jsonError } from "@/lib/api";
import { requiredSecret } from "@/lib/env";
import { assertOrigin, rateLimit } from "@/lib/security";

const input = z.object({ email: z.string().email().transform(v => v.toLowerCase()), displayName: z.string().trim().min(2).max(100), password: z.string().min(14).max(256), bootstrapToken: z.string().min(32) });
export async function POST(request: Request) { try { assertOrigin(request); await rateLimit(request, "bootstrap", 3, 3600); const data = input.parse(await request.json()); if (data.bootstrapToken !== requiredSecret("ADMIN_BOOTSTRAP_TOKEN")) throw new Error("Bootstrap token is invalid"); const existing = await db.select({ id: users.id }).from(users).limit(1); if (existing.length) throw new Error("Bootstrap is permanently closed"); const [user] = await db.insert(users).values({ email: data.email, displayName: data.displayName, passwordHash: await hashPassword(data.password), role: "owner" }).returning(); await db.insert(settings).values({ updatedBy: user.id }).onConflictDoNothing(); await db.insert(sources).values([
  { name: "Aurum website inbound", type: "inbound", baseUrl: "https://aurumbespoke.com/", checkUrl: "https://aurumbespoke.com/", access: "permitted", accessBasis: "Aurum-owned public site; production records require authorised backend access", purpose: "Manual or approved webhook import of consultation requests" },
  { name: "First-party referral research", type: "referral", access: "manual_only", accessBasis: "Review each business site and terms individually; no bulk harvesting", purpose: "Planner, stylist, venue, photography and luxury-service partnerships" },
  { name: "Professional events", type: "event", access: "manual_only", accessBasis: "Use public event pages to select networking opportunities, not attendee marketing lists", purpose: "Warm introductions and relationship development" },
]).onConflictDoNothing(); await db.insert(auditEvents).values({ actorId: user.id, action: "auth.bootstrap", entityType: "user", entityId: user.id, summary: "Initial owner created; sending remains disabled" }); await createSession(user.id); return Response.json({ ok: true }); } catch (error) { return jsonError(error, "Bootstrap failed"); } }
