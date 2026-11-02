import "server-only";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { auditEvents, contactVerifications, contacts, prospects } from "@/db/schema";
import { rootHost } from "@/lib/discovery/extract";
import { crossCheckPhone, matchListingForWebsite, placeDetails } from "@/lib/discovery/places";
import { log } from "@/lib/log";

/**
 * Independent business-phone evidence cross-check.
 * Source 1: number published on the business's own website (already stored, with excerpt).
 * Source 2: the business's Google Places listing, re-requested by stored place ID.
 * Persisted: place ID (permitted) + per-contact outcome. Google's phone is never stored.
 */
export async function crossCheckProspect(prospectId: string) {
  const [p] = await db.select().from(prospects).where(eq(prospects.id, prospectId)).limit(1);
  if (!p) throw new Error("Prospect not found");
  const phones = await db.select().from(contacts).where(and(eq(contacts.prospectId, p.id), inArray(contacts.channel, ["phone", "whatsapp"])));
  if (!phones.length) return { status: "no_phones" as const };

  let placeId = p.externalKey?.startsWith("place:") ? p.externalKey.slice(6) : null;
  let listing = placeId ? await placeDetails(placeId) : null;
  if (!listing && p.website) {
    // Seeded websites: locate the listing, accept only on website-domain identity match.
    listing = await matchListingForWebsite(p.organisation || p.displayName, rootHost(new URL(p.website).hostname));
    if (listing) {
      placeId = listing.id;
      const taken = await db.select({ id: prospects.id }).from(prospects).where(eq(prospects.externalKey, `place:${placeId}`)).limit(1);
      if (!taken.length || taken[0].id === p.id) await db.update(prospects).set({ externalKey: `place:${placeId}`, updatedAt: new Date() }).where(eq(prospects.id, p.id));
    }
  }
  if (!listing) {
    for (const c of phones) await db.insert(contactVerifications).values({ contactId: c.id, method: "google_places_crosscheck", result: "no_listing", detail: { reason: placeId ? "place no longer found" : "no domain-matched listing" } });
    return { status: "no_listing" as const };
  }

  const outcomes: Record<string, number> = {};
  for (const c of phones) {
    const check = crossCheckPhone(c.normalizedValue.startsWith("+") ? c.normalizedValue : c.value, listing.internationalPhoneNumber);
    outcomes[check.result] = (outcomes[check.result] ?? 0) + 1;
    await db.transaction(async tx => {
      await tx.insert(contactVerifications).values({ contactId: c.id, method: "google_places_crosscheck", result: check.result, detail: { placeIdStored: true, listingNumberType: check.listingType ?? null } });
      if (check.result === "match") {
        await tx.update(contacts).set({ verification: c.verification === "invalid" ? "invalid" : "verified", corroborated: true, verificationMethod: "first-party website + Google Places listing (independent cross-check)", verifiedAt: new Date(), staleAfter: new Date(Date.now() + 90 * 86400_000) }).where(eq(contacts.id, c.id));
      } else if (c.corroborated) {
        // Previously corroborated number no longer matches: demote, keep first-party evidence.
        await tx.update(contacts).set({ corroborated: false, verification: "published_unverified", verificationMethod: "first-party website; Google listing no longer matches" }).where(eq(contacts.id, c.id));
      }
    });
  }
  await db.insert(auditEvents).values({ action: "crosscheck.completed", entityType: "prospect", entityId: p.id, summary: `Phone cross-check: ${JSON.stringify(outcomes)}`, metadata: outcomes });
  return { status: "checked" as const, outcomes };
}

/** Daily selection: prospects with phones never cross-checked or checked >30 days ago. */
export async function selectCrossCheckTargets(limit: number) {
  const r = await db.execute(sql`
    select p.id from aurum_acquisition.prospects p
    where p.is_test = false and p.stage not in ('rejected','suppressed') and p.website is not null
      and exists (select 1 from aurum_acquisition.contacts c where c.prospect_id = p.id and c.channel in ('phone','whatsapp') and c.verification <> 'invalid')
      and not exists (select 1 from aurum_acquisition.contacts c join aurum_acquisition.contact_verifications v on v.contact_id = c.id
                      where c.prospect_id = p.id and v.method = 'google_places_crosscheck' and v.checked_at > now() - interval '30 days')
    order by p.commercial_fit desc limit ${limit}`);
  return (r.rows as Array<{ id: string }>).map(x => x.id);
}
export function logCrossCheckSkip(reason: string) { log("warn", "crosscheck.skipped", { reason }); }
