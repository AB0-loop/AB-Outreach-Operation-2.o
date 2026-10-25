import { sql } from "drizzle-orm";
import { db } from "@/db";
import { currentSession } from "@/lib/auth";
export async function GET() { const count = await db.execute(sql`select count(*)::int as count from aurum_acquisition.users`); const user = await currentSession().catch(() => null); return Response.json({ configured: Number((count.rows[0] as { count: number }).count) > 0, authenticated: !!user, user: user ? { displayName: user.displayName, role: user.role } : null }); }
