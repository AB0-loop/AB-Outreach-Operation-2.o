CREATE TABLE "aurum_acquisition"."call_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"prospect_id" uuid NOT NULL,
	"contact_id" uuid NOT NULL,
	"outcome" text NOT NULL,
	"dnd_checked" boolean NOT NULL,
	"notes" text,
	"called_by" uuid NOT NULL,
	"called_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "call_logs_dnd_ck" CHECK ("aurum_acquisition"."call_logs"."dnd_checked" = true)
);
--> statement-breakpoint
CREATE TABLE "aurum_acquisition"."contact_verifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contact_id" uuid NOT NULL,
	"method" text NOT NULL,
	"result" text NOT NULL,
	"detail" jsonb,
	"checked_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "aurum_acquisition"."daily_reports" (
	"day" text PRIMARY KEY NOT NULL,
	"summary" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "aurum_acquisition"."discovery_queries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"query" text NOT NULL,
	"category" "aurum_acquisition"."prospect_category" NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"last_run_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "aurum_acquisition"."provider_usage" (
	"provider" text NOT NULL,
	"day" text NOT NULL,
	"calls" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "provider_usage_calls_ck" CHECK ("aurum_acquisition"."provider_usage"."calls" >= 0)
);
--> statement-breakpoint
ALTER TABLE "aurum_acquisition"."contacts" ADD COLUMN "kind" text DEFAULT 'unknown' NOT NULL;--> statement-breakpoint
ALTER TABLE "aurum_acquisition"."contacts" ADD COLUMN "corroborated" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "aurum_acquisition"."prospects" ADD COLUMN "external_key" text;--> statement-breakpoint
ALTER TABLE "aurum_acquisition"."prospects" ADD COLUMN "website" text;--> statement-breakpoint
ALTER TABLE "aurum_acquisition"."call_logs" ADD CONSTRAINT "call_logs_prospect_id_prospects_id_fk" FOREIGN KEY ("prospect_id") REFERENCES "aurum_acquisition"."prospects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aurum_acquisition"."call_logs" ADD CONSTRAINT "call_logs_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "aurum_acquisition"."contacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aurum_acquisition"."call_logs" ADD CONSTRAINT "call_logs_called_by_users_id_fk" FOREIGN KEY ("called_by") REFERENCES "aurum_acquisition"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aurum_acquisition"."contact_verifications" ADD CONSTRAINT "contact_verifications_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "aurum_acquisition"."contacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "call_logs_contact_idx" ON "aurum_acquisition"."call_logs" USING btree ("contact_id","called_at");--> statement-breakpoint
CREATE INDEX "contact_verifications_contact_idx" ON "aurum_acquisition"."contact_verifications" USING btree ("contact_id","checked_at");--> statement-breakpoint
CREATE UNIQUE INDEX "discovery_query_uq" ON "aurum_acquisition"."discovery_queries" USING btree ("query");--> statement-breakpoint
CREATE UNIQUE INDEX "provider_usage_day_uq" ON "aurum_acquisition"."provider_usage" USING btree ("provider","day");--> statement-breakpoint
CREATE UNIQUE INDEX "prospects_external_key_uq" ON "aurum_acquisition"."prospects" USING btree ("external_key");