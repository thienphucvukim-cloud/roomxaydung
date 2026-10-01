CREATE TABLE `wallet_transactions` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `user_id` text NOT NULL,
  `kind` text NOT NULL,
  `amount` integer NOT NULL,
  `order_code` integer NOT NULL,
  `reference` text NOT NULL,
  `target_type` text,
  `target_id` text,
  `seller_user_id` text,
  `description` text NOT NULL,
  `created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `wallet_transactions_order_code_unique` ON `wallet_transactions` (`order_code`);
--> statement-breakpoint
CREATE UNIQUE INDEX `wallet_transactions_reference_unique` ON `wallet_transactions` (`reference`);
--> statement-breakpoint
CREATE INDEX `idx_wallet_transactions_user` ON `wallet_transactions` (`user_id`,`created_at`);
--> statement-breakpoint
CREATE INDEX `idx_wallet_transactions_seller` ON `wallet_transactions` (`seller_user_id`,`created_at`);
--> statement-breakpoint
CREATE TABLE `wallet_topup_requests` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `request_code` text NOT NULL,
  `user_id` text NOT NULL,
  `amount` integer NOT NULL,
  `transfer_content` text NOT NULL,
  `status` text DEFAULT 'pending' NOT NULL,
  `reviewed_by` text,
  `reviewed_at` text,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `wallet_topup_requests_request_code_unique` ON `wallet_topup_requests` (`request_code`);
--> statement-breakpoint
CREATE UNIQUE INDEX `wallet_topup_requests_transfer_content_unique` ON `wallet_topup_requests` (`transfer_content`);
--> statement-breakpoint
CREATE INDEX `idx_wallet_topups_user` ON `wallet_topup_requests` (`user_id`,`created_at`);
--> statement-breakpoint
CREATE INDEX `idx_wallet_topups_status` ON `wallet_topup_requests` (`status`,`created_at`);
