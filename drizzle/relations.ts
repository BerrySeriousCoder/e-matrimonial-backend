import { relations } from "drizzle-orm/relations";
import { admins, adminLogs, users, postEmails, posts, searchFilterSections, searchFilterOptions, userEmailLimits, emailLogs, paymentTransactions, classificationOptions, classificationCategories, postAiClassifications, searchSynonymGroups, searchSynonymWords } from "./schema";

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

export const usersRelations = relations(users, ({many}) => ({
	postEmails: many(postEmails),
	userEmailLimits: many(userEmailLimits),
	emailLogs: many(emailLogs),
	posts: many(posts),
}));

export const postsRelations = relations(posts, ({one, many}) => ({
	postEmails: many(postEmails),
	emailLogs: many(emailLogs),
	user: one(users, {
		fields: [posts.userId],
		references: [users.id]
	}),
	paymentTransaction: one(paymentTransactions, {
		fields: [posts.paymentTransactionId],
		references: [paymentTransactions.id]
	}),
	post: one(posts, {
		fields: [posts.previousPostId],
		references: [posts.id],
		relationName: "posts_previousPostId_posts_id"
	}),
	posts: many(posts, {
		relationName: "posts_previousPostId_posts_id"
	}),
	classificationOption: one(classificationOptions, {
		fields: [posts.classificationId],
		references: [classificationOptions.id]
	}),
	postAiClassifications: many(postAiClassifications),
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

export const emailLogsRelations = relations(emailLogs, ({one}) => ({
	post: one(posts, {
		fields: [emailLogs.postId],
		references: [posts.id]
	}),
	user: one(users, {
		fields: [emailLogs.userId],
		references: [users.id]
	}),
}));

export const paymentTransactionsRelations = relations(paymentTransactions, ({many}) => ({
	posts: many(posts),
}));

export const classificationOptionsRelations = relations(classificationOptions, ({one, many}) => ({
	posts: many(posts),
	classificationCategory: one(classificationCategories, {
		fields: [classificationOptions.categoryId],
		references: [classificationCategories.id]
	}),
	postAiClassifications: many(postAiClassifications),
}));

export const classificationCategoriesRelations = relations(classificationCategories, ({many}) => ({
	classificationOptions: many(classificationOptions),
}));

export const postAiClassificationsRelations = relations(postAiClassifications, ({one}) => ({
	post: one(posts, {
		fields: [postAiClassifications.postId],
		references: [posts.id]
	}),
	classificationOption: one(classificationOptions, {
		fields: [postAiClassifications.classificationOptionId],
		references: [classificationOptions.id]
	}),
}));

export const searchSynonymWordsRelations = relations(searchSynonymWords, ({one}) => ({
	searchSynonymGroup: one(searchSynonymGroups, {
		fields: [searchSynonymWords.groupId],
		references: [searchSynonymGroups.id]
	}),
}));

export const searchSynonymGroupsRelations = relations(searchSynonymGroups, ({many}) => ({
	searchSynonymWords: many(searchSynonymWords),
}));