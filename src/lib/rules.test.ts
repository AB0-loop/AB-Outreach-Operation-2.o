import { describe, expect, it } from "vitest";
import { scoreProspect } from "@/lib/scoring";
import { evaluateEligibility } from "@/lib/eligibility";
import { canonicalPair, duplicateScore, normalizeContact } from "@/lib/normalization";
import { sendBlockers, validateDryRun } from "@/lib/safety";
import { assertEvidenceClaims } from "@/lib/message";
describe("deterministic acquisition rules",()=>{
 it("never treats a professional title as demand",()=>{const r=scoreProspect({category:"professional_network",identityEvidence:1,roleEvidence:1,locationEvidence:1,relevanceEvidence:0,needEvidence:0,independentSources:1,freshestEvidenceDays:2,serviceAreaFit:20,relationshipPotential:5,timing:0});expect(r.decision).toBe("research");expect(r.reasons.join(' ')).toMatch(/not purchase intent/)});
 it("qualifies evidence-backed inbound without granting eligibility",()=>{const r=scoreProspect({category:"inbound",identityEvidence:1,roleEvidence:0,locationEvidence:1,relevanceEvidence:1,needEvidence:1,independentSources:1,freshestEvidenceDays:0,serviceAreaFit:20,relationshipPotential:15,timing:10});expect(r.decision).toBe("qualified");expect(r).not.toHaveProperty('eligibility')});
 it("suppression always makes contact ineligible",()=>expect(evaluateEligibility({contactVerification:"verified",sourceUseAllowed:true,suppressionMatch:true,relationshipBasis:"consent",legalReviewComplete:true}).status).toBe("ineligible"));
 it("published business route still needs review",()=>expect(evaluateEligibility({contactVerification:"published_unverified",sourceUseAllowed:true,suppressionMatch:false,relationshipBasis:"none",legalReviewComplete:true}).status).toBe("needs_review"));
 it("canonicalizes duplicate pairs and exact contact wins",()=>{expect(canonicalPair('a','b')).toEqual(['a','b']);expect(duplicateScore({name:'One',fingerprints:['x']},{name:'Two',fingerprints:['x']}).score).toBe(100)});
 it("normalizes email without guessing",()=>expect(normalizeContact('email',' A@Example.COM ')).toBe('a@example.com'));
 it("dry run cannot invoke provider",()=>expect(validateDryRun({renderedTo:'test@example.com',subject:'Test',body:'Body',blockers:[]}).providerInvoked).toBe(false));
 it("live gate checks contact suppression and expiry",()=>{const b=sendBlockers({environmentEnabled:true,mode:'live',killSwitch:false,prospectApproved:true,messageApproved:true,exactContactEligible:true,eligibilityExpired:true,prospectSuppressed:false,contactSuppressed:true,contactVerified:true,sentToday:0,dailyCap:5,alreadySent:false,mailboxConnected:true});expect(b).toContain('eligibility has expired');expect(b).toContain('global contact suppression applies')});
 it("requires evidence ids for claims",()=>expect(()=>assertEvidenceClaims([{claim:'Fact',evidenceId:''}])).toThrow());
});
