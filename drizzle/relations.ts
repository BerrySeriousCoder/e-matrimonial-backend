import { relations } from "drizzle-orm/relations";
import { users, posts, admins, adminLogs, postEmails, searchFilterSections, searchFilterOptions, userEmailLimits } from "./schema";

export const postsRelations = relations(posts, ({one, many}) => ({
	user: one(users, {
		fields: [posts.userId],
		references: [users.id]
	}),
	postEmails: many(postEmails),
}));

export const usersRelations = relations(users, ({many}) => ({
	posts: many(posts),
	postEmails: many(postEmails),
	userEmailLimits: many(userEmailLimits),
}));

export const adminLogsRelations = relations(adminLogs, ({one}) => ({
	admin: one(admins, {
		fields: [adminLogs.adminId],
		references: [admins.id]
	}),
}));

export const adminsRelations = relations(admins, ({many}) => ({
	adminLogs: many(adminLogs),
}));

export const postEmailsRelations = relations(postEmails, ({one}) => ({
	user: one(users, {
		fields: [postEmails.userId],
		references: [users.id]
	}),
	post: one(posts, {
		fields: [postEmails.postId],
		references: [posts.id]
	}),
}));

export const searchFilterOptionsRelations = relations(searchFilterOptions, ({one}) => ({
	searchFilterSection: one(searchFilterSections, {
		fields: [searchFilterOptions.sectionId],
		references: [searchFilterSections.id]
	}),
}));

export const searchFilterSectionsRelations = relations(searchFilterSections, ({many}) => ({
	searchFilterOptions: many(searchFilterOptions),
}));

export const userEmailLimitsRelations = relations(userEmailLimits, ({one}) => ({
	user: one(users, {
		fields: [userEmailLimits.userId],
		references: [users.id]
	}),
}));