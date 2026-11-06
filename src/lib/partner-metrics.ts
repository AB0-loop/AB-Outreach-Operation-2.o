import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/db";

export type PartnerRow = { id: string; name: string; category: string; stage: string; nextFollowUpAt: string | null; callsAttempted: number; callsAnswered: number; minutesSpent: number; meetings: number; agreed: boolean; referrals: number; consultationsCompleted: number; ordersWon: number; revenueInr: number; marginInr: number | null };
// Transparent measured counts only. No predictive score until enough real outcomes exist.
export async function partnerScorecard(opts: { includeTest?: boolean; category?: string } = {}): Promise<PartnerRow[]> {
  const r = await db.execute(sql`
    select p.id, p.display_name, p.category, p.partner_stage, p.next_follow_up_at,
      (select count(*)::int from aurum_acquisition.call_logs l where l.prospect_id = p.id) calls_attempted,
      (select count(*)::int from aurum_acquisition.call_logs l where l.prospect_id = p.id and l.outcome in ('connected_interested','meeting_booked','callback_requested','not_interested')) calls_answered,
      (select coalesce(sum(duration_minutes),0)::int from aurum_acquisition.call_logs l where l.prospect_id = p.id) minutes_spent,
      (select count(*)::int from aurum_acquisition.audit_events a where a.entity_id = p.id::text and a.action = 'partner.stage' and a.metadata->>'to' = 'meeting_held') meetings,
      (select count(*)::int from aurum_acquisition.consultations c where c.referred_by_partner_id = p.id) referrals,
      (select count(*)::int from aurum_acquisition.consultations c where c.referred_by_partner_id = p.id and c.status = 'completed') consultations_completed,
      (select count(*)::int from aurum_acquisition.orders o where o.referred_by_partner_id = p.id and o.status in ('confirmed','in_progress','completed')) orders_won,
      (select coalesce(sum(o.revenue_inr),0)::numeric from aurum_acquisition.orders o where o.referred_by_partner_id = p.id and o.status <> 'cancelled') revenue,
      (select case when count(*) filter (where o.cost_inr is null) > 0 then null else coalesce(sum(o.revenue_inr - o.cost_inr),0) end from aurum_acquisition.orders o where o.referred_by_partner_id = p.id and o.status <> 'cancelled') margin
    from aurum_acquisition.prospects p
    where p.category in ('referral_partner','corporate') and (${opts.includeTest ?? false} or p.is_test = false)
      and (${opts.category ?? null}::text is null or p.category::text = ${opts.category ?? null})
      and (p.partner_stage <> 'not_started' or exists (select 1 from aurum_acquisition.call_logs l where l.prospect_id = p.id))
    order by revenue desc, orders_won desc, referrals desc, p.display_name`);
  return (r.rows as Array<Record<string, unknown>>).map(x => ({ id: String(x.id), name: String(x.display_name), category: String(x.category), stage: String(x.partner_stage), nextFollowUpAt: x.next_follow_up_at ? String(x.next_follow_up_at) : null, callsAttempted: Number(x.calls_attempted), callsAnswered: Number(x.calls_answered), minutesSpent: Number(x.minutes_spent), meetings: Number(x.meetings), agreed: ["agreed", "active"].includes(String(x.partner_stage)), referrals: Number(x.referrals), consultationsCompleted: Number(x.consultations_completed), ordersWon: Number(x.orders_won), revenueInr: Number(x.revenue), marginInr: x.margin === null ? null : Number(x.margin) }));
}
export async function partnerFunnel(includeTest = false) {
  const r = await db.execute(sql`select partner_stage, category, count(*)::int n from aurum_acquisition.prospects where category in ('referral_partner','corporate') and (${includeTest} or is_test = false) group by 1,2`);
  return r.rows as Array<{ partner_stage: string; category: string; n: number }>;
}
