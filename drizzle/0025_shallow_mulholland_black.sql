CREATE TABLE "email_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"sender_email" varchar(255) NOT NULL,
	"recipient_email" varchar(255) NOT NULL,
	"post_id" integer,
	"user_id" integer,
	"subject" text NOT NULL,
	"message_text" text,
	"message_html" text,
	"email_type" varchar(50) NOT NULL,
	"attachments" jsonb,
	"resend_message_id" varchar(255),
	"status" varchar(20) DEFAULT 'sent' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "previous_post_id" integer;--> statement-breakpoint
ALTER TABLE "email_logs" ADD CONSTRAINT "email_logs_post_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_logs" ADD CONSTRAINT "email_logs_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_email_logs_sender" ON "email_logs" USING btree ("sender_email");--> statement-breakpoint
CREATE INDEX "idx_email_logs_recipient" ON "email_logs" USING btree ("recipient_email");--> statement-breakpoint
CREATE INDEX "idx_email_logs_post_id" ON "email_logs" USING btree ("post_id");--> statement-breakpoint
CREATE INDEX "idx_email_logs_created_at" ON "email_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_email_logs_email_type" ON "email_logs" USING btree ("email_type");--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_previous_post_id_fkey" FOREIGN KEY ("previous_post_id") REFERENCES "public"."posts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_posts_previous_post_id" ON "posts" USING btree ("previous_post_id");