import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { dailyReports } from "@/db/schema";
import { getCallQueue } from "@/lib/call-queue";
import { placesConfigured } from "@/lib/discovery/places";

export async function buildDailyReport(day: string) {
  const start = new Date(`${day}T00:00:00+05:30`), end = new Date(start.getTime() + 86400_000);
  const q = async (query: ReturnType<typeof sql>) => (await db.execute(query)).rows as Array<Record<string, unknown>>;
  const [runs] = await q(sql`select count(*)::int runs, coalesce(sum(discovered),0)::int discovered, coalesce(sum(retained),0)::int retained, coalesce(sum(rejected),0)::int rejected, count(*) filter (where status='failed')::int failed from aurum_acquisition.source_runs where created_at >= ${start} and created_at < ${end}`);
  const [prospectsRow] = await q(sql`select count(*) filter (where created_at >= ${start} and created_at < ${end} and external_key is not null)::int new_discovered, count(*) filter (where last_verified_at >= ${start} and last_verified_at < ${end})::int verified_today, count(*)::int total from aurum_acquisition.prospects where is_test=false`);
  const contactsByType = await q(sql`select channel, kind, verification, count(*)::int n from aurum_acquisition.contacts where created_at >= ${start} and created_at < ${end} group by 1,2,3 order by 4 desc`);
  const [qualified] = await q(sql`select count(*)::int n from aurum_acquisition.contacts c join aurum_acquisition.prospects p on p.id=c.prospect_id where c.created_at >= ${start} and c.created_at < ${end} and p.is_test=false and p.commercial_fit >= 65 and p.identity_confidence >= 60 and c.verification in ('verified','published_unverified','self_provided') and not exists (select 1 from aurum_acquisition.suppressions s where s.active and (s.prospect_id=p.id or s.contact_fingerprint=c.fingerprint))`);
  const [calls] = await q(sql`select count(*)::int calls, count(*) filter (where outcome='meeting_booked')::int meetings, count(*) filter (where outcome='connected_interested')::int interested from aurum_acquisition.call_logs where called_at >= ${start} and called_at < ${end}`);
  const crossChecks = await q(sql`select result, count(*)::int n from aurum_acquisition.contact_verifications where method = 'google_places_crosscheck' and checked_at >= ${start} and checked_at < ${end} group by 1`);
  const usage = await q(sql`select provider, calls from aurum_acquisition.provider_usage where day = ${day}`);
  const queue = await getCallQueue(10);
  const summary = {
    day, generatedAt: new Date().toISOString(), discoveryProviderConfigured: placesConfigured(),
    sourceRuns: runs, prospects: prospectsRow, contactsCreated: contactsByType,
    autoQualifiedContacts: { count: qualified.n, definition: "contact created today on a prospect with commercial fit ≥65 and identity confidence ≥60, contact not invalid, no active suppression; awaiting human review" },
    callQueue: { ready: (await getCallQueue(500)).length, top: queue.map(r => ({ name: r.displayName, phone: r.value, priority: r.priority, reasons: r.reasons })) },
    phoneCrossChecks: crossChecks, callsToday: calls, providerUsage: usage,
  };
  await db.insert(dailyReports).values({ day, summary }).onConflictDoUpdate({ target: dailyReports.day, set: { summary, createdAt: new Date() } });
  return summary;
}
