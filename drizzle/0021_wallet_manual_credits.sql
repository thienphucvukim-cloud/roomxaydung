CREATE TABLE wallet_manual_credits (
  reference text PRIMARY KEY NOT NULL,
  user_id text NOT NULL,
  amount integer NOT NULL CHECK (amount > 0 AND amount <= 20000000),
  order_code integer NOT NULL UNIQUE,
  reason text NOT NULL,
  performed_by text NOT NULL,
  created_at text NOT NULL
);
CREATE INDEX idx_wallet_manual_credits_created ON wallet_manual_credits (created_at);
