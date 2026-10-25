import { z } from "zod";
export const draftInput = z.object({ prospectId: z.string().uuid(), contactId: z.string().uuid(), subject: z.string().trim().min(3).max(160).refine(v => !/[\r\n]/.test(v)), bodyText: z.string().trim().min(20).max(10_000), claims: z.array(z.object({ claim: z.string().trim().min(3).max(400), evidenceId: z.string().uuid() })).max(20) });
export function assertEvidenceClaims(claims: Array<{ claim: string; evidenceId: string }>) { if (claims.some(c => !c.evidenceId)) throw new Error("Every factual claim requires evidence"); }
export function renderPartnershipDraft(input: { businessName: string; evidenceSummary: string; senderName: string }) {
  return { subject: `A possible menswear collaboration with ${input.businessName}`, bodyText: `Hello,\n\n${input.evidenceSummary}\n\nAurum Bespoke provides private fittings for suits, tuxedos, bandhgalas and coordinated wedding-party menswear across Bengaluru. If a partnership conversation would be relevant, ${input.senderName} would be glad to speak. If not, no follow-up is needed.\n\nRegards,\n${input.senderName}\nAurum Bespoke` };
}
