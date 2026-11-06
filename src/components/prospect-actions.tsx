"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/client-api";

type Contact = { id: string; channel: string; value: string; fingerprint: string };
const STAGES = ["not_started", "contacted", "meeting_scheduled", "meeting_held", "agreed", "active", "paused", "declined"];

export function ProspectActions({ prospectId, isPartner, partnerStage, nextFollowUpAt, contacts, consultations }: { prospectId: string; isPartner: boolean; partnerStage: string; nextFollowUpAt: string | null; contacts: Contact[]; consultations: Array<{ id: string; label: string }> }) {
  const router = useRouter(); const [msg, setMsg] = useState("");
  async function send(url: string, body: unknown, method = "POST") { setMsg("Working…"); const r = await apiFetch(url, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) }); const j = await r.json(); setMsg(r.ok ? "Saved" : j.error || "Failed"); if (r.ok) router.refresh(); return r.ok; }
  return <section className="panel p-5"><p className="eyebrow">Actions</p>{msg && <p className="mt-3 rounded-lg bg-[#f3f1eb] p-2 text-[9px]">{msg}</p>}
    <div className="mt-4 space-y-3">
      {isPartner && <details open><summary className="text-[10px] font-semibold">Partner stage & follow-up</summary><form className="mt-3 space-y-2" onSubmit={e => { e.preventDefault(); const f = new FormData(e.currentTarget); const when = String(f.get("next") || ""); send("/api/partners", { prospectId, stage: f.get("stage"), nextFollowUpAt: when ? new Date(when).toISOString() : null, note: f.get("note") || undefined }, "PATCH"); }}>
        <select className="field" name="stage" defaultValue={partnerStage}>{STAGES.map(s => <option key={s} value={s}>{s.replaceAll("_", " ")}</option>)}</select>
        <label className="block text-[8px]">Next follow-up<input className="field mt-1" type="datetime-local" name="next" defaultValue={nextFollowUpAt ? nextFollowUpAt.slice(0, 16) : ""} /></label>
        <input className="field" name="note" placeholder="Note (what was agreed)" /><button className="btn btn-primary">Update partner</button></form></details>}
      {isPartner && <details><summary className="text-[10px] font-semibold">Record a referral from this partner</summary><form className="mt-3 space-y-2" onSubmit={e => { e.preventDefault(); const f = new FormData(e.currentTarget); const when = String(f.get("scheduledAt") || ""); send("/api/referrals", { partnerId: prospectId, customerName: f.get("customerName"), customerPhone: f.get("customerPhone") || undefined, requirement: f.get("requirement"), status: f.get("status"), scheduledAt: when ? new Date(when).toISOString() : undefined }); }}>
        <input className="field" name="customerName" required placeholder="Referred customer name" /><input className="field" name="customerPhone" placeholder="Customer phone (optional)" />
        <input className="field" name="requirement" required placeholder="Requirement (e.g. wedding sherwani + reception suit)" />
        <select className="field" name="status"><option value="proposed">Consultation proposed</option><option value="booked">Consultation booked</option><option value="completed">Consultation completed</option></select>
        <input className="field" name="scheduledAt" type="datetime-local" /><button className="btn btn-primary">Record referral</button>
        <p className="text-[8px] text-[#7d847e]">Record real referrals only. Creates the customer and a consultation attributed to this partner.</p></form></details>}
      {!isPartner && <details open><summary className="text-[10px] font-semibold">Record order</summary><form className="mt-3 space-y-2" onSubmit={e => { e.preventDefault(); const f = new FormData(e.currentTarget); const cost = String(f.get("costInr") || ""); send("/api/orders", { prospectId, consultationId: f.get("consultationId") || undefined, status: f.get("status"), description: f.get("description"), quotedInr: Number(f.get("quotedInr")), revenueInr: Number(f.get("revenueInr")), costInr: cost ? Number(cost) : undefined, orderedAt: new Date().toISOString() }); }}>
        <select className="field" name="consultationId"><option value="">No linked consultation</option>{consultations.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}</select>
        <select className="field" name="status"><option value="quoted">Quoted</option><option value="confirmed">Confirmed</option><option value="in_progress">In progress</option><option value="completed">Completed</option><option value="cancelled">Cancelled / lost</option></select>
        <input className="field" name="description" placeholder="Garments / commission" required /><input className="field" name="quotedInr" type="number" min="0" placeholder="Quoted INR" required />
        <input className="field" name="revenueInr" type="number" min="0" placeholder="Revenue INR (0 if not yet paid)" required /><input className="field" name="costInr" type="number" min="0" placeholder="Direct cost INR (optional, for margin)" />
        <button className="btn btn-primary">Record order</button><p className="text-[8px] text-[#7d847e]">Referral attribution is taken from the linked consultation automatically.</p></form></details>}
      <details><summary className="text-[10px] font-semibold">Review</summary><div className="mt-3 flex gap-2"><button className="btn btn-primary" onClick={() => send("/api/approvals", { entityId: prospectId, decision: "approved", note: "Human evidence review" })}>Approve</button><button className="btn btn-danger" onClick={() => send("/api/approvals", { entityId: prospectId, decision: "rejected", note: "Rejected by reviewer" })}>Reject</button></div></details>
      <details><summary className="text-[10px] font-semibold">Suppress (do not contact)</summary><div className="mt-3 flex flex-wrap gap-2"><button className="btn btn-danger" onClick={() => send("/api/suppressions", { prospectId, reason: "Do not contact", source: "manual review" })}>Suppress business</button>{contacts.map(c => <button key={c.id} className="btn btn-danger" onClick={() => send("/api/suppressions", { contactFingerprint: c.fingerprint, channel: c.channel, reason: "Contact-level suppression", source: "manual review" })}>Suppress {c.value}</button>)}</div></details>
      <details><summary className="text-[10px] font-semibold">Add note</summary><form className="mt-3 space-y-2" onSubmit={e => { e.preventDefault(); const f = new FormData(e.currentTarget); send("/api/interactions", { prospectId, type: "note", body: f.get("body"), occurredAt: new Date().toISOString() }); }}><textarea className="field" name="body" required /><button className="btn btn-secondary">Save note</button></form></details>
    </div></section>;
}
