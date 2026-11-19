import "dotenv/config";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { scoreProspect } from "@/lib/scoring";
import { evaluatePartner, SCORE_MIN_CLOSED_REFERRALS } from "@/lib/partners";
import { evidenceLevel, isReliableForContact } from "@/lib/evidence-level";
import { renderLinesToPdf } from "@/lib/pdf-report";

function sourceFiles(dir: string, acc: string[] = []) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) sourceFiles(path, acc);
    else if (/\.(ts|tsx)$/.test(path) && !path.includes(".test.")) acc.push(path);
  }
  return acc;
}

describe("no-fabrication, partner threshold, evidence ladder, and 24h PDF/Telegram", () => {
  it("ships no fake-data generator or synthetic prospect fixtures in src/", () => {
    const offenders: string[] = [];
    for (const file of sourceFiles("src")) {
      const body = readFileSync(file, "utf8");
      if (/\bfaker\b|@faker-js|\bchance\.|\bcasual\b/i.test(body)) offenders.push(`${file}: fake-data library`);
      if (/lorem ipsum/i.test(body)) offenders.push(`${file}: lorem placeholder`);
      if (/Math\.random\(\)\s*\*\s*\d/.test(body)) offenders.push(`${file}: randomised numeric value`);
      if (/demoProspects|sampleProspects|mockProspects|dummyData|seedFakeData/.test(body)) offenders.push(`${file}: synthetic fixture`);
    }
    expect(offenders).toEqual([]);
  });

  it("returns zero rather than inventing a score when there is no evidence", () => {
    const empty = scoreProspect({
      category: "professional_network",
      identityEvidence: 0,
      roleEvidence: 0,
      locationEvidence: 0,
      relevanceEvidence: 0,
      needEvidence: 0,
      independentSources: 0,
      freshestEvidenceDays: null,
      serviceAreaFit: 0,
      relationshipPotential: 0,
      timing: 0,
    });
    expect(empty.identityConfidence).toBe(0);
    expect(empty.decision).toBe("reject");
  });

  const agg = (o: Partial<Parameters<typeof evaluatePartner>[0]> = {}) => ({
    callsAttempted: 0,
    callsAnswered: 0,
    meetingsHeld: 0,
    introduced: 0,
    consulted: 0,
    ordered: 0,
    lost: 0,
    revenueInr: 0,
    daysSinceTouch: null,
    ...o,
  });

  it("refuses to publish a partner score before 5 closed referrals exist", () => {
    expect(SCORE_MIN_CLOSED_REFERRALS).toBeGreaterThanOrEqual(5);
    const none = evaluatePartner(agg());
    expect(none.ranked).toBe(false);
    const oneOrderOneLoss = evaluatePartner(agg({ introduced: 2, ordered: 1, lost: 1, revenueInr: 185_000 }));
    expect(oneOrderOneLoss.ranked).toBe(false);
    const enough = evaluatePartner(agg({ introduced: 6, ordered: 3, lost: 3, revenueInr: 400_000, daysSinceTouch: 5 }));
    expect(enough.ranked).toBe(true);
  });

  it("never treats an MX record alone as reliable or human-confirmed", () => {
    const base = { channel: "email", formatValid: true, domainMailEnabled: false, sourcePublished: false, independentlyCorroborated: false, humanConfirmed: false };
    expect(evidenceLevel(base)).toBe("format_valid");
    expect(evidenceLevel({ ...base, sourcePublished: true })).toBe("source_published");
    expect(evidenceLevel({ ...base, sourcePublished: true, domainMailEnabled: true })).toBe("domain_mail_enabled");
    expect(isReliableForContact({ ...base, sourcePublished: true, domainMailEnabled: true })).toBe(false);
    expect(isReliableForContact({ ...base, sourcePublished: true, independentlyCorroborated: true })).toBe(true);
  });

  it("renders a valid PDF-1.4 document with xref and EOF markers", () => {
    const buf = renderLinesToPdf([
      { text: "AURUM BESPOKE — DAILY COLD OUTREACH BRIEF", bold: true, size: 14 },
      { text: "Zero fabricated records", size: 10 },
    ]);
    const text = buf.toString("utf8");
    expect(text.startsWith("%PDF-1.4\n")).toBe(true);
    expect(text.endsWith("%%EOF\n")).toBe(true);
    expect(text).toContain("AURUM BESPOKE");
  });

  it("sends the daily PDF to Telegram once per 24h and blocks duplicate sends on the same day", async () => {
    const { sendDailyPdfReport } = await import("@/lib/telegram");
    const { db } = await import("@/db");
    const { dailyReports } = await import("@/db/schema");
    const { eq } = await import("drizzle-orm");
    const testDay = "2099-12-31";
    await db.delete(dailyReports).where(eq(dailyReports.day, testDay));

    process.env.TELEGRAM_BOT_TOKEN = "test-bot-token";
    process.env.TELEGRAM_CHAT_ID = "123456";
    const fetchSpy = vi.fn(async () => new Response(JSON.stringify({ ok: true, result: { message_id: 9001 } }), { status: 200 }));
    vi.stubGlobal("fetch", fetchSpy);

    try {
      const first = await sendDailyPdfReport(testDay, false);
      expect(first.sent).toBe(true);
      expect(first.pdfBytes).toBeGreaterThan(500);
      expect(fetchSpy).toHaveBeenCalledTimes(1);

      const second = await sendDailyPdfReport(testDay, false);
      expect(second.sent).toBe(false);
      expect(second.alreadySent).toBe(true);
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    } finally {
      vi.unstubAllGlobals();
      delete process.env.TELEGRAM_BOT_TOKEN;
      delete process.env.TELEGRAM_CHAT_ID;
      await db.delete(dailyReports).where(eq(dailyReports.day, testDay));
    }
  });
});
