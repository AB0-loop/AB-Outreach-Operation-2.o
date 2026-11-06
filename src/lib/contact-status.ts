// Evidence ladder for a contact. Each rung is a distinct, weaker-to-stronger claim; none is shown as a bare "verified".
export type Ladder = { sourcePublished: boolean; formatValid: boolean; domainMailEnabled: boolean | null; independentlyCorroborated: boolean; humanConfirmed: boolean; invalid: boolean; label: string };
export const HUMAN_CONFIRMING_OUTCOMES = ["connected_interested", "meeting_booked", "callback_requested", "not_interested"];
export function contactLadder(contact: { channel: string; value: string; verification: string; corroborated: boolean }, verifications: Array<{ method: string; result: string }>, callOutcomes: string[]): Ladder {
  const has = (m: string, ...r: string[]) => verifications.some(v => v.method === m && r.includes(v.result));
  const invalid = contact.verification === "invalid" || callOutcomes.includes("wrong_number");
  const sourcePublished = has("first_party_publication", "found") || contact.verification === "self_provided" || contact.verification === "published_unverified" || contact.verification === "verified";
  const formatValid = contact.channel === "email" ? /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(contact.value) : has("libphonenumber_IN", "valid");
  const domainMailEnabled = contact.channel === "email" ? has("dns_mx", "pass") : null;
  const independentlyCorroborated = contact.corroborated && !invalid;
  const humanConfirmed = !invalid && callOutcomes.some(o => HUMAN_CONFIRMING_OUTCOMES.includes(o));
  const label = invalid ? "Invalid" : humanConfirmed ? "Human confirmed" : independentlyCorroborated ? "Independently corroborated" : contact.verification === "self_provided" ? "Supplied by enquirer" : domainMailEnabled ? "Source published · domain mail-enabled" : formatValid ? "Source published · format valid" : sourcePublished ? "Source published" : "Unverified";
  return { sourcePublished, formatValid, domainMailEnabled, independentlyCorroborated, humanConfirmed, invalid, label };
}
