import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { auditEvents, consultations, contacts, evidence, prospects } from "@/db/schema";
import { assertCsrf, requireAny } from "@/lib/auth";
import { jsonError } from "@/lib/api";
import { sha256 } from "@/lib/crypto";
import { contactFingerprint, normalizeContact } from "@/lib/normalization";
import { normalizePhone } from "@/lib/discovery/extract";
import { assertOrigin, fingerprintPepper } from "@/lib/security";

const input = z.object({ partnerId: z.string().uuid(), customerName: z.string().trim().min(2).max(160), customerPhone: z.string().trim().max(30).optional(), requirement: z.string().trim().min(3).max(500), status: z.enum(["proposed", "booked", "completed"]), scheduledAt: z.coerce.date().optional() });

// A referral is a human-recorded business event: creates the referred customer and a consultation attributed to the partner.
export async function POST(request: Request) {
  try {
    assertOrigin(request); const user = await requireAny(["owner", "admin", "operator"]); assertCsrf(request, user);
    const d = input.parse(await request.json());
    const [partner] = await db.select().from(prospects).where(eq(prospects.id, d.partnerId)).limit(1);
    if (!partner || !["referral_partner", "corporate"].includes(partner.category)) throw new Error("Referring partner not found");
    const phone = d.customerPhone ? normalizePhone(d.customerPhone) : null;
    if (d.customerPhone && !phone) throw new Error("Customer phone is not a valid Indian number");
    const result = await db.transaction(async tx => {
      const [customer] = await tx.insert(prospects).values({ displayName: d.customerName, category: "inbound", stage: "consultation", city: "Bengaluru", identityConfidence: 60, commercialFit: 80, assignedTo: user.id, isTest: partner.isTest }).returning();
      const ref = `aurum://referral/${partner.id}`;
      const [proof] = await tx.insert(evidence).values({ prospectId: customer.id, type: "need", sourceUrl: ref, excerpt: `Referred by ${partner.displayName}: ${d.requirement}`, summary: `Human-recorded referral from ${partner.displayName}`, contentHash: sha256(`${ref}|${customer.id}`), confidence: 90, supportsCommercialRelevance: true, origin: "human_entry", staleAfter: new Date(Date.now() + 365 * 86400_000), createdBy: user.id }).returning();
      if (phone) await tx.insert(contacts).values({ prospectId: customer.id, channel: "phone", value: phone.e164, normalizedValue: normalizeContact("phone", phone.e164), fingerprint: contactFingerprint("phone", phone.e164, fingerprintPepper()), evidenceId: proof.id, verification: "self_provided", verificationMethod: "provided via referring partner", verifiedAt: new Date(), kind: phone.type === "MOBILE" ? "mobile" : "phone" });
      const [consult] = await tx.insert(consultations).values({ prospectId: customer.id, status: d.status, scheduledAt: d.scheduledAt, completedAt: d.status === "completed" ? new Date() : null, sourceAttribution: `partner:${partner.displayName}`, referredByPartnerId: partner.id, createdBy: user.id }).returning();
      if (partner.partnerStage !== "active" && partner.partnerStage !== "paused") await tx.update(prospects).set({ partnerStage: "active", partnerStageUpdatedAt: new Date() }).where(eq(prospects.id, partner.id));
      await tx.insert(auditEvents).values({ actorId: user.id, action: "referral.recorded", entityType: "prospect", entityId: partner.id, summary: `Referral of ${d.customerName}`, metadata: { customerId: customer.id, consultationId: consult.id, humanEntered: true } });
      return { customerId: customer.id, consultationId: consult.id };
    });
    return Response.json({ ok: true, ...result }, { status: 201 });
  } catch (error) { return jsonError(error, "Referral failed"); }
}
