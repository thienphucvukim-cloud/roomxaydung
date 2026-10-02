import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";

const origin = process.env.TIPOOK_TEST_ORIGIN || "http://localhost:5173";
assert.ok(["localhost", "127.0.0.1"].includes(new URL(origin).hostname));
const variables = Object.fromEntries(readFileSync(".dev.vars", "utf8").split(/\r?\n/)
  .filter(line => /^\s*[A-Z][A-Z0-9_]*\s*=/.test(line))
  .map(line => { const index = line.indexOf("="); return [line.slice(0, index).trim(), line.slice(index + 1).trim().replace(/^(["'])(.*)\1$/, "$2")]; }));
const liveTelegram = process.env.TIPOOK_TEST_TELEGRAM === "1";
assert.ok(liveTelegram || !variables.TELEGRAM_BOT_TOKEN, "Set TIPOOK_TEST_TELEGRAM=1 explicitly to send a real test notification.");
if (liveTelegram) assert.ok(variables.TELEGRAM_BOT_TOKEN && variables.TELEGRAM_ADMIN_CHAT_ID);
const marker = `__file_request_${crypto.randomUUID()}`;
const directory = ".wrangler/state/v3/d1/miniflare-D1DatabaseObject";
let db;
let visitorId;
try {
  const session = await fetch(origin + "/api/me");
  assert.equal(session.status, 200);
  visitorId = (await session.json()).user.id;
  const cookie = session.headers.get("set-cookie")?.split(";")[0];
  assert.ok(cookie);
  for (const file of readdirSync(directory).filter(file => file.endsWith(".sqlite") && file !== "metadata.sqlite")) {
    const candidate = new DatabaseSync(`${directory}/${file}`);
    if (candidate.prepare("SELECT 1 FROM member_profiles WHERE user_id=?").get(visitorId)) { db = candidate; break; }
    candidate.close();
  }
  assert.ok(db);
  const adminId = variables.TIPOOK_ADMIN_USER_ID || db.prepare("SELECT user_id FROM member_profiles WHERE email=?")
    .get(variables.TIPOOK_ADMIN_EMAIL.trim().toLowerCase())?.user_id;
  assert.ok(adminId, "The administrator must have signed in once.");
  for (const channels of liveTelegram ? [["zalo", "messenger"]] : [[], ["zalo", "messenger"]]) {
    const response = await fetch(origin + "/api/requests", {
      method: "POST", headers: { Cookie: cookie, "Content-Type": "application/json" },
      body: JSON.stringify({ requestType: "drawing-file-request", targetType: "drawing", targetId: marker,
        recipientUserId: visitorId, subject: marker, content: "Local routing verification", contact: "test@example.invalid", channels }),
    });
    const data = await response.json();
    assert.equal(response.status, 201, JSON.stringify(data));
    assert.equal(data.request.recipientUserId, adminId);
    assert.deepEqual(JSON.parse(data.request.channels), ["internal", "telegram"]);
    assert.deepEqual(data.delivery, { internal: { status: "sent" }, telegram: liveTelegram ? { status: "sent" } : { status: "unavailable", detail: "missing-token" } });
    const message = db.prepare("SELECT recipient_user_id FROM direct_messages WHERE request_id=?").get(data.request.id);
    assert.equal(message.recipient_user_id, adminId);
    assert.deepEqual(JSON.parse(db.prepare("SELECT delivery_status FROM user_requests WHERE id=?").get(data.request.id).delivery_status), data.delivery);
  }
  console.log(liveTelegram ? "File request routed to admin and Telegram notification delivered." : "File requests route to admin, force Telegram, and report missing configuration correctly.");
} finally {
  if (db) {
    db.prepare("DELETE FROM direct_messages WHERE request_id IN (SELECT id FROM user_requests WHERE subject=?)").run(marker);
    db.prepare("DELETE FROM user_requests WHERE subject=?").run(marker);
    if (visitorId) db.prepare("DELETE FROM member_profiles WHERE user_id=?").run(visitorId);
    db.close();
  }
}
