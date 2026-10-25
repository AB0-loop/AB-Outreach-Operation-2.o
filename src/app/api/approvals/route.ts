import { z } from "zod";
import { db } from "@/db";
import { approvals, auditEvents, messageDrafts, prospects } from "@/db/schema";
import { assertCsrf, requirePermission } from "@/lib/auth";
import { jsonError } from "@/lib/api";
import { assertOrigin } from "@/lib/security";
import { eq } from "drizzle-orm";
const input = z.object({ entityType: z.enum(["prospect", "message"]), entityId: z.string().uuid(), decision: z.enum(["approved", "rejected", "changes_requested", "revoked"]), note: z.string().trim().max(1000).optional() });
export async function POST(request: Request) { try { assertOrigin(request); const user = await requirePermission("review"); assertCsrf(request, user); const data = input.parse(await request.json()); const [row] = await db.insert(approvals).values({ ...data, decidedBy: user.id }).returning(); if (data.entityType === "prospect") await db.update(prospects).set({ stage: data.decision === "approved" ? "qualified" : data.decision === "rejected" ? "rejected" : "review", updatedAt: new Date() }).where(eq(prospects.id, data.entityId)); else await db.update(messageDrafts).set({ status: data.decision === "approved" ? "approved" : data.decision === "rejected" ? "rejected" : "review", updatedAt: new Date() }).where(eq(messageDrafts.id, data.entityId)); await db.insert(auditEvents).values({ actorId: user.id, action: `approval.${data.decision}`, entityType: data.entityType, entityId: data.entityId, summary: data.note || data.decision, metadata: { approvalId: row.id } }); return Response.json({ ok: true, id: row.id }); } catch (error) { return jsonError(error, "Approval failed"); } }
