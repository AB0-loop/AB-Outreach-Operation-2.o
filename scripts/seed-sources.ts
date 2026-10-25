import "dotenv/config";
import { db, pool } from "../src/db";
import { settings, sources } from "../src/db/schema";
async function main() { await db.insert(settings).values({ key: "global" }).onConflictDoNothing(); await db.insert(sources).values([
  { name: "Aurum website inbound", type: "inbound", baseUrl: "https://aurumbespoke.com/", checkUrl: "https://aurumbespoke.com/", access: "permitted", accessBasis: "Aurum-owned public site; booking records require authorised backend access", purpose: "Inbound consultation import" },
  { name: "First-party referral research", type: "referral", access: "manual_only", accessBasis: "Review each site and terms; never bulk-harvest contacts", purpose: "Evidence-backed partner research" },
  { name: "Professional events", type: "event", access: "manual_only", accessBasis: "Use event pages to choose networking opportunities, not attendee marketing lists", purpose: "Warm introductions" },
]).onConflictDoNothing(); }
main().then(() => pool.end()).catch(async e => { console.error(e); await pool.end(); process.exit(1); });
