import { POST_STORAGE_COLUMNS } from "../lib/legacy-contracts.ts";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const freelanceProfiles = sqliteTable('freelance_profiles', {
  userId: text('user_id').primaryKey(), displayName: text('display_name').notNull(), title: text('title').notNull(), specialty: text('specialty').notNull(), location: text('location').notNull().default(''), bio: text('bio').notNull().default(''), skills: text('skills').notNull().default('[]'), experience: integer('experience').notNull().default(0), rate: integer('rate').notNull().default(0), rateUnit: text('rate_unit').notNull().default('project'), available: integer('available', {mode:'boolean'}).notNull().default(true), cover: text('cover').notNull().default(''), portfolio: text('portfolio').notNull().default('[]'), updatedAt: text('updated_at').notNull(),
}, table => [index('freelance_profiles_specialty').on(table.specialty,table.available,table.updatedAt)]);
export const freelanceProjects = sqliteTable('freelance_projects', {
  id: text('id').primaryKey(), ownerId: text('owner_id').notNull(), ownerName: text('owner_name').notNull(), freelancerId: text('freelancer_id').references(() => freelanceProfiles.userId), title: text('title').notNull(), specialty: text('specialty').notNull(), description: text('description').notNull().default(''), location: text('location').notNull().default(''), budget: integer('budget').notNull().default(0), days: integer('days').notNull().default(0), status: text('status').notNull().default('open'), agreedPrice: integer('agreed_price').notNull().default(0), agreedDays: integer('agreed_days').notNull().default(0), createdAt: text('created_at').notNull(), updatedAt: text('updated_at').notNull(),
}, table => [index('freelance_projects_market').on(table.status,table.specialty,table.createdAt),index('freelance_projects_owner').on(table.ownerId,table.updatedAt),index('freelance_projects_freelancer').on(table.freelancerId,table.updatedAt)]);
export const freelanceProposals = sqliteTable('freelance_proposals', {
  id: text('id').primaryKey(), projectId: text('project_id').notNull().references(() => freelanceProjects.id), freelancerId: text('freelancer_id').notNull().references(() => freelanceProfiles.userId), price: integer('price').notNull(), days: integer('days').notNull(), content: text('content').notNull(), createdAt: text('created_at').notNull(),
}, table => [uniqueIndex('freelance_proposals_project_member').on(table.projectId,table.freelancerId)]);
export const freelanceMessages = sqliteTable('freelance_messages', {
  id: text('id').primaryKey(), projectId: text('project_id').notNull().references(() => freelanceProjects.id), authorId: text('author_id').notNull(), authorName: text('author_name').notNull(), content: text('content').notNull(), createdAt: text('created_at').notNull(),
}, table => [index('freelance_messages_project').on(table.projectId,table.createdAt)]);
export const freelanceFiles = sqliteTable('freelance_files', {
  id: text('id').primaryKey(), projectId: text('project_id').notNull().references(() => freelanceProjects.id), uploaderId: text('uploader_id').notNull(), purpose: text('purpose').notNull(), objectKey: text('object_key').notNull().unique(), name: text('name').notNull(), size: integer('size').notNull(), createdAt: text('created_at').notNull(),
}, table => [index('freelance_files_project').on(table.projectId,table.createdAt)]);

export const posts = sqliteTable("posts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: text("user_id").notNull(),
  authorName: text("author_name").notNull(),
  category: text("category").notNull(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  specifications: text(POST_STORAGE_COLUMNS.specifications),
  audience: text("audience").notNull().default("Công khai"),
  listingType: text(POST_STORAGE_COLUMNS.listingType),
  priceLabel: text(POST_STORAGE_COLUMNS.priceLabel),
  comments: integer("comments").notNull().default(0),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});

export const catalogPromotions = sqliteTable("catalog_promotions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  postId: integer("post_id").notNull().references(() => posts.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull(),
  category: text("category").notNull(),
  position: integer("position").notNull(),
  months: integer("months").notNull(),
  amount: integer("amount").notNull(),
  reference: text("reference").notNull().unique(),
  startsAt: text("starts_at").notNull(),
  expiresAt: text("expires_at").notNull(),
}, table => [
  index("idx_catalog_promotions_slot").on(table.category, table.position, table.expiresAt),
  index("idx_catalog_promotions_post").on(table.postId, table.expiresAt),
]);

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
  // Purchased private files outlive their listing; deletion cleanup is a DB trigger.
  postId: integer("post_id").notNull(),
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

