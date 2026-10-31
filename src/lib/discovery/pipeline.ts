import "server-only";
import { and, eq, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { assessments, auditEvents, contactVerifications, contacts, evidence, prospects } from "@/db/schema";
import { sha256 } from "@/lib/crypto";
import { classifyEmail, compact, extractEmails, extractPhones, mentionsBengaluru, normalizePhone, relevanceSignals, rootHost, siteName } from "@/lib/discovery/extract";
import { crawlSite } from "@/lib/discovery/crawl";
import { checkEmailDomain } from "@/lib/discovery/verify";
import { contactFingerprint, normalizeContact, normalizeText } from "@/lib/normalization";
import { fingerprintPepper } from "@/lib/security";
import { scoreProspect } from "@/lib/scoring";

export type WebsiteTask = { url: string; category: "referral_partner" | "corporate"; sourceId: string; placeId?: string; placesPhone?: string; query?: string };
export type WebsiteResult = { status: "retained" | "refreshed" | "skipped_recent" | "rejected"; reason?: string; prospectId?: string; emails?: number; phones?: number; corroborated?: number; duplicateContacts?: number };

export async function processWebsite(task: WebsiteTask): Promise<WebsiteResult> {
  let start: URL;
  try { start = new URL(task.url); start.hash = ""; } catch { return { status: "rejected", reason: "invalid website URL" }; }
  const root = rootHost(start.hostname);
  if (/(facebook|instagram|linkedin|wedmegood|weddingwire|justdial|sulekha|indiamart|google)\./i.test(root)) return { status: "rejected", reason: "website is a platform/directory, not a first-party site" };
  const externalKey = task.placeId ? `place:${task.placeId}` : `domain:${root}`;
  const [existing] = await db.select().from(prospects).where(sql`${prospects.externalKey} = ${externalKey} or ${prospects.externalKey} = ${`domain:${root}`} or lower(${prospects.website}) like ${`%${root}%`}`).limit(1);
  if (existing?.lastVerifiedAt && Date.now() - existing.lastVerifiedAt.getTime() < 30 * 86400_000 && existing.website) return { status: "skipped_recent", prospectId: existing.id };

  const crawl = await crawlSite(start.toString());
  if (!crawl.pages.length) return { status: "rejected", reason: `site not retrievable (${[...crawl.errors, ...crawl.skipped].join("; ") || "no pages"})` };
  const home = crawl.pages[0]; const allText = crawl.pages.map(p => p.text).join(" \n ");
  const signals = relevanceSignals(allText);
  if (!signals.length) return { status: "rejected", reason: "no commercial-relevance evidence on first-party site" };
  const location = mentionsBengaluru(allText);
  const name = siteName(home.html, root);
  const placesPhone = task.placesPhone ? normalizePhone(task.placesPhone)?.e164 : undefined;
  const pepper = fingerprintPepper();

  const emailFinds = crawl.pages.flatMap(p => extractEmails(p.html, p.text).map(e => ({ ...e, page: p.url })));
  const phoneFinds = crawl.pages.flatMap(p => extractPhones(p.html, p.text).map(ph => ({ ...ph, page: p.url })));
  const emails = [...new Map(emailFinds.map(e => [e.value, e])).values()].slice(0, 6);
  const phones = [...new Map(phoneFinds.map(p => [p.e164, p])).values()].slice(0, 6);
  const emailChecks = await Promise.all(emails.map(e => checkEmailDomain(e.value, root)));
  const corroboratedCount = phones.filter(p => p.e164 === placesPhone).length;

  const scored = scoreProspect({ category: task.category, identityEvidence: 1, roleEvidence: 1, locationEvidence: location ? 1 : 0, relevanceEvidence: Math.min(2, signals.length), needEvidence: 0, independentSources: task.placeId ? 2 : 1, freshestEvidenceDays: 0, serviceAreaFit: location ? 20 : 5, relationshipPotential: task.category === "referral_partner" ? 20 : 12, timing: 0 });

  return db.transaction(async tx => {
    let prospectId: string | undefined = existing?.id;
    if (!prospectId) {
      const nameKey = normalizeText(name);
      const label = compact(root.split(".")[0]);
      const byName = await tx.execute(sql`select id from aurum_acquisition.prospects where trim(regexp_replace(lower(display_name), '[^a-z0-9]+', ' ', 'g')) = ${nameKey} or regexp_replace(lower(display_name), '[^a-z0-9]', '', 'g') in (${compact(name)}, ${label}) or regexp_replace(lower(coalesce(organisation,'')), '[^a-z0-9]', '', 'g') = ${label} limit 1`);
      prospectId = (byName.rows[0] as { id: string } | undefined)?.id;
    }
    const base = { website: home.url, externalKey, identityConfidence: scored.identityConfidence, commercialFit: scored.commercialFit, lastVerifiedAt: new Date(), updatedAt: new Date(), city: location ? "Bengaluru" : null };
    let refreshed = false;
    if (prospectId) { refreshed = true; await tx.update(prospects).set(base).where(eq(prospects.id, prospectId)); }
    else prospectId = (await tx.insert(prospects).values({ ...base, displayName: name, organisation: name, role: task.query ? `Discovered via “${task.query}”` : "Business", category: task.category, stage: scored.decision === "qualified" ? "review" : "research" }).returning({ id: prospects.id }))[0].id;
    const stale = new Date(Date.now() + 90 * 86400_000);
    const addEvidence = async (type: "identity" | "location" | "commercial_relevance" | "contact", url: string, excerpt: string, summary: string, confidence: number, relevant = false) => {
      const hash = sha256(`${url}|${excerpt}`);
      const [row] = await tx.insert(evidence).values({ prospectId: prospectId!, sourceId: task.sourceId, type, sourceUrl: url, excerpt: excerpt.slice(0, 1900), summary, contentHash: hash, confidence, supportsCommercialRelevance: relevant, staleAfter: stale }).onConflictDoNothing().returning({ id: evidence.id });
      if (row) return row.id;
      return (await tx.select({ id: evidence.id }).from(evidence).where(and(eq(evidence.prospectId, prospectId!), eq(evidence.contentHash, hash))).limit(1))[0].id;
    };
    const proofIds = [await addEvidence("identity", home.url, `Site name: ${name}`, `First-party website ${root} identifies the business as ${name}.`, 85)];
    if (location) proofIds.push(await addEvidence("location", home.url, location, "First-party website mentions Bengaluru/Bangalore.", 75));
    for (const s of signals.slice(0, 3)) proofIds.push(await addEvidence("commercial_relevance", home.url, s.excerpt, `First-party website mentions “${s.term}” (relevance weight ${s.weight}).`, 70, true));

    let duplicateContacts = 0, emailCount = 0, phoneCount = 0;
    const insertContact = async (channel: "email" | "phone", value: string, excerpt: string, page: string, kind: string, verification: "verified" | "published_unverified" | "invalid", method: string, corroborated: boolean, checks: Array<{ method: string; result: string; detail: Record<string, unknown> }>) => {
      const fingerprint = contactFingerprint(channel, value, pepper);
      const other = await tx.select({ id: contacts.id }).from(contacts).where(and(eq(contacts.fingerprint, fingerprint), ne(contacts.prospectId, prospectId!))).limit(1);
      if (other.length) { duplicateContacts++; return; }
      const evidenceId = await addEvidence("contact", page, excerpt, `${channel === "email" ? "Email" : "Phone"} published on the business's own website.`, 80);
      const [row] = await tx.insert(contacts).values({ prospectId: prospectId!, channel, value, normalizedValue: normalizeContact(channel, value), fingerprint, evidenceId, verification, verificationMethod: method, verifiedAt: new Date(), staleAfter: stale, kind, corroborated })
        .onConflictDoUpdate({ target: [contacts.prospectId, contacts.fingerprint], set: { verification, verificationMethod: method, verifiedAt: new Date(), staleAfter: stale, corroborated } }).returning({ id: contacts.id });
      for (const c of checks) await tx.insert(contactVerifications).values({ contactId: row.id, ...c });
      channel === "email" ? emailCount++ : phoneCount++;
    };
    for (const [i, e] of emails.entries()) {
      const chk = emailChecks[i];
      await insertContact("email", e.value, e.excerpt, e.page, classifyEmail(e.value), chk.mx ? "published_unverified" : "invalid", chk.mx ? `published on first-party page; MX present${chk.sameDomain ? "; same domain as website" : "; different domain"}` : "published on page; no MX record", false,
        [{ method: "first_party_publication", result: "found", detail: { page: e.page } }, { method: "dns_mx", result: chk.mx ? "pass" : "fail", detail: { domain: chk.domain } }, { method: "domain_match", result: chk.sameDomain ? "pass" : "fail", detail: { siteRoot: root } }]);
    }
    for (const p of phones) {
      const match = !!placesPhone && p.e164 === placesPhone;
      await insertContact("phone", p.e164, p.excerpt, p.page, p.type === "MOBILE" ? "mobile" : p.type === "FIXED_LINE" ? "business_line" : "phone", match ? "verified" : "published_unverified",
        match ? "published on first-party site and matches Google Places listing (two independent sources)" : "published on first-party site; valid Indian number format", match,
        [{ method: "first_party_publication", result: "found", detail: { page: p.page } }, { method: "libphonenumber_IN", result: "valid", detail: { type: p.type } }, { method: "google_places_match", result: placesPhone ? (match ? "match" : "no_match") : "not_available", detail: {} }]);
    }
    await tx.insert(assessments).values({ prospectId: prospectId!, identityConfidence: scored.identityConfidence, commercialFit: scored.commercialFit, decision: scored.decision, reasons: [...scored.reasons, `signals: ${signals.map(s => s.term).join(", ")}`], evidenceIds: proofIds, rulesVersion: `${scored.rulesVersion}+web` });
    await tx.insert(auditEvents).values({ action: refreshed ? "discovery.refreshed" : "discovery.retained", entityType: "prospect", entityId: prospectId, summary: `${name}: ${emailCount} emails, ${phoneCount} phones from first-party site`, metadata: { root, pages: crawl.pages.length, skipped: crawl.skipped, errors: crawl.errors, query: task.query } });
    return { status: refreshed ? "refreshed" : "retained", prospectId, emails: emailCount, phones: phoneCount, corroborated: corroboratedCount, duplicateContacts };
  });
}
