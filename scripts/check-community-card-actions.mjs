import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";

const origin = process.env.TIPOOK_TEST_ORIGIN || "http://localhost:5173";
assert.ok(["localhost", "127.0.0.1"].includes(new URL(origin).hostname), "Fixtures are local only.");
const directory = ".wrangler/state/v3/d1/miniflare-D1DatabaseObject";
const database = readdirSync(directory).find(file => file.endsWith(".sqlite") && file !== "metadata.sqlite");
assert.ok(database, "Start the local server first.");
const db = new DatabaseSync(`${directory}/${database}`);
const marker = `__community_actions_${crypto.randomUUID()}`;
const userIds = [];

async function session() {
  const response = await fetch(origin + "/api/me");
  assert.equal(response.status, 200);
  const data = await response.json();
  const cookie = response.headers.get("set-cookie")?.split(";")[0];
  assert.ok(cookie);
  userIds.push(data.user.id);
  return {
    id: data.user.id,
    async send(route, body, expected = 200) {
      const response = await fetch(origin + route, {
        method: body ? "POST" : "GET",
        headers: { Cookie: cookie, ...(body ? { "Content-Type": "application/json" } : {}) },
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await response.json();
      assert.equal(response.status, expected, JSON.stringify(data));
      return data;
    },
  };
}

try {
  const author = await session();
  const visitor = await session();
  const first = (await author.send("/api/posts", { category: "Bộ sưu tập ảnh", title: marker }, 201)).post;
  const second = (await author.send("/api/posts", { category: "Bộ sưu tập ảnh", title: marker }, 201)).post;
  const list = async () => (await visitor.send("/api/posts?" + new URLSearchParams({ category: "Bộ sưu tập ảnh", page: "1", q: marker }))).posts;
  assert.equal((await list()).find(post => post.id === first.id).expertQuestions, 0);

  await visitor.send("/api/comments", { postId: first.id, content: "Bình luận kiểm tra" }, 201);
  await visitor.send("/api/comments", { postId: first.id, content: "Bình luận thứ hai" }, 201);
  const request = (await visitor.send("/api/requests", {
    requestType: "expert-question", targetType: "post", targetId: String(first.id),
    subject: marker, content: "Câu hỏi kiểm tra", channels: ["internal"],
  }, 201)).request;
  assert.equal(request.recipientUserId, author.id);
  assert.ok((await author.send("/api/messages")).messages.some(message => message.requestId === request.id));

  const rows = await list();
  assert.equal(rows.find(post => post.id === first.id).comments, 2);
  assert.equal(rows.find(post => post.id === first.id).expertQuestions, 1);
  assert.equal(rows.find(post => post.id === second.id).comments, 0);
  assert.equal(rows.find(post => post.id === second.id).expertQuestions, 0);
  assert.equal((await visitor.send("/api/comments?postId=" + first.id)).comments.length, 2);
  assert.equal((await visitor.send("/api/comments?postId=" + second.id)).comments.length, 0);
  const modelCounts = await visitor.send("/api/model-engagement?targetId=" + encodeURIComponent(marker));
  assert.equal(modelCounts.comments, 0);
  assert.equal(modelCounts.expertQuestions, 0);
  console.log("PASS: community comment/question counts persist, identical titles stay isolated, questions reach the author, and built-in model discussions stay separate.");
} finally {
  for (const userId of userIds) {
    db.prepare("DELETE FROM direct_messages WHERE sender_user_id=? OR recipient_user_id=?").run(userId, userId);
    db.prepare("DELETE FROM user_requests WHERE user_id=?").run(userId);
    db.prepare("DELETE FROM post_comments WHERE user_id=?").run(userId);
    db.prepare("DELETE FROM posts WHERE user_id=?").run(userId);
    db.prepare("DELETE FROM member_profiles WHERE user_id=?").run(userId);
  }
  db.close();
}
