import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { CallLogForm } from "@/components/discovery-forms";
import { getCallQueue } from "@/lib/call-queue";
import { pageUser } from "@/lib/page-auth";
export const dynamic = "force-dynamic";
export default async function Calls() {
  const user = await pageUser(); const queue = await getCallQueue(60); const canCall = ["owner", "admin", "operator"].includes(user.role);
  const due = queue.filter(q => q.due).length;
  return <AppShell user={user}><div className="mx-auto max-w-[1100px]"><p className="eyebrow">Human-worked · follow-ups first</p><h1 className="mt-3 serif text-[36px]">Call queue</h1>
    <p className="mt-2 max-w-3xl text-[10px] leading-5 text-[#747b75]">{due} follow-up(s) due, then not-yet-reached business numbers ordered by evidence and commercial fit. Suppressed, wrong, do-not-call, declined and already-active partners never appear. Pitch a partnership, not a sale.</p>
    <div className="mt-5 space-y-3">{queue.map((r, i) => <article className="panel p-5" key={r.contactId}><div className="flex flex-col justify-between gap-2 md:flex-row"><div><span className={`badge ${r.due ? "badge-amber" : "badge-gray"}`}>#{i + 1}{r.due ? " · follow-up due" : ""}</span><h2 className="mt-2 text-[13px] font-semibold"><Link href={`/prospects/${r.prospectId}`} className="text-[#285b43]">{r.displayName}</Link></h2><p className="mt-1 text-[9px] text-[#777e78]">{r.category.replaceAll("_", " ")} · stage {r.partnerStage.replaceAll("_", " ")} · {r.website ? <a href={r.website} target="_blank" rel="noreferrer">{r.website}</a> : "no website"}</p></div><div className="text-right"><a href={`tel:${r.value}`} className="text-[16px] font-semibold">{r.value}</a><p className="text-[8px] text-[#8a908b]">{r.kind.replaceAll("_", " ")} · {r.status}</p></div></div><p className="mt-2 text-[8px] text-[#6e756f]">Why: {r.reasons.join(" · ")}</p>{canCall ? <CallLogForm contactId={r.contactId} /> : <p className="mt-2 text-[8px]">Operator role required to log calls.</p>}</article>)}
      {!queue.length && <div className="panel p-12 text-center text-[9px] text-[#8a908b]">Queue empty: no due follow-ups and no uncalled business numbers.</div>}</div></div></AppShell>;
}
