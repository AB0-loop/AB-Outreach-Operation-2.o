import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { auditEvents, prospects } from "@/db/schema";
import { assertCsrf, requireAny, requireUser } from "@/lib/auth";
import { jsonError } from "@/lib/api";
import { partnerScorecard } from "@/lib/partner-metrics";
import { assertOrigin } from "@/lib/security";

const input = z.object({ prospectId: z.string().uuid(), stage: z.enum(["not_started", "contacted", "meeting_scheduled", "meeting_held", "agreed", "active", "paused", "declined"]), nextFollowUpAt: z.coerce.date().nullable().optional(), note: z.string().trim().max(1000).optional() });

export async function GET(request: Request) {
  try {
    const user = await requireUser(); const u = new URL(request.url);
    const includeTest = u.searchParams.get("includeTest") === "1" && user.role === "owner";
    return Response.json({ ok: true, rows: await partnerScorecard({ includeTest, category: u.searchParams.get("category") ?? undefined }) });
  } catch (error) { return jsonError(error); }
}
export async function PATCH(request: Request) {
  try {
    assertOrigin(request); const user = await requireAny(["owner", "admin", "operator"]); assertCsrf(request, user);
    const d = input.parse(await request.json());
    const [p] = await db.select().from(prospects).where(eq(prospects.id, d.prospectId)).limit(1);
    if (!p || !["referral_partner", "corporate"].includes(p.category)) throw new Error("Partner or corporate record not found");
    await db.update(prospects).set({ partnerStage: d.stage, partnerStageUpdatedAt: new Date(), ...(d.nextFollowUpAt !== undefined ? { nextFollowUpAt: d.nextFollowUpAt } : {}), updatedAt: new Date() }).where(eq(prospects.id, p.id));
    await db.insert(auditEvents).values({ actorId: user.id, action: "partner.stage", entityType: "prospect", entityId: p.id, summary: `${p.partnerStage} → ${d.stage}${d.note ? `: ${d.note}` : ""}`, metadata: { from: p.partnerStage, to: d.stage, humanEntered: true } });
    return Response.json({ ok: true });
  } catch (error) { return jsonError(error, "Partner update failed"); }
}
