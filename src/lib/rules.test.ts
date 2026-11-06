import { describe, expect, it } from "vitest";
import { scoreProspect } from "@/lib/scoring";
import { canonicalPair, duplicateScore, normalizeContact } from "@/lib/normalization";
import { contactLadder } from "@/lib/contact-status";

describe("deterministic rules", () => {
  it("never treats a professional title as demand", () => { const r = scoreProspect({ category: "professional_network", identityEvidence: 1, roleEvidence: 1, locationEvidence: 1, relevanceEvidence: 0, needEvidence: 0, independentSources: 1, freshestEvidenceDays: 2, serviceAreaFit: 20, relationshipPotential: 5, timing: 0 }); expect(r.decision).toBe("research"); });
  it("canonicalizes duplicate pairs and exact contact wins", () => { expect(canonicalPair("a", "b")).toEqual(["a", "b"]); expect(duplicateScore({ name: "One", fingerprints: ["x"] }, { name: "Two", fingerprints: ["x"] }).score).toBe(100); });
  it("normalizes email without guessing", () => expect(normalizeContact("email", " A@Example.COM ")).toBe("a@example.com"));
});

describe("contact evidence ladder", () => {
  const phone = { channel: "phone", value: "+918041234567", verification: "published_unverified", corroborated: false };
  const found = [{ method: "first_party_publication", result: "found" }, { method: "libphonenumber_IN", result: "valid" }];
  it("a published, well-formed number is only 'format valid', never verified", () => { const l = contactLadder(phone, found, []); expect(l.label).toBe("Source published · format valid"); expect(l.independentlyCorroborated).toBe(false); expect(l.humanConfirmed).toBe(false); });
  it("an MX record means domain mail-enabled, not mailbox proven", () => { const l = contactLadder({ channel: "email", value: "info@x.in", verification: "published_unverified", corroborated: false }, [{ method: "first_party_publication", result: "found" }, { method: "dns_mx", result: "pass" }], []); expect(l.domainMailEnabled).toBe(true); expect(l.label).toBe("Source published · domain mail-enabled"); });
  it("corroboration requires the two-source flag", () => expect(contactLadder({ ...phone, corroborated: true }, found, []).label).toBe("Independently corroborated"));
  it("only an answered call makes it human confirmed", () => { expect(contactLadder(phone, found, ["no_answer"]).humanConfirmed).toBe(false); expect(contactLadder(phone, found, ["callback_requested"]).label).toBe("Human confirmed"); });
  it("a wrong-number report overrides every positive rung", () => { const l = contactLadder({ ...phone, corroborated: true }, found, ["connected_interested", "wrong_number"]); expect(l.invalid).toBe(true); expect(l.humanConfirmed).toBe(false); expect(l.label).toBe("Invalid"); });
});
