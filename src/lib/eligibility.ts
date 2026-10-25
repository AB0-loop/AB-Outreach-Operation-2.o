import { z } from "zod";

export const eligibilityInput = z.object({
  contactVerification: z.enum(["unverified", "published_unverified", "self_provided", "verified", "invalid", "stale"]),
  sourceUseAllowed: z.boolean(), suppressionMatch: z.boolean(), relationshipBasis: z.enum(["inbound_request", "consent", "existing_relationship", "referral", "none"]), legalReviewComplete: z.boolean(),
});
export type EligibilityInput = z.infer<typeof eligibilityInput>;
export function evaluateEligibility(raw: EligibilityInput) {
  const i = eligibilityInput.parse(raw); const reasons: string[] = [];
  if (i.suppressionMatch) return { status: "ineligible" as const, reasons: ["active suppression applies"] };
  if (i.contactVerification === "invalid") return { status: "ineligible" as const, reasons: ["contact is invalid"] };
  if (!i.sourceUseAllowed) return { status: "ineligible" as const, reasons: ["source use is not permitted"] };
  if (["unverified", "published_unverified", "stale"].includes(i.contactVerification)) reasons.push("contact is not current and verified");
  if (i.relationshipBasis === "none") reasons.push("no inbound, consent, referral or relationship basis recorded");
  if (!i.legalReviewComplete) reasons.push("channel policy review incomplete");
  return reasons.length ? { status: "needs_review" as const, reasons } : { status: "eligible" as const, reasons: ["supported relationship basis and current contact"] };
}
