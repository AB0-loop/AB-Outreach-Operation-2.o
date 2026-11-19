import "server-only";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { contacts, evidence, prospects } from "@/db/schema";
import { getCallQueue } from "@/lib/call-queue";
import { buildDailyReport } from "@/lib/report";

function pdfClean(text: string): string {
  return text
    .replace(/₹/g, "INR ")
    .replace(/[•·]/g, "-")
    .replace(/[—–]/g, "-")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[^\x20-\x7E]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function pdfEscape(text: string): string {
  return pdfClean(text).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function wrapLine(text: string, maxChars = 92): string[] {
  const clean = pdfClean(text);
  if (clean.length <= maxChars) return [clean];
  const words = clean.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    if (!current) current = word;
    else if (current.length + 1 + word.length <= maxChars) current += ` ${word}`;
    else {
      lines.push(current);
      current = word.slice(0, maxChars);
    }
  }
  if (current) lines.push(current);
  return lines;
}

type PdfLine = { text: string; bold?: boolean; size?: number; indent?: number; gapBefore?: number };

export function renderLinesToPdf(lines: PdfLine[]): Buffer {
  const pageWidth = 595;
  const pageHeight = 842;
  const marginX = 42;
  const topY = 796;
  const bottomY = 48;

  const pages: string[][] = [];
  let cmds: string[] = [];
  let y = topY;

  const flushPage = () => {
    if (cmds.length) pages.push(cmds);
    cmds = [];
    y = topY;
  };

  for (const item of lines) {
    const size = item.size ?? 9.5;
    const leading = size + 4;
    const gap = item.gapBefore ?? 0;
    const wrapped = wrapLine(item.text, size >= 13 ? 68 : size >= 11 ? 82 : 95);
    for (let i = 0; i < wrapped.length; i++) {
      const need = (i === 0 ? gap : 0) + leading;
      if (y - need < bottomY) flushPage();
      if (i === 0 && gap) y -= gap;
      const font = item.bold ? "/F2" : "/F1";
      const x = marginX + (item.indent ?? 0);
      cmds.push(`BT ${font} ${size} Tf ${x} ${y.toFixed(1)} Td (${pdfEscape(wrapped[i])}) Tj ET`);
      y -= leading;
    }
  }
  flushPage();
  if (!pages.length) pages.push(["BT /F1 10 Tf 42 790 Td (Empty report) Tj ET"]);

  // Object layout:
  // 1: Catalog, 2: Pages, 3: Font F1 (Helvetica), 4: Font F2 (Helvetica-Bold)
  // 5..: pairs of (Page, ContentStream)
  const objects: string[] = [];
  const pageIds: number[] = [];

  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";
  objects[4] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>";

  let nextId = 5;
  pages.forEach((pageCmds, idx) => {
    const pageId = nextId++;
    const contentId = nextId++;
    pageIds.push(pageId);
    const footer = `BT /F1 8 Tf 42 28 Td (Aurum Bespoke Outreach Intelligence - Page ${idx + 1} of ${pages.length} - Zero fabricated data) Tj ET`;
    const streamBody = [...pageCmds, footer].join("\n");
    objects[contentId] = `<< /Length ${Buffer.byteLength(streamBody, "utf8")} >>\nstream\n${streamBody}\nendstream`;
    objects[pageId] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentId} 0 R >>`;
  });

  objects[2] = `<< /Type /Pages /Kids [${pageIds.map(id => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`;

  let out = "%PDF-1.4\n";
  const offsets: number[] = [0];
  for (let id = 1; id < objects.length; id++) {
    offsets[id] = Buffer.byteLength(out, "utf8");
    out += `${id} 0 obj\n${objects[id]}\nendobj\n`;
  }
  const xrefStart = Buffer.byteLength(out, "utf8");
  out += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let id = 1; id < objects.length; id++) {
    out += `${String(offsets[id]).padStart(10, "0")} 00000 n \n`;
  }
  out += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;
  return Buffer.from(out, "utf8");
}

export async function generateDailyPdfReport(day: string): Promise<{ pdf: Buffer; summary: Record<string, unknown> }> {
  const summary = await buildDailyReport(day);
  const queue = await getCallQueue(40);
  const prospectRows = await db.select().from(prospects).where(eq(prospects.isTest, false)).orderBy(sql`${prospects.commercialFit} desc, ${prospects.displayName} asc`).limit(60);
  const allContacts = await db.select().from(contacts);
  const allEvidence = await db.select().from(evidence);

  const ladder = (summary.contactLadder ?? {}) as Record<string, number>;
  const prospectsStat = (summary.prospects ?? {}) as Record<string, number>;
  const reviewStat = (summary.contactsForReview ?? {}) as { count?: number };

  const lines: PdfLine[] = [
    { text: "AURUM BESPOKE — DAILY COLD OUTREACH & CLIENT DISCOVERY BRIEF", bold: true, size: 14 },
    { text: `Report Day (IST): ${day}   |   Generated: ${new Date().toISOString()}   |   Market: Bengaluru, India`, size: 9, gapBefore: 2 },
    { text: "Data Policy: 100% live first-party business website extraction. Zero synthetic or AI-fabricated records.", size: 8.5 },
    { text: "-------------------------------------------------------------------------------------------------------------", size: 9, gapBefore: 4 },
    { text: "1. 24-HOUR SUMMARY & CONTACT VERIFICATION LADDER", bold: true, size: 11, gapBefore: 6 },
    { text: `Active Businesses in Database: ${prospectsStat.total ?? prospectRows.length}   |   Newly Discovered Today: ${prospectsStat.new_discovered ?? 0}   |   Verified Today: ${prospectsStat.verified_today ?? 0}`, size: 9.5, gapBefore: 3 },
    { text: `Total Published Contacts: ${ladder.total ?? allContacts.length}   |   New Contacts for Review (24h): ${reviewStat.count ?? 0}   |   Callable Numbers in Queue: ${queue.length}`, size: 9.5 },
    { text: `Evidence Ladder: Human Confirmed: ${ladder.human_confirmed ?? 0} | Independently Corroborated: ${ladder.independently_corroborated ?? 0} | Email Domain MX-Enabled: ${ladder.email_domain_mail_enabled ?? 0} | Invalid: ${ladder.invalid ?? 0}`, size: 9 },
    { text: "2. PRIORITISED HUMAN COLD-CALLING QUEUE (BUSINESS LINES & INBOUND ONLY)", bold: true, size: 11, gapBefore: 10 },
    { text: "Disclosure: Identify as Aurum Bespoke Bengaluru, state number was found on their public website, honour DNC immediately.", size: 8.5 },
  ];

  if (!queue.length) {
    lines.push({ text: "No callable business phone numbers currently in queue.", size: 9.5, gapBefore: 4 });
  } else {
    queue.forEach((row, idx) => {
      lines.push({
        text: `#${idx + 1} [Priority ${row.priority}] ${row.displayName} (${row.category.replaceAll("_", " ")}) — ${row.value} [${row.kind.replaceAll("_", " ")}]`,
        bold: true,
        size: 9.5,
        gapBefore: 4,
      });
      lines.push({
        text: `Evidence: ${row.status} | Fit: ${row.commercialFit}/100 | Identity: ${row.identityConfidence}/100 | Website: ${row.website ?? "n/a"}`,
        size: 8.5,
        indent: 12,
      });
    });
  }

  lines.push({ text: "3. DISCOVERED BENGALURU CLIENT & PARTNER DIRECTORY (FIRST-PARTY EVIDENCE)", bold: true, size: 11, gapBefore: 12 });
  prospectRows.forEach((p, idx) => {
    const pContacts = allContacts.filter(c => c.prospectId === p.id && c.verification !== "invalid");
    const phones = pContacts.filter(c => c.channel === "phone" || c.channel === "whatsapp").map(c => c.value).join(", ") || "none";
    const emails = pContacts.filter(c => c.channel === "email").map(c => `${c.value}${c.domainMailEnabled ? " [MX OK]" : ""}`).join(", ") || "none";
    const relEvidence = allEvidence.find(e => e.prospectId === p.id && e.supportsCommercialRelevance) ?? allEvidence.find(e => e.prospectId === p.id);
    lines.push({
      text: `${idx + 1}. ${p.displayName} [${p.category.replaceAll("_", " ")}] — Fit ${p.commercialFit}/100, Identity ${p.identityConfidence}/100, Stage: ${p.partnerStage}`,
      bold: true,
      size: 9.5,
      gapBefore: 5,
    });
    lines.push({ text: `Website: ${p.website ?? "n/a"} | Phones: ${phones} | Emails: ${emails}`, size: 8.5, indent: 10 });
    if (relEvidence) {
      lines.push({ text: `Source Excerpt (${relEvidence.origin}): "${relEvidence.excerpt.slice(0, 180)}"`, size: 8, indent: 10 });
    }
  });

  const pdf = renderLinesToPdf(lines);
  return { pdf, summary };
}
