CREATE TABLE catalog_downloads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE UNIQUE INDEX idx_catalog_downloads_unique ON catalog_downloads (target_type, target_id, user_id);
