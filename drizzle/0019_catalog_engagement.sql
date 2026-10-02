CREATE TABLE catalog_views (
  id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE UNIQUE INDEX idx_catalog_views_unique ON catalog_views (target_type, target_id, user_id);

CREATE TABLE catalog_ratings (
  id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX idx_catalog_ratings_unique ON catalog_ratings (target_type, target_id, user_id);
