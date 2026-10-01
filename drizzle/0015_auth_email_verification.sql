ALTER TABLE website_sessions ADD COLUMN owner_verified INTEGER NOT NULL DEFAULT 0;
CREATE TABLE auth_email_challenges (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES website_accounts(user_id) ON DELETE CASCADE,
  purpose TEXT NOT NULL CHECK (purpose IN ('login', 'password')),
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
CREATE INDEX idx_auth_email_challenges_user ON auth_email_challenges(user_id, purpose);
CREATE TABLE auth_email_cooldowns (
  key TEXT PRIMARY KEY NOT NULL,
  sent_at INTEGER NOT NULL
);
