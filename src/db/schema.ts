import { pgTable, serial, varchar, timestamp, integer, pgEnum, jsonb, text, boolean } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Enums
export const lookingForEnum = pgEnum('looking_for', ['bride', 'groom']);
export const fontSizeEnum = pgEnum('font_size', ['default', 'medium', 'large']);
export const statusEnum = pgEnum('status', ['pending', 'published', 'archived', 'deleted', 'expired']);

export const posts = pgTable('posts', {
  id: serial('id').primaryKey(),
  email: varchar('email', { length: 255 }).notNull(),
  content: varchar('content', { length: 1000 }).notNull(),
  userId: integer('user_id').references(() => users.id),
  lookingFor: lookingForEnum('looking_for'),
  expiresAt: timestamp('expires_at'),
  fontSize: fontSizeEnum('font_size').default('default'),
  bgColor: varchar('bg_color', { length: 50 }),
  status: statusEnum('status').default('pending'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const otps = pgTable('otps', {
  id: serial('id').primaryKey(),
  email: varchar('email', { length: 255 }).notNull(),
  otp: varchar('otp', { length: 6 }).notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  password: varchar('password', { length: 255 }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const userSelectedProfiles = pgTable('user_selected_profiles', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull(),
  profileId: integer('profile_id').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Email tracking tables
export const postEmails = pgTable('post_emails', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id), // nullable for anonymous users
  email: varchar('email', { length: 255 }), // for anonymous email tracking
  postId: integer('post_id').notNull().references(() => posts.id),
  sentAt: timestamp('sent_at').defaultNow().notNull(),
});

export const userEmailLimits = pgTable('user_email_limits', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().unique().references(() => users.id),
  dailyCount: integer('daily_count').default(0).notNull(),
  lastResetDate: varchar('last_reset_date', { length: 10 }).notNull(), // YYYY-MM-DD format
});

// Admin tables
export const admins = pgTable('admins', {
  id: serial('id').primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  password: varchar('password', { length: 255 }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const adminLogs = pgTable('admin_logs', {
  id: serial('id').primaryKey(),
  adminId: integer('admin_id').notNull().references(() => admins.id),
  action: varchar('action', { length: 100 }).notNull(),
  entityType: varchar('entity_type', { length: 50 }).notNull(),
  entityId: integer('entity_id'),
  oldData: jsonb('old_data'),
  newData: jsonb('new_data'),
  details: text('details'),
  ipAddress: varchar('ip_address', { length: 45 }),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Relations
export const postsRelations = relations(posts, ({ one, many }) => ({
  user: one(users, {
    fields: [posts.userId],
    references: [users.id],
  }),
  emails: many(postEmails),
}));

export const usersRelations = relations(users, ({ many }) => ({
  posts: many(posts),
  selectedProfiles: many(userSelectedProfiles),
  sentEmails: many(postEmails),
  emailLimits: many(userEmailLimits),
}));

export const userSelectedProfilesRelations = relations(userSelectedProfiles, ({ one }) => ({
  user: one(users, {
    fields: [userSelectedProfiles.userId],
    references: [users.id],
  }),
  post: one(posts, {
    fields: [userSelectedProfiles.profileId],
    references: [posts.id],
  }),
}));

export const postEmailsRelations = relations(postEmails, ({ one }) => ({
  user: one(users, {
    fields: [postEmails.userId],
    references: [users.id],
  }),
  post: one(posts, {
    fields: [postEmails.postId],
    references: [posts.id],
  }),
}));

export const userEmailLimitsRelations = relations(userEmailLimits, ({ one }) => ({
  user: one(users, {
    fields: [userEmailLimits.userId],
    references: [users.id],
  }),
}));

export const adminsRelations = relations(admins, ({ many }) => ({
  logs: many(adminLogs),
}));

export const adminLogsRelations = relations(adminLogs, ({ one }) => ({
  admin: one(admins, {
    fields: [adminLogs.adminId],
    references: [admins.id],
  }),
}));

// UI Texts table for customizable labels
export const uiTexts = pgTable('ui_texts', {
  id: serial('id').primaryKey(),
  key: varchar('key', { length: 100 }).notNull().unique(),
  value: varchar('value', { length: 500 }).notNull(),
  description: varchar('description', { length: 255 }),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Search Filter System Tables
export const searchFilterSections = pgTable('search_filter_sections', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull().unique(),
  displayName: varchar('display_name', { length: 100 }).notNull(),
  description: varchar('description', { length: 255 }),
  order: integer('order').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const searchFilterOptions = pgTable('search_filter_options', {
  id: serial('id').primaryKey(),
  sectionId: integer('section_id').notNull().references(() => searchFilterSections.id, { onDelete: 'cascade' }),
  value: varchar('value', { length: 100 }).notNull(),
  displayName: varchar('display_name', { length: 100 }).notNull(),
  order: integer('order').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});



// Relations
export const searchFilterSectionsRelations = relations(searchFilterSections, ({ many }) => ({
  options: many(searchFilterOptions),
}));

export const searchFilterOptionsRelations = relations(searchFilterOptions, ({ one }) => ({
  section: one(searchFilterSections, {
    fields: [searchFilterOptions.sectionId],
    references: [searchFilterSections.id],
  }),
})); 