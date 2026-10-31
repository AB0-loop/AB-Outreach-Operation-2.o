import { parsePhoneNumberFromString } from "libphonenumber-js/max";

export type Found = { value: string; excerpt: string };
export type FoundPhone = { e164: string; display: string; type: string; excerpt: string };
export type Signal = { term: string; weight: number; excerpt: string };

const ENTITIES: Record<string, string> = { "&amp;": "&", "&nbsp;": " ", "&#64;": "@", "&commat;": "@", "&quot;": "\"", "&#39;": "'", "&lt;": "<", "&gt;": ">" };
export function htmlToText(html: string) {
  return html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ").replace(/&[a-z#0-9]+;/gi, m => ENTITIES[m.toLowerCase()] ?? " ").replace(/\s+/g, " ").trim();
}
export function excerptAround(text: string, index: number, len = 180) {
  const start = Math.max(0, index - len / 2); return text.slice(start, start + len).trim();
}
export function decodeCfEmail(hex: string) {
  const key = parseInt(hex.slice(0, 2), 16); let out = "";
  for (let i = 2; i < hex.length; i += 2) out += String.fromCharCode(parseInt(hex.slice(i, i + 2), 16) ^ key);
  return out;
}
const EMAIL = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,24}/gi;
const JUNK = /\.(png|jpe?g|gif|webp|svg|css|js)$|example\.|sentry|wixpress|yourdomain|domain\.com|@2x|u003e/i;
export function extractEmails(html: string, text = htmlToText(html)): Found[] {
  const found = new Map<string, Found>();
  const add = (raw: string, excerpt: string) => { const v = raw.trim().toLowerCase().replace(/^mailto:/, "").split("?")[0]; if (!v.match(/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,24}$/) || JUNK.test(v)) return; if (!found.has(v)) found.set(v, { value: v, excerpt }); };
  for (const m of html.matchAll(/href=["']mailto:([^"'>]+)["']/gi)) add(decodeURIComponent(m[1]), `mailto link: ${decodeURIComponent(m[1]).split("?")[0]}`);
  for (const m of html.matchAll(/data-cfemail=["']([0-9a-f]+)["']/gi)) { const v = decodeCfEmail(m[1]); add(v, `obfuscated email decoded from page: ${v}`); }
  for (const m of text.matchAll(EMAIL)) add(m[0], excerptAround(text, m.index ?? 0));
  return [...found.values()];
}
const MOBILE = /(?:\+91[\s-]?|\b0)?[6-9]\d{4}[\s-]?\d{5}\b/g;
const LANDLINE = /(?:\+91[\s-]?|\b0)80[\s-]?\d{4}[\s-]?\d{4}\b/g;
export function normalizePhone(raw: string) {
  const p = parsePhoneNumberFromString(raw, "IN");
  if (!p || !p.isValid() || p.country !== "IN") return null;
  return { e164: p.number, display: p.formatInternational(), type: p.getType() ?? "unknown" };
}
export function extractPhones(html: string, text = htmlToText(html)): FoundPhone[] {
  const found = new Map<string, FoundPhone>();
  const add = (raw: string, excerpt: string) => { const n = normalizePhone(raw); if (n && !found.has(n.e164)) found.set(n.e164, { ...n, excerpt }); };
  for (const m of html.matchAll(/href=["']tel:([^"'>]+)["']/gi)) add(decodeURIComponent(m[1]), `tel link: ${decodeURIComponent(m[1])}`);
  for (const m of html.matchAll(/(?:wa\.me|api\.whatsapp\.com\/send\?phone=)\/?(\d{10,13})/gi)) add(`+${m[1]}`, `WhatsApp link on page: ${m[1]}`);
  for (const re of [MOBILE, LANDLINE]) for (const m of text.matchAll(re)) add(m[0], excerptAround(text, m.index ?? 0));
  return [...found.values()];
}
const ROLE = /^(info|hello|contact|enquir(y|ies)|inquir(y|ies)|sales|events?|weddings?|admin|office|support|bookings?|team|connect|reservations|partnerships?|marketing)[0-9._-]*@/;
export const classifyEmail = (email: string) => ROLE.test(email) ? "role_email" : "named_email";
const TERMS: Array<[RegExp, string, number]> = [
  [/\bgroom(s|'s)?\b/i, "groom", 4], [/\bsherwani/i, "sherwani", 5], [/\bbandhgala/i, "bandhgala", 5], [/\bmenswear|men'?s wear|men'?s styling/i, "menswear", 5],
  [/\bbespoke\b/i, "bespoke", 3], [/\btrousseau\b/i, "trousseau", 3], [/\bwedding(s)?\b/i, "wedding", 3], [/\bdestination wedding/i, "destination wedding", 2],
  [/\b(personal|image|wardrobe) (stylist|styling|consultant)/i, "personal styling", 4], [/\bluxury\b/i, "luxury", 2], [/\bcorporate (event|offsite|gifting)/i, "corporate events", 2],
  [/\bvendor (coordination|management)|vendor sourcing/i, "vendor coordination", 3], [/\bsuits?\b/i, "suit", 2],
];
export function relevanceSignals(text: string): Signal[] {
  const out: Signal[] = [];
  for (const [re, term, weight] of TERMS) { const m = re.exec(text); if (m) out.push({ term, weight, excerpt: excerptAround(text, m.index) }); }
  return out.sort((a, b) => b.weight - a.weight);
}
export function mentionsBengaluru(text: string) { const m = /\b(bengaluru|bangalore)\b/i.exec(text); return m ? excerptAround(text, m.index) : null; }
export const compact = (v: string) => v.toLowerCase().replace(/&amp;/g, "&").replace(/[^a-z0-9]/g, "");
export function siteName(html: string, fallback: string) {
  const meta = (attr: string) => new RegExp(`<meta[^>]+(?:property|name)=["']${attr}["'][^>]+content=["']([^"']{2,100})["']`, "i").exec(html)?.[1];
  const ld = [...html.matchAll(/"@type"\s*:\s*"(?:Organization|LocalBusiness|WeddingPlanner|ProfessionalService|EventVenue)"[^{}]{0,400}?"name"\s*:\s*"([^"]{2,100})"/gi)].map(m => m[1]);
  const titleParts = (/<title[^>]*>([^<]{2,200})<\/title>/i.exec(html)?.[1] ?? "").split(/\s[|\-–—:]\s/);
  const candidates = [meta("og:site_name"), meta("application-name"), ...ld, ...titleParts].filter((c): c is string => !!c && c.trim().length >= 2).map(c => c.replace(/&amp;/g, "&").trim());
  const label = compact(fallback.split(".")[0]);
  // Prefer a candidate that is the brand on the domain (e.g. "The Tamarind Tree" for thetamarindtree.in) over SEO titles.
  const brand = candidates.find(c => { const k = compact(c); return k.length >= 4 && (label.includes(k) || k.includes(label)); });
  return (brand ?? candidates[0] ?? fallback).slice(0, 120);
}
export const rootHost = (host: string) => host.toLowerCase().replace(/^www\./, "");
