ALTER TABLE member_profiles ADD COLUMN account_status TEXT NOT NULL DEFAULT 'active' CHECK (account_status IN ('active', 'disabled', 'deleted'));
ALTER TABLE member_profiles ADD COLUMN moderation_reason TEXT NOT NULL DEFAULT '';
ALTER TABLE member_profiles ADD COLUMN moderation_version INTEGER NOT NULL DEFAULT 0;

CREATE TABLE admin_member_moderation (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL,
  performed_by TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('disable', 'enable', 'delete')),
  reason TEXT NOT NULL,
  version INTEGER NOT NULL,
  created_at TEXT NOT NULL
);
CREATE UNIQUE INDEX idx_admin_member_moderation_version ON admin_member_moderation(user_id, version);
