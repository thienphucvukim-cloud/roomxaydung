import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { createContext, SourceTextModule, SyntheticModule } from "node:vm";
import { posix } from "node:path";
import ts from "typescript";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import * as schema from "../db/schema.ts";
import { houseModels } from "../lib/house-models.ts";
import { drawings } from "../lib/drawing-catalog.ts";

const sqlite = new DatabaseSync(":memory:");
for (const file of readdirSync("drizzle").filter(file => file.endsWith(".sql")).sort()) sqlite.exec(readFileSync(`drizzle/${file}`, "utf8"));
const db = drizzle(async (query, params, method) => {
  const statement = sqlite.prepare(query);
  if (method === "run") return { rows: [], ...statement.run(...params) };
  statement.setReturnArrays(true);
  return { rows: method === "get" ? statement.get(...params) : statement.all(...params) };
});
let role = "admin";
const context = createContext({ URL, URLSearchParams, Request, Response, console });
const cache = new Map();
async function load(name, referencing = { identifier: "@/app/api/posts/route" }) {
  const id = name.startsWith(".") ? posix.normalize(posix.join(posix.dirname(referencing.identifier), name)) : name;
  if (cache.has(id)) return cache.get(id);
  const namespace = id === "@/db" ? { getDb: () => db } : id === "@/db/schema" ? schema
    : id === "cloudflare:workers" ? { env: {} }
    : id === "@/lib/admin-auth" ? { requireAdmin: async () => role === "admin" ? { userId: "admin" } : { error: Response.json({ error: "Denied" }, { status: role === "guest" ? 401 : 403 }) } }
    : id === "@/lib/website-auth" ? { validOrigin: request => request.headers.get("origin") === new URL(request.url).origin }
    : id === "@/lib/member-access" ? { memberAccessResponse: async () => null }
    : id === "@/lib/member-identity" ? { currentMember: async () => ({ userId: "author" }) }
    : !id.startsWith("@/") ? await import(id) : null;
  const mod = namespace ? new SyntheticModule(Object.keys(namespace), function () { for (const [key, value] of Object.entries(namespace)) this.setExport(key, value); }, { context })
    : new SourceTextModule(ts.transpileModule(readFileSync(id.slice(2) + (id.endsWith(".ts") ? "" : ".ts"), "utf8"), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText, { context, identifier: id });
  cache.set(id, mod); return mod;
}
const feed = await load("@/app/api/posts/route"); await feed.link(load); await feed.evaluate();
const moderation = await load("@/app/api/admin/catalog-quality/route"); await moderation.link(load); await moderation.evaluate();
async function mark(targetType, targetId, lowQuality = true, status = 200, origin = "https://app.test") {
  const response = await moderation.namespace.PATCH(new Request("https://app.test/api/admin/catalog-quality", { method: "PATCH", headers: { "Content-Type": "application/json", origin }, body: JSON.stringify({ targetType, targetId, lowQuality }) }));
  const body = await response.json(); assert.equal(response.status, status, JSON.stringify(body));
}
async function read(params, status = 200) {
  const response = await feed.namespace.GET(new Request("https://app.test/api/posts?" + new URLSearchParams(params)));
  const data = await response.json(); assert.equal(response.status, status, JSON.stringify(data));
  assert.equal(/quality|reviewedBy|reviewed_by|lowQuality/.test(JSON.stringify(data)), false, "Internal flags must never appear in public post metadata"); return data;
}
const insert = sqlite.prepare("INSERT INTO posts (user_id,author_name,category,title,content,audience,created_at) VALUES ('author','Author',?,'Quality fixture','Content',?,'2026-10-05') RETURNING id");
const add = (category, audience = "Công khai") => insert.get(category, audience).id;
const cats = ["Bộ sưu tập ảnh", "Bản vẽ cộng đồng", "Nội thất cộng đồng"];
const rows = cats.map(cat => Array.from({ length: 43 }, () => add(cat)));
const bad = rows.map(ids => ids.at(-1));
try {
  for (const [index, ids] of rows.entries()) {
    const id = bad[index];
    sqlite.prepare("INSERT INTO catalog_views(target_type,target_id,user_id,created_at) VALUES ('post',?,'reader','now')").run(String(id));
    sqlite.prepare("INSERT INTO catalog_downloads(target_type,target_id,user_id,created_at) VALUES ('post',?,'reader','now')").run(String(id));
    sqlite.prepare("INSERT INTO catalog_ratings(target_type,target_id,user_id,rating,updated_at) VALUES ('post',?,'reader',5,'now')").run(String(id));
    sqlite.prepare("INSERT INTO user_actions(user_id,action_type,target_type,target_id,created_at) VALUES ('reader','like','post',?,'now')").run(String(id));
    if (index) sqlite.prepare("INSERT INTO catalog_promotions(post_id,user_id,category,position,months,amount,reference,starts_at,expires_at) VALUES (?,'author',?,2,1,10000,?,'2020-01-01','2099-01-01')").run(id, cats[index], 'quality-' + index);
    await mark("post", String(id)); await mark("post", String(id));
    assert.equal(sqlite.prepare("SELECT count(*) n FROM catalog_quality_flags WHERE target_type='post' AND target_id=?").get(String(id)).n, 1, "A retry is idempotent");
    assert.equal(ids.length, 43);
  }
  await mark("demo", "facade.0"); await mark("demo", "drawing.0");
  role = "guest"; assert.equal((await moderation.namespace.GET()).status, 401); await mark("post", String(bad[0]), false, 401);
  role = "member"; assert.equal((await moderation.namespace.GET()).status, 403); await mark("post", String(bad[0]), false, 403);
  role = "admin";
  assert.equal((await moderation.namespace.GET()).headers.get("Cache-Control"), "private, no-store");
  assert.equal((await (await moderation.namespace.GET()).json()).flags.length, 5);
  await mark("post", String(bad[0]), false, 403, "https://attacker.test");
  for (const [type, id, low] of [["wrong", "1", true], ["post", "0", true], ["post", "1", "true"], ["demo", "facade.999", true], ["demo", "facade.00", true], [["post"], "1", true]]) await mark(type, id, low, 400);
  await mark("post", String(add("Bảng tin")), true, 404);
  await mark("post", "999999", true, 404);
  const publicStars = sqlite.prepare("SELECT * FROM catalog_ratings ORDER BY id").all();
  for (const sort of ["random", "views", "featured"]) {
    const params = { category: cats[0], seed: "4321", sort, modelKeys: JSON.stringify(houseModels.map(model => model.title)) };
    const first = await read(params), all = [...first.catalogOrder];
    assert.ok(first.nextCursor); let cursor = first.nextCursor;
    const newId = add(cats[0]);
    while (cursor) { const next = await read({ ...params, cursor }); all.push(...next.catalogOrder); cursor = next.nextCursor; }
    assert.equal(new Set(all).size, all.length, "Cursor traversal must never duplicate entries");
    const flaggedKeys = new Set(["post:" + bad[0], "post:" + bad[1], "model:" + houseModels[0].title]);
    assert.ok(all.slice(-3).every(key => flaggedKeys.has(key)), sort + ": flagged posts and demos must be after every unflagged entry");
    assert.ok(!all.includes("post:" + newId), "Posts published during scroll stay outside the snapshot");
    sqlite.prepare("DELETE FROM posts WHERE id=?").run(newId);
    const deep = await read({ ...params, postId: String(bad[0]), modelKeys: "[]" });
    assert.equal(deep.posts[0].id, bad[0], "A demoted post remains directly accessible");
    await read({ ...params, cursor: "hc:1:9:0:1" }, 400);
  }
  for (const index of [1, 2]) for (const sort of ["latest", "downloads", "views", "rating", "featured"]) {
    const modelKeys = index === 1 ? JSON.stringify(drawings.map(drawing => drawing.title)) : "[]";
    const params = { category: cats[index], sort, modelKeys, page: "1" };
    const all = [];
    for (let page = 1; page <= Math.ceil((43 + (index === 1 ? drawings.length : 0)) / 16); page++) all.push(...(await read({ ...params, page: String(page) })).catalogOrder);
    assert.equal(new Set(all).size, all.length);
    assert.equal(all.length, 43 + (index === 1 ? drawings.length : 0));
    const flaggedKeys = new Set(["post:" + bad[index], ...(index === 1 ? ["drawing:" + drawings[0].title] : [])]);
    assert.ok(all.slice(-flaggedKeys.size).every(key => flaggedKeys.has(key)), cats[index] + ' ' + sort + ": low quality overrides popularity and promotion positions across pages");
    const only = await read({ ...params, postId: String(bad[index]) }); assert.equal(only.posts[0].id, bad[index]);
  }
  assert.deepEqual(sqlite.prepare("SELECT * FROM catalog_ratings ORDER BY id").all(), publicStars, "Admin decisions never change public star ratings");
  await mark("post", String(bad[2]), false);
  assert.equal((await read({ category: cats[2], sort: "views", page: "1", modelKeys: "[]" })).catalogOrder[0], 'post:' + bad[2]);
  sqlite.prepare("DELETE FROM posts WHERE id=?").run(bad[0]);
  assert.equal(sqlite.prepare("SELECT target_id FROM catalog_quality_flags WHERE target_type='post' AND target_id=?").get(String(bad[0])), undefined);
  sqlite.prepare("INSERT INTO website_content(key,kind,value,updated_by,updated_at) VALUES ('facade.0.visibility','text','deleted','admin','now')").run();
  assert.equal(sqlite.prepare("SELECT target_id FROM catalog_quality_flags WHERE target_type='demo' AND target_id='facade.0'").get(), undefined);
  await mark("demo", "facade.0", true, 404);
  console.log("PASS: private admin-only/idempotent quality flags; all three catalogs put flagged posts/demos last across every sort and page; snapshot traversal, direct access, reversal, deletion cleanup and unchanged public stars.");
} finally { sqlite.close(); }
