CREATE TABLE wallet_sale_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  admin_percent INTEGER NOT NULL DEFAULT 20 CHECK (admin_percent BETWEEN 0 AND 99),
  updated_by TEXT,
  updated_at TEXT
);
INSERT INTO wallet_sale_settings (id, admin_percent) VALUES (1, 20);

-- Previous credits paid the full sale price; preserve their original split.
ALTER TABLE wallet_sale_credits ADD COLUMN admin_percent INTEGER NOT NULL DEFAULT 0 CHECK (admin_percent BETWEEN 0 AND 99);
ALTER TABLE wallet_sale_credits ADD COLUMN gross_amount INTEGER;
UPDATE wallet_sale_credits SET gross_amount = amount;
