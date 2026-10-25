import { sql } from "drizzle-orm";
import { boolean, check, index, integer, jsonb, numeric, pgSchema, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

export const acquisition = pgSchema("aurum_acquisition");

export const userRole = acquisition.enum("user_role", ["owner", "admin", "researcher", "reviewer", "operator"]);
export const sourceType = acquisition.enum("source_type", ["inbound", "referral", "first_party_business", "event", "association", "manual"]);
export const accessStatus = acquisition.enum("access_status", ["permitted", "manual_only", "pending_review", "prohibited"]);
export const runStatus = acquisition.enum("run_status", ["queued", "running", "completed", "partial", "failed"]);
export const jobStatus = acquisition.enum("job_status", ["queued", "running", "retry_wait", "completed", "dead_letter", "cancelled"]);
export const category = acquisition.enum("prospect_category", ["inbound", "referral_partner", "explicit_need", "corporate", "professional_network"]);
export const prospectStage = acquisition.enum("prospect_stage", ["discovered", "research", "review", "qualified", "contacted", "responded", "consultation", "customer", "rejected", "suppressed"]);
export const evidenceType = acquisition.enum("evidence_type", ["identity", "role", "location", "commercial_relevance", "need", "timing", "contact", "source_policy"]);
export const contactChannel = acquisition.enum("contact_channel", ["email", "phone", "whatsapp", "web_form"]);
export const verificationStatus = acquisition.enum("verification_status", ["unverified", "published_unverified", "self_provided", "verified", "invalid", "stale"]);
export const eligibilityStatus = acquisition.enum("eligibility_status", ["pending", "eligible", "ineligible", "needs_review"]);
export const approvalDecision = acquisition.enum("approval_decision", ["approved", "rejected", "changes_requested", "revoked"]);
export const entityType = acquisition.enum("entity_type", ["prospect", "message"]);
export const messageStatus = acquisition.enum("message_status", ["draft", "review", "approved", "rejected", "scheduled", "sent"]);
export const sendStatus = acquisition.enum("send_status", ["dry_run", "queued", "sending", "sent", "blocked", "failed"]);
export const sendingMode = acquisition.enum("sending_mode", ["disabled", "dry_run", "live"]);
export const mailboxStatus = acquisition.enum("mailbox_status", ["connected", "revoked", "error"]);
export const interactionType = acquisition.enum("interaction_type", ["inbound", "outbound", "reply", "note", "bounce", "complaint", "opt_out"]);
export const replyClass = acquisition.enum("reply_class", ["interested", "not_now", "not_interested", "opt_out", "referral", "bounce", "unknown"]);
export const consultationStatus = acquisition.enum("consultation_status", ["proposed", "booked", "completed", "cancelled", "no_show"]);
export const orderStatus = acquisition.enum("order_status", ["quoted", "confirmed", "in_progress", "completed", "cancelled"]);

export const users = acquisition.table("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull(),
  displayName: text("display_name").notNull(),
  passwordHash: text("password_hash").notNull(),
  role: userRole("role").notNull(),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [uniqueIndex("users_email_uq").on(t.email)]);

export const sessions = acquisition.table("sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull(),
  csrfHash: text("csrf_hash").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [uniqueIndex("sessions_token_uq").on(t.tokenHash), index("sessions_expiry_idx").on(t.expiresAt)]);

export const rateLimits = acquisition.table("rate_limits", {
  keyHash: text("key_hash").notNull(),
  action: text("action").notNull(),
  windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  count: integer("count").notNull().default(1),
}, t => [uniqueIndex("rate_limits_key_action_uq").on(t.keyHash, t.action), check("rate_limits_count_ck", sql`${t.count} >= 0`)]);

export const settings = acquisition.table("settings", {
  key: text("key").primaryKey().default("global"),
  mode: sendingMode("mode").notNull().default("disabled"),
  killSwitch: boolean("kill_switch").notNull().default(true),
  globalDailyCap: integer("global_daily_cap").notNull().default(5),
  mailboxDailyCap: integer("mailbox_daily_cap").notNull().default(5),
  aiMonthlyBudgetUsd: numeric("ai_monthly_budget_usd", { precision: 10, scale: 2 }).notNull().default("0"),
  updatedBy: uuid("updated_by").references(() => users.id, { onDelete: "set null" }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [check("settings_global_cap_ck", sql`${t.globalDailyCap} between 0 and 100`), check("settings_mailbox_cap_ck", sql`${t.mailboxDailyCap} between 0 and 100`)]);

export const sources = acquisition.table("sources", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  type: sourceType("type").notNull(),
  baseUrl: text("base_url"),
  access: accessStatus("access").notNull().default("pending_review"),
  accessBasis: text("access_basis").notNull(),
  purpose: text("purpose").notNull(),
  active: boolean("active").notNull().default(true),
  checkUrl: text("check_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [uniqueIndex("sources_name_uq").on(t.name)]);

export const sourceRuns = acquisition.table("source_runs", {
  id: uuid("id").defaultRandom().primaryKey(),
  sourceId: uuid("source_id").notNull().references(() => sources.id, { onDelete: "restrict" }),
  status: runStatus("status").notNull().default("queued"),
  discovered: integer("discovered").notNull().default(0),
  parsed: integer("parsed").notNull().default(0),
  uniqueRecords: integer("unique_records").notNull().default(0),
  retained: integer("retained").notNull().default(0),
  rejected: integer("rejected").notNull().default(0),
  detail: jsonb("detail").$type<Record<string, unknown>>(),
  error: text("error"),
  startedAt: timestamp("started_at", { withTimezone: true }),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [index("source_runs_source_created_idx").on(t.sourceId, t.createdAt)]);

export const jobs = acquisition.table("jobs", {
  id: uuid("id").defaultRandom().primaryKey(),
  type: text("type").notNull(),
  payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
  status: jobStatus("status").notNull().default("queued"),
  idempotencyKey: text("idempotency_key").notNull(),
  attempts: integer("attempts").notNull().default(0),
  maxAttempts: integer("max_attempts").notNull().default(3),
  runAfter: timestamp("run_after", { withTimezone: true }).notNull().defaultNow(),
  lockedAt: timestamp("locked_at", { withTimezone: true }),
  lockedBy: text("locked_by"),
  lastError: text("last_error"),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [uniqueIndex("jobs_idempotency_uq").on(t.idempotencyKey), index("jobs_claim_idx").on(t.status, t.runAfter), check("jobs_attempts_ck", sql`${t.attempts} >= 0 and ${t.maxAttempts} between 1 and 10`)]);

export const prospects = acquisition.table("prospects", {
  id: uuid("id").defaultRandom().primaryKey(),
  displayName: text("display_name").notNull(),
  organisation: text("organisation"),
  role: text("role"),
  city: text("city"),
  category: category("category").notNull(),
  stage: prospectStage("stage").notNull().default("discovered"),
  identityConfidence: integer("identity_confidence").notNull().default(0),
  commercialFit: integer("commercial_fit").notNull().default(0),
  assignedTo: uuid("assigned_to").references(() => users.id, { onDelete: "set null" }),
  lastVerifiedAt: timestamp("last_verified_at", { withTimezone: true }),
  isTest: boolean("is_test").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [index("prospects_stage_idx").on(t.stage), index("prospects_org_idx").on(t.organisation), check("prospects_identity_score_ck", sql`${t.identityConfidence} between 0 and 100`), check("prospects_fit_score_ck", sql`${t.commercialFit} between 0 and 100`)]);

export const evidence = acquisition.table("evidence", {
  id: uuid("id").defaultRandom().primaryKey(),
  prospectId: uuid("prospect_id").notNull().references(() => prospects.id, { onDelete: "cascade" }),
  sourceId: uuid("source_id").references(() => sources.id, { onDelete: "set null" }),
  type: evidenceType("type").notNull(),
  sourceUrl: text("source_url").notNull(),
  excerpt: text("excerpt").notNull(),
  summary: text("summary").notNull(),
  contentHash: text("content_hash").notNull(),
  confidence: integer("confidence").notNull(),
  supportsCommercialRelevance: boolean("supports_commercial_relevance").notNull().default(false),
  discoveredAt: timestamp("discovered_at", { withTimezone: true }).notNull().defaultNow(),
  verifiedAt: timestamp("verified_at", { withTimezone: true }).notNull().defaultNow(),
  staleAfter: timestamp("stale_after", { withTimezone: true }).notNull(),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
}, t => [uniqueIndex("evidence_prospect_hash_uq").on(t.prospectId, t.contentHash), index("evidence_stale_idx").on(t.staleAfter), check("evidence_confidence_ck", sql`${t.confidence} between 0 and 100`)]);

export const contacts = acquisition.table("contacts", {
  id: uuid("id").defaultRandom().primaryKey(),
  prospectId: uuid("prospect_id").notNull().references(() => prospects.id, { onDelete: "cascade" }),
  channel: contactChannel("channel").notNull(),
  value: text("value").notNull(),
  normalizedValue: text("normalized_value").notNull(),
  fingerprint: text("fingerprint").notNull(),
  evidenceId: uuid("evidence_id").references(() => evidence.id, { onDelete: "set null" }),
  verification: verificationStatus("verification").notNull().default("unverified"),
  verificationMethod: text("verification_method"),
  verifiedAt: timestamp("verified_at", { withTimezone: true }),
  staleAfter: timestamp("stale_after", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [uniqueIndex("contacts_prospect_fingerprint_uq").on(t.prospectId, t.fingerprint), index("contacts_fingerprint_idx").on(t.fingerprint)]);

export const duplicateCandidates = acquisition.table("duplicate_candidates", {
  id: uuid("id").defaultRandom().primaryKey(),
  prospectLowId: uuid("prospect_low_id").notNull().references(() => prospects.id, { onDelete: "cascade" }),
  prospectHighId: uuid("prospect_high_id").notNull().references(() => prospects.id, { onDelete: "cascade" }),
  score: integer("score").notNull(),
  reasons: jsonb("reasons").$type<string[]>().notNull(),
  decision: text("decision").notNull().default("pending"),
  reviewedBy: uuid("reviewed_by").references(() => users.id, { onDelete: "set null" }),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [uniqueIndex("duplicate_pair_uq").on(t.prospectLowId, t.prospectHighId), check("duplicate_order_ck", sql`${t.prospectLowId} < ${t.prospectHighId}`), check("duplicate_score_ck", sql`${t.score} between 0 and 100`)]);

export const assessments = acquisition.table("assessments", {
  id: uuid("id").defaultRandom().primaryKey(),
  prospectId: uuid("prospect_id").notNull().references(() => prospects.id, { onDelete: "cascade" }),
  identityConfidence: integer("identity_confidence").notNull(),
  commercialFit: integer("commercial_fit").notNull(),
  decision: text("decision").notNull(),
  reasons: jsonb("reasons").$type<string[]>().notNull(),
  evidenceIds: jsonb("evidence_ids").$type<string[]>().notNull(),
  rulesVersion: text("rules_version").notNull(),
  assessedBy: uuid("assessed_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [index("assessments_prospect_idx").on(t.prospectId, t.createdAt), check("assessments_identity_ck", sql`${t.identityConfidence} between 0 and 100`), check("assessments_fit_ck", sql`${t.commercialFit} between 0 and 100`)]);

export const eligibilityChecks = acquisition.table("eligibility_checks", {
  id: uuid("id").defaultRandom().primaryKey(),
  prospectId: uuid("prospect_id").notNull().references(() => prospects.id, { onDelete: "cascade" }),
  contactId: uuid("contact_id").notNull().references(() => contacts.id, { onDelete: "cascade" }),
  status: eligibilityStatus("status").notNull(),
  purpose: text("purpose").notNull(),
  relationshipBasis: text("relationship_basis").notNull(),
  sourceUseAllowed: boolean("source_use_allowed").notNull(),
  reasons: jsonb("reasons").$type<string[]>().notNull(),
  checkedBy: uuid("checked_by").references(() => users.id, { onDelete: "set null" }),
  validUntil: timestamp("valid_until", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [index("eligibility_contact_created_idx").on(t.contactId, t.createdAt), index("eligibility_expiry_idx").on(t.validUntil)]);

export const suppressions = acquisition.table("suppressions", {
  id: uuid("id").defaultRandom().primaryKey(),
  prospectId: uuid("prospect_id").references(() => prospects.id, { onDelete: "set null" }),
  contactFingerprint: text("contact_fingerprint"),
  channel: contactChannel("channel"),
  reason: text("reason").notNull(),
  source: text("source").notNull(),
  active: boolean("active").notNull().default(true),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  liftedAt: timestamp("lifted_at", { withTimezone: true }),
  liftedBy: uuid("lifted_by").references(() => users.id, { onDelete: "set null" }),
}, t => [index("suppressions_prospect_active_idx").on(t.prospectId, t.active), index("suppressions_fingerprint_active_idx").on(t.contactFingerprint, t.active)]);

export const messageDrafts = acquisition.table("message_drafts", {
  id: uuid("id").defaultRandom().primaryKey(),
  prospectId: uuid("prospect_id").notNull().references(() => prospects.id, { onDelete: "cascade" }),
  contactId: uuid("contact_id").notNull().references(() => contacts.id, { onDelete: "restrict" }),
  subject: text("subject").notNull(),
  bodyText: text("body_text").notNull(),
  claimEvidence: jsonb("claim_evidence").$type<Array<{ claim: string; evidenceId: string }>>().notNull(),
  status: messageStatus("status").notNull().default("draft"),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [index("message_status_idx").on(t.status)]);

export const approvals = acquisition.table("approvals", {
  id: uuid("id").defaultRandom().primaryKey(),
  entityType: entityType("entity_type").notNull(),
  entityId: uuid("entity_id").notNull(),
  decision: approvalDecision("decision").notNull(),
  note: text("note"),
  decidedBy: uuid("decided_by").notNull().references(() => users.id, { onDelete: "restrict" }),
  decidedAt: timestamp("decided_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [index("approvals_entity_idx").on(t.entityType, t.entityId, t.decidedAt)]);

export const mailboxes = acquisition.table("mailboxes", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull(),
  provider: text("provider").notNull().default("gmail"),
  status: mailboxStatus("status").notNull(),
  scopes: jsonb("scopes").$type<string[]>().notNull(),
  encryptedRefreshToken: text("encrypted_refresh_token").notNull(),
  keyVersion: text("key_version").notNull(),
  connectedBy: uuid("connected_by").references(() => users.id, { onDelete: "set null" }),
  lastError: text("last_error"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [uniqueIndex("mailboxes_email_uq").on(t.email)]);

export const oauthStates = acquisition.table("oauth_states", {
  id: uuid("id").defaultRandom().primaryKey(),
  stateHash: text("state_hash").notNull(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  encryptedVerifier: text("encrypted_verifier").notNull(),
  redirectUri: text("redirect_uri").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  consumedAt: timestamp("consumed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [uniqueIndex("oauth_state_uq").on(t.stateHash)]);

export const sendAttempts = acquisition.table("send_attempts", {
  id: uuid("id").defaultRandom().primaryKey(),
  messageId: uuid("message_id").notNull().references(() => messageDrafts.id, { onDelete: "restrict" }),
  contactId: uuid("contact_id").notNull().references(() => contacts.id, { onDelete: "restrict" }),
  mailboxId: uuid("mailbox_id").references(() => mailboxes.id, { onDelete: "set null" }),
  idempotencyKey: text("idempotency_key").notNull(),
  status: sendStatus("status").notNull(),
  providerMessageId: text("provider_message_id"),
  blockers: jsonb("blockers").$type<string[]>(),
  error: text("error"),
  attemptedAt: timestamp("attempted_at", { withTimezone: true }).notNull().defaultNow(),
  sentAt: timestamp("sent_at", { withTimezone: true }),
}, t => [uniqueIndex("send_idempotency_uq").on(t.idempotencyKey), index("send_message_idx").on(t.messageId, t.attemptedAt)]);

export const interactions = acquisition.table("interactions", {
  id: uuid("id").defaultRandom().primaryKey(),
  prospectId: uuid("prospect_id").notNull().references(() => prospects.id, { onDelete: "cascade" }),
  type: interactionType("type").notNull(),
  channel: contactChannel("channel"),
  classification: replyClass("classification"),
  subject: text("subject"),
  body: text("body").notNull(),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
  recordedBy: uuid("recorded_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [index("interactions_prospect_time_idx").on(t.prospectId, t.occurredAt)]);

export const consultations = acquisition.table("consultations", {
  id: uuid("id").defaultRandom().primaryKey(),
  prospectId: uuid("prospect_id").notNull().references(() => prospects.id, { onDelete: "restrict" }),
  status: consultationStatus("status").notNull(),
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  location: text("location"),
  notes: text("notes"),
  sourceAttribution: text("source_attribution").notNull(),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [index("consultations_status_time_idx").on(t.status, t.scheduledAt)]);

export const orders = acquisition.table("orders", {
  id: uuid("id").defaultRandom().primaryKey(),
  prospectId: uuid("prospect_id").notNull().references(() => prospects.id, { onDelete: "restrict" }),
  consultationId: uuid("consultation_id").references(() => consultations.id, { onDelete: "set null" }),
  status: orderStatus("status").notNull(),
  description: text("description").notNull(),
  quotedInr: numeric("quoted_inr", { precision: 12, scale: 2 }).notNull().default("0"),
  revenueInr: numeric("revenue_inr", { precision: 12, scale: 2 }).notNull().default("0"),
  orderedAt: timestamp("ordered_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [index("orders_status_idx").on(t.status), check("orders_amounts_ck", sql`${t.quotedInr} >= 0 and ${t.revenueInr} >= 0`)]);

export const costs = acquisition.table("costs", {
  id: uuid("id").defaultRandom().primaryKey(),
  category: text("category").notNull(),
  description: text("description").notNull(),
  amountInr: numeric("amount_inr", { precision: 12, scale: 2 }).notNull(),
  incurredAt: timestamp("incurred_at", { withTimezone: true }).notNull(),
  isEstimate: boolean("is_estimate").notNull().default(false),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [check("costs_amount_ck", sql`${t.amountInr} >= 0`)]);

export const auditEvents = acquisition.table("audit_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id"),
  summary: text("summary").notNull(),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  requestId: text("request_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [index("audit_entity_idx").on(t.entityType, t.entityId, t.createdAt), index("audit_actor_idx").on(t.actorId, t.createdAt)]);