export const catalogViews = sqliteTable("catalog_views", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  targetType: text("target_type").notNull(),
  targetId: text("target_id").notNull(),
  userId: text("user_id").notNull(),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
}, (table) => [uniqueIndex("idx_catalog_views_unique").on(table.targetType, table.targetId, table.userId)]);

export const catalogDownloads = sqliteTable("catalog_downloads", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  targetType: text("target_type").notNull(),
  targetId: text("target_id").notNull(),
  userId: text("user_id").notNull(),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
}, table => [uniqueIndex("idx_catalog_downloads_unique").on(table.targetType, table.targetId, table.userId)]);

export const catalogRatings = sqliteTable("catalog_ratings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  targetType: text("target_type").notNull(),
  targetId: text("target_id").notNull(),
  userId: text("user_id").notNull(),
  rating: integer("rating").notNull(),
  updatedAt: text("updated_at").notNull().$defaultFn(() => new Date().toISOString()),
}, (table) => [uniqueIndex("idx_catalog_ratings_unique").on(table.targetType, table.targetId, table.userId)]);
export const walletTransactions = sqliteTable("wallet_transactions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: text("user_id").notNull(),
  kind: text("kind").notNull(),
  wallet: text("wallet").notNull().default("deposit"),
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
  index("idx_wallet_transactions_wallet").on(table.userId, table.wallet, table.createdAt),
  index("idx_wallet_transactions_seller").on(table.sellerUserId, table.createdAt),
]);

export const walletManualCredits = sqliteTable("wallet_manual_credits", {
  reference: text("reference").primaryKey(),
  userId: text("user_id").notNull(),
  amount: integer("amount").notNull(),
  orderCode: integer("order_code").notNull().unique(),
  reason: text("reason").notNull(),
  performedBy: text("performed_by").notNull(),
  createdAt: text("created_at").notNull(),
}, table => [index("idx_wallet_manual_credits_created").on(table.createdAt)]);

export const walletWithdrawals = sqliteTable("wallet_withdrawals", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  amount: integer("amount").notNull(),
  bankName: text("bank_name").notNull(),
  accountNumber: text("account_number").notNull(),
  accountName: text("account_name").notNull(),
  status: text("status").notNull().default("pending"),
  reviewNote: text("review_note"),
  reviewedBy: text("reviewed_by"),
  reviewedAt: text("reviewed_at"),
  createdAt: text("created_at").notNull(),
}, table => [index("idx_wallet_withdrawals_user").on(table.userId, table.createdAt), index("idx_wallet_withdrawals_status").on(table.status, table.createdAt)]);

export const walletSaleCredits = sqliteTable("wallet_sale_credits", {
  purchaseId: integer("purchase_id").primaryKey(),
  sellerUserId: text("seller_user_id").notNull(),
  amount: integer("amount").notNull(),
  grossAmount: integer("gross_amount"),
  adminPercent: integer("admin_percent").notNull().default(0),
  reviewedBy: text("reviewed_by").notNull(),
  createdAt: text("created_at").notNull(),
  revokedBy: text("revoked_by"),
  revokedAt: text("revoked_at"),
  revocationReason: text("revocation_reason"),
});

export const walletSaleSettings = sqliteTable("wallet_sale_settings", {
  id: integer("id").primaryKey(),
  adminPercent: integer("admin_percent").notNull().default(20),
  updatedBy: text("updated_by"),
  updatedAt: text("updated_at"),
});

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
  avatarKey: text("avatar_key"),
  googleAvatarUrl: text("google_avatar_url"),
  email: text("email"),
  accountType: text("account_type").notNull().default("user"),
  profession: text("profession"),
  upgradedAt: text("upgraded_at"),
  accountStatus: text("account_status").notNull().default("active"),
  moderationReason: text("moderation_reason").notNull().default(""),
  moderationVersion: integer("moderation_version").notNull().default(0),
  updatedAt: text("updated_at").notNull().$defaultFn(() => new Date().toISOString()),
}, (table) => [index("idx_member_profiles_type").on(table.accountType)]);

export const adminMemberModeration = sqliteTable("admin_member_moderation", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  performedBy: text("performed_by").notNull(),
  action: text("action").notNull(),
  reason: text("reason").notNull(),
  version: integer("version").notNull(),
  createdAt: text("created_at").notNull(),
}, table => [uniqueIndex("idx_admin_member_moderation_version").on(table.userId, table.version)]);

