import "server-only";
import { asc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { discoveryQueries, jobs, prospects, sourceRuns, sources } from "@/db/schema";
import { safeSourceFetch } from "@/lib/safe-fetch";
import { log } from "@/lib/log";
import { istDay, placesConfigured, placesTextSearch } from "@/lib/discovery/places";
import { processWebsite, type WebsiteResult } from "@/lib/discovery/pipeline";
import { rootHost } from "@/lib/discovery/extract";
import { crossCheckProspect, logCrossCheckSkip, purgeExpiredPlaceCache, selectCrossCheckTargets } from "@/lib/discovery/crosscheck";
import { sendDailyPdfReport } from "@/lib/telegram";

export async function claimJob(workerId: string) {
  const result = await db.execute(sql`with candidate as (select id from aurum_acquisition.jobs where ((status in ('queued','retry_wait') and run_after <= now()) or (status='running' and locked_at < now() - interval '15 minutes')) order by run_after, created_at for update skip locked limit 1) update aurum_acquisition.jobs j set status='running', attempts=j.attempts+1, locked_at=now(), locked_by=${workerId}, updated_at=now() from candidate where j.id=candidate.id returning j.*`);
  const row = result.rows[0] as Record<string, unknown> | undefined;
  if (!row) return null;
  return { id: String(row.id), type: String(row.type), payload: row.payload as Record<string, unknown>, attempts: Number(row.attempts), maxAttempts: Number(row.max_attempts) };
}
type ClaimedJob = NonNullable<Awaited<ReturnType<typeof claimJob>>>;

export async function enqueue(type: string, payload: Record<string, unknown>, idempotencyKey: string, runAfter = new Date()) {
  await db.insert(jobs).values({ type, payload, idempotencyKey, runAfter }).onConflictDoNothing();
}

export async function ensureDailySchedule(now = new Date()) {
  const day = istDay(now);
  await enqueue("discovery.daily", { day }, `discovery.daily:${day}`, now);
  await enqueue("verify.crosscheck_daily", { day }, `verify.crosscheck_daily:${day}`, new Date(now.getTime() + 60_000));
  await enqueue("places.purge_cache", { day }, `places.purge_cache:${day}`, new Date(now.getTime() + 120_000));
  const reportAt = new Date(`${day}T20:00:00+05:30`);
  await enqueue("report.daily", { day }, `report.daily:${day}`, reportAt > now ? reportAt : now);
}

async function sourceId(name: string) {
  const [s] = await db.select().from(sources).where(eq(sources.name, name)).limit(1);
  if (!s) throw new Error(`Source "${name}" is not seeded`);
  if (!s.active || s.access === "prohibited") throw new Error(`Source "${name}" is inactive or prohibited`);
  return s.id;
}

function tally(results: WebsiteResult[]) {
  return {
    retained: results.filter(r => r.status === "retained").length,
    refreshed: results.filter(r => r.status === "refreshed").length,
    skipped: results.filter(r => r.status === "skipped_recent").length,
    rejected: results.filter(r => r.status === "rejected").length,
    emails: results.reduce((s, r) => s + (r.emails ?? 0), 0),
    phones: results.reduce((s, r) => s + (r.phones ?? 0), 0),
    corroborated: results.reduce((s, r) => s + (r.corroborated ?? 0), 0),
    rejections: results.filter(r => r.reason).map(r => r.reason),
  };
}

const DIRECTORY_HOSTS = /wedmegood|weddingwire|venuebookingz|mandap\.com|eventosaur|venuelook|weddingz\.in|justdial|facebook|instagram|linkedin|google|magicbricks|sloshout|partykaro|bookmyfunction|banquetbooking|stories\.hilton\.com|newsroom\.hyatt\.com/i;

// Verified first-party Bengaluru wedding planners, photographers, venues & corporate event firms for autonomous crawling
export const BENGALURU_FIRST_PARTY_DISCOVERY_POOL: Array<{ url: string; category: "referral_partner" | "corporate" }> = [
  { url: "https://zzeeh.com/", category: "referral_partner" },
  { url: "https://airaweddingplanners.com/", category: "referral_partner" },
  { url: "https://www.divyavithika.com/", category: "referral_partner" },
  { url: "https://www.kraftstarmanagement.com/", category: "referral_partner" },
  { url: "https://www.crimsonandcherry.com/", category: "referral_partner" },
  { url: "https://www.meragi.com/", category: "referral_partner" },
  { url: "https://www.wedsy.in/", category: "referral_partner" },
  { url: "https://www.gunitevents.com/", category: "referral_partner" },
  { url: "https://poonammayanksharma.co.in/", category: "referral_partner" },
  { url: "https://weddingsbyshubharambh.com/", category: "referral_partner" },
  { url: "https://www.neetashankar.com/", category: "referral_partner" },
  { url: "https://vivekkrishnan.com/contact", category: "referral_partner" },
  { url: "https://karthikphotography.in/contact", category: "referral_partner" },
  { url: "https://sreevikash.com/contact/", category: "referral_partner" },
  { url: "https://www.deccanlenz.com/contact-2", category: "referral_partner" },
  { url: "https://www.erigoevent.com/", category: "corporate" },
  { url: "https://moeindia.com/", category: "corporate" },
  { url: "https://theutpala.com/", category: "corporate" },
  { url: "https://ashwahevents.com/", category: "corporate" },
  { url: "https://madruncommunications.in/", category: "corporate" },
  { url: "https://www.blackpepperevents.com/services/", category: "corporate" },
];

async function discoverFromOpenRegistry(): Promise<Array<{ url: string; category: "referral_partner" | "corporate" }>> {
  try {
    const r = await fetch("https://panigrahana.com/data/venue-cost-registry-2026.json", {
      headers: { "user-agent": "AurumBespokeResearch/1.0 (+https://aurumbespoke.com/)" },
      signal: AbortSignal.timeout(15_000),
    });
    if (!r.ok) return [];
    const data = (await r.json()) as { rows?: Array<{ venue?: string; area?: string; city?: string; source_url?: string }> };
    const out: Array<{ url: string; category: "referral_partner" }> = [];
    for (const row of data.rows ?? []) {
      const text = `${row.venue ?? ""} ${row.area ?? ""} ${row.source_url ?? ""}`;
      if (row.city === "Bangalore" && row.source_url && row.source_url.startsWith("https://") && !DIRECTORY_HOSTS.test(row.source_url) && !/mysore|mysuru|hosur|coorg|chikmagalur|kabini/i.test(text)) {
        out.push({ url: row.source_url, category: "referral_partner" });
      }
    }
    return out;
  } catch {
    return [];
  }
}

async function discoveryDaily(payload: Record<string, unknown>) {
  if (process.env.DISCOVERY_ENABLED === "false") return;
  const day = String(payload.day ?? istDay());

  // 1. Official Google Places API search queries when GOOGLE_PLACES_API_KEY is configured
  if (placesConfigured()) {
    const cap = Number(process.env.DISCOVERY_QUERIES_PER_DAY ?? 8);
    const queries = await db.select().from(discoveryQueries).where(eq(discoveryQueries.active, true)).orderBy(sql`${discoveryQueries.lastRunAt} asc nulls first`, asc(discoveryQueries.createdAt)).limit(cap);
    for (const q of queries) await enqueue("discovery.query", { queryId: q.id }, `discovery.query:${q.id}:${day}`);
  } else {
    log("warn", "discovery.places_unconfigured", { reason: "GOOGLE_PLACES_API_KEY not configured; running first-party & CC BY 4.0 open-registry discovery" });
  }

  // 2. Autonomous first-party & CC BY 4.0 open-registry discovery (queues uncrawled domains up to daily batch limit)
  const existing = await db.select({ website: prospects.website }).from(prospects);
  const knownRoots = new Set(
    existing
      .map(e => {
        try { return e.website ? rootHost(new URL(e.website).hostname) : ""; } catch { return ""; }
      })
      .filter(Boolean)
  );
  const openVenues = await discoverFromOpenRegistry();
  const candidates = [...BENGALURU_FIRST_PARTY_DISCOVERY_POOL, ...openVenues];
  const dailySiteBatch = Number(process.env.DISCOVERY_WEBSITES_PER_DAY ?? 12);
  let queued = 0;
  const queuedRoots = new Set<string>();
  for (const item of candidates) {
    if (queued >= dailySiteBatch) break;
    let root = "";
    try { root = rootHost(new URL(item.url).hostname); } catch { continue; }
    if (!root || knownRoots.has(root) || queuedRoots.has(root)) continue;
    queuedRoots.add(root);
    await enqueue("discovery.website", { url: item.url, category: item.category }, `discovery.website:${root}:${day}`);
    queued++;
  }
}

async function discoveryQuery(payload: Record<string, unknown>) {
  const [q] = await db.select().from(discoveryQueries).where(eq(discoveryQueries.id, String(payload.queryId))).limit(1);
  if (!q) throw new Error("Discovery query not found");
  const src = await sourceId("Google Places + first-party websites");
  const [run] = await db.insert(sourceRuns).values({ sourceId: src, status: "running", startedAt: new Date(), detail: { query: q.query } }).returning();
  const places = await placesTextSearch(q.query);
  const results: WebsiteResult[] = [];
  for (const p of places) {
    if (!p.websiteUri) { results.push({ status: "rejected", reason: "listing has no first-party website" }); continue; }
    try {
      results.push(await processWebsite({ url: p.websiteUri, category: q.category === "corporate" ? "corporate" : "referral_partner", sourceId: src, placeId: p.id, placesPhone: p.internationalPhoneNumber, query: q.query }));
    } catch (e) {
      results.push({ status: "rejected", reason: e instanceof Error ? e.message : "processing failed" });
    }
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

async function sourceHealth(payload: Record<string, unknown>) {
  const runId = String(payload.runId);
  const [source] = await db.select().from(sources).where(eq(sources.id, String(payload.sourceId))).limit(1);
  if (!source || !source.checkUrl || !source.baseUrl) throw new Error("Source is not configured for health checks");
  if (source.access === "prohibited") throw new Error("Source access is prohibited");
  await db.update(sourceRuns).set({ status: "running", startedAt: new Date() }).where(eq(sourceRuns.id, runId));
  const detail = await safeSourceFetch(source.checkUrl, source.baseUrl);
  await db.update(sourceRuns).set({ status: detail.ok ? "completed" : "partial", detail, finishedAt: new Date() }).where(eq(sourceRuns.id, runId));
}

async function crossCheckDaily(payload: Record<string, unknown>) {
  if (!placesConfigured()) { logCrossCheckSkip("GOOGLE_PLACES_API_KEY not configured"); return; }
  const day = String(payload.day ?? istDay());
  for (const id of await selectCrossCheckTargets(Number(process.env.CROSSCHECK_PROSPECTS_PER_DAY ?? 15))) {
    await enqueue("verify.crosscheck", { prospectId: id }, `verify.crosscheck:${id}:${day}`);
  }
}

export async function processJob(job: ClaimedJob) {
  try {
    if (job.type === "source.health_check") await sourceHealth(job.payload);
    else if (job.type === "discovery.daily") await discoveryDaily(job.payload);
    else if (job.type === "discovery.query") await discoveryQuery(job.payload);
    else if (job.type === "discovery.website") await discoveryWebsite(job.payload);
    else if (job.type === "verify.crosscheck_daily") await crossCheckDaily(job.payload);
    else if (job.type === "verify.crosscheck") await crossCheckProspect(String(job.payload.prospectId));
    else if (job.type === "places.purge_cache") await purgeExpiredPlaceCache();
    else if (job.type === "report.daily") await sendDailyPdfReport(String(job.payload.day ?? istDay()), Boolean(job.payload.force));
    else if (job.type === "maintenance.expire_sessions") await db.execute(sql`delete from aurum_acquisition.sessions where expires_at < now()`);
    else throw new Error(`Unsupported job type ${job.type}`);
    await db.update(jobs).set({ status: "completed", completedAt: new Date(), lockedAt: null, lockedBy: null, lastError: null, updatedAt: new Date() }).where(eq(jobs.id, job.id));
    log("info", "job.completed", { jobId: job.id, type: job.type, attempts: job.attempts });
    return { status: "completed" as const };
  } catch (error) {
    const message = error instanceof Error ? error.message : "job failed";
    const dead = job.attempts >= job.maxAttempts || /cap of \d+ reached|not configured/.test(message);
    const delay = Math.min(3600, 30 * 2 ** Math.max(0, job.attempts - 1));
    await db.update(jobs).set({ status: dead ? "dead_letter" : "retry_wait", lastError: message, runAfter: new Date(Date.now() + delay * 1000), lockedAt: null, lockedBy: null, updatedAt: new Date() }).where(eq(jobs.id, job.id));
    if (job.type === "source.health_check") await db.update(sourceRuns).set({ status: dead ? "failed" : "queued", error: message, finishedAt: dead ? new Date() : null }).where(eq(sourceRuns.id, String(job.payload.runId)));
    log("error", "job.failed", { jobId: job.id, type: job.type, attempts: job.attempts, dead, error: message });
    return { status: dead ? "dead_letter" as const : "retry_wait" as const, error: message };
  }
}

export async function runOnce(workerId: string) {
  const job = await claimJob(workerId);
  if (!job) return { status: "empty" as const };
  return processJob(job);
}
