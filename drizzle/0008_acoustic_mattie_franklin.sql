ALTER TABLE "post_emails" DROP CONSTRAINT "post_emails_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "post_emails" DROP CONSTRAINT "post_emails_post_id_posts_id_fk";
--> statement-breakpoint
ALTER TABLE "user_email_limits" DROP CONSTRAINT "user_email_limits_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "post_emails" ADD CONSTRAINT "post_emails_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_emails" ADD CONSTRAINT "post_emails_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_email_limits" ADD CONSTRAINT "user_email_limits_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;