import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { auditEvents, discoveryQueries } from "@/db/schema";
import { assertCsrf, requirePermission } from "@/lib/auth";
import { jsonError } from "@/lib/api";
import { enqueue } from "@/lib/jobs";
import { istDay } from "@/lib/discovery/places";
import { sendDailyPdfReport } from "@/lib/telegram";
import { assertOrigin } from "@/lib/security";

const body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("add_query"), query: z.string().trim().min(5).max(120), category: z.enum(["referral_partner", "corporate"]) }),
  z.object({ action: z.literal("toggle_query"), id: z.string().uuid(), active: z.boolean() }),
  z.object({ action: z.literal("run_now") }),
  z.object({ action: z.literal("add_website"), url: z.string().url().max(500), category: z.enum(["referral_partner", "corporate"]) }),
  z.object({ action: z.literal("report_now") }),
  z.object({ action: z.literal("send_telegram_pdf"), force: z.boolean().optional() }),
  z.object({ action: z.literal("crosscheck"), prospectId: z.string().uuid() }),
]);

export async function POST(request: Request) {
  try {
    assertOrigin(request);
    const user = await requirePermission("research");
    assertCsrf(request, user);
    const data = body.parse(await request.json());
    const stamp = Date.now();
    if (data.action === "add_query") await db.insert(discoveryQueries).values({ query: data.query, category: data.category }).onConflictDoNothing();
    if (data.action === "toggle_query") await db.update(discoveryQueries).set({ active: data.active }).where(eq(discoveryQueries.id, data.id));
    if (data.action === "run_now") await enqueue("discovery.daily", { day: istDay() }, `discovery.manual:${stamp}`);
    if (data.action === "add_website") await enqueue("discovery.website", { url: data.url, category: data.category }, `discovery.website:${new URL(data.url).hostname}:${istDay()}`);
    if (data.action === "crosscheck") await enqueue("verify.crosscheck", { prospectId: data.prospectId }, `verify.crosscheck:manual:${data.prospectId}:${stamp}`);
    if (data.action === "report_now") await enqueue("report.daily", { day: istDay() }, `report.manual:${stamp}`);
    if (data.action === "send_telegram_pdf") {
      const res = await sendDailyPdfReport(istDay(), Boolean(data.force));
      await db.insert(auditEvents).values({ actorId: user.id, action: "discovery.send_telegram_pdf", entityType: "daily_report", entityId: res.day, summary: `PDF (${res.pdfBytes} bytes): ${res.telegramStatus}` });
      return Response.json({ ...res, note: res.sent ? `PDF sent to Telegram (${res.pdfBytes} bytes)` : `PDF generated (${res.pdfBytes} bytes) · ${res.telegramStatus}` });
    }
    await db.insert(auditEvents).values({ actorId: user.id, action: `discovery.${data.action}`, entityType: "discovery", summary: JSON.stringify(data).slice(0, 300) });
    return Response.json({ ok: true, note: ["run_now", "add_website", "report_now", "crosscheck"].includes(data.action) ? "Queued; the scheduled worker will process it." : "Saved" });
  } catch (error) {
    return jsonError(error, "Discovery action failed");
  }
}
