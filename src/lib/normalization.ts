import { createHmac } from "node:crypto";

export function normalizeText(value: string) {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\b(mr|mrs|ms|dr|ca|prof)\.?\b/g, "").replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}
export function normalizeContact(channel: string, value: string) {
  const clean = value.trim().toLowerCase();
  return channel === "email" ? clean : channel === "web_form" ? new URL(clean).toString() : clean.replace(/[^0-9+]/g, "");
}
export function contactFingerprint(channel: string, value: string, pepper: string) {
  return createHmac("sha256", pepper).update(`${channel}:${normalizeContact(channel, value)}`).digest("hex");
}
export function canonicalPair(a: string, b: string): [string, string] {
  if (a === b) throw new Error("A record cannot duplicate itself");
  return a < b ? [a, b] : [b, a];
}
export function duplicateScore(a: { name: string; organisation?: string | null; fingerprints?: string[] }, b: { name: string; organisation?: string | null; fingerprints?: string[] }) {
  let score = 0; const reasons: string[] = [];
  if (normalizeText(a.name) === normalizeText(b.name)) { score += 55; reasons.push("same normalized name"); }
  if (a.organisation && b.organisation && normalizeText(a.organisation) === normalizeText(b.organisation)) { score += 25; reasons.push("same normalized organisation"); }
  const af = new Set(a.fingerprints ?? []);
  if ((b.fingerprints ?? []).some(x => af.has(x))) { score = 100; reasons.push("same contact fingerprint"); }
  return { score: Math.min(score, 100), reasons };
}
