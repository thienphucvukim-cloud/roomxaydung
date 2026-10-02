import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";

const origin = process.env.TIPOOK_TEST_ORIGIN || "http://localhost:5173";
assert.ok(["localhost", "127.0.0.1"].includes(new URL(origin).hostname), "Fixtures are local only.");
const directory = ".wrangler/state/v3/d1/miniflare-D1DatabaseObject";
const databases = readdirSync(directory).filter(file => file.endsWith(".sqlite") && file !== "metadata.sqlite");
assert.ok(databases.length, "Start the local server first.");
let db;
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
    async send(route, body, expected = 200, method) {
      const response = await fetch(origin + route, {
        method: method || (body ? "POST" : "GET"),
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
  for (const database of databases) {
    const candidate = new DatabaseSync(`${directory}/${database}`);
    if (candidate.prepare("SELECT 1 FROM member_profiles WHERE user_id=?").get(author.id)) { db = candidate; break; }
    candidate.close();
  }
  assert.ok(db, "Find the database used by the running server.");
  const first = (await author.send("/api/posts", { category: "Bộ sưu tập ảnh", title: marker }, 201)).post;
  const second = (await author.send("/api/posts", { category: "Bộ sưu tập ảnh", title: marker }, 201)).post;
  const list = async () => (await visitor.send("/api/posts?" + new URLSearchParams({ category: "Bộ sưu tập ảnh", page: "1", q: marker }))).posts;
  assert.equal((await list()).find(post => post.id === first.id).expertQuestions, 0);

  await visitor.send("/api/comments", { postId: first.id, content: "Bình luận kiểm tra" }, 201);
  await visitor.send("/api/comments", { postId: first.id, content: "Bình luận thứ hai" }, 201);
  const request = (await visitor.send("/api/requests", {
    requestType: "expert-question", targetType: "post", targetId: String(first.id),
    subject: marker, content: "Câu hỏi kiểm tra", channels: ["zalo", "messenger", "telegram"], recipientUserId: visitor.id,
  }, 201)).request;
  assert.equal(request.recipientUserId, author.id);
  assert.deepEqual(JSON.parse(request.channels), ["internal"]);
  assert.deepEqual(JSON.parse(request.deliveryStatus), { internal: { status: "sent" } });
  assert.ok((await author.send("/api/messages")).messages.some(message => message.requestId === request.id));
  assert.ok(!(await visitor.send("/api/messages")).messages.some(message => message.requestId === request.id));
  const resolvedThread = await visitor.send("/api/messages?" + new URLSearchParams({ targetType: "post", targetId: String(first.id), peerId: visitor.id }));
  assert.equal(resolvedThread.peerId, author.id);
  const reply = (await author.send("/api/messages", { peerId: visitor.id, content: "Chuyên gia trả lời trực tiếp" }, 201)).message;
  const thread = await visitor.send("/api/messages?peerId=" + encodeURIComponent(author.id));
  assert.deepEqual(thread.messages.map(message => message.senderUserId), [visitor.id, author.id]);
  assert.equal(thread.currentUserId, visitor.id);
  assert.ok(thread.messages.some(message => message.id === reply.id));
  await visitor.send("/api/messages", { ids: [reply.id] }, 200, "PATCH");
  assert.ok((await author.send("/api/messages?peerId=" + encodeURIComponent(visitor.id))).messages.find(message => message.id === reply.id).readAt);
  const unrelated = await session();
  assert.equal((await unrelated.send("/api/messages?peerId=" + encodeURIComponent(author.id))).messages.length, 0);
  await unrelated.send("/api/messages", { id: reply.id }, 404, "PATCH");
  const conversations = (await visitor.send("/api/messages?mode=conversations")).conversations;
  assert.equal(conversations.find(conversation => conversation.peerId === author.id).lastMessage.id, reply.id);
  assert.equal(conversations.find(conversation => conversation.peerId === author.id).unread, 0);
  assert.equal((await visitor.send("/api/messages?peerId=" + encodeURIComponent(author.id) + "&before=" + reply.id)).messages.length, 1);
  await visitor.send("/api/messages", { peerId: "nonexistent-peer", content: "Không có người nhận" }, 404);
  await visitor.send("/api/messages", { peerId: author.id, content: "x".repeat(2001) }, 400);

  const modelRequest = (await visitor.send("/api/requests", {
    requestType: "expert-question", targetType: "house-model", targetId: "Nhà 3 tầng có sân trước",
    subject: marker, content: "Câu hỏi cho tác giả mẫu nhà", recipientUserId: visitor.id, channels: [],
  }, 201)).request;
  assert.equal(modelRequest.recipientUserId, "virtual-architect-003");
  assert.deepEqual(JSON.parse(modelRequest.channels), ["internal"]);
  assert.equal(db.prepare("SELECT recipient_user_id FROM direct_messages WHERE request_id=?").get(modelRequest.id).recipient_user_id, "virtual-architect-003");

  await visitor.send("/api/requests", {
    requestType: "expert-question", targetType: "post", targetId: "999999999",
    subject: marker, content: "Bài không tồn tại", recipientUserId: visitor.id,
  }, 400);

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
  console.log("PASS: questions reach the correct author internally; two-way chat, read receipts, conversation lists, pagination and access isolation work; community counts stay separate.");
} finally {
  for (const userId of db ? userIds : []) {
    db.prepare("DELETE FROM direct_messages WHERE sender_user_id=? OR recipient_user_id=?").run(userId, userId);
    db.prepare("DELETE FROM user_requests WHERE user_id=?").run(userId);
    db.prepare("DELETE FROM post_comments WHERE user_id=?").run(userId);
    db.prepare("DELETE FROM posts WHERE user_id=?").run(userId);
    db.prepare("DELETE FROM member_profiles WHERE user_id=?").run(userId);
  }
  db?.close();
}
