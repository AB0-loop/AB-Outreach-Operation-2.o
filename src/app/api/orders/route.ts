import { z } from "zod";
import { db } from "@/db";
import { auditEvents, orders, prospects } from "@/db/schema";
import { assertCsrf, requireAny } from "@/lib/auth";
import { jsonError } from "@/lib/api";
import { assertOrigin } from "@/lib/security";
import { eq } from "drizzle-orm";
const input = z.object({ prospectId: z.string().uuid(), consultationId: z.string().uuid().optional(), status: z.enum(["quoted", "confirmed", "in_progress", "completed", "cancelled"]), description: z.string().trim().min(2).max(1000), quotedInr: z.number().min(0), revenueInr: z.number().min(0), orderedAt: z.coerce.date().optional() });
export async function POST(request: Request) { try { assertOrigin(request); const user = await requireAny(["owner", "admin", "operator"]); assertCsrf(request, user); const data = input.parse(await request.json()); const [row] = await db.insert(orders).values({ ...data, quotedInr: String(data.quotedInr), revenueInr: String(data.revenueInr), completedAt: data.status === "completed" ? new Date() : null, createdBy: user.id }).returning(); if (["confirmed", "in_progress", "completed"].includes(data.status)) await db.update(prospects).set({ stage: "customer", updatedAt: new Date() }).where(eq(prospects.id, data.prospectId)); await db.insert(auditEvents).values({ actorId: user.id, action: "order.created", entityType: "order", entityId: row.id, summary: `${data.status} order recorded`, metadata: { revenueInr: data.revenueInr } }); return Response.json({ ok: true, id: row.id }, { status: 201 }); } catch (error) { return jsonError(error, "Order failed"); } }
