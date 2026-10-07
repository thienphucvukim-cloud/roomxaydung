// Run with node --experimental-vm-modules scripts/test-post-ownership.mjs.
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
function execute(sql, params, method) {
  const statement = sqlite.prepare(sql);
  if (method === "run") return { rows: [], ...statement.run(...params) };
  statement.setReturnArrays(true);
  return { rows: method === "get" ? statement.get(...params) : statement.all(...params) };
}
let failImageBatch = false;
let beforeBatch;
const db = drizzle(async (...args) => execute(...args), async queries => {
  beforeBatch?.(); beforeBatch = undefined;
  sqlite.exec("BEGIN");
  try {
    const results = queries.map((query, index) => {
      const result = execute(query.sql, query.params, query.method);
      if (failImageBatch && index === 1) throw new Error("Simulated image insert failure");
      return result;
    });
    sqlite.exec("COMMIT"); return results;
  } catch (error) { sqlite.exec("ROLLBACK"); throw error; }
});
const objects = new Map();
let userId = "author";
const context = createContext({ URL, URLSearchParams, Response, Request, Headers, TextEncoder, Uint8Array, crypto, console });
const cache = new Map();
async function load(specifier, referencing) {
  const path = specifier.startsWith(".") ? posix.normalize(posix.join(posix.dirname(referencing.identifier), specifier)) : specifier;
  if (cache.has(path)) return cache.get(path);
  const namespace = path === "@/db" ? { getDb: () => db }
    : path === "cloudflare:workers" ? { env: { DOWNLOAD_LINK_SECRET: "local-deletion-test", BUCKET: { head: async key => objects.get(key) || null, get: async key => key === "paid-file" ? { body: "Purchased PDF", size: 13, writeHttpMetadata: h => h.set("content-type", "application/pdf") } : null } } }
    : path === "@/db/schema" ? schema
    : path === "@/lib/payment-identity" ? { getPaymentBuyerId: async () => userId }
    : path === "@/lib/member-identity" ? { currentMember: async () => ({ userId, authorName: "Author" }) }
    : path === "@/lib/admin-auth" ? { requireAdmin: async () => ({ userId: "admin" }) }
    : path === "@/lib/website-auth" ? { getAuthenticatedIdentity: async () => userId ? { userId } : null, isAdminIdentity: identity => identity?.userId === "admin", validOrigin: request => request.headers.get("sec-fetch-site") !== "cross-site" && (!request.headers.get("origin") || request.headers.get("origin") === new URL(request.url).origin) }
    : !path.startsWith("@/") ? await import(path) : null;
  const mod = namespace ? new SyntheticModule(Object.keys(namespace), function () {
    for (const [key, value] of Object.entries(namespace)) this.setExport(key, value);
  }, { context }) : new SourceTextModule(ts.transpileModule(readFileSync(path.slice(2) + (path.endsWith(".ts") ? "" : ".ts"), "utf8"), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  }).outputText, { context, identifier: path });
  cache.set(path, mod);
  return mod;
}
const route = await load("@/app/api/my-posts/route");
await route.link(load); await route.evaluate();
const { normalizeCatalogPrice } = (await load("@/lib/catalog-price")).namespace;
for (const value of ["", "  ", "0", "0đ", "0 ₫", "Miễn phí"]) assert.equal(normalizeCatalogPrice(value), "0đ", value);
for (const value of ["150000", "150.000đ", "150,000 VND", " 150.000 ₫ "]) assert.equal(normalizeCatalogPrice(value), "150.000đ", value);
assert.equal(normalizeCatalogPrice("2000"), "2.000đ");
for (const value of [null, undefined, 150000, "-2000", "1đ", "1999", "1.500", "20.00", "2,500.5", "2e3", "abc2000", "2000abc", "9007199254740992", "2".repeat(241)]) assert.equal(normalizeCatalogPrice(value), null, String(value));
const products = await load("@/lib/wallet-products"); await products.link(load); await products.evaluate();
const feed = await load("@/app/api/news-feed/route");
await feed.link(load); await feed.evaluate();
const comments = await load("@/app/api/comments/route");
await comments.link(load); await comments.evaluate();
const admin = await load("@/app/api/admin/manage/[resource]/route");
await admin.link(load); await admin.evaluate();
const downloads = await load("@/app/api/downloads/drawing/route");
await downloads.link(load); await downloads.evaluate();
const signatures = await load("@/lib/download-links");
const insert = sqlite.prepare("INSERT INTO posts (user_id, author_name, category, title, content, audience, created_at) VALUES (?, 'Author', ?, 'Original', 'Content', ?, '2026-10-02') RETURNING id");
const add = (owner = "author", audience = "Công khai", category = "Bộ sưu tập ảnh") => insert.get(owner, category, audience).id;
const own = add();
const other = add("other");
const moderated = add("author", "Ẩn bởi quản trị");
const adminDeleted = add("author", "Đã xóa bởi quản trị");
const commentPost = add("author", "Công khai", "Thảo luận mẫu nhà");
sqlite.prepare("INSERT INTO post_attachments (post_id, object_key, file_name, mime_type, size, access_type, created_at) VALUES (?, 'paid-file', 'plan.pdf', 'application/pdf', 100, 'private', '2026-10-02')").run(own);
sqlite.prepare("INSERT INTO post_comments (post_id, user_id, author_name, content, created_at) VALUES (?, 'reader', 'Reader', 'Comment', '2026-10-02')").run(own);
const filesBefore = sqlite.prepare("SELECT * FROM post_attachments").all();
const commentsBefore = sqlite.prepare("SELECT * FROM post_comments").all();
async function read(params = {}, status = 200) {
  const response = await route.namespace.GET(new Request("http://localhost/api/my-posts?" + new URLSearchParams(params)));
  const data = await response.json(); assert.equal(response.status, status, JSON.stringify(data));
  assert.equal(response.headers.get("Cache-Control"), "private, no-store"); return data;
}
async function change(body, status = 200, method = "PATCH", origin = "http://localhost") {
  const response = await route.namespace[method](new Request("http://localhost/api/my-posts", {
    method, headers: { "Content-Type": "application/json", origin }, body: JSON.stringify(body),
  }));
  const data = await response.json(); assert.equal(response.status, status, JSON.stringify(data)); return data;
}
async function publicIds() {
  const response = await feed.namespace.GET(new Request("http://localhost/api/news-feed"));
  assert.equal(response.status, 200); return (await response.json()).posts.map(post => post.id);
}
try {
  userId = null;
  await read({}, 401); await change({ id: own, title: "No" }, 401);
  userId = "author";
  assert.deepEqual((await read()).posts.map(post => post.id), [moderated, own]);
  for (const page of ["0", "1.5", "NaN", "100001"]) await read({ page }, 400);
  await read({ id: "oops" }, 400);
  await change({ id: own, title: "Cross origin" }, 403, "PATCH", "https://attacker.example");
  for (const method of ["PATCH", "DELETE"]) await change(method === "PATCH" ? { id: other, title: "Attack" } : { id: other }, 404, method);
  for (const fields of [{ attachments: [] }, { paidFiles: [] }, { userId: "other" }, { audience: "Công khai" }, { category: "New" }, { priceLabel: "100000" }]) await change({ id: own, ...fields }, 400);
  for (const body of [null, [], { id: "1" }, { id: own, title: " " }, { id: own, content: "x".repeat(1201) }, { id: own, specifications: 123 }, { id: own, action: "unknown" }, { id: own, action: "hide", title: "No" }]) await change(body, 400);
  assert.equal((await change({ id: own, title: " Updated ", content: "New text", specifications: "5x20", listingType: "Hiện đại" })).post.title, "Updated");
  await change({ id: own, action: "hide" });
  userId = "other";
  assert.equal((await comments.namespace.GET(new Request(`http://localhost/api/comments?postId=${own}`))).status, 404);
  assert.equal((await comments.namespace.POST(new Request("http://localhost/api/comments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ postId: own, content: "No" }) }))).status, 404);
  userId = "author";
  assert.equal((await comments.namespace.GET(new Request(`http://localhost/api/comments?postId=${own}`))).status, 200);
  const adminHidden = await admin.namespace.GET(new Request("http://localhost/api/admin/manage/posts?filter=hidden"), { params: Promise.resolve({ resource: "posts" }) });
  assert.ok((await adminHidden.json()).items.some(post => post.id === own));
  assert.ok(!(await publicIds()).includes(own));
  assert.equal((await read({ id: String(own) })).posts[0].audience, "Chỉ mình tôi");
  await change({ id: own, title: "Edited while hidden" });
  await change({ id: own, action: "publish" }); assert.ok((await publicIds()).includes(own));
  await read({ trash: "true" }, 400);
  await change({ id: moderated, title: "Moderated edit" });
  await change({ id: moderated, action: "publish" }, 404);
  await change({ id: moderated }, 200, "DELETE");
  assert.equal(sqlite.prepare("SELECT audience FROM posts WHERE id = ?").get(moderated).audience, "Tác giả xóa bài bị quản trị ẩn");
  await change({ id: moderated, action: "restore" }, 400);
  await change({ id: moderated, action: "publish" }, 404);
  await change({ id: adminDeleted, action: "restore" }, 400);
  await change({ id: commentPost, title: "Comment attack" }, 404);
  userId = "other"; assert.equal((await read({ id: String(own) })).posts.length, 0);
  await change({ id: own, action: "hide" }, 404);
  assert.deepEqual(sqlite.prepare("SELECT * FROM post_attachments").all(), filesBefore);
  assert.deepEqual(sqlite.prepare("SELECT * FROM post_comments").all(), commentsBefore);
  userId = "author";
  const keys = ["aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", "cccccccc-cccc-cccc-cccc-cccccccccccc", "dddddddd-dddd-dddd-dddd-dddddddddddd"];
  for (const [index, key] of keys.entries()) objects.set(key, { size: 100 + index, httpMetadata: { contentType: "image/webp" }, customMetadata: { ownerUserId: "author", accessType: "public", imageOptimized: "webp-v1", imageMaxEdge: "1600", fileName: encodeURIComponent(`Ảnh ${index}.webp`) } });
  const imagesFor = () => sqlite.prepare("SELECT object_key FROM post_attachments WHERE post_id = ? AND access_type = 'public' ORDER BY id").all(own).map(row => row.object_key);
  const edited = await change({ id: own, title: "With photos", imageKeys: keys.slice(0, 2) });
  assert.deepEqual(edited.post.images.map(image => image.key), keys.slice(0, 2));
  assert.equal(edited.post.images[0].name, "Ảnh 0.webp");
  assert.deepEqual((await read({ id: String(own) })).posts[0].images.map(image => image.key), keys.slice(0, 2));
  await change({ id: own, imageKeys: [keys[1], keys[0], keys[2]] });
  assert.deepEqual(imagesFor(), [keys[1], keys[0], keys[2]], "Cover order persists; add and retain existing images.");
  await change({ id: own, imageKeys: [keys[3], keys[0]] });
  assert.deepEqual(imagesFor(), [keys[3], keys[0]], "Replace and remove images.");
  assert.equal(objects.size, 4, "Removing from a post does not destroy stored objects.");
  for (const imageKeys of [null, "no", [keys[0], keys[0]], Array(11).fill(keys[0]), [123], ["invalid"], ["paid-file"]]) await change({ id: own, imageKeys }, 400);
  objects.get(keys[1]).customMetadata.ownerUserId = "other";
  await change({ id: own, imageKeys: [keys[1]] }, 400);
  objects.get(keys[1]).customMetadata.ownerUserId = "author";
  objects.get(keys[1]).customMetadata.accessType = "private";
  await change({ id: own, imageKeys: [keys[1]] }, 400);
  objects.get(keys[1]).customMetadata.accessType = "public";
  objects.get(keys[1]).httpMetadata.contentType = "application/pdf";
  await change({ id: own, imageKeys: [keys[1]] }, 400);
  objects.get(keys[1]).httpMetadata.contentType = "image/webp";
  objects.get(keys[1]).size = 26 * 1024 * 1024;
  await change({ id: own, imageKeys: [keys[1]] }, 400);
  objects.get(keys[1]).size = 0;
  await change({ id: own, imageKeys: [keys[1]] }, 400);
  objects.get(keys[1]).size = 101;
  sqlite.prepare("INSERT INTO post_attachments (post_id, object_key, file_name, mime_type, size, access_type, created_at) VALUES (?, ?, 'Other.webp', 'image/webp', 100, 'public', '2026-10-02')").run(other, keys[1]);
  await change({ id: own, imageKeys: [keys[1]] }, 400);
  userId = "other"; await change({ id: own, imageKeys: [] }, 404); userId = "author";
  const beforeFailure = sqlite.prepare("SELECT * FROM post_attachments WHERE post_id = ? ORDER BY id").all(own);
  failImageBatch = true;
  await change({ id: own, title: "Must roll back", imageKeys: [keys[2]] }, 500);
  failImageBatch = false;
  assert.deepEqual(sqlite.prepare("SELECT * FROM post_attachments WHERE post_id = ? ORDER BY id").all(own), beforeFailure);
  assert.equal(sqlite.prepare("SELECT title FROM posts WHERE id = ?").get(own).title, "With photos");
  beforeBatch = () => sqlite.prepare("UPDATE posts SET audience = 'Đã xóa bởi quản trị' WHERE id = ?").run(own);
  await change({ id: own, imageKeys: [] }, 404);
  assert.deepEqual(sqlite.prepare("SELECT * FROM post_attachments WHERE post_id = ? ORDER BY id").all(own), beforeFailure, "A moderation change during validation prevents every batch mutation.");
  sqlite.prepare("UPDATE posts SET audience = 'Công khai' WHERE id = ?").run(own);
  await change({ id: own, imageKeys: [] }); assert.deepEqual(imagesFor(), []);
  assert.deepEqual(sqlite.prepare("SELECT * FROM post_attachments WHERE access_type = 'private'").all(), filesBefore);
  assert.deepEqual(sqlite.prepare("SELECT * FROM post_comments").all(), commentsBefore);
  const feedPost = add("author", "Công khai", "Bảng tin");
  assert.equal((await read({ id: String(feedPost) })).posts[0].category, "Bảng tin");
  await change({ id: feedPost, content: "Edited feed post" });
  await change({ id: feedPost, action: "hide" });
  assert.equal((await read({ id: String(feedPost) })).posts[0].audience, "Chỉ mình tôi");
  await change({ id: feedPost, action: "publish" });
  userId = "other";
  await change({ id: feedPost, content: "Unauthorized" }, 404);
  userId = "author";
  await change({ id: feedPost }, 200, "DELETE");
  assert.equal(sqlite.prepare("SELECT audience FROM posts WHERE id = ?").get(feedPost).audience, "Đã xóa bởi tác giả");
  // A purchased file remains downloadable even though its listing cannot be restored.
  sqlite.prepare("INSERT INTO wallet_transactions (user_id, kind, amount, order_code, reference, target_type, target_id, description, created_at) VALUES ('buyer', 'purchase', -100000, 12345, 'deletion-test', 'post', ?, 'Purchased plan', '2026-10-05')").run(String(own));
  const ledgerBefore = sqlite.prepare("SELECT * FROM wallet_transactions").all();
  sqlite.prepare("INSERT INTO post_attachments (post_id, object_key, file_name, mime_type, size, access_type, created_at) VALUES (?, 'cover', 'cover.webp', 'image/webp', 100, 'public', '2026-10-05')").run(own);
  sqlite.prepare("INSERT INTO user_actions (user_id, action_type, target_type, target_id, created_at) VALUES ('reader', 'save', 'post', ?, '2026-10-05')").run(String(own));
  await change({ id: own }, 200, "DELETE");
  assert.equal(sqlite.prepare("SELECT audience FROM posts WHERE id = ?").get(own).audience, "Đã xóa bởi tác giả");
  assert.deepEqual(sqlite.prepare("SELECT * FROM post_comments").all(), commentsBefore);
  assert.equal((await read({ id: String(own) })).posts.length, 0);
  const adminContext = { params: Promise.resolve({ resource: "posts" }) };
  const retainedList = await admin.namespace.GET(new Request("http://localhost/api/admin/manage/posts?filter=deleted"), adminContext);
  assert.ok((await retainedList.json()).items.some(post => post.id === own));
  const adminRequest = (method, body) => new Request("http://localhost/api/admin/manage/posts", { method, headers: { "Content-Type": "application/json", origin: "http://localhost" }, body: JSON.stringify(body) });
  assert.equal((await admin.namespace.PATCH(adminRequest("PATCH", { id: own, audience: "Công khai" }), adminContext)).status, 404);
  assert.equal((await admin.namespace.DELETE(adminRequest("DELETE", { id: own }), adminContext)).status, 200);
  assert.equal(sqlite.prepare("SELECT id FROM posts WHERE id = ?").get(own), undefined);
  assert.equal((await read({ id: String(own) })).posts.length, 0);
  assert.ok(!(await publicIds()).includes(own));
  assert.equal(sqlite.prepare("SELECT count(*) n FROM post_comments WHERE post_id = ?").get(own).n, 0);
  assert.equal(sqlite.prepare("SELECT count(*) n FROM user_actions WHERE target_type = 'post' AND target_id = ?").get(String(own)).n, 0);
  assert.deepEqual(sqlite.prepare("SELECT * FROM post_attachments WHERE post_id = ?").all(own), filesBefore);
  assert.deepEqual(sqlite.prepare("SELECT * FROM wallet_transactions").all(), ledgerBefore);
  await change({ id: own }, 404, "DELETE");
  await change({ id: own, title: "Deleted edit" }, 404);
  await change({ id: own, action: "restore" }, 400);
  const expires = Math.floor(Date.now() / 1000) + 3600;
  const token = await signatures.namespace.createDownloadToken(12345, filesBefore[0].id, expires, "buyer");
  const url = `http://localhost/api/downloads/drawing?order=12345&file=${filesBefore[0].id}&expires=${expires}&token=${token}`;
  userId = "buyer";
  const download = await downloads.namespace.GET(new Request(url));
  assert.equal(download.status, 200); assert.equal(await download.text(), "Purchased PDF");
  userId = "other";
  assert.equal((await downloads.namespace.GET(new Request(url))).status, 403);
  // Admin deletion also removes hidden content, with no restore endpoint.
  const adminPost = add("other", "Chỉ mình tôi");
  sqlite.prepare("INSERT INTO post_attachments (post_id, object_key, file_name, mime_type, size, access_type, created_at) VALUES (?, 'unsold-file', 'unsold.pdf', 'application/pdf', 100, 'private', '2026-10-05')").run(adminPost);
  assert.equal((await admin.namespace.DELETE(adminRequest("DELETE", { id: adminPost }), adminContext)).status, 200);
  assert.equal(sqlite.prepare("SELECT id FROM posts WHERE id = ?").get(adminPost), undefined);
  assert.equal(sqlite.prepare("SELECT id FROM post_attachments WHERE object_key = 'unsold-file'").get(), undefined);
  assert.equal((await admin.namespace.PATCH(adminRequest("PATCH", { id: adminPost, action: "restore" }), adminContext)).status, 400);
  assert.equal((await admin.namespace.DELETE(adminRequest("DELETE", { id: other, ignored: true }), { params: Promise.resolve({ resource: "members" }) })).status, 404);
  userId = "admin";
  const adminOwnPost = add("admin");
  assert.equal((await read({ id: String(adminOwnPost) })).isAdmin, true);
  await change({ id: adminOwnPost }, 200, "DELETE");
  assert.equal(sqlite.prepare("SELECT id FROM posts WHERE id = ?").get(adminOwnPost), undefined);
  userId = "author";
  for (const category of ["Bản vẽ cộng đồng", "Nội thất cộng đồng"]) {
    const catalogPost = add("author", "Công khai", category);
    const otherCatalogPost = add("other", "Công khai", category);
    await change({ id: otherCatalogPost, priceLabel: "50000" }, 404);
    const priced = await change({ id: catalogPost, priceLabel: "150000" });
    assert.equal(priced.post.priceLabel, "150.000đ");
    assert.equal((await products.namespace.resolveWalletProduct("post", String(catalogPost))).amount, 150000);
    for (const value of ["1đ", "-2000", "bad2000", 10000, null]) await change({ id: catalogPost, priceLabel: value }, 400);
    assert.equal((await read({ id: String(catalogPost) })).posts[0].priceLabel, "150.000đ");
    await change({ id: catalogPost, priceLabel: "75000" });
    assert.equal((await products.namespace.resolveWalletProduct("post", String(catalogPost))).amount, 75000);
    await change({ id: catalogPost, priceLabel: "" });
    assert.equal((await products.namespace.resolveWalletProduct("post", String(catalogPost))).amount, 0);
    const adminPrice = await admin.namespace.PATCH(adminRequest("PATCH", { id: otherCatalogPost, priceLabel: "99000" }), adminContext);
    assert.equal(adminPrice.status, 200);
    assert.equal((await products.namespace.resolveWalletProduct("post", String(otherCatalogPost))).amount, 99000);
    const listed = await admin.namespace.GET(new Request(`http://localhost/api/admin/manage/posts?id=${otherCatalogPost}`), adminContext);
    assert.equal((await listed.json()).items[0].priceLabel, "99.000đ");
    assert.equal((await admin.namespace.PATCH(adminRequest("PATCH", { id: otherCatalogPost, priceLabel: "-99000" }), adminContext)).status, 400);
    await change({ id: catalogPost }, 200, "DELETE");
    await change({ id: catalogPost, priceLabel: "80000" }, 404);
  }
  console.log("PASS: catalog price editing enforces ownership, category, valid VND amounts and deleted states; checkout uses current author/admin prices.");
  console.log("PASS: author deletion retained only in admin, permanent admin deletion (including own profile), hide/show, cleanup, ownership/privacy, unchanged ledger and purchased downloads, atomic photo editing.");
} finally { sqlite.close(); }
