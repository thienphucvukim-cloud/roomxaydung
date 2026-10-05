// Run with node --experimental-vm-modules scripts/test-news-feed.mjs.
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { createContext, SourceTextModule, SyntheticModule } from "node:vm";
import { posix } from "node:path";
import ts from "typescript";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import * as schema from "../db/schema.ts";

const sqlite = new DatabaseSync(":memory:");
for (const file of readdirSync("drizzle").filter(name => name.endsWith(".sql")).sort()) sqlite.exec(readFileSync(`drizzle/${file}`, "utf8"));
const db = drizzle(async (sql, params, method) => {
  const statement = sqlite.prepare(sql);
  if (method === "run") return { rows: [], ...statement.run(...params) };
  statement.setReturnArrays(true);
  return { rows: method === "get" ? statement.get(...params) : statement.all(...params) };
});
const context = createContext({ URL, URLSearchParams, Response, Request, console });
const cache = new Map();
let signedIn = true;
const objects = new Map();
async function load(specifier, referencing) {
  const path = specifier.startsWith(".") ? posix.normalize(posix.join(posix.dirname(referencing.identifier), specifier)) : specifier;
  if (cache.has(path)) return cache.get(path);
  const namespace = path === "@/db" ? { getDb: () => db } : path === "@/db/schema" ? schema
    : path === "@/lib/member-access" ? { memberAccessResponse: async () => signedIn ? null : Response.json({ error: "Login required" }, { status: 401 }) }
    : path === "@/lib/member-identity" ? { currentMember: async () => ({ userId: "member", authorName: "Member", email: "member@example.test" }), currentUserId: async () => "member" }
    : path === "@/lib/payment-identity" ? { getPaymentBuyerId: async () => signedIn ? "member" : null }
    : path === "cloudflare:workers" ? { env: { BUCKET: { head: async key => objects.get(key) ?? null, delete: async key => objects.delete(key) } } }
    : !path.startsWith("@/") ? await import(path) : null;
  const vmModule = namespace ? new SyntheticModule(Object.keys(namespace), function () {
    for (const [key, value] of Object.entries(namespace)) this.setExport(key, value);
  }, { context }) : new SourceTextModule(ts.transpileModule(readFileSync(path.slice(2) + (path.endsWith(".ts") ? "" : ".ts"), "utf8"), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  }).outputText, { context, identifier: path });
  cache.set(path, vmModule);
  return vmModule;
}
const route = await load("@/app/api/news-feed/route");
await route.link(load);
await route.evaluate();
const publishing = await load("@/app/api/posts/route");
await publishing.link(load);
await publishing.evaluate();
const commenting = await load("@/app/api/comments/route");
await commenting.link(load);
await commenting.evaluate();
const files = await load("@/app/api/files/route");
await files.link(load);
await files.evaluate();
async function comment(body, status = 201) {
  const response = await commenting.namespace.POST(new Request("http://localhost/api/comments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }));
  const payload = await response.json();
  assert.equal(response.status, status, JSON.stringify(payload));
  return payload;
}
async function readComments(params, status = 200) {
  const response = await commenting.namespace.GET(new Request("http://localhost/api/comments?" + new URLSearchParams(params)));
  const payload = await response.json();
  assert.equal(response.status, status, JSON.stringify(payload));
  if (status === 200) assert.equal(response.headers.get("Cache-Control"), "private, no-store");
  return payload;
}
async function publish(body, status = 201) {
  const response = await publishing.namespace.POST(new Request("http://localhost/api/posts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }));
  const payload = await response.json();
  assert.equal(response.status, status, JSON.stringify(payload));
  return payload;
}
async function read(params = {}, status = 200) {
  const response = await route.namespace.GET(new Request("http://localhost/api/news-feed?" + new URLSearchParams(params)));
  const result = await response.json();
  assert.equal(response.status, status, JSON.stringify(result));
  if (status === 200) assert.equal(response.headers.get("Cache-Control"), "no-store");
  return result;
}
const insert = sqlite.prepare("INSERT INTO posts (user_id, author_name, category, title, content, audience, created_at) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id");
const add = (category, title, createdAt, audience = "Công khai") => insert.get("author", "Người chia sẻ", category, title, "Nội dung thực tế", audience, createdAt).id;
try {
  assert.equal((await read()).total, 0);
  assert.equal((await read()).totalPages, 1);
  const oldest = add("Bộ sưu tập ảnh", "Mặt tiền cũ", "2026-01-01T00:00:00.000Z");
  for (let day = 2; day <= 22; day++) add("Bộ sưu tập ảnh", `Mặt tiền ${day}`, `2026-01-${String(day).padStart(2, "0")}T00:00:00.000Z`);
  const drawing = add("Bản vẽ cộng đồng", "Bản vẽ mới", "2026-02-01T00:00:00.000Z");
  const interior = add("Nội thất cộng đồng", "Nội thất mới", "2026-02-01T00:00:00.000Z");
  add("Bộ sưu tập ảnh", "Bài riêng tư", "2026-03-01T00:00:00.000Z", "Chỉ mình tôi");
  add("Bộ sưu tập ảnh", "Bài đã ẩn", "2026-03-01T00:00:00.000Z", "Ẩn bởi quản trị");
  add("Bộ sưu tập ảnh", "Bài đã xóa", "2026-03-01T00:00:00.000Z", "Đã xóa bởi quản trị");
  add("Thảo luận mẫu nhà", "Bình luận mẫu nhà", "2026-03-01T00:00:00.000Z");
  const attach = sqlite.prepare("INSERT INTO post_attachments (post_id, object_key, file_name, mime_type, size, access_type, created_at) VALUES (?, ?, ?, ?, 10, ?, '2026-02-01T00:00:00.000Z')");
  attach.run(drawing, "cover", "cover.png", "image/png", "public");
  attach.run(drawing, "second", "second.png", "image/png", "public");
  attach.run(drawing, "private-preview", "secret.png", "image/png", "private");
  attach.run(drawing, "paid-file", "paid.pdf", "application/pdf", "private");
  const first = await read();
  assert.equal(first.posts[0].avatarUrl, null);
  sqlite.prepare("INSERT INTO member_profiles (user_id, display_name, avatar_key, google_avatar_url, updated_at) VALUES ('author', 'Người chia sẻ', 'custom-avatar', 'https://google.test/avatar', 'now')").run();
  assert.equal((await read()).posts[0].avatarUrl, "/api/files?key=custom-avatar");
  sqlite.prepare("UPDATE member_profiles SET avatar_key=NULL WHERE user_id='author'").run();
  assert.equal((await read()).posts[0].avatarUrl, "https://google.test/avatar");
  assert.equal(first.total, 24);
  assert.equal(first.posts.length, 20);
  assert.equal(first.totalPages, 2);
  assert.equal(first.posts[0].id, interior, "Equal timestamps use descending ID order.");
  assert.equal(first.posts[1].id, drawing);
  assert.deepEqual(first.posts[1].images.map(image => image.name), ["cover.png", "second.png"]);
  assert.ok(!JSON.stringify(first).includes("paid-file"));
  assert.ok(!JSON.stringify(first).includes("private-preview"));
  const second = await read({ page: "2" });
  assert.equal(second.posts.length, 4);
  assert.equal(second.posts.at(-1).id, oldest);
  assert.equal(new Set([...first.posts, ...second.posts].map(post => post.id)).size, 24);
  const filtered = await read({ category: "Bộ sưu tập ảnh", q: "Mặt tiền cũ" });
  assert.equal(filtered.total, 1);
  assert.equal(filtered.posts[0].sourceHref, `/${filtered.posts[0].slug}`, "Source links address the original post independently of pagination and search.");
  assert.equal((await read({ q: "Người chia sẻ" })).total, 24);
  assert.equal((await read({ category: "Bản vẽ cộng đồng" })).posts[0].sourceHref, `/${first.posts[1].slug}`);
  assert.equal(first.posts[0].sourceHref, `/${first.posts[0].slug}`);
  for (const item of [filtered.posts[0], first.posts[1], first.posts[0]]) {
    const sourceUrl = new URL(item.sourceHref, "http://localhost");
    const params = new URLSearchParams({ category: item.category, postId: String(item.id) });
    if (item.category === "Bộ sưu tập ảnh") params.set("seed", "4321");
    else params.set("page", "1");
    const sourceResponse = await publishing.namespace.GET(new Request("http://localhost/api/posts?" + params));
    assert.equal(sourceResponse.status, 200);
    const sourcePayload = await sourceResponse.json();
    assert.deepEqual(sourcePayload.posts.map(post => post.id), [item.id], "The source catalog must return exactly the original post, including older posts outside its first page.");
    assert.equal(sourceUrl.hash, "");
    assert.equal(sourceUrl.search, "");
    assert.deepEqual((await read({ slug: item.slug })).posts.map(post => post.id), [item.id], "Readable links resolve the exact post across categories");
  }
  assert.equal((await read({ q: "không có" })).total, 0);
  for (const page of ["0", "-1", "1.5", "NaN", "1000001"]) await read({ page }, 400);
  await read({ category: "Không hợp lệ" }, 400);
  const latest = add("Bộ sưu tập ảnh", "Bài vừa đăng", "2026-04-01T00:00:00.000Z");
  assert.equal((await read()).posts[0].id, latest, "New publications appear without copying or rebuilding feed data.");
  sqlite.prepare("UPDATE posts SET audience = 'Ẩn bởi quản trị' WHERE id = ?").run(latest);
  assert.ok(!(await read()).posts.some(post => post.id === latest));
  sqlite.prepare("DELETE FROM posts WHERE id = ?").run(oldest);
  assert.equal((await read({ q: "Mặt tiền cũ" })).total, 0);
  const direct = add("Bảng tin", "Bài đăng trực tiếp", "2026-05-01T00:00:00.000Z");
  const directFeed = await read({ category: "Bảng tin" });
  assert.equal(directFeed.posts[0].id, direct);
  assert.equal(directFeed.posts[0].sourceHref, `/${directFeed.posts[0].slug}`);
  assert.equal((await read({ postId: String(direct) })).posts.length, 1);
  assert.equal((await read({ postId: String(direct) })).posts[0].id, direct);
  sqlite.prepare("UPDATE posts SET audience = 'Chỉ mình tôi' WHERE id = ?").run(direct);
  assert.equal((await read({ postId: String(direct) })).posts.length, 0);
  for (const postId of ["0", "-1", "NaN", "1.5"]) await read({ postId }, 400);
  const textPost = await publish({ category: "Bảng tin", content: "Chia sẻ trực tiếp từ bảng tin" });
  assert.equal(textPost.post.userId, "member");
  assert.equal(textPost.post.audience, "Công khai");
  assert.equal((await read({ postId: String(textPost.post.id) })).posts[0].content, "Chia sẻ trực tiếp từ bảng tin");
  await publish({ category: "Bảng tin", content: "   " }, 400);
  await publish({ category: "Bảng tin", attachments: [{ key: "invalid" }] }, 400);
  await publish({ category: "Bảng tin", content: "x".repeat(1201) }, 400);
  signedIn = false;
  await publish({ category: "Bảng tin", content: "Anonymous" }, 401);
  signedIn = true;
  const image = { key: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", name: "photo.webp", type: "image/webp", size: 100 };
  objects.set(image.key, { size: 100, customMetadata: { ownerUserId: "member", accessType: "public", imageOptimized: "webp-v1", imageMaxEdge: "1280" }, httpMetadata: { contentType: "image/webp" } });
  const photoPost = await publish({ category: "Bảng tin", attachments: [image] });
  assert.equal((await read({ postId: String(photoPost.post.id) })).posts[0].images[0].name, "photo.webp");
  const target = photoPost.post.id;
  await comment({ postId: target, content: "" }, 400);
  await comment({ postId: target, content: "x".repeat(601) }, 400);
  await comment({ postId: target, content: 123 }, 400);
  await comment({ postId: target, imageKey: "invalid" }, 400);
  const missing = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
  await comment({ postId: target, imageKey: missing }, 400);
  objects.set(missing, { httpMetadata: { contentType: "application/pdf" }, customMetadata: { ownerUserId: "member" } });
  await comment({ postId: target, imageKey: missing }, 400);
  objects.set(missing, { size: 100, httpMetadata: { contentType: "image/webp" }, customMetadata: { ownerUserId: "other", accessType: "public", imageOptimized: "webp-v1", imageMaxEdge: "1280" } });
  await comment({ postId: target, imageKey: missing }, 403);
  objects.set(missing, { httpMetadata: { contentType: "image/png" }, customMetadata: { ownerUserId: "member", accessType: "private" } });
  await comment({ postId: target, imageKey: missing }, 400);
  signedIn = false; await comment({ postId: target, imageKey: image.key }, 401); signedIn = true;
  sqlite.prepare("INSERT INTO member_profiles (user_id, display_name, avatar_key, updated_at) VALUES ('member', 'Member', 'member-avatar', 'now') ON CONFLICT(user_id) DO UPDATE SET avatar_key = 'member-avatar'").run();
  const imageOnly = (await comment({ postId: target, imageKey: image.key })).comment;
  assert.equal(imageOnly.content, "");
  assert.equal(imageOnly.imageUrl, `/api/files?key=${image.key}`);
  assert.equal(imageOnly.avatarUrl, "/api/files?key=member-avatar");
  const commentOnlyImage = "cccccccc-cccc-cccc-cccc-cccccccccccc";
  objects.set(commentOnlyImage, { size: 100, httpMetadata: { contentType: "image/webp" }, customMetadata: { ownerUserId: "member", accessType: "public", imageOptimized: "webp-v1", imageMaxEdge: "1280" } });
  const withProtectedImage = await comment({ postId: target, content: "Có ảnh", imageKey: commentOnlyImage });
  assert.equal(withProtectedImage.total, 2);
  assert.equal((await files.namespace.DELETE(new Request(`http://localhost/api/files?key=${commentOnlyImage}`, { method: "DELETE" }))).status, 409);
  assert.ok(objects.has(commentOnlyImage), "Images in saved comments must not be deleted by the upload cleanup endpoint.");
  const combined = (await comment({ postId: target, content: "Có ảnh", imageKey: image.key })).comment;
  assert.equal(combined.content, "Có ảnh");
  assert.equal((await read({ postId: String(target) })).posts[0].comments, 3);
  const addComment = sqlite.prepare("INSERT INTO post_comments (post_id, user_id, author_name, content, created_at) VALUES (?, 'member', 'Member', ?, '2026-10-03')");
  for (let i = 0; i < 105; i++) addComment.run(target, `Bình luận ${i}`);
  const newest = await readComments({ postId: target, limit: 20 });
  assert.equal(newest.total, 108);
  assert.equal(newest.comments.length, 20);
  assert.equal(newest.comments.at(-1).content, "Bình luận 104");
  assert.ok(newest.nextCursor);
  const ids = new Set(newest.comments.map(item => item.id));
  let cursor = newest.nextCursor;
  while (cursor) {
    const older = await readComments({ postId: target, limit: 20, beforeId: cursor });
    assert.ok(older.comments.every(item => item.id < cursor));
    for (const item of older.comments) { assert.ok(!ids.has(item.id)); ids.add(item.id); }
    cursor = older.nextCursor;
  }
  assert.equal(ids.size, 108, "All comments remain accessible beyond the old 100-comment limit.");
  assert.equal((await readComments({ postId: target })).comments.length, 100, "Existing catalog consumers keep their default ordering and limit.");
  for (const params of [{ postId: 0 }, { postId: target, limit: 0 }, { postId: target, limit: 101 }, { postId: target, limit: 20, beforeId: -1 }, { postId: target, beforeId: 1 }]) await readComments(params, 400);
  sqlite.prepare("UPDATE posts SET audience = 'Chỉ mình tôi' WHERE id = ?").run(target);
  signedIn = false;
  await readComments({ postId: target, limit: 20 }, 404);
  signedIn = true;
  await comment({ postId: target, content: "Ẩn" }, 404);
  console.log("PASS: publishing, feed aggregation/privacy, source links, text/image comments, upload ownership, avatars, counts and complete comment pagination.");
} finally { sqlite.close(); }
