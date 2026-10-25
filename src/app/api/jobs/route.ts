import { desc } from "drizzle-orm";
import { db } from "@/db";
import { jobs } from "@/db/schema";
import { requirePermission } from "@/lib/auth";
import { jsonError } from "@/lib/api";
export async function GET() { try { await requirePermission("administer"); const rows = await db.select().from(jobs).orderBy(desc(jobs.createdAt)).limit(100); return Response.json({ ok: true, rows }); } catch (error) { return jsonError(error); } }
