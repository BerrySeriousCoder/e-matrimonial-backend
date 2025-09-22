ALTER TABLE "payment_transactions" DROP CONSTRAINT "payment_transactions_post_id_posts_id_fk";
--> statement-breakpoint
ALTER TABLE "payment_transactions" DROP CONSTRAINT "payment_transactions_coupon_code_coupon_codes_code_fk";
--> statement-breakpoint
ALTER TABLE "posts" DROP CONSTRAINT "posts_created_by_admin_id_admins_id_fk";
--> statement-breakpoint
ALTER TABLE "posts" DROP CONSTRAINT "posts_payment_transaction_id_payment_transactions_id_fk";
--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "duration" integer DEFAULT 14;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_payment_transaction_id_fkey" FOREIGN KEY ("payment_transaction_id") REFERENCES "public"."payment_transactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_coupon_codes_code" ON "coupon_codes" USING btree ("code" text_ops);--> statement-breakpoint
CREATE INDEX "idx_coupon_codes_is_active" ON "coupon_codes" USING btree ("is_active" bool_ops);--> statement-breakpoint
CREATE INDEX "idx_payment_transactions_post_id" ON "payment_transactions" USING btree ("post_id" int4_ops);--> statement-breakpoint
CREATE INDEX "idx_payment_transactions_razorpay_payment_link_id" ON "payment_transactions" USING btree ("razorpay_payment_link_id" text_ops);--> statement-breakpoint
CREATE INDEX "idx_payment_transactions_status" ON "payment_transactions" USING btree ("status" text_ops);