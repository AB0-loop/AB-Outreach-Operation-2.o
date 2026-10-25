import { z } from "zod";
import { db } from "@/db";
import { auditEvents, settings } from "@/db/schema";
import { assertCsrf, requirePermission } from "@/lib/auth";
import { jsonError } from "@/lib/api";
import { isLiveSendEnvironment } from "@/lib/env";
import { assertOrigin } from "@/lib/security";
const input = z.object({ mode: z.enum(["disabled", "dry_run", "live"]), killSwitch: z.boolean(), globalDailyCap: z.number().int().min(0).max(100), mailboxDailyCap: z.number().int().min(0).max(100), confirmation: z.string().optional() });
export async function PATCH(request: Request) { try { assertOrigin(request); const user = await requirePermission("owner"); assertCsrf(request, user); const data = input.parse(await request.json()); if ((data.mode === "live" || !data.killSwitch) && (data.confirmation !== "ENABLE LIVE SENDING" || !isLiveSendEnvironment())) throw new Error("Live mode requires environment permission and exact confirmation"); await db.insert(settings).values({ key: "global", mode: data.mode, killSwitch: data.killSwitch, globalDailyCap: data.globalDailyCap, mailboxDailyCap: data.mailboxDailyCap, updatedBy: user.id, updatedAt: new Date() }).onConflictDoUpdate({ target: settings.key, set: { mode: data.mode, killSwitch: data.killSwitch, globalDailyCap: data.globalDailyCap, mailboxDailyCap: data.mailboxDailyCap, updatedBy: user.id, updatedAt: new Date() } }); await db.insert(auditEvents).values({ actorId: user.id, action: "settings.updated", entityType: "settings", entityId: "global", summary: `Mode ${data.mode}; kill switch ${data.killSwitch ? "on" : "off"}` }); return Response.json({ ok: true }); } catch (error) { return jsonError(error, "Settings update failed"); } }
