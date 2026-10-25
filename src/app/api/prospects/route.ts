import { desc } from "drizzle-orm";
import { db } from "@/db";
import { contacts, prospects } from "@/db/schema";
import { assertCsrf, requireAny, requireUser } from "@/lib/auth";
import { jsonError } from "@/lib/api";
import { createProspect, prospectInput } from "@/lib/prospect-service";
import { assertOrigin } from "@/lib/security";
export async function GET() { try { await requireUser(); const rows = await db.select({ id: prospects.id, displayName: prospects.displayName, organisation: prospects.organisation, category: prospects.category, stage: prospects.stage, identityConfidence: prospects.identityConfidence, commercialFit: prospects.commercialFit, updatedAt: prospects.updatedAt }).from(prospects).orderBy(desc(prospects.updatedAt)).limit(200); return Response.json({ ok: true, rows }); } catch (error) { return jsonError(error); } }
export async function POST(request: Request) { try { assertOrigin(request); const user = await requireAny(["owner", "admin", "researcher", "operator"]); assertCsrf(request, user); const result = await createProspect(prospectInput.parse(await request.json()), user.id); return Response.json({ ok: true, ...result }, { status: 201 }); } catch (error) { return jsonError(error, "Prospect creation failed"); } }
