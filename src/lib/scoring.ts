import { z } from "zod";

export const RULES_VERSION = "aurum-v1";
export const scoringInput = z.object({
  category: z.enum(["inbound", "referral_partner", "explicit_need", "corporate", "professional_network"]),
  identityEvidence: z.number().int().min(0), roleEvidence: z.number().int().min(0), locationEvidence: z.number().int().min(0), relevanceEvidence: z.number().int().min(0), needEvidence: z.number().int().min(0), independentSources: z.number().int().min(0), freshestEvidenceDays: z.number().int().min(0).nullable(),
  serviceAreaFit: z.number().int().min(0).max(20), relationshipPotential: z.number().int().min(0).max(20), timing: z.number().int().min(0).max(10),
});
export type ScoringInput = z.infer<typeof scoringInput>;
export function scoreProspect(raw: ScoringInput) {
  const i = scoringInput.parse(raw); const reasons: string[] = [];
  let identity = Math.min(100, (i.identityEvidence ? 30 : 0) + (i.roleEvidence ? 20 : 0) + (i.locationEvidence ? 15 : 0) + (i.independentSources >= 2 ? 20 : 0) + (i.freshestEvidenceDays !== null && i.freshestEvidenceDays <= 90 ? 15 : 0));
  const relevance = i.category === "inbound" || i.category === "explicit_need" ? 30 : i.category === "referral_partner" ? 24 : i.category === "corporate" ? 18 : 8;
  const evidence = Math.min(20, i.relevanceEvidence * 10 + i.needEvidence * 15);
  const fit = Math.min(100, relevance + evidence + i.serviceAreaFit + i.relationshipPotential + i.timing);
  if (!i.identityEvidence) reasons.push("identity evidence missing");
  if (!i.relevanceEvidence && !i.needEvidence) reasons.push("commercial relevance is not evidenced");
  if (i.category === "professional_network" && !i.needEvidence) reasons.push("professional title is not purchase intent");
  const decision = fit >= 65 && identity >= 60 && (i.relevanceEvidence > 0 || i.needEvidence > 0) ? "qualified" : fit < 25 ? "reject" : "research";
  return { identityConfidence: identity, commercialFit: fit, decision, reasons, rulesVersion: RULES_VERSION };
}
