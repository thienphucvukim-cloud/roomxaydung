CREATE TABLE `user_actions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`action_type` text NOT NULL,
	`target_type` text NOT NULL,
	`target_id` text NOT NULL,
	`payload` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_user_actions_unique` ON `user_actions` (`user_id`,`action_type`,`target_type`,`target_id`);--> statement-breakpoint
CREATE INDEX `idx_user_actions_user` ON `user_actions` (`user_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `user_requests` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`author_name` text NOT NULL,
	`request_type` text NOT NULL,
	`target_type` text NOT NULL,
	`target_id` text NOT NULL,
	`subject` text NOT NULL,
	`content` text NOT NULL,
	`contact` text,
	`attachment_key` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_user_requests_user` ON `user_requests` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_user_requests_type` ON `user_requests` (`request_type`,`created_at`);--> statement-breakpoint
ALTER TABLE `posts` ADD `audience` text DEFAULT 'Công khai' NOT NULL;--> statement-breakpoint
ALTER TABLE `posts` ADD `feeling` text;--> statement-breakpoint
ALTER TABLE `posts` ADD `background` text;--> statement-breakpoint
ALTER TABLE `posts` ADD `mentions` text;--> statement-breakpoint
ALTER TABLE `posts` ADD `poll_question` text;--> statement-breakpoint
ALTER TABLE `posts` ADD `poll_options` text;