"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/client-api";
export function ActionButton({ url, body, label, method = "POST", variant = "btn-secondary" }: { url: string; body: unknown; label: string; method?: string; variant?: string }) {
  const router = useRouter(); const [msg, setMsg] = useState("");
  return <span className="inline-flex flex-col"><button className={`btn ${variant}`} onClick={async () => { setMsg("Working…"); const r = await apiFetch(url, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) }); const j = await r.json(); setMsg(r.ok ? (j.note || "Done") : j.error || "Failed"); if (r.ok) router.refresh(); }}>{label}</button>{msg && <small className="mt-1 text-[8px] text-[#68706a]">{msg}</small>}</span>;
}
