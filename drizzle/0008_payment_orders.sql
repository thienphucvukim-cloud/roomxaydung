CREATE TABLE `payment_orders` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `order_code` integer NOT NULL,
  `buyer_user_id` text NOT NULL,
  `buyer_name` text NOT NULL,
  `buyer_email` text,
  `seller_user_id` text NOT NULL,
  `target_type` text NOT NULL,
  `target_id` text NOT NULL,
  `product_title` text NOT NULL,
  `amount` integer NOT NULL,
  `provider` text DEFAULT 'payos' NOT NULL,
  `payment_link_id` text,
  `checkout_url` text,
  `status` text DEFAULT 'pending' NOT NULL,
  `transaction_reference` text,
  `paid_at` text,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `payment_orders_order_code_unique` ON `payment_orders` (`order_code`);
--> statement-breakpoint
CREATE INDEX `idx_payment_orders_buyer` ON `payment_orders` (`buyer_user_id`,`created_at`);
--> statement-breakpoint
CREATE INDEX `idx_payment_orders_seller` ON `payment_orders` (`seller_user_id`,`created_at`);
--> statement-breakpoint
CREATE INDEX `idx_payment_orders_status` ON `payment_orders` (`status`,`created_at`);