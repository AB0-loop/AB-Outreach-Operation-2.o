import "dotenv/config";
import { db, pool } from "../src/db";
import { jobs, sourceRuns, sources } from "../src/db/schema";
import { eq } from "drizzle-orm";
import { runOnce } from "../src/lib/jobs";
async function main(){const rows=await db.select().from(sources);for(const source of rows.filter(x=>x.checkUrl)){const[run]=await db.insert(sourceRuns).values({sourceId:source.id,status:"queued"}).returning();await db.insert(jobs).values({type:"source.health_check",payload:{sourceId:source.id,runId:run.id},idempotencyKey:`manual-source-check:${source.id}:${Date.now()}`});await runOnce("manual-source-check");const[result]=await db.select().from(sourceRuns).where(eq(sourceRuns.id,run.id));console.log(JSON.stringify({source:source.name,status:result.status,detail:result.detail,error:result.error}))}}
main().then(()=>pool.end()).catch(async e=>{console.error(e);await pool.end();process.exit(1)});
