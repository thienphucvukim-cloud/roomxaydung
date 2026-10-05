import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";

const sqlite = new DatabaseSync(":memory:");
const migration = "0034_permanent_post_deletion.sql";
try {
  for (const file of readdirSync("drizzle").filter(name => name.endsWith(".sql") && name < migration).sort()) sqlite.exec(readFileSync(`drizzle/${file}`, "utf8"));
  const add = sqlite.prepare("INSERT INTO posts (user_id, author_name, category, title, content, audience, created_at) VALUES ('author', 'Author', 'Bảng tin', 'Listing', 'Content', ?, '2026-10-05') RETURNING id");
  const adminDeleted = add.get("Đã xóa bởi quản trị").id;
  const authorDeleted = add.get("Đã xóa bởi tác giả").id;
  const moderatedDeleted = add.get("Tác giả xóa bài bị quản trị ẩn").id;
  const hidden = add.get("Ẩn bởi quản trị").id;
  const publicId = add.get("Công khai").id;
  const file = sqlite.prepare("INSERT INTO post_attachments (post_id, object_key, file_name, mime_type, size, access_type, created_at) VALUES (?, ?, 'plan.pdf', 'application/pdf', 100, ?, '2026-10-05')");
  file.run(adminDeleted, "purchased", "private");
  file.run(adminDeleted, "public-image", "public");
  file.run(authorDeleted, "author-image", "public");
  file.run(hidden, "hidden-file", "private");
  file.run(publicId, "public-file", "private");
  sqlite.prepare("INSERT INTO wallet_transactions (user_id, kind, amount, order_code, reference, target_type, target_id, description, created_at) VALUES ('buyer', 'purchase', -100000, 123, 'migration-test', 'post', ?, 'Purchase', '2026-10-05')").run(String(adminDeleted));
  const ledger = sqlite.prepare("SELECT * FROM wallet_transactions").all();
  const purchased = sqlite.prepare("SELECT * FROM post_attachments WHERE object_key = 'purchased'").get();
  const retained = sqlite.prepare("SELECT * FROM post_attachments WHERE post_id != ? ORDER BY id").all(adminDeleted);
  const content = sqlite.prepare("INSERT INTO website_content (key, kind, value, updated_by, updated_at) VALUES (?, 'text', ?, 'admin', '2026-10-05')");
  for (const [key, value] of [["facade.0.visibility", "deleted"], ["facade.0.title", "Deleted override"], ["facade.1.visibility", "hidden"], ["facade.1.title", "Hidden override"], ["facade.text.0", "Catalog intro"]]) content.run(key, value);
  sqlite.exec(readFileSync(`drizzle/${migration}`, "utf8"));
  assert.equal(sqlite.prepare("SELECT id FROM posts WHERE id = ?").get(adminDeleted), undefined);
  for (const id of [authorDeleted, moderatedDeleted, hidden, publicId]) assert.ok(sqlite.prepare("SELECT id FROM posts WHERE id = ?").get(id));
  assert.deepEqual(sqlite.prepare("SELECT * FROM wallet_transactions").all(), ledger);
  assert.deepEqual(sqlite.prepare("SELECT * FROM post_attachments WHERE object_key = 'purchased'").get(), purchased);
  assert.deepEqual(sqlite.prepare("SELECT * FROM post_attachments WHERE post_id != ? ORDER BY id").all(adminDeleted), retained);
  assert.equal(sqlite.prepare("SELECT id FROM post_attachments WHERE object_key = 'public-image'").get(), undefined);
  assert.equal(sqlite.prepare("SELECT key FROM website_content WHERE key = 'facade.0.title'").get(), undefined);
  for (const key of ["facade.0.visibility", "facade.1.title", "facade.text.0"]) assert.ok(sqlite.prepare("SELECT key FROM website_content WHERE key = ?").get(key));
  assert.deepEqual(sqlite.prepare("PRAGMA foreign_key_check").all(), []);
  console.log("PASS: legacy admin deletions purged; author deletions and hidden/public posts retained; purchased file IDs/metadata and full ledger unchanged; deleted demo overrides removed.");
} finally { sqlite.close(); }
