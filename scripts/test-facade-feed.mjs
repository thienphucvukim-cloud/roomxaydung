// Run with node --experimental-vm-modules scripts/test-facade-feed.mjs.
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { createContext, SourceTextModule, SyntheticModule } from "node:vm";
import ts from "typescript";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import * as schema from "../db/schema.ts";
import * as feed from "../lib/facade-feed.ts";
import * as pagination from "../lib/catalog-pagination.ts";
import * as promotions from "../lib/catalog-promotions.ts";
import * as ownership from "../lib/post-ownership.ts";
import { facadePageHref } from "../lib/facade-pagination.ts";
import { drawingPostHref } from "../lib/catalog-pagination.ts";

const sqlite = new DatabaseSync(":memory:");
for (const file of readdirSync("drizzle").filter(name => name.endsWith(".sql")).sort()) sqlite.exec(readFileSync(`drizzle/${file}`, "utf8"));
const db = drizzle(async (sql, params, method) => {
  const statement = sqlite.prepare(sql);
  if (method === "run") return { rows: [], ...statement.run(...params) };
  statement.setReturnArrays(true);
  return { rows: method === "get" ? statement.get(...params) : statement.all(...params) };
});
const context = createContext({ URL, Request, Response, console });
const mocks = {
  "../../../db": { getDb: () => db },
  "../../../db/schema": schema,
  "../../../lib/member-identity": { currentMember: () => { throw Error("Not used in GET"); } },
  "cloudflare:workers": { env: {} },
  "../../../lib/catalog-pagination": pagination,
  "../../../lib/catalog-promotions": promotions,
  "@/lib/post-ownership": ownership,
  "../../../lib/facade-feed": feed,
  "../../../lib/drawing-catalog": { parseVndPrice: () => 0 },
};
const route = new SourceTextModule(ts.transpileModule(readFileSync("app/api/posts/route.ts", "utf8"), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText, { context });
await route.link(async specifier => {
  const namespace = mocks[specifier] ?? await import(specifier);
  return new SyntheticModule(Object.keys(namespace), function () {
    for (const [key, value] of Object.entries(namespace)) this.setExport(key, value);
  }, { context });
});
await route.evaluate();
async function read(params = {}, status = 200) {
  const query = new URLSearchParams({ category: "Bộ sưu tập ảnh", seed: "4321", ...params });
  if (params.seed === null) query.delete("seed");
  const response = await route.namespace.GET(new Request("http://localhost/api/posts?" + query));
  const result = await response.json();
  assert.equal(response.status, status, JSON.stringify(result));
  return result;
}
const insert = sqlite.prepare("INSERT INTO posts (user_id, author_name, category, title, content, audience, created_at) VALUES ('author', 'Tác giả', ?, ?, '', ?, '2026-10-02T00:00:00.000Z') RETURNING id");
const add = (title, audience = "Công khai", category = "Bộ sưu tập ảnh") => insert.get(category, title, audience).id;
try {
  assert.deepEqual((await read()).posts, []);
  assert.equal((await read()).nextCursor, null);
  const ids = Array.from({ length: 65 }, (_, index) => add(`Mẫu ${index}`));
  add("Riêng tư", "Chỉ mình tôi");
  const drawingId = add("Bản vẽ", "Công khai", "Bản vẽ cộng đồng");
  add("Bản vẽ ẩn", "Chỉ mình tôi", "Bản vẽ cộng đồng");
  add("Nội thất", "Công khai", "Nội thất cộng đồng");
  const attachment = sqlite.prepare("INSERT INTO post_attachments (post_id, object_key, file_name, mime_type, size, access_type, created_at) VALUES (?, ?, ?, ?, 100, ?, '2026-10-02')");
  attachment.run(drawingId, "cover", "cover.jpg", "image/jpeg", "public");
  attachment.run(drawingId, "preview", "preview.png", "image/png", "public");
  attachment.run(drawingId, "private", "design.dwg", "application/octet-stream", "private");
  const linked = await read({ q: "Bản vẽ" });
  assert.equal(linked.posts.length, 1);
  assert.equal(linked.posts[0].id, drawingId);
  assert.deepEqual(linked.posts[0].attachments.map(file => file.key), ["cover", "preview"]);
  const purchaseLink = new URL(drawingPostHref(drawingId), "http://localhost");
  assert.equal(purchaseLink.hash, `#post-${drawingId}`);
  const source = await read({ category: "Bản vẽ cộng đồng", seed: null, page: "1", postId: purchaseLink.searchParams.get("postId") });
  assert.deepEqual(source.posts.map(post => post.id), [drawingId]);
  assert.equal(source.total, 1);
  for (const postId of ["0", "oops", "99999999999999999999999"]) await read({ postId }, 400);
  sqlite.prepare("UPDATE posts SET content = 'Thông tin đã sửa' WHERE id = ?").run(drawingId);
  assert.equal((await read({ postId: String(drawingId) })).posts[0].content, "Thông tin đã sửa");
  sqlite.prepare("UPDATE posts SET audience = 'Chỉ mình tôi' WHERE id = ?").run(drawingId);
  assert.deepEqual((await read({ postId: String(drawingId) })).posts, []);
  sqlite.prepare("UPDATE posts SET audience = 'Công khai' WHERE id = ?").run(drawingId);
  const first = await read();
  assert.equal(first.posts.length, 20);
  const firstIds = first.posts.map(post => post.id);
  assert.deepEqual((await read()).posts.map(post => post.id), firstIds);
  assert.notDeepEqual((await read({ seed: "987654" })).posts.map(post => post.id), firstIds);
  const deleted = ids.find(id => !firstIds.includes(id));
  sqlite.prepare("DELETE FROM posts WHERE id = ?").run(deleted);
  const inserted = add("Đăng trong lúc cuộn");
  const rendered = [...firstIds];
  let cursor = first.nextCursor;
  while (cursor) {
    const next = await read({ cursor });
    assert.ok(next.posts.length <= 20);
    rendered.push(...next.posts.map(post => post.id));
    cursor = next.nextCursor;
  }
  assert.equal(new Set(rendered).size, rendered.length);
  assert.deepEqual([...rendered].sort((a, b) => a - b), [...ids.filter(id => id !== deleted), drawingId]);
  assert.ok(!rendered.includes(inserted));
  const filtered = await read({ q: "Mẫu 60" });
  assert.equal(filtered.posts.length, 1);
  assert.equal(filtered.posts[0].title, "Mẫu 60");
  for (const seed of ["0", "-1", "oops", "2147483647"]) await read({ seed }, 400);
  for (const cursor of ["", "oops", "1:2", "1:2147483647:2", "1:2:99999999999999999999999"]) await read({ cursor }, 400);
  const legacy = await read({ seed: null, page: "1" });
  assert.equal(legacy.page, 1);
  assert.equal(legacy.pageSize, 20);
  assert.equal(legacy.total, 66);
  const addView = sqlite.prepare("INSERT INTO catalog_views (target_type, target_id, user_id, created_at) VALUES (?, ?, ?, '2026-10-02')");
  const addLike = sqlite.prepare("INSERT INTO user_actions (user_id, action_type, target_type, target_id, created_at) VALUES (?, 'like', ?, ?, '2026-10-02')");
  for (let index = 0; index < 3; index++) addView.run("post", String(ids[60]), `viewer-${index}`);
  addView.run("post", String(ids[61]), "viewer-0");
  addView.run("house-model", "Nhà mẫu kiểm tra", "viewer-0");
  addLike.run("liker-0", "post", String(ids[61]));
  addLike.run("liker-1", "post", String(ids[61]));
  addLike.run("liker-0", "post", String(ids[60]));
  addLike.run("liker-0", "house-model", "Nhà mẫu kiểm tra");
  addLike.run("saver-0", "post", String(ids[62]));
  sqlite.prepare("UPDATE user_actions SET action_type = 'save' WHERE user_id = 'saver-0'").run();
  for (const sort of ["views", "featured"]) {
    const ranked = await read({ sort });
    assert.equal(ranked.posts[0].id, sort === "views" ? ids[60] : ids[61]);
    assert.equal(ranked.posts[0].sortScore, sort === "views" ? 3 : 2);
    assert.equal(ranked.modelScores["Nhà mẫu kiểm tra"], 1);
    const all = [...ranked.posts];
    let rankedCursor = ranked.nextCursor;
    while (rankedCursor) {
      const next = await read({ sort, cursor: rankedCursor });
      all.push(...next.posts);
      rankedCursor = next.nextCursor;
    }
    assert.equal(new Set(all.map(post => post.id)).size, 66);
    assert.equal(all.length, 66);
    assert.ok(all.every((post, index) => index === 0 || all[index - 1].sortScore >= post.sortScore));
    const matching = await read({ sort, q: "Mẫu 60" });
    assert.equal(matching.posts.length, 1);
    assert.equal(matching.posts[0].id, ids[60]);
  }
  const items = Array.from({ length: 30 }, (_, index) => index);
  assert.deepEqual([...feed.shuffleFacadeItems(items, 4321)].sort((a, b) => a - b), items);
  assert.deepEqual(feed.shuffleFacadeItems(items, 4321), feed.shuffleFacadeItems(items, 4321));
  assert.notDeepEqual(feed.shuffleFacadeItems(items, 4321), feed.shuffleFacadeItems(items, 987654));
  assert.equal(facadePageHref(2), "/kho-mau-nha-dep-chat");
  assert.equal(new URL(facadePageHref(1, " Mặt tiền & 5m "), "http://localhost").searchParams.get("q"), "Mặt tiền & 5m");
  const sortedLink = new URL(facadePageHref(1, "Hiện đại", "views"), "http://localhost");
  assert.equal(sortedLink.searchParams.get("q"), "Hiện đại");
  assert.equal(sortedLink.searchParams.get("sort"), "views");
  assert.equal(feed.parseFacadeSort("featured"), "featured");
  assert.equal(feed.parseFacadeSort("unknown"), "random");
  console.log("Facade feed: random and ranked ordering, cursor traversal, insert/delete safety, filtering, validation and links passed.");
} finally {
  sqlite.close();
}
