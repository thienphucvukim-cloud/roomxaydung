CREATE TABLE catalog_quality_flags (
  target_type TEXT NOT NULL CHECK(target_type IN ('post', 'demo')),
  target_id TEXT NOT NULL,
  reviewed_by TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY(target_type, target_id)
);
CREATE TRIGGER catalog_quality_delete_post AFTER DELETE ON posts BEGIN
  DELETE FROM catalog_quality_flags WHERE target_type = 'post' AND target_id = CAST(OLD.id AS TEXT);
END;
CREATE TRIGGER catalog_quality_delete_demo_insert AFTER INSERT ON website_content
WHEN NEW.key LIKE '%.visibility' AND NEW.value = 'deleted' BEGIN
  DELETE FROM catalog_quality_flags WHERE target_type = 'demo' AND target_id = substr(NEW.key, 1, length(NEW.key) - 11);
END;
CREATE TRIGGER catalog_quality_delete_demo_update AFTER UPDATE ON website_content
WHEN NEW.key LIKE '%.visibility' AND NEW.value = 'deleted' BEGIN
  DELETE FROM catalog_quality_flags WHERE target_type = 'demo' AND target_id = substr(NEW.key, 1, length(NEW.key) - 11);
END;
