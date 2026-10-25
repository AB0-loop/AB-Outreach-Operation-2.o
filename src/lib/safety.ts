export type SendGate = {
  environmentEnabled: boolean; mode: "disabled" | "dry_run" | "live"; killSwitch: boolean;
  prospectApproved: boolean; messageApproved: boolean; exactContactEligible: boolean; eligibilityExpired: boolean;
  prospectSuppressed: boolean; contactSuppressed: boolean; contactVerified: boolean;
  sentToday: number; dailyCap: number; alreadySent: boolean; mailboxConnected: boolean;
};
export function sendBlockers(i: SendGate) {
  const b: string[] = [];
  if (!i.environmentEnabled) b.push("live environment permission is disabled");
  if (i.mode !== "live") b.push(`workspace mode is ${i.mode}`);
  if (i.killSwitch) b.push("global kill switch is active");
  if (!i.prospectApproved) b.push("prospect approval missing");
  if (!i.messageApproved) b.push("message approval missing");
  if (!i.exactContactEligible) b.push("selected contact is not eligible");
  if (i.eligibilityExpired) b.push("eligibility has expired");
  if (i.prospectSuppressed) b.push("prospect suppression applies");
  if (i.contactSuppressed) b.push("global contact suppression applies");
  if (!i.contactVerified) b.push("selected contact is not verified");
  if (!i.mailboxConnected) b.push("mailbox is not connected");
  if (i.sentToday >= i.dailyCap) b.push("daily cap reached");
  if (i.alreadySent) b.push("message was already sent");
  return b;
}
export function validateDryRun(input: { renderedTo: string; subject: string; body: string; blockers: string[] }) {
  return { providerInvoked: false as const, status: "dry_run" as const, preview: input, checkedAt: new Date().toISOString() };
}
