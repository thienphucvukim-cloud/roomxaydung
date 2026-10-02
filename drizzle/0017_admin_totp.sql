CREATE TABLE admin_totp_credentials (
  user_id TEXT PRIMARY KEY NOT NULL REFERENCES website_accounts(user_id) ON DELETE CASCADE,
  secret_encrypted TEXT NOT NULL,
  last_step INTEGER NOT NULL DEFAULT -1,
  created_at INTEGER NOT NULL
);
CREATE TABLE admin_recovery_codes (
  code_hash TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES website_accounts(user_id) ON DELETE CASCADE
);
CREATE INDEX idx_admin_recovery_codes_user ON admin_recovery_codes(user_id);
CREATE TABLE admin_totp_challenges (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES website_accounts(user_id) ON DELETE CASCADE,
  purpose TEXT NOT NULL CHECK (purpose IN ('login', 'setup', 'password', 'rotate')),
  browser_hash TEXT NOT NULL,
  password_version TEXT NOT NULL,
  credential_version TEXT,
  pending_secret TEXT,
  new_password_hash TEXT,
  session_hash TEXT,
  redirect_to TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  expires_at INTEGER NOT NULL
);
CREATE INDEX idx_admin_totp_challenges_user ON admin_totp_challenges(user_id);
-- Existing email-verified owner sessions must enroll/login with TOTP again.
DELETE FROM website_sessions WHERE user_id IN (SELECT user_id FROM website_accounts WHERE is_owner = 1);
DELETE FROM auth_email_challenges WHERE user_id IN (SELECT user_id FROM website_accounts WHERE is_owner = 1);
