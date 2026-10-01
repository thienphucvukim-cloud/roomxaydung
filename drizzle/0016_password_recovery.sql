-- Preserve existing pending challenges while allowing password recovery.
CREATE TABLE auth_email_challenges_v2 (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES website_accounts(user_id) ON DELETE CASCADE,
  purpose TEXT NOT NULL CHECK (purpose IN ('login', 'password', 'reset')),
  browser_hash TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  password_version TEXT NOT NULL,
  session_hash TEXT,
  new_password_hash TEXT,
  redirect_to TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
INSERT INTO auth_email_challenges_v2 SELECT * FROM auth_email_challenges;
DROP TABLE auth_email_challenges;
ALTER TABLE auth_email_challenges_v2 RENAME TO auth_email_challenges;
CREATE INDEX idx_auth_email_challenges_user ON auth_email_challenges(user_id, purpose);
CREATE TABLE auth_password_reset_requests (
  id TEXT PRIMARY KEY NOT NULL,
  email TEXT NOT NULL,
  browser_hash TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX idx_auth_password_reset_email ON auth_password_reset_requests(email);
