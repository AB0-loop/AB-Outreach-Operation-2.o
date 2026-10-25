CREATE SCHEMA "aurum_acquisition";
--> statement-breakpoint
CREATE TYPE "aurum_acquisition"."access_status" AS ENUM('permitted', 'manual_only', 'pending_review', 'prohibited');--> statement-breakpoint
CREATE TYPE "aurum_acquisition"."approval_decision" AS ENUM('approved', 'rejected', 'changes_requested', 'revoked');--> statement-breakpoint
CREATE TYPE "aurum_acquisition"."prospect_category" AS ENUM('inbound', 'referral_partner', 'explicit_need', 'corporate', 'professional_network');--> statement-breakpoint
CREATE TYPE "aurum_acquisition"."consultation_status" AS ENUM('proposed', 'booked', 'completed', 'cancelled', 'no_show');--> statement-breakpoint
CREATE TYPE "aurum_acquisition"."contact_channel" AS ENUM('email', 'phone', 'whatsapp', 'web_form');--> statement-breakpoint
CREATE TYPE "aurum_acquisition"."eligibility_status" AS ENUM('pending', 'eligible', 'ineligible', 'needs_review');--> statement-breakpoint
CREATE TYPE "aurum_acquisition"."entity_type" AS ENUM('prospect', 'message');--> statement-breakpoint
CREATE TYPE "aurum_acquisition"."evidence_type" AS ENUM('identity', 'role', 'location', 'commercial_relevance', 'need', 'timing', 'contact', 'source_policy');--> statement-breakpoint
CREATE TYPE "aurum_acquisition"."interaction_type" AS ENUM('inbound', 'outbound', 'reply', 'note', 'bounce', 'complaint', 'opt_out');--> statement-breakpoint
CREATE TYPE "aurum_acquisition"."job_status" AS ENUM('queued', 'running', 'retry_wait', 'completed', 'dead_letter', 'cancelled');--> statement-breakpoint
CREATE TYPE "aurum_acquisition"."mailbox_status" AS ENUM('connected', 'revoked', 'error');--> statement-breakpoint
CREATE TYPE "aurum_acquisition"."message_status" AS ENUM('draft', 'review', 'approved', 'rejected', 'scheduled', 'sent');--> statement-breakpoint
CREATE TYPE "aurum_acquisition"."order_status" AS ENUM('quoted', 'confirmed', 'in_progress', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "aurum_acquisition"."prospect_stage" AS ENUM('discovered', 'research', 'review', 'qualified', 'contacted', 'responded', 'consultation', 'customer', 'rejected', 'suppressed');--> statement-breakpoint
CREATE TYPE "aurum_acquisition"."reply_class" AS ENUM('interested', 'not_now', 'not_interested', 'opt_out', 'referral', 'bounce', 'unknown');--> statement-breakpoint
CREATE TYPE "aurum_acquisition"."run_status" AS ENUM('queued', 'running', 'completed', 'partial', 'failed');--> statement-breakpoint
CREATE TYPE "aurum_acquisition"."send_status" AS ENUM('dry_run', 'queued', 'sending', 'sent', 'blocked', 'failed');--> statement-breakpoint
CREATE TYPE "aurum_acquisition"."sending_mode" AS ENUM('disabled', 'dry_run', 'live');--> statement-breakpoint
CREATE TYPE "aurum_acquisition"."source_type" AS ENUM('inbound', 'referral', 'first_party_business', 'event', 'association', 'manual');--> statement-breakpoint
CREATE TYPE "aurum_acquisition"."user_role" AS ENUM('owner', 'admin', 'researcher', 'reviewer', 'operator');--> statement-breakpoint
CREATE TYPE "aurum_acquisition"."verification_status" AS ENUM('unverified', 'published_unverified', 'self_provided', 'verified', 'invalid', 'stale');--> statement-breakpoint
CREATE TABLE "aurum_acquisition"."approvals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_type" "aurum_acquisition"."entity_type" NOT NULL,
	"entity_id" uuid NOT NULL,
	"decision" "aurum_acquisition"."approval_decision" NOT NULL,
	"note" text,
	"decided_by" uuid NOT NULL,
	"decided_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "aurum_acquisition"."assessments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"prospect_id" uuid NOT NULL,
	"identity_confidence" integer NOT NULL,
	"commercial_fit" integer NOT NULL,
	"decision" text NOT NULL,
	"reasons" jsonb NOT NULL,
	"evidence_ids" jsonb NOT NULL,
	"rules_version" text NOT NULL,
	"assessed_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "assessments_identity_ck" CHECK ("aurum_acquisition"."assessments"."identity_confidence" between 0 and 100),
	CONSTRAINT "assessments_fit_ck" CHECK ("aurum_acquisition"."assessments"."commercial_fit" between 0 and 100)
);
--> statement-breakpoint
CREATE TABLE "aurum_acquisition"."audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" uuid,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text,
	"summary" text NOT NULL,
	"metadata" jsonb,
	"request_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "aurum_acquisition"."consultations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"prospect_id" uuid NOT NULL,
	"status" "aurum_acquisition"."consultation_status" NOT NULL,
	"scheduled_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"location" text,
	"notes" text,
	"source_attribution" text NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "aurum_acquisition"."contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"prospect_id" uuid NOT NULL,
	"channel" "aurum_acquisition"."contact_channel" NOT NULL,
	"value" text NOT NULL,
	"normalized_value" text NOT NULL,
	"fingerprint" text NOT NULL,
	"evidence_id" uuid,
	"verification" "aurum_acquisition"."verification_status" DEFAULT 'unverified' NOT NULL,
	"verification_method" text,
	"verified_at" timestamp with time zone,
	"stale_after" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "aurum_acquisition"."costs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category" text NOT NULL,
	"description" text NOT NULL,
	"amount_inr" numeric(12, 2) NOT NULL,
	"incurred_at" timestamp with time zone NOT NULL,
	"is_estimate" boolean DEFAULT false NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "costs_amount_ck" CHECK ("aurum_acquisition"."costs"."amount_inr" >= 0)
);
--> statement-breakpoint
CREATE TABLE "aurum_acquisition"."duplicate_candidates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"prospect_low_id" uuid NOT NULL,
	"prospect_high_id" uuid NOT NULL,
	"score" integer NOT NULL,
	"reasons" jsonb NOT NULL,
	"decision" text DEFAULT 'pending' NOT NULL,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "duplicate_order_ck" CHECK ("aurum_acquisition"."duplicate_candidates"."prospect_low_id" < "aurum_acquisition"."duplicate_candidates"."prospect_high_id"),
	CONSTRAINT "duplicate_score_ck" CHECK ("aurum_acquisition"."duplicate_candidates"."score" between 0 and 100)
);
--> statement-breakpoint
CREATE TABLE "aurum_acquisition"."eligibility_checks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"prospect_id" uuid NOT NULL,
	"contact_id" uuid NOT NULL,
	"status" "aurum_acquisition"."eligibility_status" NOT NULL,
	"purpose" text NOT NULL,
	"relationship_basis" text NOT NULL,
	"source_use_allowed" boolean NOT NULL,
	"reasons" jsonb NOT NULL,
	"checked_by" uuid,
	"valid_until" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "aurum_acquisition"."evidence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"prospect_id" uuid NOT NULL,
	"source_id" uuid,
	"type" "aurum_acquisition"."evidence_type" NOT NULL,
	"source_url" text NOT NULL,
	"excerpt" text NOT NULL,
	"summary" text NOT NULL,
	"content_hash" text NOT NULL,
	"confidence" integer NOT NULL,
	"supports_commercial_relevance" boolean DEFAULT false NOT NULL,
	"discovered_at" timestamp with time zone DEFAULT now() NOT NULL,
	"verified_at" timestamp with time zone DEFAULT now() NOT NULL,
	"stale_after" timestamp with time zone NOT NULL,
	"created_by" uuid,
	CONSTRAINT "evidence_confidence_ck" CHECK ("aurum_acquisition"."evidence"."confidence" between 0 and 100)
);
--> statement-breakpoint
CREATE TABLE "aurum_acquisition"."interactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"prospect_id" uuid NOT NULL,
	"type" "aurum_acquisition"."interaction_type" NOT NULL,
	"channel" "aurum_acquisition"."contact_channel",
	"classification" "aurum_acquisition"."reply_class",
	"subject" text,
	"body" text NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"recorded_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "aurum_acquisition"."jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"status" "aurum_acquisition"."job_status" DEFAULT 'queued' NOT NULL,
	"idempotency_key" text NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 3 NOT NULL,
	"run_after" timestamp with time zone DEFAULT now() NOT NULL,
	"locked_at" timestamp with time zone,
	"locked_by" text,
	"last_error" text,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "jobs_attempts_ck" CHECK ("aurum_acquisition"."jobs"."attempts" >= 0 and "aurum_acquisition"."jobs"."max_attempts" between 1 and 10)
);
--> statement-breakpoint
CREATE TABLE "aurum_acquisition"."mailboxes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"provider" text DEFAULT 'gmail' NOT NULL,
	"status" "aurum_acquisition"."mailbox_status" NOT NULL,
	"scopes" jsonb NOT NULL,
	"encrypted_refresh_token" text NOT NULL,
	"key_version" text NOT NULL,
	"connected_by" uuid,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "aurum_acquisition"."message_drafts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"prospect_id" uuid NOT NULL,
	"contact_id" uuid NOT NULL,
	"subject" text NOT NULL,
	"body_text" text NOT NULL,
	"claim_evidence" jsonb NOT NULL,
	"status" "aurum_acquisition"."message_status" DEFAULT 'draft' NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "aurum_acquisition"."oauth_states" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"state_hash" text NOT NULL,
	"user_id" uuid NOT NULL,
	"encrypted_verifier" text NOT NULL,
	"redirect_uri" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "aurum_acquisition"."orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"prospect_id" uuid NOT NULL,
	"consultation_id" uuid,
	"status" "aurum_acquisition"."order_status" NOT NULL,
	"description" text NOT NULL,
	"quoted_inr" numeric(12, 2) DEFAULT '0' NOT NULL,
	"revenue_inr" numeric(12, 2) DEFAULT '0' NOT NULL,
	"ordered_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "orders_amounts_ck" CHECK ("aurum_acquisition"."orders"."quoted_inr" >= 0 and "aurum_acquisition"."orders"."revenue_inr" >= 0)
);
--> statement-breakpoint
CREATE TABLE "aurum_acquisition"."prospects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"display_name" text NOT NULL,
	"organisation" text,
	"role" text,
	"city" text,
	"category" "aurum_acquisition"."prospect_category" NOT NULL,
	"stage" "aurum_acquisition"."prospect_stage" DEFAULT 'discovered' NOT NULL,
	"identity_confidence" integer DEFAULT 0 NOT NULL,
	"commercial_fit" integer DEFAULT 0 NOT NULL,
	"assigned_to" uuid,
	"last_verified_at" timestamp with time zone,
	"is_test" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "prospects_identity_score_ck" CHECK ("aurum_acquisition"."prospects"."identity_confidence" between 0 and 100),
	CONSTRAINT "prospects_fit_score_ck" CHECK ("aurum_acquisition"."prospects"."commercial_fit" between 0 and 100)
);
--> statement-breakpoint
CREATE TABLE "aurum_acquisition"."rate_limits" (
	"key_hash" text NOT NULL,
	"action" text NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"count" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "rate_limits_count_ck" CHECK ("aurum_acquisition"."rate_limits"."count" >= 0)
);
--> statement-breakpoint
CREATE TABLE "aurum_acquisition"."send_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"message_id" uuid NOT NULL,
	"contact_id" uuid NOT NULL,
	"mailbox_id" uuid,
	"idempotency_key" text NOT NULL,
	"status" "aurum_acquisition"."send_status" NOT NULL,
	"provider_message_id" text,
	"blockers" jsonb,
	"error" text,
	"attempted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "aurum_acquisition"."sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"csrf_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "aurum_acquisition"."settings" (
	"key" text PRIMARY KEY DEFAULT 'global' NOT NULL,
	"mode" "aurum_acquisition"."sending_mode" DEFAULT 'disabled' NOT NULL,
	"kill_switch" boolean DEFAULT true NOT NULL,
	"global_daily_cap" integer DEFAULT 5 NOT NULL,
	"mailbox_daily_cap" integer DEFAULT 5 NOT NULL,
	"ai_monthly_budget_usd" numeric(10, 2) DEFAULT '0' NOT NULL,
	"updated_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "settings_global_cap_ck" CHECK ("aurum_acquisition"."settings"."global_daily_cap" between 0 and 100),
	CONSTRAINT "settings_mailbox_cap_ck" CHECK ("aurum_acquisition"."settings"."mailbox_daily_cap" between 0 and 100)
);
--> statement-breakpoint
CREATE TABLE "aurum_acquisition"."source_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" uuid NOT NULL,
	"status" "aurum_acquisition"."run_status" DEFAULT 'queued' NOT NULL,
	"discovered" integer DEFAULT 0 NOT NULL,
	"parsed" integer DEFAULT 0 NOT NULL,
	"unique_records" integer DEFAULT 0 NOT NULL,
	"retained" integer DEFAULT 0 NOT NULL,
	"rejected" integer DEFAULT 0 NOT NULL,
	"detail" jsonb,
	"error" text,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "aurum_acquisition"."sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"type" "aurum_acquisition"."source_type" NOT NULL,
	"base_url" text,
	"access" "aurum_acquisition"."access_status" DEFAULT 'pending_review' NOT NULL,
	"access_basis" text NOT NULL,
	"purpose" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"check_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "aurum_acquisition"."suppressions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"prospect_id" uuid,
	"contact_fingerprint" text,
	"channel" "aurum_acquisition"."contact_channel",
	"reason" text NOT NULL,
	"source" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"lifted_at" timestamp with time zone,
	"lifted_by" uuid
);
--> statement-breakpoint
CREATE TABLE "aurum_acquisition"."users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"display_name" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" "aurum_acquisition"."user_role" NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "aurum_acquisition"."approvals" ADD CONSTRAINT "approvals_decided_by_users_id_fk" FOREIGN KEY ("decided_by") REFERENCES "aurum_acquisition"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aurum_acquisition"."assessments" ADD CONSTRAINT "assessments_prospect_id_prospects_id_fk" FOREIGN KEY ("prospect_id") REFERENCES "aurum_acquisition"."prospects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aurum_acquisition"."assessments" ADD CONSTRAINT "assessments_assessed_by_users_id_fk" FOREIGN KEY ("assessed_by") REFERENCES "aurum_acquisition"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aurum_acquisition"."audit_events" ADD CONSTRAINT "audit_events_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "aurum_acquisition"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aurum_acquisition"."consultations" ADD CONSTRAINT "consultations_prospect_id_prospects_id_fk" FOREIGN KEY ("prospect_id") REFERENCES "aurum_acquisition"."prospects"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aurum_acquisition"."consultations" ADD CONSTRAINT "consultations_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "aurum_acquisition"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aurum_acquisition"."contacts" ADD CONSTRAINT "contacts_prospect_id_prospects_id_fk" FOREIGN KEY ("prospect_id") REFERENCES "aurum_acquisition"."prospects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aurum_acquisition"."contacts" ADD CONSTRAINT "contacts_evidence_id_evidence_id_fk" FOREIGN KEY ("evidence_id") REFERENCES "aurum_acquisition"."evidence"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aurum_acquisition"."costs" ADD CONSTRAINT "costs_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "aurum_acquisition"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aurum_acquisition"."duplicate_candidates" ADD CONSTRAINT "duplicate_candidates_prospect_low_id_prospects_id_fk" FOREIGN KEY ("prospect_low_id") REFERENCES "aurum_acquisition"."prospects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aurum_acquisition"."duplicate_candidates" ADD CONSTRAINT "duplicate_candidates_prospect_high_id_prospects_id_fk" FOREIGN KEY ("prospect_high_id") REFERENCES "aurum_acquisition"."prospects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aurum_acquisition"."duplicate_candidates" ADD CONSTRAINT "duplicate_candidates_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "aurum_acquisition"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aurum_acquisition"."eligibility_checks" ADD CONSTRAINT "eligibility_checks_prospect_id_prospects_id_fk" FOREIGN KEY ("prospect_id") REFERENCES "aurum_acquisition"."prospects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aurum_acquisition"."eligibility_checks" ADD CONSTRAINT "eligibility_checks_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "aurum_acquisition"."contacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aurum_acquisition"."eligibility_checks" ADD CONSTRAINT "eligibility_checks_checked_by_users_id_fk" FOREIGN KEY ("checked_by") REFERENCES "aurum_acquisition"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aurum_acquisition"."evidence" ADD CONSTRAINT "evidence_prospect_id_prospects_id_fk" FOREIGN KEY ("prospect_id") REFERENCES "aurum_acquisition"."prospects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aurum_acquisition"."evidence" ADD CONSTRAINT "evidence_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "aurum_acquisition"."sources"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aurum_acquisition"."evidence" ADD CONSTRAINT "evidence_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "aurum_acquisition"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aurum_acquisition"."interactions" ADD CONSTRAINT "interactions_prospect_id_prospects_id_fk" FOREIGN KEY ("prospect_id") REFERENCES "aurum_acquisition"."prospects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aurum_acquisition"."interactions" ADD CONSTRAINT "interactions_recorded_by_users_id_fk" FOREIGN KEY ("recorded_by") REFERENCES "aurum_acquisition"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aurum_acquisition"."mailboxes" ADD CONSTRAINT "mailboxes_connected_by_users_id_fk" FOREIGN KEY ("connected_by") REFERENCES "aurum_acquisition"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aurum_acquisition"."message_drafts" ADD CONSTRAINT "message_drafts_prospect_id_prospects_id_fk" FOREIGN KEY ("prospect_id") REFERENCES "aurum_acquisition"."prospects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aurum_acquisition"."message_drafts" ADD CONSTRAINT "message_drafts_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "aurum_acquisition"."contacts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aurum_acquisition"."message_drafts" ADD CONSTRAINT "message_drafts_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "aurum_acquisition"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aurum_acquisition"."oauth_states" ADD CONSTRAINT "oauth_states_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "aurum_acquisition"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aurum_acquisition"."orders" ADD CONSTRAINT "orders_prospect_id_prospects_id_fk" FOREIGN KEY ("prospect_id") REFERENCES "aurum_acquisition"."prospects"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aurum_acquisition"."orders" ADD CONSTRAINT "orders_consultation_id_consultations_id_fk" FOREIGN KEY ("consultation_id") REFERENCES "aurum_acquisition"."consultations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aurum_acquisition"."orders" ADD CONSTRAINT "orders_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "aurum_acquisition"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aurum_acquisition"."prospects" ADD CONSTRAINT "prospects_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "aurum_acquisition"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aurum_acquisition"."send_attempts" ADD CONSTRAINT "send_attempts_message_id_message_drafts_id_fk" FOREIGN KEY ("message_id") REFERENCES "aurum_acquisition"."message_drafts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aurum_acquisition"."send_attempts" ADD CONSTRAINT "send_attempts_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "aurum_acquisition"."contacts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aurum_acquisition"."send_attempts" ADD CONSTRAINT "send_attempts_mailbox_id_mailboxes_id_fk" FOREIGN KEY ("mailbox_id") REFERENCES "aurum_acquisition"."mailboxes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aurum_acquisition"."sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "aurum_acquisition"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aurum_acquisition"."settings" ADD CONSTRAINT "settings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "aurum_acquisition"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aurum_acquisition"."source_runs" ADD CONSTRAINT "source_runs_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "aurum_acquisition"."sources"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aurum_acquisition"."suppressions" ADD CONSTRAINT "suppressions_prospect_id_prospects_id_fk" FOREIGN KEY ("prospect_id") REFERENCES "aurum_acquisition"."prospects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aurum_acquisition"."suppressions" ADD CONSTRAINT "suppressions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "aurum_acquisition"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aurum_acquisition"."suppressions" ADD CONSTRAINT "suppressions_lifted_by_users_id_fk" FOREIGN KEY ("lifted_by") REFERENCES "aurum_acquisition"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "approvals_entity_idx" ON "aurum_acquisition"."approvals" USING btree ("entity_type","entity_id","decided_at");--> statement-breakpoint
CREATE INDEX "assessments_prospect_idx" ON "aurum_acquisition"."assessments" USING btree ("prospect_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_entity_idx" ON "aurum_acquisition"."audit_events" USING btree ("entity_type","entity_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_actor_idx" ON "aurum_acquisition"."audit_events" USING btree ("actor_id","created_at");--> statement-breakpoint
CREATE INDEX "consultations_status_time_idx" ON "aurum_acquisition"."consultations" USING btree ("status","scheduled_at");--> statement-breakpoint
CREATE UNIQUE INDEX "contacts_prospect_fingerprint_uq" ON "aurum_acquisition"."contacts" USING btree ("prospect_id","fingerprint");--> statement-breakpoint
CREATE INDEX "contacts_fingerprint_idx" ON "aurum_acquisition"."contacts" USING btree ("fingerprint");--> statement-breakpoint
CREATE UNIQUE INDEX "duplicate_pair_uq" ON "aurum_acquisition"."duplicate_candidates" USING btree ("prospect_low_id","prospect_high_id");--> statement-breakpoint
CREATE INDEX "eligibility_contact_created_idx" ON "aurum_acquisition"."eligibility_checks" USING btree ("contact_id","created_at");--> statement-breakpoint
CREATE INDEX "eligibility_expiry_idx" ON "aurum_acquisition"."eligibility_checks" USING btree ("valid_until");--> statement-breakpoint
CREATE UNIQUE INDEX "evidence_prospect_hash_uq" ON "aurum_acquisition"."evidence" USING btree ("prospect_id","content_hash");--> statement-breakpoint
CREATE INDEX "evidence_stale_idx" ON "aurum_acquisition"."evidence" USING btree ("stale_after");--> statement-breakpoint
CREATE INDEX "interactions_prospect_time_idx" ON "aurum_acquisition"."interactions" USING btree ("prospect_id","occurred_at");--> statement-breakpoint
CREATE UNIQUE INDEX "jobs_idempotency_uq" ON "aurum_acquisition"."jobs" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "jobs_claim_idx" ON "aurum_acquisition"."jobs" USING btree ("status","run_after");--> statement-breakpoint
CREATE UNIQUE INDEX "mailboxes_email_uq" ON "aurum_acquisition"."mailboxes" USING btree ("email");--> statement-breakpoint
CREATE INDEX "message_status_idx" ON "aurum_acquisition"."message_drafts" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "oauth_state_uq" ON "aurum_acquisition"."oauth_states" USING btree ("state_hash");--> statement-breakpoint
CREATE INDEX "orders_status_idx" ON "aurum_acquisition"."orders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "prospects_stage_idx" ON "aurum_acquisition"."prospects" USING btree ("stage");--> statement-breakpoint
CREATE INDEX "prospects_org_idx" ON "aurum_acquisition"."prospects" USING btree ("organisation");--> statement-breakpoint
CREATE UNIQUE INDEX "rate_limits_key_action_uq" ON "aurum_acquisition"."rate_limits" USING btree ("key_hash","action");--> statement-breakpoint
CREATE UNIQUE INDEX "send_idempotency_uq" ON "aurum_acquisition"."send_attempts" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "send_message_idx" ON "aurum_acquisition"."send_attempts" USING btree ("message_id","attempted_at");--> statement-breakpoint
CREATE UNIQUE INDEX "sessions_token_uq" ON "aurum_acquisition"."sessions" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "sessions_expiry_idx" ON "aurum_acquisition"."sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "source_runs_source_created_idx" ON "aurum_acquisition"."source_runs" USING btree ("source_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "sources_name_uq" ON "aurum_acquisition"."sources" USING btree ("name");--> statement-breakpoint
CREATE INDEX "suppressions_prospect_active_idx" ON "aurum_acquisition"."suppressions" USING btree ("prospect_id","active");--> statement-breakpoint
CREATE INDEX "suppressions_fingerprint_active_idx" ON "aurum_acquisition"."suppressions" USING btree ("contact_fingerprint","active");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_uq" ON "aurum_acquisition"."users" USING btree ("email");