import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { assessments, auditEvents, contacts, eligibilityChecks, evidence, prospects } from "@/db/schema";
import { contactFingerprint, normalizeContact, normalizeText } from "@/lib/normalization";
import { fingerprintPepper } from "@/lib/security";
import { scoreProspect } from "@/lib/scoring";
import { sha256 } from "@/lib/crypto";

export const prospectInput = z.object({
  sourceId: z.string().uuid(), displayName: z.string().trim().min(2).max(160), organisation: z.string().trim().max(200).optional(), role: z.string().trim().max(160).optional(), city: z.string().trim().max(120).default("Bengaluru"),
  category: z.enum(["inbound", "referral_partner", "explicit_need", "corporate", "professional_network"]), sourceUrl: z.string().url().max(2048), evidenceType: z.enum(["identity", "role", "location", "commercial_relevance", "need", "timing", "contact", "source_policy"]), excerpt: z.string().trim().min(10).max(2000), summary: z.string().trim().min(10).max(800), evidenceConfidence: z.number().int().min(0).max(100),
  contact: z.object({ channel: z.enum(["email", "phone", "whatsapp", "web_form"]), value: z.string().trim().min(3).max(500) }).optional(), inbound: z.boolean().default(false), isTest: z.boolean().default(false),
});
export type ProspectInput = z.infer<typeof prospectInput>;

export async function createProspect(raw: ProspectInput, actorId: string | null) {
  const input = prospectInput.parse(raw);
  const normalizedName = normalizeText(input.displayName), normalizedOrg = normalizeText(input.organisation ?? "");
  const fingerprint = input.contact ? contactFingerprint(input.contact.channel, input.contact.value, fingerprintPepper()) : null;
  const existingContact = fingerprint ? await db.select({ prospectId: contacts.prospectId }).from(contacts).where(eq(contacts.fingerprint, fingerprint)).limit(1) : [];
  if (existingContact[0]) throw new Error(`Duplicate contact already belongs to prospect ${existingContact[0].prospectId}`);
  const sameIdentity = await db.execute(sql`select id from aurum_acquisition.prospects where lower(regexp_replace(display_name, '[^a-zA-Z0-9]+', ' ', 'g')) = ${normalizedName} and lower(regexp_replace(coalesce(organisation,''), '[^a-zA-Z0-9]+', ' ', 'g')) = ${normalizedOrg} limit 1`);
  if (sameIdentity.rows[0]) throw new Error(`Possible duplicate prospect ${String((sameIdentity.rows[0] as { id: string }).id)}`);
  const commercial = ["commercial_relevance", "need", "timing"].includes(input.evidenceType);
  const scored = scoreProspect({ category: input.category, identityEvidence: 1, roleEvidence: input.role ? 1 : 0, locationEvidence: input.city ? 1 : 0, relevanceEvidence: commercial ? 1 : 0, needEvidence: input.evidenceType === "need" || input.inbound ? 1 : 0, independentSources: 1, freshestEvidenceDays: 0, serviceAreaFit: /bengaluru|bangalore/i.test(input.city) ? 20 : 5, relationshipPotential: input.category === "referral_partner" ? 20 : input.inbound ? 15 : 5, timing: input.inbound ? 10 : 0 });
  return db.transaction(async tx => {
    const [prospect] = await tx.insert(prospects).values({ displayName: input.displayName, organisation: input.organisation, role: input.role, city: input.city, category: input.category, stage: scored.decision === "qualified" ? "review" : "research", identityConfidence: scored.identityConfidence, commercialFit: scored.commercialFit, assignedTo: actorId, lastVerifiedAt: new Date(), isTest: input.isTest }).returning();
    const [proof] = await tx.insert(evidence).values({ prospectId: prospect.id, sourceId: input.sourceId, type: input.evidenceType, sourceUrl: input.sourceUrl, excerpt: input.excerpt, summary: input.summary, contentHash: sha256(`${input.sourceUrl}|${input.excerpt}`), confidence: input.evidenceConfidence, supportsCommercialRelevance: commercial || input.inbound, staleAfter: new Date(Date.now() + 180 * 86400_000), createdBy: actorId }).returning();
    let contactId: string | null = null;
    if (input.contact && fingerprint) {
      const [contact] = await tx.insert(contacts).values({ prospectId: prospect.id, channel: input.contact.channel, value: input.contact.value, normalizedValue: normalizeContact(input.contact.channel, input.contact.value), fingerprint, evidenceId: proof.id, verification: input.inbound ? "self_provided" : "published_unverified", verificationMethod: input.inbound ? "submitted by enquirer" : "published first-party route", verifiedAt: input.inbound ? new Date() : null, staleAfter: new Date(Date.now() + (input.inbound ? 30 : 90) * 86400_000) }).returning();
      contactId = contact.id;
      if (input.inbound) await tx.insert(eligibilityChecks).values({ prospectId: prospect.id, contactId: contact.id, status: "eligible", purpose: "respond to requested consultation", relationshipBasis: "inbound_request", sourceUseAllowed: true, reasons: ["contact supplied in an inbound request"], checkedBy: actorId, validUntil: new Date(Date.now() + 30 * 86400_000) });
    }
    await tx.insert(assessments).values({ prospectId: prospect.id, identityConfidence: scored.identityConfidence, commercialFit: scored.commercialFit, decision: scored.decision, reasons: scored.reasons, evidenceIds: [proof.id], rulesVersion: scored.rulesVersion, assessedBy: actorId });
    await tx.insert(auditEvents).values({ actorId, action: "prospect.created", entityType: "prospect", entityId: prospect.id, summary: `Created ${input.category} record with source evidence`, metadata: { inbound: input.inbound, contactId, isTest: input.isTest } });
    return { prospectId: prospect.id, evidenceId: proof.id, contactId, scores: scored };
  });
}