export const websiteAccounts = sqliteTable("website_accounts", {
  userId: text("user_id").primaryKey(),
  email: text("email").unique(),
  username: text("username").unique(),
  googleSub: text("google_sub").unique(),
  displayName: text("display_name").notNull(),
  passwordHash: text("password_hash").notNull(),
  isOwner: integer("is_owner", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").notNull(),
});

export const adminMemberPasswordResets = sqliteTable("admin_member_password_resets", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => websiteAccounts.userId, { onDelete: "cascade" }),
  performedBy: text("performed_by").notNull(),
  verificationNote: text("verification_note").notNull(),
  createdAt: text("created_at").notNull(),
}, (table) => [index("idx_admin_member_password_resets_user").on(table.userId, table.createdAt)]);

export const websiteSessions = sqliteTable("website_sessions", {
  tokenHash: text("token_hash").primaryKey(),
  userId: text("user_id").notNull().references(() => websiteAccounts.userId, { onDelete: "cascade" }),
  expiresAt: integer("expires_at").notNull(),
  ownerVerified: integer("owner_verified", { mode: "boolean" }).notNull().default(false),
}, (table) => [index("idx_website_sessions_user").on(table.userId)]);

export const authRateLimits = sqliteTable("auth_rate_limits", {
  key: text("key").primaryKey(),
  attempts: integer("attempts").notNull(),
  expiresAt: integer("expires_at").notNull(),
});

export const authGoogleRequests = sqliteTable("auth_google_requests", {
  stateHash: text("state_hash").primaryKey(),
  browserHash: text("browser_hash").notNull(),
  verifier: text("verifier").notNull(),
  nonce: text("nonce").notNull(),
  redirectTo: text("redirect_to").notNull(),
  expiresAt: integer("expires_at").notNull(),
}, (table) => [index("idx_auth_google_requests_expiry").on(table.expiresAt)]);

export const websiteContent = sqliteTable("website_content", {
  key: text("key").primaryKey(),
  kind: text("kind").notNull(),
  value: text("value").notNull(),
  updatedBy: text("updated_by").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const authEmailChallenges = sqliteTable("auth_email_challenges", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => websiteAccounts.userId, { onDelete: "cascade" }),
  purpose: text("purpose").notNull(),
  browserHash: text("browser_hash").notNull(),
  codeHash: text("code_hash").notNull(),
  passwordVersion: text("password_version").notNull(),
  sessionHash: text("session_hash"),
  newPasswordHash: text("new_password_hash"),
  redirectTo: text("redirect_to").notNull(),
  attempts: integer("attempts").notNull().default(0),
  expiresAt: integer("expires_at").notNull(),
  createdAt: integer("created_at").notNull(),
}, (table) => [index("idx_auth_email_challenges_user").on(table.userId, table.purpose)]);

export const authEmailCooldowns = sqliteTable("auth_email_cooldowns", {
  key: text("key").primaryKey(),
  sentAt: integer("sent_at").notNull(),
});

export const authPasswordResetRequests = sqliteTable("auth_password_reset_requests", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  browserHash: text("browser_hash").notNull(),
  attempts: integer("attempts").notNull().default(0),
  createdAt: integer("created_at").notNull(),
  expiresAt: integer("expires_at").notNull(),
}, (table) => [index("idx_auth_password_reset_email").on(table.email)]);

export const adminTotpCredentials = sqliteTable("admin_totp_credentials", {
  userId: text("user_id").primaryKey().references(() => websiteAccounts.userId, { onDelete: "cascade" }),
  secretEncrypted: text("secret_encrypted").notNull(),
  lastStep: integer("last_step").notNull().default(-1),
  createdAt: integer("created_at").notNull(),
});
export const adminRecoveryCodes = sqliteTable("admin_recovery_codes", {
  codeHash: text("code_hash").primaryKey(),
  userId: text("user_id").notNull().references(() => websiteAccounts.userId, { onDelete: "cascade" }),
}, (table) => [index("idx_admin_recovery_codes_user").on(table.userId)]);
export const adminTotpChallenges = sqliteTable("admin_totp_challenges", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => websiteAccounts.userId, { onDelete: "cascade" }),
  purpose: text("purpose").notNull(), browserHash: text("browser_hash").notNull(),
  passwordVersion: text("password_version").notNull(), credentialVersion: text("credential_version"),
  pendingSecret: text("pending_secret"), newPasswordHash: text("new_password_hash"), sessionHash: text("session_hash"),
  redirectTo: text("redirect_to").notNull(), attempts: integer("attempts").notNull().default(0), expiresAt: integer("expires_at").notNull(),
}, (table) => [index("idx_admin_totp_challenges_user").on(table.userId)]);
