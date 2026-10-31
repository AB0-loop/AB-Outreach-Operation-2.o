import "dotenv/config";
import { db, pool } from "../src/db";
import { discoveryQueries, settings, sources } from "../src/db/schema";
async function main() {
  await db.insert(settings).values({ key: "global" }).onConflictDoNothing();
  await db.insert(sources).values([
    { name: "Aurum website inbound", type: "inbound", baseUrl: "https://aurumbespoke.com/", checkUrl: "https://aurumbespoke.com/", access: "permitted", accessBasis: "Aurum-owned public site; booking records require authorised backend access", purpose: "Inbound consultation import" },
    { name: "First-party referral research", type: "referral", access: "manual_only", accessBasis: "Review each site and terms; never bulk-harvest contacts", purpose: "Evidence-backed partner research" },
    { name: "Professional events", type: "event", access: "manual_only", accessBasis: "Use event pages to choose networking opportunities, not attendee marketing lists", purpose: "Warm introductions" },
    { name: "Google Places + first-party websites", type: "first_party_business", access: "permitted", accessBasis: "Official Places API used for discovery; only place IDs stored per Maps terms; contacts extracted solely from each business's own website, robots.txt respected", purpose: "Autonomous daily partner discovery" },
    { name: "Seeded first-party websites", type: "first_party_business", access: "permitted", accessBasis: "Business websites entered by staff; robots.txt respected; organisation-published contacts only", purpose: "Targeted partner research" },
  ]).onConflictDoNothing();
  await db.insert(discoveryQueries).values([
    { query: "wedding planner in Bengaluru", category: "referral_partner" },
    { query: "luxury wedding venue Bengaluru", category: "referral_partner" },
    { query: "wedding photographer Bengaluru", category: "referral_partner" },
    { query: "wedding decorator Bengaluru", category: "referral_partner" },
    { query: "personal stylist for men Bengaluru", category: "referral_partner" },
    { query: "bridal and groom makeover studio Bengaluru", category: "referral_partner" },
    { query: "corporate event management company Bengaluru", category: "corporate" },
    { query: "destination wedding planner Bangalore", category: "referral_partner" },
  ]).onConflictDoNothing();
}
main().then(() => pool.end()).catch(async e => { console.error(e); await pool.end(); process.exit(1); });
