CREATE TABLE `member_profiles` (
  `user_id` text PRIMARY KEY NOT NULL,
  `display_name` text NOT NULL,
  `email` text,
  `account_type` text DEFAULT 'user' NOT NULL,
  `profession` text,
  `upgraded_at` text,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_member_profiles_type` ON `member_profiles` (`account_type`);