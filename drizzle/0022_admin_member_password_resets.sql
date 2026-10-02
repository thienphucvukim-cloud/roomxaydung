CREATE TABLE admin_member_password_resets (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES website_accounts(user_id) ON DELETE CASCADE,
  performed_by TEXT NOT NULL,
  verification_note TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_admin_member_password_resets_user ON admin_member_password_resets(user_id, created_at);
