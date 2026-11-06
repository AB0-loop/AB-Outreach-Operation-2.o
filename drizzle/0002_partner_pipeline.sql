CREATE TYPE "aurum_acquisition"."evidence_origin" AS ENUM('automated_extraction', 'human_entry');--> statement-breakpoint
CREATE TYPE "aurum_acquisition"."partner_stage" AS ENUM('not_started', 'contacted', 'meeting_scheduled', 'meeting_held', 'agreed', 'active', 'paused', 'declined');--> statement-breakpoint
ALTER TABLE "aurum_acquisition"."eligibility_checks" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "aurum_acquisition"."mailboxes" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "aurum_acquisition"."message_drafts" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "aurum_acquisition"."oauth_states" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "aurum_acquisition"."send_attempts" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "aurum_acquisition"."settings" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "aurum_acquisition"."eligibility_checks" CASCADE;--> statement-breakpoint
DROP TABLE "aurum_acquisition"."mailboxes" CASCADE;--> statement-breakpoint
DROP TABLE "aurum_acquisition"."message_drafts" CASCADE;--> statement-breakpoint
DROP TABLE "aurum_acquisition"."oauth_states" CASCADE;--> statement-breakpoint
DROP TABLE "aurum_acquisition"."send_attempts" CASCADE;--> statement-breakpoint
DROP TABLE "aurum_acquisition"."settings" CASCADE;--> statement-breakpoint
ALTER TABLE "aurum_acquisition"."orders" DROP CONSTRAINT "orders_amounts_ck";--> statement-breakpoint
ALTER TABLE "aurum_acquisition"."call_logs" ADD COLUMN "duration_minutes" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "aurum_acquisition"."call_logs" ADD COLUMN "follow_up_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "aurum_acquisition"."consultations" ADD COLUMN "referred_by_partner_id" uuid;--> statement-breakpoint
ALTER TABLE "aurum_acquisition"."evidence" ADD COLUMN "origin" "aurum_acquisition"."evidence_origin" DEFAULT 'automated_extraction' NOT NULL;--> statement-breakpoint
ALTER TABLE "aurum_acquisition"."orders" ADD COLUMN "cost_inr" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "aurum_acquisition"."orders" ADD COLUMN "referred_by_partner_id" uuid;--> statement-breakpoint
ALTER TABLE "aurum_acquisition"."prospects" ADD COLUMN "partner_stage" "aurum_acquisition"."partner_stage" DEFAULT 'not_started' NOT NULL;--> statement-breakpoint
ALTER TABLE "aurum_acquisition"."prospects" ADD COLUMN "partner_stage_updated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "aurum_acquisition"."prospects" ADD COLUMN "next_follow_up_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "aurum_acquisition"."consultations" ADD CONSTRAINT "consultations_referred_by_partner_id_prospects_id_fk" FOREIGN KEY ("referred_by_partner_id") REFERENCES "aurum_acquisition"."prospects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aurum_acquisition"."orders" ADD CONSTRAINT "orders_referred_by_partner_id_prospects_id_fk" FOREIGN KEY ("referred_by_partner_id") REFERENCES "aurum_acquisition"."prospects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "orders_partner_idx" ON "aurum_acquisition"."orders" USING btree ("referred_by_partner_id");--> statement-breakpoint
ALTER TABLE "aurum_acquisition"."call_logs" ADD CONSTRAINT "call_logs_duration_ck" CHECK ("aurum_acquisition"."call_logs"."duration_minutes" between 0 and 600);--> statement-breakpoint
ALTER TABLE "aurum_acquisition"."orders" ADD CONSTRAINT "orders_amounts_ck" CHECK ("aurum_acquisition"."orders"."quoted_inr" >= 0 and "aurum_acquisition"."orders"."revenue_inr" >= 0 and coalesce("aurum_acquisition"."orders"."cost_inr", 0) >= 0);--> statement-breakpoint
DROP TYPE "aurum_acquisition"."eligibility_status";--> statement-breakpoint
DROP TYPE "aurum_acquisition"."mailbox_status";--> statement-breakpoint
DROP TYPE "aurum_acquisition"."message_status";--> statement-breakpoint
DROP TYPE "aurum_acquisition"."send_status";--> statement-breakpoint
DROP TYPE "aurum_acquisition"."sending_mode";