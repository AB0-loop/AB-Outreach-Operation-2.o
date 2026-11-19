export type ContactChecks = {
  channel: string;
  formatValid: boolean;
  domainMailEnabled: boolean;
  sourcePublished: boolean;
  independentlyCorroborated: boolean;
  humanConfirmed: boolean;
};

export const EVIDENCE_LABELS = {
  human_confirmed: "Human confirmed",
  independently_corroborated: "Independently corroborated",
  domain_mail_enabled: "Domain mail-enabled",
  source_published: "Source published",
  format_valid: "Format valid",
  unchecked: "Unchecked",
} as const;
export type EvidenceLevel = keyof typeof EVIDENCE_LABELS;

/** Strongest single claim the evidence actually supports. Never the word "verified" alone. */
export function evidenceLevel(c: ContactChecks): EvidenceLevel {
  if (c.humanConfirmed) return "human_confirmed";
  if (c.independentlyCorroborated) return "independently_corroborated";
  if (c.channel === "email" && c.domainMailEnabled) return "domain_mail_enabled";
  if (c.sourcePublished) return "source_published";
  if (c.formatValid) return "format_valid";
  return "unchecked";
}

export function evidenceBreakdown(c: ContactChecks) {
  const rows: Array<{ key: string; label: string; passed: boolean; meaning: string }> = [
    { key: "format_valid", label: EVIDENCE_LABELS.format_valid, passed: c.formatValid, meaning: "Parsed as a well-formed address or E.164 number" },
    { key: "source_published", label: EVIDENCE_LABELS.source_published, passed: c.sourcePublished, meaning: "Published on the business's own website, source URL stored" },
  ];
  if (c.channel === "email") rows.push({ key: "domain_mail_enabled", label: EVIDENCE_LABELS.domain_mail_enabled, passed: c.domainMailEnabled, meaning: "Domain publishes MX records — does not prove this mailbox exists" });
  rows.push(
    { key: "independently_corroborated", label: EVIDENCE_LABELS.independently_corroborated, passed: c.independentlyCorroborated, meaning: "A second independent source agreed" },
    { key: "human_confirmed", label: EVIDENCE_LABELS.human_confirmed, passed: c.humanConfirmed, meaning: "A person confirmed it reaches the business" },
  );
  return rows;
}

/** Only a human-confirmed or corroborated contact may be treated as reliable for outreach. */
export function isReliableForContact(c: ContactChecks) {
  return c.humanConfirmed || (c.independentlyCorroborated && c.sourcePublished);
}
