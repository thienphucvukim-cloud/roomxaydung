CREATE TABLE website_accounts (
  user_id TEXT PRIMARY KEY NOT NULL,
  email TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE website_sessions (
  token_hash TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES website_accounts(user_id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL
);
CREATE INDEX idx_website_sessions_user ON website_sessions(user_id);
CREATE TABLE auth_rate_limits (
  key TEXT PRIMARY KEY NOT NULL,
  attempts INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
