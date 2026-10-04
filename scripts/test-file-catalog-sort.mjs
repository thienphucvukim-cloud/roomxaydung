import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { createContext, SourceTextModule, SyntheticModule } from "node:vm";
import ts from "typescript";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import * as schema from "../db/schema.ts";
import { drawings } from "../lib/drawing-catalog.ts";
import { catalogPageHref } from "../lib/catalog-pagination.ts";
import { parseFileCatalogSort } from "../lib/file-catalog-sort.ts";

const sqlite = new DatabaseSync(":memory:");
for (const file of readdirSync("drizzle").filter(file => file.endsWith(".sql")).sort()) sqlite.exec(readFileSync(`drizzle/${file}`, "utf8"));
const db = drizzle(async (query, params, method) => {
  const statement = sqlite.prepare(query);
  if (method === "run") return { rows: [], ...statement.run(...params) };
  statement.setReturnArrays(true);
  return { rows: method === "get" ? statement.get(...params) : statement.all(...params) };
});
let memberId = "buyer";
let objectExists = true;
const env = { BUCKET: { get: async () => objectExists ? { body: "file fixture", size: 12, writeHttpMetadata: headers => headers.set("content-type", "application/pdf") } : null } };
const context = createContext({ URL, URLSearchParams, Response, Request, Headers, console, Date });
const fixtures = {
  "@/db": { getDb: () => db }, "@/db/schema": schema, "cloudflare:workers": { env },
  "@/lib/member-access": { memberAccessResponse: async () => null },
  "@/lib/member-identity": { currentMember: async () => ({ userId: memberId, authorName: "Buyer" }) },
  "@/lib/payment-identity": { getPaymentBuyerId: async () => memberId },
  "@/lib/download-links": { verifyDownloadToken: async () => true },
};
const cache = new Map();
async function load(name, reference) {
  const id = name.startsWith(".") ? "@/" + path.posix.normalize(path.posix.join(path.posix.dirname(reference.identifier.slice(2)), name)) : name;
  if (cache.has(id)) return cache.get(id);
  const namespace = fixtures[id] || (!id.startsWith("@/") ? await import(id) : null);
  const vmModule = namespace ? new SyntheticModule(Object.keys(namespace), function () {
    for (const [key, value] of Object.entries(namespace)) this.setExport(key, value);
  }, { context, identifier: id }) : new SourceTextModule(ts.transpileModule(readFileSync(id.slice(2) + (id.endsWith(".ts") ? "" : ".ts"), "utf8"), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  }).outputText, { context, identifier: id });
  cache.set(id, vmModule);
  return vmModule;
}
async function route(name) {
  const vmModule = await load(`@/app/api/${name}/route`);
  if (vmModule.status === "unlinked") await vmModule.link(load);
  if (vmModule.status === "linked") await vmModule.evaluate();
  return vmModule.namespace;
}
async function feed(category, sort, extras = {}) {
  const params = new URLSearchParams({ category, sort, page: "1", ...extras });
  const response = await (await route("posts")).GET(new Request("https://app.test/api/posts?" + params));
  const result = await response.json();
  assert.equal(response.status, 200, JSON.stringify(result));
  return result;
}
const add = sqlite.prepare("INSERT INTO posts (user_id, author_name, category, title, content, audience, created_at) VALUES ('author', 'Author', ?, ?, '', ?, ?) RETURNING id");
const drawCategory = "Bản vẽ cộng đồng", interiorCategory = "Nội thất cộng đồng";
try {
  for (const category of [drawCategory, interiorCategory]) {
    const ids = Array.from({ length: 20 }, (_, index) => add.get(category, `fixture ${index}`, "Công khai", `2026-01-${String(index + 1).padStart(2, "0")}`).id);
    const hidden = add.get(category, "hidden", "Riêng tư", "2099-01-01").id;
    for (const [index, table, amount] of [[0, "catalog_downloads", 4], [1, "catalog_views", 5], [2, "catalog_ratings", 1], [3, "catalog_ratings", 2]]) {
      for (let user = 0; user < amount; user++) {
        sqlite.prepare(`INSERT INTO ${table} (target_type, target_id, user_id, ${table === "catalog_ratings" ? "rating, updated_at" : "created_at"}) VALUES ('post', ?, ?, ${table === "catalog_ratings" ? "5, 'now'" : "'now'"})`).run(String(ids[index]), `user-${user}`);
      }
    }
    sqlite.prepare("INSERT INTO catalog_promotions (post_id,user_id,category,position,months,amount,reference,starts_at,expires_at) VALUES (?,'author',?,2,1,10000,?,'2020-01-01','2099-01-01')").run(ids[4], category, category + "-active");
    sqlite.prepare("INSERT INTO catalog_promotions (post_id,user_id,category,position,months,amount,reference,starts_at,expires_at) VALUES (?,'author',?,1,1,10000,?,'2020-01-01','2020-02-01')").run(ids[5], category, category + "-expired");
    sqlite.prepare("INSERT INTO user_actions (user_id,action_type,target_type,target_id,created_at) VALUES ('fan','save','post',?,'now')").run(String(ids[6]));
    assert.equal((await feed(category, "downloads")).catalogOrder[0], "post:" + ids[0]);
    assert.equal((await feed(category, "views")).catalogOrder[0], "post:" + ids[1]);
    assert.deepEqual((await feed(category, "rating")).catalogOrder.slice(0, 2), ["post:" + ids[3], "post:" + ids[2]]);
    assert.deepEqual((await feed(category, "featured")).catalogOrder.slice(0, 2), ["post:" + ids[4], "post:" + ids[6]]);
    assert.equal((await feed(category, "latest")).posts[0].id, ids[4], "Default order preserves active advertising positions");
    const first = await feed(category, "views");
    const second = await feed(category, "views", { page: "2" });
    const all = [...first.catalogOrder, ...second.catalogOrder];
    assert.equal(all.length, 20);
    assert.equal(new Set(all).size, 20);
    assert.equal(all.includes("post:" + hidden), false);
    assert.equal((await feed(category, "views", { q: "fixture 1" })).total, 11);
  }
  const keys = JSON.stringify([drawings[0].title, drawings[6].title]);
  const demoFeed = await feed(drawCategory, "views", { modelKeys: keys });
  assert.equal(demoFeed.catalogOrder[0], "drawing:" + drawings[6].title);
  const second = await feed(drawCategory, "views", { modelKeys: keys, page: "2" });
  const merged = [...demoFeed.catalogOrder, ...second.catalogOrder];
  assert.equal(merged.length, 22);
  assert.equal(new Set(merged).size, 22, "Demo and community entries must share pagination without losses or duplicates");
  const viewLeader = Number(demoFeed.posts.find(post => post.title === "fixture 1").id);
  sqlite.prepare("INSERT INTO wallet_transactions (user_id,kind,amount,order_code,reference,target_type,target_id,description,created_at) VALUES ('buyer','purchase',0,1001,'fixture','post',?,'fixture','now')").run(String(viewLeader));
  const fileId = Number(sqlite.prepare("INSERT INTO post_attachments (post_id,object_key,file_name,mime_type,size,access_type,created_at) VALUES (?,'object','file.pdf','application/pdf',12,'private','now')").run(viewLeader).lastInsertRowid);
  const download = await route("downloads/drawing");
  const request = () => new Request(`https://app.test/api/downloads/drawing?order=1001&file=${fileId}&expires=9999999999&token=${"a".repeat(64)}`);
  assert.equal((await download.GET(request())).status, 200);
  assert.equal((await download.GET(request())).status, 200);
  assert.equal(sqlite.prepare("SELECT count(*) AS n FROM catalog_downloads WHERE target_id=?").get(String(viewLeader)).n, 1);
  memberId = null;
  assert.equal((await download.GET(request())).status, 401);
  memberId = "buyer";
  objectExists = false;
  assert.equal((await download.GET(request())).status, 404);
  assert.equal(sqlite.prepare("SELECT count(*) AS n FROM catalog_downloads WHERE target_id=?").get(String(viewLeader)).n, 1);
  for (const sort of ["downloads", "views", "rating", "featured"]) {
    const url = new URL(catalogPageHref("/noi-that", 2, "Phòng ngủ", sort), "https://app.test");
    assert.equal(url.searchParams.get("sort"), sort);
    assert.equal(url.searchParams.get("q"), "Phòng ngủ");
  }
  assert.equal(parseFileCatalogSort("invalid"), "latest");
  console.log("PASS: four rankings for both catalogs, ratings ties, active/expired promotions, merged demo pagination, search, private posts, URL persistence and authenticated deduplicated downloads.");
} finally { sqlite.close(); }
