import { and, eq, or } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { auditEvents, callLogs, contacts, interactions, prospects, suppressions } from "@/db/schema";
import { assertCsrf, requireAny } from "@/lib/auth";
import { jsonError } from "@/lib/api";
import { assertOrigin } from "@/lib/security";

const body = z.object({
  contactId: z.string().uuid(),
  outcome: z.enum(["no_answer", "connected_interested", "meeting_booked", "callback_requested", "not_interested", "wrong_number", "do_not_call"]),
  dndChecked: z.literal(true, { message: "Confirm the DND/NCPR and calling-policy check before logging a call" }),
  durationMinutes: z.number().int().min(0).max(600).default(0),
  followUpAt: z.coerce.date().optional(),
  notes: z.string().trim().max(2000).optional(),
}).refine(d => !["callback_requested", "meeting_booked"].includes(d.outcome) || !!d.followUpAt, { message: "A callback or meeting needs a date and time", path: ["followUpAt"] });

const nextStage: Record<string, string | undefined> = { connected_interested: "contacted", callback_requested: "contacted", no_answer: undefined, meeting_booked: "meeting_scheduled", not_interested: "declined" };

export async function POST(request: Request) {
  try {
    assertOrigin(request); const user = await requireAny(["owner", "admin", "operator"]); assertCsrf(request, user);
    const d = body.parse(await request.json());
    const [contact] = await db.select().from(contacts).where(eq(contacts.id, d.contactId)).limit(1);
    if (!contact || !["phone", "whatsapp"].includes(contact.channel)) throw new Error("Phone contact not found");
    const blocked = await db.select({ id: suppressions.id }).from(suppressions).where(and(eq(suppressions.active, true), or(eq(suppressions.prospectId, contact.prospectId), eq(suppressions.contactFingerprint, contact.fingerprint)))).limit(1);
    if (blocked.length) throw new Error("This contact is suppressed and must not be called");
    const [prospect] = await db.select().from(prospects).where(eq(prospects.id, contact.prospectId)).limit(1);
    await db.transaction(async tx => {
      await tx.insert(callLogs).values({ prospectId: contact.prospectId, contactId: contact.id, outcome: d.outcome, dndChecked: true, durationMinutes: d.durationMinutes, followUpAt: d.followUpAt, notes: d.notes, calledBy: user.id });
      await tx.insert(interactions).values({ prospectId: contact.prospectId, type: "outbound", channel: "phone", classification: d.outcome === "do_not_call" ? "opt_out" : ["connected_interested", "meeting_booked", "callback_requested"].includes(d.outcome) ? "interested" : d.outcome === "not_interested" ? "not_interested" : "unknown", subject: `Call: ${d.outcome.replaceAll("_", " ")}`, body: d.notes || d.outcome, occurredAt: new Date(), recordedBy: user.id });
      if (d.outcome === "do_not_call") await tx.insert(suppressions).values({ prospectId: contact.prospectId, contactFingerprint: contact.fingerprint, channel: contact.channel, reason: "Asked not to be called", source: "call", createdBy: user.id });
      if (d.outcome === "wrong_number") await tx.update(contacts).set({ verification: "invalid", corroborated: false, verificationMethod: "reported wrong number on call", verifiedAt: new Date() }).where(eq(contacts.id, contact.id));
      const stage = nextStage[d.outcome];
      const isPartner = prospect && ["referral_partner", "corporate"].includes(prospect.category);
      const advance = isPartner && stage && !(prospect.partnerStage === "meeting_scheduled" && stage === "contacted") && !["meeting_held", "agreed", "active"].includes(prospect.partnerStage);
      await tx.update(prospects).set({ ...(advance ? { partnerStage: stage as "contacted", partnerStageUpdatedAt: new Date() } : {}), ...(d.followUpAt ? { nextFollowUpAt: d.followUpAt } : {}), ...(d.outcome === "connected_interested" ? { stage: "responded" as const } : {}), updatedAt: new Date() }).where(eq(prospects.id, contact.prospectId));
      if (advance) await tx.insert(auditEvents).values({ actorId: user.id, action: "partner.stage", entityType: "prospect", entityId: contact.prospectId, summary: `${prospect.partnerStage} → ${stage} (call)`, metadata: { from: prospect.partnerStage, to: stage, humanEntered: true } });
      await tx.insert(auditEvents).values({ actorId: user.id, action: "call.logged", entityType: "contact", entityId: contact.id, summary: `Call outcome ${d.outcome}`, metadata: { humanEntered: true } });
    });
    return Response.json({ ok: true }, { status: 201 });
  } catch (error) { return jsonError(error, "Call logging failed"); }
}
