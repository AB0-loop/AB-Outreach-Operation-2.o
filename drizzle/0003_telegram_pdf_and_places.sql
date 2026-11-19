CREATE TYPE "aurum_acquisition"."crosscheck_verdict" AS ENUM('match', 'mismatch', 'no_phone_listed', 'place_not_found', 'provider_unavailable');--> statement-breakpoint
CREATE TABLE "aurum_acquisition"."phone_crosschecks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contact_id" uuid NOT NULL,
	"place_reference_id" uuid,
	"source" text DEFAULT 'google_places' NOT NULL,
	"verdict" "aurum_acquisition"."crosscheck_verdict" NOT NULL,
	"detail" text NOT NULL,
	"attribution" text DEFAULT 'Powered by Google' NOT NULL,
	"checked_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "aurum_acquisition"."place_references" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"prospect_id" uuid NOT NULL,
	"place_id" text NOT NULL,
	"place_id_captured_at" timestamp with time zone DEFAULT now() NOT NULL,
	"cached_lat" numeric(9, 6),
	"cached_lng" numeric(9, 6),
	"coordinate_cache_expires_at" timestamp with time zone,
	"attribution" text DEFAULT 'Powered by Google' NOT NULL,
	"last_checked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "aurum_acquisition"."contacts" ADD COLUMN "format_valid" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "aurum_acquisition"."contacts" ADD COLUMN "domain_mail_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "aurum_acquisition"."contacts" ADD COLUMN "source_published" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "aurum_acquisition"."contacts" ADD COLUMN "independently_corroborated" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "aurum_acquisition"."contacts" ADD COLUMN "human_confirmed" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "aurum_acquisition"."daily_reports" ADD COLUMN "pdf_bytes" integer;--> statement-breakpoint
ALTER TABLE "aurum_acquisition"."daily_reports" ADD COLUMN "telegram_sent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "aurum_acquisition"."daily_reports" ADD COLUMN "telegram_message_id" text;--> statement-breakpoint
ALTER TABLE "aurum_acquisition"."daily_reports" ADD COLUMN "telegram_status" text;--> statement-breakpoint
ALTER TABLE "aurum_acquisition"."phone_crosschecks" ADD CONSTRAINT "phone_crosschecks_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "aurum_acquisition"."contacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aurum_acquisition"."phone_crosschecks" ADD CONSTRAINT "phone_crosschecks_place_reference_id_place_references_id_fk" FOREIGN KEY ("place_reference_id") REFERENCES "aurum_acquisition"."place_references"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aurum_acquisition"."place_references" ADD CONSTRAINT "place_references_prospect_id_prospects_id_fk" FOREIGN KEY ("prospect_id") REFERENCES "aurum_acquisition"."prospects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "phone_crosscheck_contact_idx" ON "aurum_acquisition"."phone_crosschecks" USING btree ("contact_id","checked_at");--> statement-breakpoint
CREATE UNIQUE INDEX "place_reference_uq" ON "aurum_acquisition"."place_references" USING btree ("prospect_id","place_id");--> statement-breakpoint
CREATE INDEX "place_cache_expiry_idx" ON "aurum_acquisition"."place_references" USING btree ("coordinate_cache_expires_at");