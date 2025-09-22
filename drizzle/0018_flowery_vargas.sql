DROP INDEX "idx_admin_analytics_created_at";--> statement-breakpoint
DROP INDEX "idx_admin_analytics_user_id";--> statement-breakpoint
DROP INDEX "idx_daily_admin_stats_date";--> statement-breakpoint
DROP INDEX "idx_data_entry_stats_employee_id";--> statement-breakpoint
DROP INDEX "idx_data_entry_stats_date";--> statement-breakpoint
DROP INDEX "idx_data_entry_stats_employee_date";--> statement-breakpoint
CREATE INDEX "idx_admin_analytics_created_at" ON "admin_analytics" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_admin_analytics_user_id" ON "admin_analytics" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_daily_admin_stats_date" ON "daily_admin_stats" USING btree ("date");--> statement-breakpoint
CREATE INDEX "idx_data_entry_stats_employee_id" ON "data_entry_stats" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "idx_data_entry_stats_date" ON "data_entry_stats" USING btree ("date");--> statement-breakpoint
CREATE INDEX "idx_data_entry_stats_employee_date" ON "data_entry_stats" USING btree ("employee_id","date");