import { desc } from "drizzle-orm";
import { db } from "@/db";
import { dailyReports } from "@/db/schema";
import { AppShell } from "@/components/app-shell";
import { ActionButton } from "@/components/action-button";
import { pageUser } from "@/lib/page-auth";
export const dynamic = "force-dynamic";
type Summary = { day: string; generatedAt: string; discoveryProviderConfigured: boolean; sourceRuns: Record<string, number>; prospects: Record<string, number>; contactsCreated: Array<{ channel: string; kind: string; verification: string; n: number }>; autoQualifiedContacts: { count: number; definition: string }; callQueue: { ready: number; top: Array<{ name: string; phone: string; priority: number; reasons: string[] }> }; callsToday: Record<string, number>; phoneCrossChecks?: Array<{ result: string; n: number }> };
export default async function Reports() {
  const user = await pageUser(); const rows = await db.select().from(dailyReports).orderBy(desc(dailyReports.day)).limit(30); const latest = rows[0]?.summary as Summary | undefined;
  return <AppShell user={user}><div className="mx-auto max-w-[1150px]"><p className="eyebrow">Generated automatically at 20:00 IST</p><div className="flex items-end justify-between"><h1 className="mt-3 serif text-[36px]">Daily qualified-contact report</h1><ActionButton url="/api/discovery" body={{ action: "report_now" }} label="Queue report now" /></div>
    {latest ? <><div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">{[["Day", latest.day], ["Sites processed", latest.sourceRuns.discovered], ["New businesses", latest.prospects.new_discovered], ["Auto-qualified contacts", latest.autoQualifiedContacts.count], ["Call-ready", latest.callQueue.ready]].map(([a, b]) => <div key={String(a)} className="panel p-4"><p className="text-[9px] text-[#858b85]">{a}</p><p className="mt-2 text-xl font-semibold">{String(b)}</p></div>)}</div>
      {!latest.discoveryProviderConfigured && <p className="mt-4 rounded-xl bg-[#fff6ec] p-3 text-[9px] text-[#8b6a36]">Google Places was not configured for this report; only seeded websites were processed.</p>}
      <p className="mt-3 text-[8px] text-[#858b85]">Definition: {latest.autoQualifiedContacts.definition}.</p>
      <div className="mt-5 grid gap-5 lg:grid-cols-2"><section className="panel p-5"><p className="eyebrow">Contacts extracted today</p><table className="mt-3 w-full"><tbody>{latest.contactsCreated.map((c, i) => <tr key={i}><td className="p-2">{c.channel}</td><td className="p-2">{c.kind}</td><td className="p-2">{c.verification}</td><td className="p-2 text-right">{c.n}</td></tr>)}{!latest.contactsCreated.length && <tr><td className="p-4 text-center">None today.</td></tr>}</tbody></table></section>
        <section className="panel p-5"><p className="eyebrow">Top of tomorrow’s call queue</p><ol className="mt-3 space-y-2">{latest.callQueue.top.map((t, i) => <li key={i} className="text-[9px]"><b>{t.name}</b> · {t.phone} · priority {t.priority}<br /><span className="text-[#848a85]">{t.reasons.join(" · ")}</span></li>)}</ol>{!latest.callQueue.top.length && <p className="mt-3 text-[9px]">Queue empty.</p>}</section></div>
      <p className="mt-4 text-[9px]">Phone cross-checks today: {(latest.phoneCrossChecks ?? []).map(c => `${c.result.replaceAll("_", " ")} ${c.n}`).join(" · ") || "none"}</p><p className="mt-1 text-[8px] text-[#9a9f9a]">Calls today: {latest.callsToday.calls ?? 0} · interested {latest.callsToday.interested ?? 0} · meetings {latest.callsToday.meetings ?? 0} · generated {new Date(latest.generatedAt).toLocaleString("en-IN")}</p></>
      : <div className="panel mt-5 p-12 text-center text-[9px]">No report yet. The worker creates one daily, or queue one now.</div>}
    {rows.length > 1 && <section className="panel mt-5 p-5"><p className="eyebrow">History</p><ul className="mt-3 space-y-1 text-[9px]">{rows.map(r => { const s = r.summary as Summary; return <li key={r.day}>{r.day}: {s.prospects.new_discovered} new businesses · {s.autoQualifiedContacts.count} auto-qualified contacts · {s.callQueue.ready} call-ready</li>; })}</ul></section>}
  </div></AppShell>;
}
