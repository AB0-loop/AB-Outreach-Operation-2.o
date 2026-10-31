import "server-only";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { htmlToText, rootHost } from "@/lib/discovery/extract";

const UA = "AurumBespokeResearch/1.0 (+https://aurumbespoke.com/)";
const MAX_BYTES = 1_500_000;
function privateIp(ip: string) { return /^(127\.|10\.|192\.168\.|169\.254\.|0\.|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.|::1$|fc|fd|fe80)/i.test(ip) || /^172\.(1[6-9]|2\d|3[01])\./.test(ip); }
async function assertPublic(url: URL) {
  if (!["http:", "https:"].includes(url.protocol)) throw new Error("Only http(s) is allowed");
  if (isIP(url.hostname) || url.hostname === "localhost") throw new Error("IP/localhost targets are prohibited");
  const addrs = await lookup(url.hostname, { all: true });
  if (!addrs.length || addrs.some(a => privateIp(a.address))) throw new Error("Target resolves to a private address");
}
export async function fetchPage(target: string, root: string) {
  let url = new URL(target);
  for (let hop = 0; hop < 4; hop++) {
    if (rootHost(url.hostname) !== root) throw new Error("Redirected outside the business site");
    await assertPublic(url);
    const r = await fetch(url, { headers: { "user-agent": UA, accept: "text/html" }, redirect: "manual", signal: AbortSignal.timeout(15_000), cache: "no-store" });
    if (r.status >= 300 && r.status < 400 && r.headers.get("location")) { url = new URL(r.headers.get("location")!, url); continue; }
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    if (!(r.headers.get("content-type") ?? "").includes("html")) throw new Error("Not HTML");
    const body = await r.text();
    if (Buffer.byteLength(body) > MAX_BYTES) throw new Error("Page too large");
    return { url: url.toString(), html: body };
  }
  throw new Error("Too many redirects");
}
export function robotsAllowed(robots: string, path: string) {
  let applies = false; const disallow: string[] = []; const allow: string[] = [];
  for (const line of robots.split(/\r?\n/)) {
    const [k, ...rest] = line.split("#")[0].split(":"); const key = k?.trim().toLowerCase(); const v = rest.join(":").trim();
    if (key === "user-agent") applies = v === "*" || UA.toLowerCase().startsWith(v.toLowerCase());
    else if (applies && key === "disallow" && v) disallow.push(v);
    else if (applies && key === "allow" && v) allow.push(v);
  }
  const longest = (list: string[]) => Math.max(-1, ...list.filter(p => path.startsWith(p.replace(/\*.*$/, ""))).map(p => p.length));
  return longest(allow) >= longest(disallow);
}
export async function crawlSite(start: string, maxPages = 4) {
  const first = new URL(start); const root = rootHost(first.hostname);
  let robots = "";
  try { const r = await fetch(new URL("/robots.txt", first), { headers: { "user-agent": UA }, signal: AbortSignal.timeout(10_000) }); if (r.ok) robots = await r.text(); } catch { /* absent robots means no restriction */ }
  const queue = [first.toString()]; const seen = new Set<string>();
  const pages: Array<{ url: string; html: string; text: string }> = []; const skipped: string[] = []; const errors: string[] = [];
  while (queue.length && pages.length < maxPages) {
    const next = queue.shift()!; const u = new URL(next); const key = rootHost(u.hostname) + u.pathname.replace(/\/$/, "");
    if (seen.has(key)) continue; seen.add(key);
    if (!robotsAllowed(robots, u.pathname)) { skipped.push(`${u.pathname} (robots.txt)`); continue; }
    try {
      const page = await fetchPage(next, root);
      pages.push({ ...page, text: htmlToText(page.html) });
      if (pages.length === 1) for (const m of page.html.matchAll(/href=["']([^"'#]+)["']/gi)) {
        try { const link = new URL(m[1], page.url); if (rootHost(link.hostname) === root && /contact|about|reach|enquir|connect|team|get-in-touch/i.test(link.pathname)) queue.push(link.toString()); } catch { /* ignore malformed links */ }
      }
      await new Promise(r => setTimeout(r, 750));
    } catch (e) { errors.push(`${u.pathname}: ${e instanceof Error ? e.message : "failed"}`); }
  }
  return { root, pages, skipped, errors };
}
