-- D1 keeps foreign keys enabled. Preserve child rows before rebuilding the
-- account table, because DROP TABLE cascades even with deferred constraints.
CREATE TABLE __auth_0018_sessions AS SELECT * FROM website_sessions;
CREATE TABLE __auth_0018_email_challenges AS SELECT * FROM auth_email_challenges;
CREATE TABLE __auth_0018_totp_credentials AS SELECT * FROM admin_totp_credentials;
CREATE TABLE __auth_0018_recovery_codes AS SELECT * FROM admin_recovery_codes;
CREATE TABLE __auth_0018_totp_challenges AS SELECT * FROM admin_totp_challenges;

CREATE TABLE website_accounts_v3 (
  user_id TEXT PRIMARY KEY NOT NULL,
  email TEXT UNIQUE,
  username TEXT UNIQUE,
  google_sub TEXT UNIQUE,
  display_name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  is_owner INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
INSERT INTO website_accounts_v3 (user_id, email, display_name, password_hash, is_owner, created_at)
  SELECT user_id, email, display_name, password_hash, is_owner, created_at FROM website_accounts;
DROP TABLE website_accounts;
ALTER TABLE website_accounts_v3 RENAME TO website_accounts;

INSERT INTO website_sessions SELECT * FROM __auth_0018_sessions;
INSERT INTO auth_email_challenges SELECT * FROM __auth_0018_email_challenges;
INSERT INTO admin_totp_credentials SELECT * FROM __auth_0018_totp_credentials;
INSERT INTO admin_recovery_codes SELECT * FROM __auth_0018_recovery_codes;
INSERT INTO admin_totp_challenges SELECT * FROM __auth_0018_totp_challenges;
DROP TABLE __auth_0018_sessions;
DROP TABLE __auth_0018_email_challenges;
DROP TABLE __auth_0018_totp_credentials;
DROP TABLE __auth_0018_recovery_codes;
DROP TABLE __auth_0018_totp_challenges;

CREATE TABLE auth_google_requests (
  state_hash TEXT PRIMARY KEY NOT NULL,
  browser_hash TEXT NOT NULL,
  verifier TEXT NOT NULL,
  nonce TEXT NOT NULL,
  redirect_to TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX idx_auth_google_requests_expiry ON auth_google_requests(expires_at);
