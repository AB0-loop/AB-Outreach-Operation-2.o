import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { eq, inArray } from "drizzle-orm";
process.env.GOOGLE_PLACES_API_KEY = "test-key-not-real"; process.env.APP_ENV = "development"; process.env.CROSSCHECK_DAILY_DETAILS_CAP = "1000"; process.env.DISCOVERY_DAILY_PLACES_CAP = "1000";
let db: any, pool: any, s: any, cc: any, places: any; const created: string[] = [];
const LISTING_PHONE = "+91 80 6945 1080";
function stubFetch(phone?: string, website = "https://fixture-venue.example/") {
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    if (String(url).includes("places/")) return new Response(JSON.stringify({ id: "ChIJfixturePlace01", websiteUri: website, ...(phone ? { internationalPhoneNumber: phone } : {}) }), { status: 200 });
    return new Response(JSON.stringify({ places: [{ id: "ChIJfixturePlace02", websiteUri: website, ...(phone ? { internationalPhoneNumber: phone } : {}) }] }), { status: 200 });
  }));
}
async function fixture(externalKey: string | null, phoneE164: string) {
  const [p] = await db.insert(s.prospects).values({ displayName: `Fixture Venue ${Date.now()}${Math.random()}`, organisation: "Fixture Venue", category: "referral_partner", website: "https://fixture-venue.example/", externalKey, commercialFit: 80, identityConfidence: 80 }).returning();
  created.push(p.id);
  const [c] = await db.insert(s.contacts).values({ prospectId: p.id, channel: "phone", value: phoneE164, normalizedValue: phoneE164, fingerprint: `${p.id.replace(/-/g, "")}ffffffffffffffffffffffffffffffff`.slice(0, 64), verification: "published_unverified", kind: "business_line" }).returning();
  return { p, c };
}
beforeAll(async () => { ({ db, pool } = await import("@/db")); s = await import("@/db/schema"); cc = await import("@/lib/discovery/crosscheck"); places = await import("@/lib/discovery/places"); });
afterAll(async () => { vi.unstubAllGlobals(); await db.delete(s.prospects).where(inArray(s.prospects.externalKey, ["place:ChIJfixturePlace01","place:ChIJfixturePlace02","place:ChIJfixturePlace03"])); if (created.length) await db.delete(s.prospects).where(inArray(s.prospects.id, created)); await pool?.end(); });

describe("Google Places connector boundaries", () => {
  it("compares phones by outcome only", () => {
    expect(places.crossCheckPhone("+918069451080", LISTING_PHONE)).toMatchObject({ result: "match" });
    expect(places.crossCheckPhone("+919888399994", LISTING_PHONE)).toMatchObject({ result: "no_match" });
    expect(places.crossCheckPhone("+918069451080", undefined)).toEqual({ result: "no_listing_phone" });
  });
  it("matches listings to seeded sites only on website domain", () => { expect(places.sameSite("venue.in", "venue.in")).toBe(true); expect(places.sameSite("shop.venue.in", "venue.in")).toBe(true); expect(places.sameSite("other.in", "venue.in")).toBe(false); });
  it("rejects malformed place IDs before any network call", async () => { const f = vi.fn(); vi.stubGlobal("fetch", f); await expect(places.placeDetails("../../evil")).rejects.toThrow(/Invalid place ID/); expect(f).not.toHaveBeenCalled(); });
});

describe("independent phone cross-check", () => {
  it("verifies a matching first-party number and never stores Google's phone", async () => {
    stubFetch(LISTING_PHONE); const { p, c } = await fixture("place:ChIJfixturePlace01", "+918069451080");
    const r = await cc.crossCheckProspect(p.id); expect(r).toMatchObject({ status: "checked", outcomes: { match: 1 } });
    const [after] = await db.select().from(s.contacts).where(eq(s.contacts.id, c.id)); expect(after.verification).toBe("verified"); expect(after.corroborated).toBe(true);
    const rows = await db.select().from(s.contactVerifications).where(eq(s.contactVerifications.contactId, c.id));
    expect(JSON.stringify(rows)).not.toContain("6945"); expect(rows.some((x: any) => x.method === "google_places_crosscheck" && x.result === "match")).toBe(true);
  });
  it("demotes a previously corroborated number that no longer matches", async () => {
    stubFetch("+91 80 1111 2222"); const { p, c } = await fixture("place:ChIJfixturePlace03", "+918069451080");
    await db.update(s.contacts).set({ corroborated: true, verification: "verified" }).where(eq(s.contacts.id, c.id));
    await cc.crossCheckProspect(p.id);
    const [after] = await db.select().from(s.contacts).where(eq(s.contacts.id, c.id)); expect(after.corroborated).toBe(false); expect(after.verification).toBe("published_unverified");
  });
  it("links a seeded website to its listing only via domain match and stores just the place ID", async () => {
    stubFetch(LISTING_PHONE); const { p } = await fixture(null, "+918069451080");
    await cc.crossCheckProspect(p.id);
    const [after] = await db.select().from(s.prospects).where(eq(s.prospects.id, p.id)); expect(after.externalKey).toBe("place:ChIJfixturePlace02");
  });
  it("rejects a listing whose website is a different business", async () => {
    stubFetch(LISTING_PHONE, "https://someone-else.example/"); const { p, c } = await fixture(null, "+918069451080");
    expect(await cc.crossCheckProspect(p.id)).toEqual({ status: "no_listing" });
    const [after] = await db.select().from(s.contacts).where(eq(s.contacts.id, c.id)); expect(after.corroborated).toBe(false);
  });
});
