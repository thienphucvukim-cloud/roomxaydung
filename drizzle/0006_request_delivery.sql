ALTER TABLE `user_requests` ADD `recipient_user_id` text;
--> statement-breakpoint
ALTER TABLE `user_requests` ADD `channels` text;
--> statement-breakpoint
ALTER TABLE `user_requests` ADD `delivery_status` text;
--> statement-breakpoint
ALTER TABLE `virtual_profiles` ADD `zalo_user_id` text;
--> statement-breakpoint
ALTER TABLE `virtual_profiles` ADD `messenger_psid` text;
--> statement-breakpoint
ALTER TABLE `virtual_profiles` ADD `telegram_chat_id` text;
--> statement-breakpoint
ALTER TABLE `virtual_profiles` ADD `internal_chat_id` text;
--> statement-breakpoint
CREATE TABLE `direct_messages` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `sender_user_id` text NOT NULL,
  `sender_name` text NOT NULL,
  `recipient_user_id` text NOT NULL,
  `request_id` integer,
  `subject` text NOT NULL,
  `content` text NOT NULL,
  `attachment_key` text,
  `read_at` text,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  FOREIGN KEY (`request_id`) REFERENCES `user_requests`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_direct_messages_recipient` ON `direct_messages` (`recipient_user_id`,`created_at`);
--> statement-breakpoint
CREATE INDEX `idx_direct_messages_sender` ON `direct_messages` (`sender_user_id`,`created_at`);