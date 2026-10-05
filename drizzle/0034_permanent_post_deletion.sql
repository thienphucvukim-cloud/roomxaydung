-- Preserve only private files already sold, so buyers keep their download rights.
-- The listing itself, its images, comments and interactions are permanently removed.
CREATE TABLE post_attachments_retained (
  id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  post_id INTEGER NOT NULL,
  object_key TEXT NOT NULL,
  file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size INTEGER NOT NULL,
  access_type TEXT NOT NULL DEFAULT 'public',
  created_at TEXT NOT NULL
);
INSERT INTO post_attachments_retained (id, post_id, object_key, file_name, mime_type, size, access_type, created_at)
SELECT id, post_id, object_key, file_name, mime_type, size, access_type, created_at FROM post_attachments;
DROP TABLE post_attachments;
ALTER TABLE post_attachments_retained RENAME TO post_attachments;
CREATE UNIQUE INDEX post_attachments_object_key_unique ON post_attachments(object_key);
CREATE INDEX idx_post_attachments_post_id ON post_attachments(post_id);

CREATE TRIGGER posts_permanent_delete_cleanup BEFORE DELETE ON posts BEGIN
  DELETE FROM post_attachments WHERE post_id = OLD.id
    AND NOT (access_type = 'private' AND EXISTS (
      SELECT 1 FROM wallet_transactions WHERE kind = 'purchase'
        AND target_type = 'post' AND target_id = CAST(OLD.id AS TEXT)
    ));
  DELETE FROM user_actions WHERE target_type = 'post' AND target_id = CAST(OLD.id AS TEXT);
  DELETE FROM catalog_views WHERE target_type = 'post' AND target_id = CAST(OLD.id AS TEXT);
  DELETE FROM catalog_ratings WHERE target_type = 'post' AND target_id = CAST(OLD.id AS TEXT);
  DELETE FROM catalog_downloads WHERE target_type = 'post' AND target_id = CAST(OLD.id AS TEXT);
END;

DELETE FROM posts WHERE audience = 'Đã xóa bởi quản trị';

-- Keep a terminal marker for built-in demo cards to prevent their defaults reappearing.
DELETE FROM website_content WHERE key NOT LIKE '%.visibility'
  AND EXISTS (SELECT 1 FROM website_content marker WHERE marker.value = 'deleted'
    AND marker.key LIKE '%.visibility'
    AND substr(website_content.key, 1, length(marker.key) - 10) = substr(marker.key, 1, length(marker.key) - 10));
