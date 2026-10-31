import "dotenv/config";
import { randomUUID } from "node:crypto";
import { pool } from "../src/db";
import { ensureDailySchedule, runOnce } from "../src/lib/jobs";

// Designed for an hourly Cloud Scheduler → Cloud Run Job trigger: it self-schedules today's
// discovery and report, then drains the queue within a bounded time budget.
const workerId = `${process.env.K_REVISION ?? "local"}:${randomUUID()}`;
const once = process.argv.includes("--once");
const deadline = Date.now() + Number(process.env.WORKER_TIME_BUDGET_MS ?? 45 * 60_000);
async function main() {
  if (!process.argv.includes("--no-schedule")) await ensureDailySchedule();
  let processed = 0;
  do { const r = await runOnce(workerId); if (r.status === "empty") break; processed++; } while (!once && Date.now() < deadline && processed < 200);
  console.info(JSON.stringify({ severity: "INFO", event: "worker.finished", processed }));
}
main().then(() => pool.end()).catch(async error => { console.error(JSON.stringify({ severity: "ERROR", event: "worker.crash", error: error instanceof Error ? error.message : String(error) })); await pool.end(); process.exit(1); });
