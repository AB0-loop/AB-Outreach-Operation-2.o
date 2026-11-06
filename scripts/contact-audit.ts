import "dotenv/config";
import { eq } from "drizzle-orm";
import { db, pool } from "../src/db";
import { contactVerifications, contacts, evidence, prospects } from "../src/db/schema";
import { decodeCfEmail } from "../src/lib/discovery/extract";

// Release gate 3: independently re-fetch each contact's source page (not via the crawler) and confirm the value is still published there.
async function main() {
  const rows = await db.select({ c: contacts, ev: evidence, p: prospects }).from(contacts).innerJoin(prospects, eq(prospects.id, contacts.prospectId)).leftJoin(evidence, eq(evidence.id, contacts.evidenceId)).where(eq(prospects.isTest, false));
  const pages = new Map<string, string>(); const results: Array<Record<string, unknown>> = [];
  for (const { c, ev, p } of rows) {
    const url = ev?.sourceUrl?.startsWith("http") ? ev.sourceUrl : p.website;
    if (!url) { results.push({ business: p.displayName, value: c.value, result: "no_source_url" }); continue; }
    if (!pages.has(url)) { try { const r = await fetch(url, { headers: { "user-agent": "AurumBespokeResearch/1.0 (+https://aurumbespoke.com/) audit" }, signal: AbortSignal.timeout(20000) }); pages.set(url, r.ok ? await r.text() : `__HTTP_${r.status}`); } catch (e) { pages.set(url, `__ERROR_${e instanceof Error ? e.message : "fetch"}`); } }
    const html = pages.get(url)!;
    let found = false;
    if (html.startsWith("__")) { results.push({ business: p.displayName, value: c.value, url, result: "source_unreachable", detail: html }); await db.insert(contactVerifications).values({ contactId: c.id, method: "source_recheck", result: "unreachable", detail: { url } }); continue; }
    if (c.channel === "email") {
      const decoded = [...html.matchAll(/data-cfemail=["']([0-9a-f]+)["']/gi)].map(m => decodeCfEmail(m[1]).toLowerCase());
      found = html.toLowerCase().includes(c.value.toLowerCase()) || decoded.includes(c.value.toLowerCase());
    } else {
      const national = c.value.replace(/\D/g, "").slice(-10);
      found = html.replace(/\D/g, "").includes(national);
    }
    await db.insert(contactVerifications).values({ contactId: c.id, method: "source_recheck", result: found ? "still_published" : "not_found", detail: { url } });
    results.push({ business: p.displayName, channel: c.channel, value: c.value, url, result: found ? "still_published" : "NOT_FOUND" });
  }
  console.log(JSON.stringify({ checked: results.length, stillPublished: results.filter(r => r.result === "still_published").length, notFound: results.filter(r => r.result === "NOT_FOUND").length, unreachable: results.filter(r => r.result === "source_unreachable").length, results }, null, 1));
}
main().then(() => pool.end()).catch(async e => { console.error(e); await pool.end(); process.exit(1); });
