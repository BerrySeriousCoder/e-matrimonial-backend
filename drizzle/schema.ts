import { pgTable, foreignKey, serial, varchar, integer, timestamp, unique, jsonb, text, boolean, pgEnum } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

export const fontSize = pgEnum("font_size", ['default', 'medium', 'large'])
export const lookingFor = pgEnum("looking_for", ['bride', 'groom'])
export const status = pgEnum("status", ['pending', 'published', 'archived', 'deleted', 'expired'])


export const posts = pgTable("posts", {
	id: serial().primaryKey().notNull(),
	email: varchar({ length: 255 }).notNull(),
	content: varchar({ length: 1000 }).notNull(),
	userId: integer("user_id"),
	lookingFor: lookingFor("looking_for"),
	expiresAt: timestamp("expires_at", { mode: 'string' }),
	fontSize: fontSize("font_size").default('default'),
	bgColor: varchar("bg_color", { length: 50 }),
	status: status().default('pending'),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "posts_user_id_users_id_fk"
		}),
]);

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

export const admins = pgTable("admins", {
	id: serial().primaryKey().notNull(),
	email: varchar({ length: 255 }).notNull(),
	password: varchar({ length: 255 }).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	unique("admins_email_unique").on(table.email),
]);

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
