import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/db";

export type CallRow = { contactId: string; prospectId: string; value: string; kind: string; verification: string; corroborated: boolean; displayName: string; category: string; website: string | null; commercialFit: number; identityConfidence: number; attempts: number; lastCalled: string | null; priority: number; reasons: string[] };

// Human-worked queue of organisation-published phone numbers (or numbers supplied in an inbound request).
export async function getCallQueue(limit = 100): Promise<CallRow[]> {
  const r = await db.execute(sql`
    select c.id contact_id, c.value, c.kind, c.verification, c.corroborated, p.id prospect_id, p.display_name, p.category, p.website, p.commercial_fit, p.identity_confidence,
      (select count(*)::int from aurum_acquisition.call_logs l where l.contact_id = c.id) attempts,
      (select max(called_at) from aurum_acquisition.call_logs l where l.contact_id = c.id) last_called
    from aurum_acquisition.contacts c join aurum_acquisition.prospects p on p.id = c.prospect_id
    where c.channel in ('phone','whatsapp') and c.verification in ('verified','published_unverified','self_provided')
      and (c.stale_after is null or c.stale_after > now())
      and p.stage not in ('rejected','suppressed','customer') and p.is_test = false and p.commercial_fit >= 50
      and (p.category in ('referral_partner','corporate') or c.verification = 'self_provided')
      and not exists (select 1 from aurum_acquisition.suppressions s where s.active and (s.prospect_id = p.id or s.contact_fingerprint = c.fingerprint))
      and not exists (select 1 from aurum_acquisition.call_logs l where l.contact_id = c.id and (l.outcome in ('do_not_call','wrong_number','not_interested','meeting_booked') or l.called_at > now() - interval '14 days'))
    limit 500`);
  return (r.rows as Array<Record<string, unknown>>).map(x => {
    const fit = Number(x.commercial_fit), conf = Number(x.identity_confidence), attempts = Number(x.attempts), corroborated = Boolean(x.corroborated);
    const reasons = [`commercial fit ${fit}`, `identity confidence ${conf}`];
    if (corroborated) reasons.push("number corroborated by two independent sources");
    if (x.kind === "business_line") reasons.push("fixed business line");
    if (x.verification === "self_provided") reasons.push("number supplied by the enquirer");
    if (attempts) reasons.push(`${attempts} earlier attempt(s)`);
    const priority = Math.round(fit * 0.6 + conf * 0.25 + (corroborated ? 15 : 0) + (x.verification === "self_provided" ? 25 : 0) + (x.kind === "business_line" ? 3 : 0) - attempts * 8);
    return { contactId: String(x.contact_id), prospectId: String(x.prospect_id), value: String(x.value), kind: String(x.kind), verification: String(x.verification), corroborated, displayName: String(x.display_name), category: String(x.category), website: x.website ? String(x.website) : null, commercialFit: fit, identityConfidence: conf, attempts, lastCalled: x.last_called ? String(x.last_called) : null, priority, reasons };
  }).sort((a, b) => b.priority - a.priority).slice(0, limit);
}
