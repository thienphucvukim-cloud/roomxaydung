// Run with node --experimental-vm-modules scripts/test-catalog-engagement.mjs.
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { createContext, SourceTextModule, SyntheticModule } from "node:vm";
import ts from "typescript";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import * as schema from "../db/schema.ts";

const sqlite = new DatabaseSync(":memory:");
for (const name of readdirSync("drizzle").filter(name => name.endsWith(".sql")).sort()) sqlite.exec(readFileSync(`drizzle/${name}`, "utf8"));
const db = drizzle(async (sql, params, method) => {
  const statement = sqlite.prepare(sql);
  if (method === "run") return { rows: [], ...statement.run(...params) };
  statement.setReturnArrays(true);
  return { rows: method === "get" ? statement.get(...params) : statement.all(...params) };
});
let visitor = "guest_first", member = null;
const context = createContext({ URL, Response, Request, console });
const cache = new Map();
async function load(specifier) {
  if (cache.has(specifier)) return cache.get(specifier);
  let namespace;
  if (specifier === "@/db") namespace = { getDb: () => db };
  else if (specifier === "@/db/schema") namespace = schema;
  else if (specifier === "@/lib/payment-identity") namespace = {
    getPaymentBuyerId: async () => member?.userId ?? visitor,
    getOrCreatePaymentBuyerId: async () => ({ userId: member?.userId ?? visitor }),
    attachPaymentBuyerCookie: response => response,
  };
  else if (specifier === "@/lib/website-auth") namespace = { getAuthenticatedIdentity: async () => member };
  else if (!specifier.startsWith("@/")) namespace = await import(specifier);
  let vmModule;
  if (namespace) vmModule = new SyntheticModule(Object.keys(namespace), function () { for (const [key, value] of Object.entries(namespace)) this.setExport(key, value); }, { context });
  else {
    const file = specifier.slice(2) + ".ts";
    vmModule = new SourceTextModule(ts.transpileModule(readFileSync(file, "utf8"), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText, { context, identifier: file });
  }
  cache.set(specifier, vmModule);
  return vmModule;
}
const route = await load("@/app/api/catalog-engagement/route");
await route.link(load);
await route.evaluate();
const { GET, POST } = route.namespace;
const facade = { targetType: "house-model", targetId: "Nhà phố 3 tầng xanh mát" };
const drawing = { targetType: "drawing", targetId: "Nhà cấp 4 mái Thái 1 tầng 11 × 13m, diện tích 130m²" };
async function send(target, action, rating, status = 200) {
  const response = await POST(new Request("http://localhost/api/catalog-engagement", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...target, action, rating }) }));
  const data = await response.json();
  assert.equal(response.status, status, JSON.stringify(data));
  return data;
}
async function read(target) {
  const response = await GET(new Request("http://localhost/api/catalog-engagement?" + new URLSearchParams(target)));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Cache-Control"), "private, no-store");
  return response.json();
}
try {
  assert.equal((await read(facade)).views, 0);
  assert.equal((await send(facade, "view")).views, 1);
  await Promise.all(Array.from({ length: 5 }, () => send(facade, "view")));
  assert.equal((await read(facade)).views, 1, "Repeated opens by one visitor must not inflate views.");
  visitor = "guest_second";
  assert.equal((await send(facade, "view")).views, 2);
  await send({ ...facade, targetId: "missing" }, "view", undefined, 404);
  assert.equal((await send(drawing, "view")).views, 1);
  await send(facade, "rate", 5, 400);
  await send(drawing, "rate", 5, 401);
  assert.equal((await read(drawing)).rating, null);
  member = { userId: "member_first" };
  for (const invalid of [0, 6, 1.5, "5", null]) await send(drawing, "rate", invalid, 400);
  await send(drawing, ["rate"], 5, 400);
  assert.equal((await send(drawing, "rate", 5)).rating, 5);
  const changed = await send(drawing, "rate", 3);
  assert.equal(changed.myRating, 3);
  assert.equal(changed.ratingCount, 1);
  member = { userId: "member_second" };
  const average = await send(drawing, "rate", 5);
  assert.equal(average.rating, 4);
  assert.equal(average.ratingCount, 2);
  assert.equal(average.myRating, 5);
  const insert = sqlite.prepare("INSERT INTO posts (user_id, author_name, category, title, content, audience, created_at) VALUES ('author', 'Author', ?, 'Same title', '', ?, '2026-10-02')");
  const facadePost = String(insert.run("Bộ sưu tập ảnh", "Công khai").lastInsertRowid);
  const drawingPost = String(insert.run("Bản vẽ cộng đồng", "Công khai").lastInsertRowid);
  const interiorPost = String(insert.run("Nội thất cộng đồng", "Công khai").lastInsertRowid);
  const privatePost = String(insert.run("Nội thất cộng đồng", "Riêng tư").lastInsertRowid);
  const post = targetId => ({ targetType: "post", targetId });
  assert.equal((await send(post(facadePost), "view")).views, 1);
  assert.equal((await send(post(drawingPost), "view")).views, 1);
  assert.equal((await send(post(interiorPost), "view")).views, 1);
  assert.equal((await send(post(drawingPost), "rate", 2)).rating, 2);
  assert.equal((await send(post(interiorPost), "rate", 4)).rating, 4);
  assert.equal((await read(post(drawingPost))).rating, 2, "Posts with identical titles must keep separate ratings.");
  await send(post(privatePost), "rate", 5, 404);
  await send(post("0001"), "view", undefined, 404);
  assert.equal((await POST(new Request("http://localhost/api/catalog-engagement", { method: "POST", body: "bad json" }))).status, 400);
  member = null;
  assert.equal((await read(drawing)).myRating, null);
  console.log("PASS: persistent unique views, concurrent deduplication, authenticated ratings, rating updates and averages, category validation, and separate drawing/interior/post statistics.");
} finally { sqlite.close(); }
