import { pgTable, serial, varchar, timestamp, unique, integer, foreignKey, jsonb, text, boolean, index, numeric, pgEnum } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

export const adminRole = pgEnum("admin_role", ['superadmin', 'admin', 'data_entry'])
export const fontSize = pgEnum("font_size", ['default', 'large'])
export const lookingFor = pgEnum("looking_for", ['bride', 'groom'])
export const status = pgEnum("status", ['pending', 'published', 'archived', 'deleted', 'expired', 'edited', 'payment_pending'])
export const analyticsEventType = pgEnum("analytics_event_type", ['ad_submission', 'ad_approval', 'ad_rejection', 'payment_success', 'payment_failure', 'email_sent', 'profile_selection'])


export const otps = pgTable("otps", {
	id: serial().primaryKey().notNull(),
	email: varchar({ length: 255 }).notNull(),
	otp: varchar({ length: 6 }).notNull(),
	expiresAt: timestamp("expires_at", { mode: 'string' }).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
});

export const uiTexts = pgTable("ui_texts", {
	id: serial().primaryKey().notNull(),
	key: varchar({ length: 100 }).notNull(),
	value: varchar({ length: 500 }).notNull(),
	description: varchar({ length: 255 }),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	unique("ui_texts_key_unique").on(table.key),
]);

export const userSelectedProfiles = pgTable("user_selected_profiles", {
	id: serial().primaryKey().notNull(),
	userId: integer("user_id").notNull(),
	profileId: integer("profile_id").notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
});

export const adminLogs = pgTable("admin_logs", {
	id: serial().primaryKey().notNull(),
	adminId: integer("admin_id").notNull(),
	action: varchar({ length: 100 }).notNull(),
	entityType: varchar("entity_type", { length: 50 }).notNull(),
	entityId: integer("entity_id"),
	oldData: jsonb("old_data"),
	newData: jsonb("new_data"),
	details: text(),
	ipAddress: varchar("ip_address", { length: 45 }),
	userAgent: text("user_agent"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.adminId],
			foreignColumns: [admins.id],
			name: "admin_logs_admin_id_admins_id_fk"
		}),
]);

export const users = pgTable("users", {
	id: serial().primaryKey().notNull(),
	email: varchar({ length: 255 }).notNull(),
	password: varchar({ length: 255 }).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	unique("users_email_unique").on(table.email),
]);

export const admins = pgTable("admins", {
	id: serial().primaryKey().notNull(),
	email: varchar({ length: 255 }).notNull(),
	password: varchar({ length: 255 }).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	role: adminRole().default('admin').notNull(),
}, (table) => [
	unique("admins_email_unique").on(table.email),
]);

export const posts = pgTable("posts", {
	id: serial().primaryKey().notNull(),
	email: varchar({ length: 255 }).notNull(),
	content: varchar({ length: 1000 }).notNull(),
	userId: integer("user_id"),
	lookingFor: lookingFor("looking_for"),
	duration: integer().default(14),
	expiresAt: timestamp("expires_at", { mode: 'string' }),
	fontSize: fontSize("font_size").default('default'),
	bgColor: varchar("bg_color", { length: 50 }),
	status: status().default('pending'),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	createdByAdminId: integer("created_by_admin_id"),
	paymentTransactionId: integer("payment_transaction_id"),
	baseAmount: integer("base_amount"),
	finalAmount: integer("final_amount"),
	couponCode: varchar("coupon_code", { length: 50 }),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "posts_user_id_users_id_fk"
		}),
	foreignKey({
			columns: [table.paymentTransactionId],
			foreignColumns: [paymentTransactions.id],
			name: "posts_payment_transaction_id_fkey"
		}),
]);

export const postEmails = pgTable("post_emails", {
	id: serial().primaryKey().notNull(),
	userId: integer("user_id"),
	email: varchar({ length: 255 }),
	postId: integer("post_id").notNull(),
	sentAt: timestamp("sent_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "post_emails_user_id_users_id_fk"
		}),
	foreignKey({
			columns: [table.postId],
			foreignColumns: [posts.id],
			name: "post_emails_post_id_posts_id_fk"
		}),
]);

export const searchFilterSections = pgTable("search_filter_sections", {
	id: serial().primaryKey().notNull(),
	name: varchar({ length: 100 }).notNull(),
	displayName: varchar("display_name", { length: 100 }).notNull(),
	description: varchar({ length: 255 }),
	order: integer().default(0).notNull(),
	isActive: boolean("is_active").default(true).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	unique("search_filter_sections_name_unique").on(table.name),
]);

export const searchFilterOptions = pgTable("search_filter_options", {
	id: serial().primaryKey().notNull(),
	sectionId: integer("section_id").notNull(),
	value: varchar({ length: 100 }).notNull(),
	displayName: varchar("display_name", { length: 100 }).notNull(),
	order: integer().default(0).notNull(),
	isActive: boolean("is_active").default(true).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.sectionId],
			foreignColumns: [searchFilterSections.id],
			name: "search_filter_options_section_id_search_filter_sections_id_fk"
		}).onDelete("cascade"),
]);

export const userEmailLimits = pgTable("user_email_limits", {
	id: serial().primaryKey().notNull(),
	userId: integer("user_id").notNull(),
	dailyCount: integer("daily_count").default(0).notNull(),
	lastResetDate: varchar("last_reset_date", { length: 10 }).notNull(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "user_email_limits_user_id_users_id_fk"
		}),
	unique("user_email_limits_user_id_unique").on(table.userId),
]);

