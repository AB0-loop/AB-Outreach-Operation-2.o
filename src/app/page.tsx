import { count, sql } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { currentSession } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";
import { AuthForm } from "@/components/auth-form";
import { getCallQueue } from "@/lib/call-queue";
export const dynamic = "force-dynamic";

export default async function Home() {
  const userCount = await db.select({ n: count() }).from(users); const user = await currentSession().catch(() => null);
  if (!user) return <main className="grid min-h-screen place-items-center bg-[#f3f0e9] p-6"><section className="w-full max-w-md panel p-7"><span className="grid h-11 w-11 place-items-center rounded-xl bg-[#173d2f] serif text-xl text-[#d7bf87]">A</span><p className="eyebrow mt-7">{userCount[0].n ? "Secure workspace" : "First-time setup"}</p><h1 className="mt-3 serif text-4xl tracking-[-.03em]">{userCount[0].n ? "Sign in to Aurum." : "Create the owner account."}</h1><p className="mt-3 text-[10px] leading-5 text-[#747b75]">Real records are never shown publicly.</p><AuthForm mode={userCount[0].n ? "login" : "setup"} /></section></main>;
  const [m] = (await db.execute(sql`
    with p as (select * from aurum_acquisition.prospects where not is_test)
    select (select count(*)::int from p where category in ('referral_partner','corporate')) partners_found,
      (select count(*)::int from aurum_acquisition.contacts c join p on p.id=c.prospect_id where c.channel='phone' and c.verification<>'invalid') phones,
      (select count(*)::int from aurum_acquisition.call_logs l join p on p.id=l.prospect_id) calls,
      (select count(*)::int from aurum_acquisition.call_logs l join p on p.id=l.prospect_id where l.outcome in ('connected_interested','meeting_booked','callback_requested','not_interested')) answered,
      (select count(*)::int from p where partner_stage in ('meeting_held','agreed','active')) met,
      (select count(*)::int from p where partner_stage in ('agreed','active')) agreed,
      (select count(*)::int from aurum_acquisition.consultations c join p on p.id=c.prospect_id where c.referred_by_partner_id is not null) referrals,
      (select count(*)::int from aurum_acquisition.orders o join p on p.id=o.prospect_id where o.status in ('confirmed','in_progress','completed')) orders_won,
      (select coalesce(sum(o.revenue_inr),0)::numeric from aurum_acquisition.orders o join p on p.id=o.prospect_id where o.status <> 'cancelled' and o.referred_by_partner_id is not null) partner_revenue,
      (select coalesce(sum(o.revenue_inr),0)::numeric from aurum_acquisition.orders o join p on p.id=o.prospect_id where o.status <> 'cancelled') total_revenue,
      (select max(completed_at) from aurum_acquisition.jobs where type like 'discovery.%' and status='completed') last_discovery`)).rows as Array<Record<string, number | string | null>>;
  const due = (await getCallQueue(500)).filter(q => q.due).length;
  const steps: Array<[string, number]> = [["Partners found", Number(m.partners_found)], ["Calls made", Number(m.calls)], ["Calls answered", Number(m.answered)], ["Meetings held", Number(m.met)], ["Partnerships agreed", Number(m.agreed)], ["Referrals received", Number(m.referrals)], ["Orders won", Number(m.orders_won)]];
  return <AppShell user={user}><div className="mx-auto max-w-[1200px]"><p className="eyebrow">Stored, non-test records only</p><h1 className="mt-3 serif text-[38px] tracking-[-.035em]">Partner acquisition overview</h1>
    <p className="mt-2 text-[10px] text-[#747b75]">{due} follow-up(s) due today · last discovery run: {m.last_discovery ? new Date(String(m.last_discovery)).toLocaleString("en-IN") : "never"} · {Number(m.phones)} usable business phones on file</p>
    <section className="panel mt-5 p-5"><p className="eyebrow">Funnel (each step shows count / previous step)</p><div className="mt-4 space-y-3">{steps.map(([label, value], i) => { const prev = i ? steps[i - 1][1] : value; return <div key={label} className="grid grid-cols-[150px_1fr_110px] items-center gap-3"><span className="text-[10px]">{label}</span><div className="h-2 rounded-full bg-[#ece9e2]"><div className="h-2 rounded-full bg-[#426f58]" style={{ width: `${steps[0][1] ? Math.max(value ? 2 : 0, value / steps[0][1] * 100) : 0}%` }} /></div><span className="text-right text-[9px]">{value}{i ? ` / ${prev} · ${prev ? Math.round(value / prev * 100) + "%" : "—"}` : ""}</span></div>; })}</div></section>
    <div className="mt-5 grid gap-3 sm:grid-cols-2"><div className="panel p-4"><p className="text-[9px] text-[#858b85]">Revenue attributed to partners</p><p className="mt-2 text-2xl font-semibold">₹{Number(m.partner_revenue).toLocaleString("en-IN")}</p></div><div className="panel p-4"><p className="text-[9px] text-[#858b85]">All recorded revenue</p><p className="mt-2 text-2xl font-semibold">₹{Number(m.total_revenue).toLocaleString("en-IN")}</p></div></div>
  </div></AppShell>;
}
