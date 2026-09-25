CREATE TABLE `delivery_profiles` (
  `user_id` text PRIMARY KEY NOT NULL,
  `zalo_user_id` text,
  `messenger_psid` text,
  `telegram_chat_id` text,
  `internal_chat_id` text,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);