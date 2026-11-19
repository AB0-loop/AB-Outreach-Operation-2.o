import { requireUser } from "@/lib/auth";
import { jsonError } from "@/lib/api";
import { istDay } from "@/lib/discovery/places";
import { generateDailyPdfReport } from "@/lib/pdf-report";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await requireUser();
    const url = new URL(request.url);
    const day = url.searchParams.get("day") || istDay();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new Error("Invalid day format (expected YYYY-MM-DD)");
    const { pdf } = await generateDailyPdfReport(day);
    return new Response(new Uint8Array(pdf), {
      status: 200,
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `attachment; filename="aurum-outreach-${day}.pdf"`,
        "content-length": String(pdf.byteLength),
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    return jsonError(error, "PDF report generation failed");
  }
}
