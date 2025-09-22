CREATE TYPE "public"."analytics_event_type" AS ENUM('ad_submission', 'ad_approval', 'ad_rejection', 'payment_success', 'payment_failure', 'email_sent', 'profile_selection');--> statement-breakpoint
CREATE TABLE "admin_analytics" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_type" "analytics_event_type" NOT NULL,
	"user_id" varchar(255),
	"session_id" varchar(100),
	"page_path" varchar(200),
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "daily_admin_stats" (
	"id" serial PRIMARY KEY NOT NULL,
	"date" timestamp NOT NULL,
	"ad_submissions" integer DEFAULT 0 NOT NULL,
	"ad_approvals" integer DEFAULT 0 NOT NULL,
	"payment_success_rate" numeric(5, 2) DEFAULT '0.00' NOT NULL,
	"unique_email_senders" integer DEFAULT 0 NOT NULL,
	"unique_email_recipients" integer DEFAULT 0 NOT NULL,
	"duration_2weeks" integer DEFAULT 0 NOT NULL,
	"duration_3weeks" integer DEFAULT 0 NOT NULL,
	"duration_4weeks" integer DEFAULT 0 NOT NULL,
	"font_default" integer DEFAULT 0 NOT NULL,
	"font_large" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "unique_daily_admin_stats_date" UNIQUE("date")
);
--> statement-breakpoint
CREATE TABLE "data_entry_stats" (
	"id" serial PRIMARY KEY NOT NULL,
	"employee_id" varchar(255) NOT NULL,
	"date" timestamp NOT NULL,
	"posts_created" integer DEFAULT 0 NOT NULL,
	"posts_approved" integer DEFAULT 0 NOT NULL,
	"posts_rejected" integer DEFAULT 0 NOT NULL,
	"posts_edited" integer DEFAULT 0 NOT NULL,
	"total_characters" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "idx_admin_analytics_event_type" ON "admin_analytics" USING btree ("event_type" text_ops);--> statement-breakpoint
CREATE INDEX "idx_admin_analytics_created_at" ON "admin_analytics" USING btree ("created_at" text_ops);--> statement-breakpoint
CREATE INDEX "idx_admin_analytics_user_id" ON "admin_analytics" USING btree ("user_id" text_ops);--> statement-breakpoint
CREATE INDEX "idx_daily_admin_stats_date" ON "daily_admin_stats" USING btree ("date" text_ops);--> statement-breakpoint
CREATE INDEX "idx_data_entry_stats_employee_id" ON "data_entry_stats" USING btree ("employee_id" text_ops);--> statement-breakpoint
CREATE INDEX "idx_data_entry_stats_date" ON "data_entry_stats" USING btree ("date" text_ops);--> statement-breakpoint
CREATE INDEX "idx_data_entry_stats_employee_date" ON "data_entry_stats" USING btree ("employee_id" text_ops,"date" text_ops);