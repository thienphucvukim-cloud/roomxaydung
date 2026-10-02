-- All existing funds stay in the deposit wallet. Historical manual credits
-- cannot safely be inferred to be file revenue.
ALTER TABLE wallet_transactions ADD COLUMN wallet TEXT NOT NULL DEFAULT 'deposit' CHECK (wallet IN ('deposit', 'sales'));
CREATE INDEX idx_wallet_transactions_wallet ON wallet_transactions (user_id, wallet, created_at);

CREATE TABLE wallet_sale_credits (
  purchase_id INTEGER PRIMARY KEY REFERENCES wallet_transactions(id),
  seller_user_id TEXT NOT NULL,
  amount INTEGER NOT NULL CHECK (amount > 0),
  reviewed_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  revoked_by TEXT,
  revoked_at TEXT,
  revocation_reason TEXT
);

CREATE TABLE wallet_withdrawals (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL,
  amount INTEGER NOT NULL CHECK (amount > 0),
  bank_name TEXT NOT NULL,
  account_number TEXT NOT NULL,
  account_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'rejected')),
  review_note TEXT,
  reviewed_by TEXT,
  reviewed_at TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_wallet_withdrawals_user ON wallet_withdrawals (user_id, created_at);
CREATE INDEX idx_wallet_withdrawals_status ON wallet_withdrawals (status, created_at);
