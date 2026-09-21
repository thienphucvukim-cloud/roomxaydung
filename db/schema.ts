import { index, integer, primaryKey, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const posts = sqliteTable("posts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: text("user_id").notNull(),
  authorName: text("author_name").notNull(),
  category: text("category").notNull(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  location: text("location"),
  audience: text("audience").notNull().default("Công khai"),
  feeling: text("feeling"),
  background: text("background"),
  mentions: text("mentions"),
  pollQuestion: text("poll_question"),
  pollOptions: text("poll_options"),
  comments: integer("comments").notNull().default(0),
  likes: integer("likes").notNull().default(0),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});

export const postComments = sqliteTable("post_comments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  postId: integer("post_id").notNull().references(() => posts.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull(),
  authorName: text("author_name").notNull(),
  content: text("content").notNull(),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
}, (table) => [index("idx_post_comments_post_id").on(table.postId)]);

export const postLikes = sqliteTable("post_likes", {
  postId: integer("post_id").notNull().references(() => posts.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull(),
}, (table) => [primaryKey({ columns: [table.postId, table.userId] })]);
export const postAttachments = sqliteTable("post_attachments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  postId: integer("post_id").notNull().references(() => posts.id, { onDelete: "cascade" }),
  objectKey: text("object_key").notNull().unique(),
  fileName: text("file_name").notNull(),
  mimeType: text("mime_type").notNull(),
  size: integer("size").notNull(),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
}, (table) => [index("idx_post_attachments_post_id").on(table.postId)]);
export const userActions = sqliteTable("user_actions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: text("user_id").notNull(),
  actionType: text("action_type").notNull(),
  targetType: text("target_type").notNull(),
  targetId: text("target_id").notNull(),
  payload: text("payload"),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
}, (table) => [
  uniqueIndex("idx_user_actions_unique").on(table.userId, table.actionType, table.targetType, table.targetId),
  index("idx_user_actions_user").on(table.userId, table.createdAt),
]);

export const userRequests = sqliteTable("user_requests", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: text("user_id").notNull(),
  authorName: text("author_name").notNull(),
  requestType: text("request_type").notNull(),
  targetType: text("target_type").notNull(),
  targetId: text("target_id").notNull(),
  subject: text("subject").notNull(),
  content: text("content").notNull(),
  contact: text("contact"),
  attachmentKey: text("attachment_key"),
  status: text("status").notNull().default("pending"),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
}, (table) => [
  index("idx_user_requests_user").on(table.userId, table.createdAt),
  index("idx_user_requests_type").on(table.requestType, table.createdAt),
]);
