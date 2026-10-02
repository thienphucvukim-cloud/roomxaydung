import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";

const db = new DatabaseSync(":memory:");
db.exec("PRAGMA foreign_keys = ON");
for (const name of readdirSync("drizzle").filter(name => name.endsWith(".sql") && name < "0018").sort()) db.exec(readFileSync(`drizzle/${name}`, "utf8"));
db.exec(`
  INSERT INTO website_accounts VALUES ('owner', 'owner@example.test', 'Owner', 'existing-hash', '2026-01-01', 1);
  INSERT INTO website_sessions VALUES ('session', 'owner', 9999999999999, 1);
  INSERT INTO auth_email_challenges VALUES ('email-code', 'owner', 'reset', 'browser', 'code', 'password', NULL, NULL, '/tai-khoan', 0, 9999999999999, 1);
  INSERT INTO admin_totp_credentials VALUES ('owner', 'encrypted-existing-secret', 42, 1);
  INSERT INTO admin_recovery_codes VALUES ('recovery-code', 'owner');
  INSERT INTO admin_totp_challenges VALUES ('totp-code', 'owner', 'login', 'browser', 'password', 'credential', NULL, NULL, NULL, '/tai-khoan', 0, 9999999999999);
`);
const tables = ["website_accounts", "website_sessions", "auth_email_challenges", "admin_totp_credentials", "admin_recovery_codes", "admin_totp_challenges"];
const before = tables.map(table => db.prepare(`SELECT * FROM ${table}`).all());
db.exec("BEGIN");
db.exec(readFileSync("drizzle/0018_member_username_google.sql", "utf8"));
db.exec("COMMIT");
for (let i = 0; i < tables.length; i++) {
  const after = db.prepare(`SELECT * FROM ${tables[i]}`).all();
  if (i === 0) { assert.equal(after[0].username, null); assert.equal(after[0].google_sub, null); delete after[0].username; delete after[0].google_sub; }
  assert.deepEqual(after, before[i], `${tables[i]} must preserve all existing rows`);
}
assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);
db.exec(`INSERT INTO website_accounts (user_id, username, display_name, password_hash, created_at) VALUES ('alice', 'alice', 'Alice', 'hash', '2026-01-01'), ('bob', 'bob', 'Bob', 'hash', '2026-01-01')`);
assert.equal(db.prepare("SELECT count(*) AS total FROM website_accounts WHERE email IS NULL").get().total, 2);
assert.throws(() => db.exec("INSERT INTO website_accounts (user_id, username, display_name, password_hash, created_at) VALUES ('duplicate', 'alice', 'Other', 'hash', '2026-01-01')"), /UNIQUE/);
db.exec("DELETE FROM website_accounts WHERE user_id = 'owner'");
for (const table of tables.slice(1)) assert.equal(db.prepare(`SELECT count(*) AS total FROM ${table}`).get().total, 0, `${table} must still cascade on deletion`);
db.close();
console.log("PASS: account migration preserves sessions, email challenges, TOTP secrets, recovery codes and constraints; multiple accounts need no email.");