export const couponCodes = pgTable("coupon_codes", {
	id: serial().primaryKey().notNull(),
	code: varchar({ length: 50 }).notNull(),
	discountPercentage: numeric("discount_percentage", { precision: 5, scale:  2 }).notNull(),
	isActive: boolean("is_active").default(true).notNull(),
	usageLimit: integer("usage_limit"),
	usedCount: integer("used_count").default(0).notNull(),
	expiresAt: timestamp("expires_at", { mode: 'string' }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_coupon_codes_code").using("btree", table.code.asc().nullsLast().op("text_ops")),
	index("idx_coupon_codes_is_active").using("btree", table.isActive.asc().nullsLast().op("bool_ops")),
	unique("coupon_codes_code_unique").on(table.code),
]);

export const paymentConfigs = pgTable("payment_configs", {
	id: serial().primaryKey().notNull(),
	basePriceFirst200: integer("base_price_first_200").default(5000).notNull(),
	additionalPricePer20Chars: integer("additional_price_per_20_chars").default(500).notNull(),
	largeFontMultiplier: numeric("large_font_multiplier", { precision: 3, scale:  2 }).default('1.20').notNull(),
	visibility2WeeksMultiplier: numeric("visibility_2_weeks_multiplier", { precision: 3, scale:  2 }).default('1.00').notNull(),
	visibility3WeeksMultiplier: numeric("visibility_3_weeks_multiplier", { precision: 3, scale:  2 }).default('1.50').notNull(),
	visibility4WeeksMultiplier: numeric("visibility_4_weeks_multiplier", { precision: 3, scale:  2 }).default('2.00').notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
});

export const paymentTransactions = pgTable("payment_transactions", {
	id: serial().primaryKey().notNull(),
	postId: integer("post_id"),
	razorpayPaymentLinkId: varchar("razorpay_payment_link_id", { length: 255 }),
	razorpayPaymentId: varchar("razorpay_payment_id", { length: 255 }),
	razorpayPaymentLinkReferenceId: varchar("razorpay_payment_link_reference_id", { length: 255 }),
	amount: integer().notNull(),
	currency: varchar({ length: 3 }).default('INR').notNull(),
	status: varchar({ length: 50 }).default('pending').notNull(),
	couponCode: varchar("coupon_code", { length: 50 }),
	discountAmount: integer("discount_amount").default(0).notNull(),
	finalAmount: integer("final_amount").notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_payment_transactions_post_id").using("btree", table.postId.asc().nullsLast().op("int4_ops")),
	index("idx_payment_transactions_razorpay_payment_link_id").using("btree", table.razorpayPaymentLinkId.asc().nullsLast().op("text_ops")),
	index("idx_payment_transactions_status").using("btree", table.status.asc().nullsLast().op("text_ops")),
]);

// Analytics tables
export const adminAnalytics = pgTable("admin_analytics", {
	id: serial().primaryKey().notNull(),
	eventType: analyticsEventType("event_type").notNull(),
	userId: varchar("user_id", { length: 255 }),
	sessionId: varchar("session_id", { length: 100 }),
	pagePath: varchar("page_path", { length: 200 }),
	metadata: jsonb(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_admin_analytics_created_at").on(table.createdAt),
	index("idx_admin_analytics_user_id").on(table.userId),
]);

export const dataEntryStats = pgTable("data_entry_stats", {
	id: serial().primaryKey().notNull(),
	employeeId: varchar("employee_id", { length: 255 }).notNull(),
	date: timestamp("date", { mode: 'string' }).notNull(),
	postsCreated: integer("posts_created").default(0).notNull(),
	postsApproved: integer("posts_approved").default(0).notNull(),
	postsRejected: integer("posts_rejected").default(0).notNull(),
	postsEdited: integer("posts_edited").default(0).notNull(),
	totalCharacters: integer("total_characters").default(0).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_data_entry_stats_employee_id").on(table.employeeId),
	index("idx_data_entry_stats_date").on(table.date),
	index("idx_data_entry_stats_employee_date").on(table.employeeId, table.date),
]);

export const dailyAdminStats = pgTable("daily_admin_stats", {
	id: serial().primaryKey().notNull(),
	date: timestamp("date", { mode: 'string' }).notNull(),
	adSubmissions: integer("ad_submissions").default(0).notNull(),
	adApprovals: integer("ad_approvals").default(0).notNull(),
	paymentSuccessRate: numeric("payment_success_rate", { precision: 5, scale: 2 }).default('0.00').notNull(),
	uniqueEmailSenders: integer("unique_email_senders").default(0).notNull(),
	uniqueEmailRecipients: integer("unique_email_recipients").default(0).notNull(),
	duration2weeks: integer("duration_2weeks").default(0).notNull(),
	duration3weeks: integer("duration_3weeks").default(0).notNull(),
	duration4weeks: integer("duration_4weeks").default(0).notNull(),
	fontDefault: integer("font_default").default(0).notNull(),
	fontLarge: integer("font_large").default(0).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_daily_admin_stats_date").on(table.date),
	unique("unique_daily_admin_stats_date").on(table.date),
]);
