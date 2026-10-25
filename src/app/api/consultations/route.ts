import { z } from "zod";
import { db } from "@/db";
import { auditEvents, consultations, prospects } from "@/db/schema";
import { assertCsrf, requireAny } from "@/lib/auth";
import { jsonError } from "@/lib/api";
import { assertOrigin } from "@/lib/security";
import { eq } from "drizzle-orm";
const input = z.object({ prospectId: z.string().uuid(), status: z.enum(["proposed", "booked", "completed", "cancelled", "no_show"]), scheduledAt: z.coerce.date().optional(), location: z.string().max(300).optional(), notes: z.string().max(3000).optional(), sourceAttribution: z.string().min(2).max(200) });
export async function POST(request: Request) { try { assertOrigin(request); const user = await requireAny(["owner", "admin", "operator"]); assertCsrf(request, user); const data = input.parse(await request.json()); const [row] = await db.insert(consultations).values({ ...data, completedAt: data.status === "completed" ? new Date() : null, createdBy: user.id }).returning(); if (["booked", "completed"].includes(data.status)) await db.update(prospects).set({ stage: "consultation", updatedAt: new Date() }).where(eq(prospects.id, data.prospectId)); await db.insert(auditEvents).values({ actorId: user.id, action: "consultation.created", entityType: "consultation", entityId: row.id, summary: `${data.status} consultation recorded` }); return Response.json({ ok: true, id: row.id }, { status: 201 }); } catch (error) { return jsonError(error, "Consultation failed"); } }
