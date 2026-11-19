import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { auditEvents, dailyReports } from "@/db/schema";
import { istDay } from "@/lib/discovery/places";
import { generateDailyPdfReport } from "@/lib/pdf-report";
import { log } from "@/lib/log";

export function telegramConfigured(): boolean {
  return Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID);
}

/**
 * Generates the daily PDF report from real database records and sends it to Telegram
 * at most once per 24-hour day (unless force=true). Never invents data or delivery status.
 */
export async function sendDailyPdfReport(day = istDay(), force = false) {
  const [existing] = await db.select().from(dailyReports).where(eq(dailyReports.day, day)).limit(1);
  if (existing?.telegramSentAt && !force) {
    return {
      ok: true,
      sent: false,
      alreadySent: true,
      day,
      pdfBytes: existing.pdfBytes ?? 0,
      telegramSentAt: existing.telegramSentAt.toISOString(),
      telegramMessageId: existing.telegramMessageId,
      telegramStatus: existing.telegramStatus ?? "already_sent_in_24h",
    };
  }

  const { pdf, summary } = await generateDailyPdfReport(day);
  const pdfBytes = pdf.byteLength;

  if (!telegramConfigured()) {
    const status = "pdf_generated_telegram_unconfigured (set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID)";
    await db.update(dailyReports).set({ pdfBytes, telegramStatus: status }).where(eq(dailyReports.day, day));
    log("warn", "telegram.daily_pdf.unconfigured", { day, pdfBytes });
    return { ok: true, sent: false, alreadySent: false, day, pdfBytes, telegramStatus: status };
  }

  const token = process.env.TELEGRAM_BOT_TOKEN!;
  const chatId = process.env.TELEGRAM_CHAT_ID!;
  const prospectsStat = (summary.prospects ?? {}) as Record<string, number>;
  const queueStat = (summary.callQueue ?? {}) as { ready?: number };
  const ladder = (summary.contactLadder ?? {}) as Record<string, number>;

  const caption = [
    `Aurum Bespoke — Daily Cold Outreach & Discovery PDF (${day})`,
    `Businesses: ${prospectsStat.total ?? 0} total (${prospectsStat.new_discovered ?? 0} new today)`,
    `Contacts: ${ladder.total ?? 0} published (${queueStat.ready ?? 0} callable phones in queue)`,
    `Evidence: ${ladder.human_confirmed ?? 0} human-confirmed, ${ladder.independently_corroborated ?? 0} corroborated, ${ladder.email_domain_mail_enabled ?? 0} MX-enabled emails`,
  ].join("\n");

  const form = new FormData();
  form.set("chat_id", chatId);
  form.set("caption", caption);
  form.set("document", new Blob([new Uint8Array(pdf)], { type: "application/pdf" }), `aurum-outreach-${day}.pdf`);

  const response = await fetch(`https://api.telegram.org/bot${token}/sendDocument`, {
    method: "POST",
    body: form,
    signal: AbortSignal.timeout(25_000),
  });
  const body = (await response.json().catch(() => ({}))) as { ok?: boolean; description?: string; result?: { message_id?: number } };
  if (!response.ok || !body.ok) {
    const err = `Telegram HTTP ${response.status}: ${body.description ?? "sendDocument failed"}`;
    await db.update(dailyReports).set({ pdfBytes, telegramStatus: err }).where(eq(dailyReports.day, day));
    throw new Error(err);
  }

  const messageId = String(body.result?.message_id ?? "");
  const sentAt = new Date();
  await db.update(dailyReports).set({ pdfBytes, telegramSentAt: sentAt, telegramMessageId: messageId, telegramStatus: "sent" }).where(eq(dailyReports.day, day));
  await db.insert(auditEvents).values({ action: "telegram.daily_pdf.sent", entityType: "daily_report", entityId: day, summary: `Sent daily outreach PDF (${pdfBytes} bytes) to Telegram`, metadata: { day, pdfBytes, messageId } });
  log("info", "telegram.daily_pdf.sent", { day, pdfBytes, messageId });
  return { ok: true, sent: true, alreadySent: false, day, pdfBytes, telegramMessageId: messageId, telegramSentAt: sentAt.toISOString(), telegramStatus: "sent" };
}
