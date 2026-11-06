import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { contactLadder } from "@/lib/contact-status";

export type CallRow = { contactId: string; prospectId: string; value: string; kind: string; status: string; displayName: string; category: string; partnerStage: string; website: string | null; commercialFit: number; identityConfidence: number; attempts: number; dueAt: string | null; due: boolean; priority: number; reasons: string[] };

// Human-worked queue. Due callbacks/follow-ups first; then new partners by transparent ordering.
export async function getCallQueue(limit = 100): Promise<CallRow[]> {
  const r = await db.execute(sql`
    select c.id contact_id, c.value, c.kind, c.channel, c.verification, c.corroborated, p.id prospect_id, p.display_name, p.category, p.partner_stage, p.website, p.commercial_fit, p.identity_confidence, p.next_follow_up_at,
      coalesce((select json_agg(json_build_object('method', v.method, 'result', v.result)) from aurum_acquisition.contact_verifications v where v.contact_id = c.id), '[]') verifications,
      coalesce((select json_agg(l.outcome) from aurum_acquisition.call_logs l where l.contact_id = c.id), '[]') outcomes,
      (select count(*)::int from aurum_acquisition.call_logs l where l.contact_id = c.id) attempts,
      (select l.follow_up_at from aurum_acquisition.call_logs l where l.contact_id = c.id order by l.called_at desc limit 1) last_follow_up,
      (select l.called_at from aurum_acquisition.call_logs l where l.contact_id = c.id order by l.called_at desc limit 1) last_called
    from aurum_acquisition.contacts c join aurum_acquisition.prospects p on p.id = c.prospect_id
    where c.channel in ('phone','whatsapp') and c.verification in ('verified','published_unverified','self_provided')
      and (c.stale_after is null or c.stale_after > now())
      and p.stage not in ('rejected','suppressed','customer') and p.is_test = false
      and p.partner_stage not in ('declined','active','paused')
      and (p.category in ('referral_partner','corporate') or c.verification = 'self_provided')
      and not exists (select 1 from aurum_acquisition.suppressions s where s.active and (s.prospect_id = p.id or s.contact_fingerprint = c.fingerprint))
      and not exists (select 1 from aurum_acquisition.call_logs l where l.contact_id = c.id and l.outcome in ('do_not_call','wrong_number','not_interested'))
    limit 1000`);
  const now = Date.now();
  return (r.rows as Array<Record<string, unknown>>).flatMap(x => {
    const lastCalled = x.last_called ? new Date(String(x.last_called)).getTime() : null;
    const followCandidates = [x.last_follow_up, x.next_follow_up_at].filter(Boolean).map(v => new Date(String(v)).getTime());
    const dueAt = followCandidates.length ? Math.min(...followCandidates) : null;
    const due = dueAt !== null && dueAt <= now;
    if (dueAt !== null && !due) return [];                                   // scheduled for later
    if (!due && lastCalled !== null && now - lastCalled < 14 * 86400_000) return []; // cooling off
    const fit = Number(x.commercial_fit), conf = Number(x.identity_confidence), attempts = Number(x.attempts);
    const ladder = contactLadder({ channel: String(x.channel), value: String(x.value), verification: String(x.verification), corroborated: Boolean(x.corroborated) }, x.verifications as Array<{ method: string; result: string }>, x.outcomes as string[]);
    const reasons = [due ? "follow-up due" : "not yet reached", ladder.label, `commercial fit ${fit}`];
    if (x.kind === "business_line") reasons.push("fixed business line");
    if (attempts) reasons.push(`${attempts} earlier attempt(s)`);
    const priority = (due ? 1000 : 0) + (x.verification === "self_provided" ? 200 : 0) + (ladder.humanConfirmed ? 60 : ladder.independentlyCorroborated ? 30 : 0) + fit - attempts * 10;
    return [{ contactId: String(x.contact_id), prospectId: String(x.prospect_id), value: String(x.value), kind: String(x.kind), status: ladder.label, displayName: String(x.display_name), category: String(x.category), partnerStage: String(x.partner_stage), website: x.website ? String(x.website) : null, commercialFit: fit, identityConfidence: conf, attempts, dueAt: dueAt ? new Date(dueAt).toISOString() : null, due, priority, reasons }];
  }).sort((a, b) => b.priority - a.priority).slice(0, limit);
}
