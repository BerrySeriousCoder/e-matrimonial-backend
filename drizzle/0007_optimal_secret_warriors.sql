CREATE TABLE "post_emails" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"post_id" integer NOT NULL,
	"sent_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_email_limits" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"daily_count" integer DEFAULT 0 NOT NULL,
	"last_reset_date" varchar(10) NOT NULL,
	CONSTRAINT "user_email_limits_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
ALTER TABLE "posts" ALTER COLUMN "content" SET DATA TYPE varchar(2000);--> statement-breakpoint
ALTER TABLE "post_emails" ADD CONSTRAINT "post_emails_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_emails" ADD CONSTRAINT "post_emails_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_email_limits" ADD CONSTRAINT "user_email_limits_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;