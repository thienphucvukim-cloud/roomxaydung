import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";

assert.equal(process.env.TIPOOK_TEST_TELEGRAM, "1", "This test sends real Telegram notifications; explicitly enable it.");
const origin = process.env.TIPOOK_TEST_ORIGIN || "http://localhost:5173";
assert.ok(["localhost", "127.0.0.1"].includes(new URL(origin).hostname));
const marker = `__wallet_telegram_${crypto.randomUUID()}`;
const directory = ".wrangler/state/v3/d1/miniflare-D1DatabaseObject";
let db;
let userId;
let postId;
try {
  const session = await fetch(origin + "/api/me");
  assert.equal(session.status, 200);
  userId = (await session.json()).user.id;
  const cookie = session.headers.get("set-cookie")?.split(";")[0];
  assert.ok(cookie);
  for (const file of readdirSync(directory).filter(file => file.endsWith(".sqlite") && file !== "metadata.sqlite")) {
    const candidate = new DatabaseSync(`${directory}/${file}`);
    if (candidate.prepare("SELECT 1 FROM member_profiles WHERE user_id=?").get(userId)) { db = candidate; break; }
    candidate.close();
  }
  assert.ok(db);
  db.prepare("UPDATE member_profiles SET display_name=? WHERE user_id=?").run("KIỂM TRA TELEGRAM (dữ liệu thử)", userId);
  const now = new Date().toISOString();
  postId = Number(db.prepare("INSERT INTO posts (user_id, author_name, category, title, content, audience, poll_question, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
    .run(userId, "Kiểm tra Telegram", "Bản vẽ cộng đồng", marker, "Bài thử, sẽ được xóa sau kiểm tra", "Công khai", "20.000đ", now).lastInsertRowid);
  async function send(path, body, status) {
    const response = await fetch(origin + path, { method: "POST", headers: { Cookie: cookie, "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await response.json();
    assert.equal(response.status, status, JSON.stringify(data));
    return data;
  }
  assert.equal((await send("/api/wallet/topups", { amount: 9999 }, 400)).telegram, undefined);
  const topup = await send("/api/wallet/topups", { amount: 10000 }, 201);
  assert.equal(topup.request.status, "pending");
  assert.deepEqual(topup.telegram, { status: "sent" });
  const balance = () => db.prepare("SELECT coalesce(sum(amount),0) AS balance FROM wallet_transactions WHERE user_id=?").get(userId).balance;
  assert.equal(balance(), 0, "Creating a topup request must not credit the wallet.");
  const purchase = { targetType: "post", targetId: String(postId), purchaseId: crypto.randomUUID() };
  assert.equal((await send("/api/wallet/purchase", purchase, 402)).telegram, undefined);
  db.prepare("INSERT INTO wallet_transactions (user_id, kind, amount, order_code, reference, description, created_at) VALUES (?, 'topup', 50000, ?, ?, ?, ?)")
    .run(userId, Date.now(), marker, "Local test balance", now);
  const paid = await send("/api/wallet/purchase", purchase, 201);
  assert.deepEqual(paid.telegram, { status: "sent" });
  assert.equal(balance(), 30000);
  for (const purchaseId of [purchase.purchaseId, crypto.randomUUID()]) {
    const repeat = await send("/api/wallet/purchase", { ...purchase, purchaseId }, 200);
    assert.equal(repeat.alreadyPurchased, true);
    assert.equal(repeat.telegram, undefined, "Repeated purchases must not send another notification.");
  }
  assert.equal(balance(), 30000);
  console.log("Telegram topup and purchase notifications delivered; invalid requests, insufficient funds and repeated purchases do not notify or double-charge.");
} finally {
  if (db) {
    db.prepare("DELETE FROM direct_messages WHERE sender_user_id=? OR recipient_user_id=? OR (sender_user_id='tipook-wallet' AND content LIKE ?)").run(userId, userId, `%${marker}%`);
    for (const table of ["wallet_topup_requests", "wallet_transactions", "member_profiles"]) db.prepare(`DELETE FROM ${table} WHERE user_id=?`).run(userId);
    if (postId) db.prepare("DELETE FROM posts WHERE id=?").run(postId);
    db.close();
  }
}
