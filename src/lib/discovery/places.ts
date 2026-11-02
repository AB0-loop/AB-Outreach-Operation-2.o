import "server-only";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { normalizePhone, rootHost } from "@/lib/discovery/extract";

/*
 * Google Places API (New) connector.
 * Terms boundary (Google Maps Platform Terms §3.2.3 + Places service terms):
 *  - Only place IDs are persisted. Phone numbers and websites returned by Google are used
 *    transiently in memory and are never written to the database, logs or reports.
 *  - Stored phone/email values always come from the business's own website.
 *  - A cross-check stores only the outcome (match / no_match / no_listing_phone).
 */
export const placesConfigured = () => !!process.env.GOOGLE_PLACES_API_KEY;
export const istDay = (d = new Date()) => new Date(d.getTime() + 5.5 * 3600_000).toISOString().slice(0, 10);
const BENGALURU = { circle: { center: { latitude: 12.9716, longitude: 77.5946 }, radius: 35000 } };

export async function reserveProviderCall(provider: string, cap: number) {
  const r = await db.execute(sql`insert into aurum_acquisition.provider_usage(provider, day, calls) values (${provider}, ${istDay()}, 1)
    on conflict (provider, day) do update set calls = aurum_acquisition.provider_usage.calls + 1 returning calls`);
  const calls = Number((r.rows[0] as { calls: number }).calls);
  if (calls > cap) throw new Error(`${provider} daily cap of ${cap} reached`);
  return calls;
}
function apiKey() { const k = process.env.GOOGLE_PLACES_API_KEY; if (!k) throw new Error("GOOGLE_PLACES_API_KEY is not configured"); return k; }

const place = z.object({ id: z.string(), websiteUri: z.string().url().optional(), internationalPhoneNumber: z.string().optional(), businessStatus: z.string().optional() });
export type TransientPlace = z.infer<typeof place>;
const searchResponse = z.object({ places: z.array(place).optional(), nextPageToken: z.string().optional() });

async function textSearchPage(query: string, pageSize: number, pageToken?: string) {
  await reserveProviderCall("google_places_text_search", Number(process.env.DISCOVERY_DAILY_PLACES_CAP ?? 30));
  const r = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: { "content-type": "application/json", "X-Goog-Api-Key": apiKey(), "X-Goog-FieldMask": "places.id,places.websiteUri,places.internationalPhoneNumber,places.businessStatus,nextPageToken" },
    body: JSON.stringify({ textQuery: query, regionCode: "IN", pageSize, locationBias: BENGALURU, ...(pageToken ? { pageToken } : {}) }),
    signal: AbortSignal.timeout(20_000),
  });
  if (r.status === 429) throw new Error("Places quota/rate limit (429)");
  if (!r.ok) throw new Error(`Places Text Search failed (${r.status})`);
  return searchResponse.parse(await r.json());
}

/** Discovery search: up to `maxPages` pages (each page is one billed request, max 20 results). */
export async function placesTextSearch(query: string, maxPages = Number(process.env.DISCOVERY_PAGES_PER_QUERY ?? 1)): Promise<TransientPlace[]> {
  const pageSize = Math.min(20, Number(process.env.DISCOVERY_RESULTS_PER_QUERY ?? 10));
  const out: TransientPlace[] = []; let token: string | undefined;
  for (let page = 0; page < Math.max(1, Math.min(3, maxPages)); page++) {
    const res = await textSearchPage(query, pageSize, token);
    out.push(...(res.places ?? []));
    if (!res.nextPageToken) break;
    token = res.nextPageToken;
    await new Promise(r => setTimeout(r, 1500)); // next-page tokens need a short delay before use
  }
  return out.filter(p => !p.businessStatus || p.businessStatus === "OPERATIONAL");
}

/** Re-request a stored place ID (the supported pattern under Google's caching terms). */
export async function placeDetails(placeId: string): Promise<TransientPlace | null> {
  if (!/^[A-Za-z0-9_-]{10,300}$/.test(placeId)) throw new Error("Invalid place ID");
  await reserveProviderCall("google_places_details", Number(process.env.CROSSCHECK_DAILY_DETAILS_CAP ?? 25));
  const r = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`, {
    headers: { "X-Goog-Api-Key": apiKey(), "X-Goog-FieldMask": "id,websiteUri,internationalPhoneNumber,businessStatus" },
    signal: AbortSignal.timeout(15_000),
  });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`Place Details failed (${r.status})`);
  return place.parse(await r.json());
}

/** Find the Google listing for a seeded website: accepted only if the listing's website domain matches. */
export async function matchListingForWebsite(businessName: string, websiteRoot: string): Promise<TransientPlace | null> {
  const candidates = await placesTextSearch(`${businessName} Bengaluru`, 1);
  return candidates.find(c => c.websiteUri && sameSite(rootHost(new URL(c.websiteUri).hostname), websiteRoot)) ?? null;
}
export const sameSite = (a: string, b: string) => a === b || a.endsWith(`.${b}`) || b.endsWith(`.${a}`);

export type CrossCheck = { result: "match" | "no_match" | "no_listing_phone"; listingType?: string };
/** Compare a first-party phone (E.164) to a transient listing phone. Returns only the outcome. */
export function crossCheckPhone(firstPartyE164: string, listingPhone?: string): CrossCheck {
  if (!listingPhone) return { result: "no_listing_phone" };
  const n = normalizePhone(listingPhone);
  if (!n) return { result: "no_listing_phone" };
  return { result: n.e164 === firstPartyE164 ? "match" : "no_match", listingType: n.type };
}
