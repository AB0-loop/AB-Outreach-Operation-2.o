import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { auditEvents, consultations, orders, prospects } from "@/db/schema";
import { assertCsrf, requireAny } from "@/lib/auth";
import { jsonError } from "@/lib/api";
import { assertOrigin } from "@/lib/security";

const input = z.object({ prospectId: z.string().uuid(), consultationId: z.string().uuid().optional(), referredByPartnerId: z.string().uuid().optional(), status: z.enum(["quoted", "confirmed", "in_progress", "completed", "cancelled"]), description: z.string().trim().min(2).max(1000), quotedInr: z.number().min(0), revenueInr: z.number().min(0), costInr: z.number().min(0).optional(), orderedAt: z.coerce.date().optional() });

export async function POST(request: Request) {
  try {
    assertOrigin(request); const user = await requireAny(["owner", "admin", "operator"]); assertCsrf(request, user);
    const d = input.parse(await request.json());
    let partnerId = d.referredByPartnerId ?? null;
    if (d.consultationId) {
      const [c] = await db.select().from(consultations).where(eq(consultations.id, d.consultationId)).limit(1);
      if (!c || c.prospectId !== d.prospectId) throw new Error("Consultation does not belong to this customer");
      partnerId = partnerId ?? c.referredByPartnerId;
    } else if (!partnerId) {
      const [c] = await db.select().from(consultations).where(eq(consultations.prospectId, d.prospectId)).limit(1);
      partnerId = c?.referredByPartnerId ?? null;
    }
    const [row] = await db.insert(orders).values({ prospectId: d.prospectId, consultationId: d.consultationId, referredByPartnerId: partnerId, status: d.status, description: d.description, quotedInr: String(d.quotedInr), revenueInr: String(d.revenueInr), costInr: d.costInr === undefined ? null : String(d.costInr), orderedAt: d.orderedAt, completedAt: d.status === "completed" ? new Date() : null, createdBy: user.id }).returning();
    if (["confirmed", "in_progress", "completed"].includes(d.status)) await db.update(prospects).set({ stage: "customer", updatedAt: new Date() }).where(eq(prospects.id, d.prospectId));
    await db.insert(auditEvents).values({ actorId: user.id, action: "order.created", entityType: "order", entityId: row.id, summary: `${d.status} order recorded`, metadata: { revenueInr: d.revenueInr, referredByPartnerId: partnerId, humanEntered: true } });
    return Response.json({ ok: true, id: row.id, referredByPartnerId: partnerId }, { status: 201 });
  } catch (error) { return jsonError(error, "Order failed"); }
}
