import "dotenv/config";
import { randomUUID } from "node:crypto";
import { pool } from "../src/db";
import { runOnce } from "../src/lib/jobs";
const workerId = `${process.env.K_REVISION ?? "local"}:${randomUUID()}`;
const once = process.argv.includes("--once");
async function main() { do { const result = await runOnce(workerId); if (result.status === "empty") break; } while (!once); }
main().then(() => pool.end()).catch(async error => { console.error(JSON.stringify({ severity: "ERROR", event: "worker.crash", error: error instanceof Error ? error.message : String(error) })); await pool.end(); process.exit(1); });
