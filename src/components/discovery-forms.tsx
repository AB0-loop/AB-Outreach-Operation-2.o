"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/client-api";
export function DiscoveryForm({ action }: { action: "add_query" | "add_website" }) {
  const router = useRouter(); const [msg, setMsg] = useState("");
  return <form className="flex flex-col gap-2 md:flex-row" onSubmit={async e => { e.preventDefault(); const f = new FormData(e.currentTarget); const payload = action === "add_query" ? { action, query: f.get("value"), category: f.get("category") } : { action, url: f.get("value"), category: f.get("category") }; const r = await apiFetch("/api/discovery", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) }); const j = await r.json(); setMsg(r.ok ? j.note : j.error); if (r.ok) { (e.target as HTMLFormElement).reset(); router.refresh(); } }}>
    <input className="field" name="value" required placeholder={action === "add_query" ? "e.g. sherwani-friendly wedding stylist Bengaluru" : "https://business-website.example"} type={action === "add_website" ? "url" : "text"} />
    <select className="field md:max-w-[170px]" name="category"><option value="referral_partner">Referral partner</option><option value="corporate">Corporate</option></select>
    <button className="btn btn-primary">{action === "add_query" ? "Add search" : "Queue website"}</button>{msg && <small className="self-center text-[8px]">{msg}</small>}
  </form>;
}
export function CallLogForm({ contactId }: { contactId: string }) {
  const router = useRouter(); const [msg, setMsg] = useState("");
  return <form className="mt-3 grid gap-2 md:grid-cols-[1fr_1fr_.5fr_auto]" onSubmit={async e => { e.preventDefault(); const f = new FormData(e.currentTarget); const when = String(f.get("followUpAt") || ""); const r = await apiFetch("/api/calls", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ contactId, outcome: f.get("outcome"), dndChecked: f.get("dnd") === "on", durationMinutes: Number(f.get("minutes") || 0), followUpAt: when ? new Date(when).toISOString() : undefined, notes: f.get("notes") || undefined }) }); const j = await r.json(); setMsg(r.ok ? "Logged" : j.error); if (r.ok) router.refresh(); }}>
    <select className="field" name="outcome"><option value="no_answer">No answer</option><option value="connected_interested">Spoke — interested</option><option value="callback_requested">Callback requested</option><option value="meeting_booked">Meeting booked</option><option value="not_interested">Not interested</option><option value="wrong_number">Wrong number</option><option value="do_not_call">Asked not to be called</option></select>
    <input className="field" name="followUpAt" type="datetime-local" title="Callback / meeting date" />
    <input className="field" name="minutes" type="number" min="0" max="600" placeholder="Min" />
    <button className="btn btn-primary">Log call</button>
    <input className="field md:col-span-4" name="notes" placeholder="Notes: who you spoke to, what was agreed" />
    <label className="flex items-center gap-2 text-[8px] md:col-span-4"><input type="checkbox" name="dnd" /> I checked DND/NCPR status and this is a business line or an inbound requester, per our calling policy</label>
    {msg && <small className="text-[8px] md:col-span-4">{msg}</small>}
  </form>;
}
export function EvidenceForm({ prospectId }: { prospectId: string }) {
  const router = useRouter(); const [msg, setMsg] = useState("");
  return <form className="mt-3 space-y-2" onSubmit={async e => { e.preventDefault(); const f = new FormData(e.currentTarget); const r = await apiFetch("/api/evidence", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ prospectId, type: f.get("type"), sourceUrl: f.get("sourceUrl"), excerpt: f.get("excerpt"), summary: f.get("summary"), confidence: Number(f.get("confidence")) }) }); const j = await r.json(); setMsg(r.ok ? "Evidence saved" : j.error); if (r.ok) router.refresh(); }}>
    <select className="field" name="type"><option value="role">Role (e.g. founder from LinkedIn)</option><option value="identity">Identity</option><option value="commercial_relevance">Commercial relevance</option><option value="need">Need</option><option value="location">Location</option><option value="timing">Timing</option></select>
    <input className="field" name="sourceUrl" type="url" required placeholder="Page you personally viewed" />
    <input className="field" name="excerpt" required placeholder="Exact text you saw" />
    <input className="field" name="summary" required placeholder="Factual summary" />
    <input className="field" name="confidence" type="number" min="0" max="100" defaultValue="70" />
    <button className="btn btn-secondary">Save evidence</button>{msg && <small className="text-[8px]">{msg}</small>}
  </form>;
}
