import "server-only";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";

export const placesConfigured = () => !!process.env.GOOGLE_PLACES_API_KEY;
export const istDay = (d = new Date()) => new Date(d.getTime() + 5.5 * 3600_000).toISOString().slice(0, 10);

export async function reserveProviderCall(provider: string, cap: number) {
  const r = await db.execute(sql`insert into aurum_acquisition.provider_usage(provider, day, calls) values (${provider}, ${istDay()}, 1)
    on conflict (provider, day) do update set calls = aurum_acquisition.provider_usage.calls + 1 returning calls`);
  const calls = Number((r.rows[0] as { calls: number }).calls);
  if (calls > cap) throw new Error(`${provider} daily cap of ${cap} reached`);
  return calls;
}
const schema = z.object({ places: z.array(z.object({ id: z.string(), websiteUri: z.string().url().optional(), internationalPhoneNumber: z.string().optional(), businessStatus: z.string().optional() })).optional() });

// Google Maps Platform terms permit storing only place IDs; website and phone are used transiently
// (website to locate the business's own site, phone only to corroborate a number found on that site).
export async function placesTextSearch(query: string) {
  const key = process.env.GOOGLE_PLACES_API_KEY; if (!key) throw new Error("GOOGLE_PLACES_API_KEY is not configured");
  await reserveProviderCall("google_places_text_search", Number(process.env.DISCOVERY_DAILY_PLACES_CAP ?? 30));
  const r = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: { "content-type": "application/json", "X-Goog-Api-Key": key, "X-Goog-FieldMask": "places.id,places.websiteUri,places.internationalPhoneNumber,places.businessStatus" },
    body: JSON.stringify({ textQuery: query, regionCode: "IN", pageSize: Math.min(20, Number(process.env.DISCOVERY_RESULTS_PER_QUERY ?? 10)), locationBias: { circle: { center: { latitude: 12.9716, longitude: 77.5946 }, radius: 35000 } } }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!r.ok) throw new Error(`Places Text Search failed (${r.status})`);
  return (schema.parse(await r.json()).places ?? []).filter(p => !p.businessStatus || p.businessStatus === "OPERATIONAL");
}
