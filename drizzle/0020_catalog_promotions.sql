CREATE TABLE catalog_promotions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('Bản vẽ cộng đồng', 'Nội thất cộng đồng')),
  position INTEGER NOT NULL CHECK (position BETWEEN 1 AND 16),
  months INTEGER NOT NULL CHECK (months BETWEEN 1 AND 12),
  amount INTEGER NOT NULL CHECK (amount > 0),
  reference TEXT NOT NULL UNIQUE,
  starts_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
CREATE INDEX idx_catalog_promotions_slot ON catalog_promotions(category, position, expires_at);
CREATE INDEX idx_catalog_promotions_post ON catalog_promotions(post_id, expires_at);
