import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { auditEvents, prospects, suppressions } from "@/db/schema";
import { assertCsrf, requireAny } from "@/lib/auth";
import { jsonError } from "@/lib/api";
import { assertOrigin } from "@/lib/security";

const input = z.object({ prospectId: z.string().uuid().optional(), contactFingerprint: z.string().length(64).optional(), channel: z.enum(["email", "phone", "whatsapp", "web_form"]).optional(), reason: z.string().trim().min(2).max(500), source: z.string().trim().min(2).max(100) }).refine(v => v.prospectId || v.contactFingerprint, "Prospect or contact is required");
export async function POST(request: Request) {
  try {
    assertOrigin(request);
    const user = await requireAny(["owner", "admin", "reviewer", "operator"]);
    assertCsrf(request, user);
    const data = input.parse(await request.json());
    const [row] = await db.insert(suppressions).values({ ...data, createdBy: user.id }).returning();
    if (data.prospectId) await db.update(prospects).set({ stage: "suppressed", updatedAt: new Date() }).where(eq(prospects.id, data.prospectId));
    await db.insert(auditEvents).values({ actorId: user.id, action: "suppression.created", entityType: "suppression", entityId: row.id, summary: data.reason });
    return Response.json({ ok: true, id: row.id }, { status: 201 });
  } catch (error) { return jsonError(error, "Suppression failed"); }
}
