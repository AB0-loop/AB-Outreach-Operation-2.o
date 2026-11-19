export type PartnerAggregate = {
  callsAttempted: number;
  callsAnswered: number;
  meetingsHeld: number;
  introduced: number;
  consulted: number;
  ordered: number;
  lost: number;
  revenueInr: number;
  daysSinceTouch: number | null;
};

/**
 * Minimum closed referrals before a composite score is statistically meaningful.
 * Below this the UI shows raw counts only.
 */
export const SCORE_MIN_CLOSED_REFERRALS = 5;

export type PartnerEvaluation =
  | { ranked: false; reason: string; closed: number; needed: number; conversion: number | null; facts: string[] }
  | { ranked: true; score: number; tier: "proven" | "promising"; conversion: number; facts: string[] };

export function evaluatePartner(a: PartnerAggregate): PartnerEvaluation {
  const closed = a.ordered + a.lost;
  const conversion = closed > 0 ? a.ordered / closed : null;
  const facts: string[] = [];
  if (a.callsAttempted) facts.push(`${a.callsAnswered}/${a.callsAttempted} calls answered`);
  if (a.meetingsHeld) facts.push(`${a.meetingsHeld} meeting(s) held`);
  if (a.introduced) facts.push(`${a.introduced} referral(s) received`);
  if (a.ordered) facts.push(`${a.ordered} order(s), ₹${a.revenueInr.toLocaleString("en-IN")}`);
  if (a.lost) facts.push(`${a.lost} lost`);
  if (a.daysSinceTouch !== null && a.daysSinceTouch > 90) facts.push(`no contact for ${a.daysSinceTouch} days`);
  if (!facts.length) facts.push("no recorded activity yet");

  if (closed < SCORE_MIN_CLOSED_REFERRALS) {
    return { ranked: false, reason: `Not enough closed referrals to score (${closed}/${SCORE_MIN_CLOSED_REFERRALS})`, closed, needed: SCORE_MIN_CLOSED_REFERRALS - closed, conversion, facts };
  }

  let score = Math.round((conversion as number) * 55);
  score += Math.min(25, a.ordered * 5);
  score += Math.min(20, Math.round(a.revenueInr / 100_000) * 4);
  if (a.daysSinceTouch !== null && a.daysSinceTouch > 90) score -= 15;
  return { ranked: true, score: Math.max(0, Math.min(100, score)), tier: (conversion as number) >= 0.4 ? "proven" : "promising", conversion: conversion as number, facts };
}
