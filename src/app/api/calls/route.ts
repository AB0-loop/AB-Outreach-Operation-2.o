import { and, eq, or } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { auditEvents, callLogs, consultations, contacts, interactions, prospects, suppressions } from "@/db/schema";
import { assertCsrf, requireAny } from "@/lib/auth";
import { jsonError } from "@/lib/api";
import { assertOrigin } from "@/lib/security";

const body = z.object({
  contactId: z.string().uuid(),
  outcome: z.enum(["no_answer", "connected_interested", "meeting_booked", "callback_requested", "not_interested", "wrong_number", "do_not_call"]),
  dndChecked: z.literal(true, { message: "Confirm the DND/NCPR and calling-policy check before logging a call" }),
  notes: z.string().trim().max(2000).optional(),
});
export async function POST(request: Request) {
  try {
    assertOrigin(request); const user = await requireAny(["owner", "admin", "operator"]); assertCsrf(request, user);
    const data = body.parse(await request.json());
    const [contact] = await db.select().from(contacts).where(eq(contacts.id, data.contactId)).limit(1);
    if (!contact || !["phone", "whatsapp"].includes(contact.channel)) throw new Error("Phone contact not found");
    const blocked = await db.select({ id: suppressions.id }).from(suppressions).where(and(eq(suppressions.active, true), or(eq(suppressions.prospectId, contact.prospectId), eq(suppressions.contactFingerprint, contact.fingerprint)))).limit(1);
    if (blocked.length) throw new Error("This contact is suppressed and must not be called");
    await db.transaction(async tx => {
      await tx.insert(callLogs).values({ prospectId: contact.prospectId, contactId: contact.id, outcome: data.outcome, dndChecked: true, notes: data.notes, calledBy: user.id });
      await tx.insert(interactions).values({ prospectId: contact.prospectId, type: "outbound", channel: "phone", classification: data.outcome === "do_not_call" ? "opt_out" : data.outcome === "connected_interested" || data.outcome === "meeting_booked" ? "interested" : data.outcome === "not_interested" ? "not_interested" : "unknown", subject: `Call: ${data.outcome.replaceAll("_", " ")}`, body: data.notes || data.outcome, occurredAt: new Date(), recordedBy: user.id });
      if (data.outcome === "do_not_call") await tx.insert(suppressions).values({ prospectId: contact.prospectId, contactFingerprint: contact.fingerprint, channel: contact.channel, reason: "Asked not to be called", source: "call", createdBy: user.id });
      if (data.outcome === "wrong_number") await tx.update(contacts).set({ verification: "invalid", verificationMethod: "reported wrong number on call", verifiedAt: new Date() }).where(eq(contacts.id, contact.id));
      if (data.outcome === "connected_interested") await tx.update(prospects).set({ stage: "responded", updatedAt: new Date() }).where(eq(prospects.id, contact.prospectId));
      if (data.outcome === "meeting_booked") { await tx.insert(consultations).values({ prospectId: contact.prospectId, status: "proposed", sourceAttribution: "call queue", notes: data.notes, createdBy: user.id }); await tx.update(prospects).set({ stage: "consultation", updatedAt: new Date() }).where(eq(prospects.id, contact.prospectId)); }
      await tx.insert(auditEvents).values({ actorId: user.id, action: "call.logged", entityType: "contact", entityId: contact.id, summary: `Call outcome ${data.outcome}` });
    });
    return Response.json({ ok: true }, { status: 201 });
  } catch (error) { return jsonError(error, "Call logging failed"); }
}
