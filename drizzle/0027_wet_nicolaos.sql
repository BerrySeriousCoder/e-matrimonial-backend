CREATE TABLE "post_ai_classifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"post_id" integer NOT NULL,
	"classification_option_id" integer NOT NULL,
	"confidence" real DEFAULT 0 NOT NULL,
	"evidence" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "payment_transactions" ADD COLUMN "razorpay_order_id" varchar(255);--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "expiry_reminder_sent" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "post_ai_classifications" ADD CONSTRAINT "post_ai_classifications_post_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_ai_classifications" ADD CONSTRAINT "post_ai_classifications_option_id_fk" FOREIGN KEY ("classification_option_id") REFERENCES "public"."classification_options"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_post_ai_classifications_post_id" ON "post_ai_classifications" USING btree ("post_id");--> statement-breakpoint
CREATE INDEX "idx_payment_transactions_razorpay_order_id" ON "payment_transactions" USING btree ("razorpay_order_id" text_ops);