import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

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
  pollQuestion: text("poll_question"),
  comments: integer("comments").notNull().default(0),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});

export const postComments = sqliteTable("post_comments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  postId: integer("post_id").notNull().references(() => posts.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull(),
  authorName: text("author_name").notNull(),
  content: text("content").notNull(),
  imageKey: text("image_key"),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
}, (table) => [index("idx_post_comments_post_id").on(table.postId)]);

export const postAttachments = sqliteTable("post_attachments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  postId: integer("post_id").notNull().references(() => posts.id, { onDelete: "cascade" }),
  objectKey: text("object_key").notNull().unique(),
  fileName: text("file_name").notNull(),
  mimeType: text("mime_type").notNull(),
  size: integer("size").notNull(),
  accessType: text("access_type").notNull().default("public"),
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
  recipientUserId: text("recipient_user_id"),
  channels: text("channels"),
  deliveryStatus: text("delivery_status"),
  status: text("status").notNull().default("pending"),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
}, (table) => [
  index("idx_user_requests_user").on(table.userId, table.createdAt),
  index("idx_user_requests_type").on(table.requestType, table.createdAt),
]);
export const virtualProfiles = sqliteTable("virtual_profiles", {
  id: text("id").primaryKey(),
  displayName: text("display_name").notNull(),
  accountType: text("account_type").notNull(),
  profession: text("profession").notNull(),
  specialty: text("specialty"),
  location: text("location"),
  bio: text("bio"),
  avatar: text("avatar"),
  zaloUserId: text("zalo_user_id"),
  messengerPsid: text("messenger_psid"),
  telegramChatId: text("telegram_chat_id"),
  internalChatId: text("internal_chat_id"),
  isVirtual: integer("is_virtual", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
}, (table) => [
  index("idx_virtual_profiles_type").on(table.accountType),
  index("idx_virtual_profiles_profession").on(table.profession),
]);
export const directMessages = sqliteTable("direct_messages", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  senderUserId: text("sender_user_id").notNull(),
  senderName: text("sender_name").notNull(),
  recipientUserId: text("recipient_user_id").notNull(),
  requestId: integer("request_id").references(() => userRequests.id, { onDelete: "set null" }),
  subject: text("subject").notNull(),
  content: text("content").notNull(),
  attachmentKey: text("attachment_key"),
  readAt: text("read_at"),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
}, (table) => [
  index("idx_direct_messages_recipient").on(table.recipientUserId, table.createdAt),
  index("idx_direct_messages_sender").on(table.senderUserId, table.createdAt),
]);
export const deliveryProfiles = sqliteTable("delivery_profiles", {
  userId: text("user_id").primaryKey(),
  zaloUserId: text("zalo_user_id"),
  messengerPsid: text("messenger_psid"),
  telegramChatId: text("telegram_chat_id"),
  internalChatId: text("internal_chat_id"),
  updatedAt: text("updated_at").notNull().$defaultFn(() => new Date().toISOString()),
});
export const walletTransactions = sqliteTable("wallet_transactions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: text("user_id").notNull(),
  kind: text("kind").notNull(),
  amount: integer("amount").notNull(),
  orderCode: integer("order_code").notNull(),
  reference: text("reference").notNull(),
  targetType: text("target_type"),
  targetId: text("target_id"),
  sellerUserId: text("seller_user_id"),
  description: text("description").notNull(),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
}, (table) => [
  uniqueIndex("wallet_transactions_order_code_unique").on(table.orderCode),
  uniqueIndex("wallet_transactions_reference_unique").on(table.reference),
  index("idx_wallet_transactions_user").on(table.userId, table.createdAt),
  index("idx_wallet_transactions_seller").on(table.sellerUserId, table.createdAt),
]);

export const walletTopupRequests = sqliteTable("wallet_topup_requests", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  requestCode: text("request_code").notNull().unique(),
  userId: text("user_id").notNull(),
  amount: integer("amount").notNull(),
  transferContent: text("transfer_content").notNull().unique(),
  status: text("status").notNull().default("pending"),
  reviewedBy: text("reviewed_by"),
  reviewedAt: text("reviewed_at"),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").notNull().$defaultFn(() => new Date().toISOString()),
}, (table) => [
  index("idx_wallet_topups_user").on(table.userId, table.createdAt),
  index("idx_wallet_topups_status").on(table.status, table.createdAt),
]);

export const memberProfiles = sqliteTable("member_profiles", {
  userId: text("user_id").primaryKey(),
  displayName: text("display_name").notNull(),
  email: text("email"),
  accountType: text("account_type").notNull().default("user"),
  profession: text("profession"),
  upgradedAt: text("upgraded_at"),
  updatedAt: text("updated_at").notNull().$defaultFn(() => new Date().toISOString()),
}, (table) => [index("idx_member_profiles_type").on(table.accountType)]);
