import "server-only";
import { asc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { discoveryQueries, jobs, sourceRuns, sources } from "@/db/schema";
import { safeSourceFetch } from "@/lib/safe-fetch";
import { log } from "@/lib/log";
import { istDay, placesConfigured, placesTextSearch } from "@/lib/discovery/places";
import { processWebsite, type WebsiteResult } from "@/lib/discovery/pipeline";
import { buildDailyReport } from "@/lib/report";

export async function claimJob(workerId: string) { const result = await db.execute(sql`with candidate as (select id from aurum_acquisition.jobs where ((status in ('queued','retry_wait') and run_after <= now()) or (status='running' and locked_at < now() - interval '15 minutes')) order by run_after, created_at for update skip locked limit 1) update aurum_acquisition.jobs j set status='running', attempts=j.attempts+1, locked_at=now(), locked_by=${workerId}, updated_at=now() from candidate where j.id=candidate.id returning j.*`); const row = result.rows[0] as Record<string, unknown> | undefined; if (!row) return null; return { id: String(row.id), type: String(row.type), payload: row.payload as Record<string, unknown>, attempts: Number(row.attempts), maxAttempts: Number(row.max_attempts) }; }
type ClaimedJob = NonNullable<Awaited<ReturnType<typeof claimJob>>>;

export async function enqueue(type: string, payload: Record<string, unknown>, idempotencyKey: string, runAfter = new Date()) {
  await db.insert(jobs).values({ type, payload, idempotencyKey, runAfter }).onConflictDoNothing();
}
export async function ensureDailySchedule(now = new Date()) {
  const day = istDay(now);
  await enqueue("discovery.daily", { day }, `discovery.daily:${day}`, now);
  const reportAt = new Date(`${day}T20:00:00+05:30`);
  await enqueue("report.daily", { day }, `report.daily:${day}`, reportAt > now ? reportAt : now);
}
async function sourceId(name: string) { const [s] = await db.select().from(sources).where(eq(sources.name, name)).limit(1); if (!s) throw new Error(`Source "${name}" is not seeded`); if (!s.active || s.access === "prohibited") throw new Error(`Source "${name}" is inactive or prohibited`); return s.id; }
function tally(results: WebsiteResult[]) { return { retained: results.filter(r => r.status === "retained").length, refreshed: results.filter(r => r.status === "refreshed").length, skipped: results.filter(r => r.status === "skipped_recent").length, rejected: results.filter(r => r.status === "rejected").length, emails: results.reduce((s, r) => s + (r.emails ?? 0), 0), phones: results.reduce((s, r) => s + (r.phones ?? 0), 0), corroborated: results.reduce((s, r) => s + (r.corroborated ?? 0), 0), rejections: results.filter(r => r.reason).map(r => r.reason) }; }

async function discoveryDaily(payload: Record<string, unknown>) {
  if (process.env.DISCOVERY_ENABLED === "false") return;
  if (!placesConfigured()) { log("warn", "discovery.skipped", { reason: "GOOGLE_PLACES_API_KEY not configured" }); return; }
  const day = String(payload.day ?? istDay()); const cap = Number(process.env.DISCOVERY_QUERIES_PER_DAY ?? 8);
  const queries = await db.select().from(discoveryQueries).where(eq(discoveryQueries.active, true)).orderBy(sql`${discoveryQueries.lastRunAt} asc nulls first`, asc(discoveryQueries.createdAt)).limit(cap);
  for (const q of queries) await enqueue("discovery.query", { queryId: q.id }, `discovery.query:${q.id}:${day}`);
}
async function discoveryQuery(payload: Record<string, unknown>) {
  const [q] = await db.select().from(discoveryQueries).where(eq(discoveryQueries.id, String(payload.queryId))).limit(1); if (!q) throw new Error("Discovery query not found");
  const src = await sourceId("Google Places + first-party websites");
  const [run] = await db.insert(sourceRuns).values({ sourceId: src, status: "running", startedAt: new Date(), detail: { query: q.query } }).returning();
  const places = await placesTextSearch(q.query);
  const results: WebsiteResult[] = [];
  for (const p of places) {
    if (!p.websiteUri) { results.push({ status: "rejected", reason: "listing has no first-party website" }); continue; }
    try { results.push(await processWebsite({ url: p.websiteUri, category: q.category === "corporate" ? "corporate" : "referral_partner", sourceId: src, placeId: p.id, placesPhone: p.internationalPhoneNumber, query: q.query })); }
    catch (e) { results.push({ status: "rejected", reason: e instanceof Error ? e.message : "processing failed" }); }
  }
  const t = tally(results);
  await db.update(sourceRuns).set({ status: "completed", finishedAt: new Date(), discovered: places.length, parsed: places.length - results.filter(r => r.reason === "listing has no first-party website").length, uniqueRecords: t.retained + t.refreshed + t.skipped, retained: t.retained + t.refreshed, rejected: t.rejected, detail: { query: q.query, ...t } }).where(eq(sourceRuns.id, run.id));
  await db.update(discoveryQueries).set({ lastRunAt: new Date() }).where(eq(discoveryQueries.id, q.id));
}
async function discoveryWebsite(payload: Record<string, unknown>) {
  const src = await sourceId("Seeded first-party websites");
  const [run] = await db.insert(sourceRuns).values({ sourceId: src, status: "running", startedAt: new Date(), detail: { url: payload.url } }).returning();
  const r = await processWebsite({ url: String(payload.url), category: payload.category === "corporate" ? "corporate" : "referral_partner", sourceId: src });
  const t = tally([r]);
  await db.update(sourceRuns).set({ status: r.status === "rejected" ? "partial" : "completed", finishedAt: new Date(), discovered: 1, parsed: r.status === "rejected" ? 0 : 1, uniqueRecords: r.status === "rejected" ? 0 : 1, retained: t.retained + t.refreshed, rejected: t.rejected, detail: { url: payload.url, ...t } }).where(eq(sourceRuns.id, run.id));
}
async function sourceHealth(payload: Record<string, unknown>) { const runId = String(payload.runId); const [source] = await db.select().from(sources).where(eq(sources.id, String(payload.sourceId))).limit(1); if (!source || !source.checkUrl || !source.baseUrl) throw new Error("Source is not configured for health checks"); if (source.access === "prohibited") throw new Error("Source access is prohibited"); await db.update(sourceRuns).set({ status: "running", startedAt: new Date() }).where(eq(sourceRuns.id, runId)); const detail = await safeSourceFetch(source.checkUrl, source.baseUrl); await db.update(sourceRuns).set({ status: detail.ok ? "completed" : "partial", detail, finishedAt: new Date() }).where(eq(sourceRuns.id, runId)); }

export async function processJob(job: ClaimedJob) {
  try {
    if (job.type === "source.health_check") await sourceHealth(job.payload);
    else if (job.type === "discovery.daily") await discoveryDaily(job.payload);
    else if (job.type === "discovery.query") await discoveryQuery(job.payload);
    else if (job.type === "discovery.website") await discoveryWebsite(job.payload);
    else if (job.type === "report.daily") await buildDailyReport(String(job.payload.day ?? istDay()));
    else if (job.type === "maintenance.expire_sessions") await db.execute(sql`delete from aurum_acquisition.sessions where expires_at < now()`);
    else throw new Error(`Unsupported job type ${job.type}`);
    await db.update(jobs).set({ status: "completed", completedAt: new Date(), lockedAt: null, lockedBy: null, lastError: null, updatedAt: new Date() }).where(eq(jobs.id, job.id));
    log("info", "job.completed", { jobId: job.id, type: job.type, attempts: job.attempts });
    return { status: "completed" as const };
  } catch (error) {
    const message = error instanceof Error ? error.message : "job failed"; const dead = job.attempts >= job.maxAttempts || /cap of \d+ reached|not configured/.test(message);
    const delay = Math.min(3600, 30 * 2 ** Math.max(0, job.attempts - 1));
    await db.update(jobs).set({ status: dead ? "dead_letter" : "retry_wait", lastError: message, runAfter: new Date(Date.now() + delay * 1000), lockedAt: null, lockedBy: null, updatedAt: new Date() }).where(eq(jobs.id, job.id));
    if (job.type === "source.health_check") await db.update(sourceRuns).set({ status: dead ? "failed" : "queued", error: message, finishedAt: dead ? new Date() : null }).where(eq(sourceRuns.id, String(job.payload.runId)));
    log("error", "job.failed", { jobId: job.id, type: job.type, attempts: job.attempts, dead, error: message });
    return { status: dead ? "dead_letter" as const : "retry_wait" as const, error: message };
  }
}
export async function runOnce(workerId: string) { const job = await claimJob(workerId); if (!job) return { status: "empty" as const }; return processJob(job); }
