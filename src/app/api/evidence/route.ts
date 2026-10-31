import { z } from "zod";
import { db } from "@/db";
import { auditEvents, evidence } from "@/db/schema";
import { assertCsrf, requirePermission } from "@/lib/auth";
import { jsonError } from "@/lib/api";
import { sha256 } from "@/lib/crypto";
import { assertOrigin } from "@/lib/security";

const body = z.object({ prospectId: z.string().uuid(), type: z.enum(["identity", "role", "location", "commercial_relevance", "need", "timing"]), sourceUrl: z.string().url().max(2048), excerpt: z.string().trim().min(5).max(1500), summary: z.string().trim().min(5).max(600), confidence: z.number().int().min(0).max(100) });
export async function POST(request: Request) {
  try {
    assertOrigin(request); const user = await requirePermission("research"); assertCsrf(request, user);
    const d = body.parse(await request.json());
    const [row] = await db.insert(evidence).values({ prospectId: d.prospectId, type: d.type, sourceUrl: d.sourceUrl, excerpt: d.excerpt, summary: d.summary, contentHash: sha256(`${d.sourceUrl}|${d.excerpt}`), confidence: d.confidence, supportsCommercialRelevance: ["commercial_relevance", "need", "timing"].includes(d.type), staleAfter: new Date(Date.now() + 180 * 86400_000), createdBy: user.id }).onConflictDoNothing().returning();
    if (!row) throw new Error("This evidence is already recorded");
    await db.insert(auditEvents).values({ actorId: user.id, action: "evidence.manual", entityType: "prospect", entityId: d.prospectId, summary: `${d.type} evidence from ${new URL(d.sourceUrl).hostname}` });
    return Response.json({ ok: true, id: row.id }, { status: 201 });
  } catch (error) { return jsonError(error, "Evidence failed"); }
}
