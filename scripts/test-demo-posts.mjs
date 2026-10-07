// Run with node --experimental-vm-modules scripts/test-demo-posts.mjs.
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
const db = drizzle(async (sql, params) => {
  const statement = sqlite.prepare(sql);
  statement.setReturnArrays(true);
  return { rows: statement.all(...params) };
});
let isAdmin = true;
const context = createContext({ URL, URLSearchParams, Response, Request, console });
const cache = new Map();
async function load(specifier, referencing) {
  const path = specifier.startsWith(".") ? posix.normalize(posix.join(posix.dirname(referencing.identifier), specifier)) : specifier;
  if (cache.has(path)) return cache.get(path);
  const namespace = path === "@/db" ? { getDb: () => db }
    : path === "@/db/schema" ? schema
    : path === "cloudflare:workers" ? { env: { DB: {
      prepare: sql => ({ bind: (...params) => () => sqlite.prepare(sql).run(...params) }),
      batch: async statements => {
        sqlite.exec("BEGIN");
        try { statements.forEach(run => run()); sqlite.exec("COMMIT"); }
        catch (error) { sqlite.exec("ROLLBACK"); throw error; }
      },
    } } }
    : path === "@/lib/admin-auth" ? { requireAdmin: async () => isAdmin ? { userId: "admin" } : { error: Response.json({ error: "Unauthorized" }, { status: 401 }) } }
    : path === "@/lib/website-auth" ? { validOrigin: request => request.headers.get("origin") === new URL(request.url).origin }
    : !path.startsWith("@/") ? await import(path) : null;
  const mod = namespace ? new SyntheticModule(Object.keys(namespace), function () {
    for (const [key, value] of Object.entries(namespace)) this.setExport(key, value);
  }, { context }) : new SourceTextModule(ts.transpileModule(readFileSync(path.slice(2) + (path.endsWith(".ts") ? "" : ".ts"), "utf8"), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  }).outputText, { context, identifier: path });
  cache.set(path, mod);
  return mod;
}
const route = await load("@/app/api/site-content/route");
await route.link(load); await route.evaluate();
const helpers = await load("@/lib/demo-posts");
await helpers.link(load); await helpers.evaluate();
const search = await load("@/app/api/search/route");
await search.link(load); await search.evaluate();
const products = await load("@/lib/wallet-products"); await products.link(load); await products.evaluate();
const { drawings } = (await load("@/lib/drawing-catalog")).namespace;
const { demoPostVisible, demoPostState } = helpers.namespace;
const read = async () => (await (await route.namespace.GET()).json()).content;
const results = async () => (await (await search.namespace.GET(new Request("https://example.test/api/search?q=" + encodeURIComponent("Nhà phố 3 tầng xanh mát")))).json()).results;
async function write(changes, expected = 200, origin = "https://example.test") {
  const response = await route.namespace.PUT(new Request("https://example.test/api/site-content", {
    method: "PUT", headers: { Origin: origin, "Content-Type": "application/json" }, body: JSON.stringify({ changes }),
  }));
  assert.equal(response.status, expected, await response.text());
}
const state = value => [{ key: "facade.0.visibility", content: { kind: "text", value } }];
try {
  const priceChange = value => [{ key: "drawing.0.price", content: { kind: "text", value } }];
  const product = () => products.namespace.resolveWalletProduct("drawing", drawings[0].title);
  assert.equal((await product()).amount, 150000);
  await write(priceChange("99000"));
  assert.equal((await read())["drawing.0.price"].value, "99.000đ");
  assert.equal((await product()).amount, 99000, "Checkout reads the persisted price override");
  for (const value of ["-2000", "1đ", "abc2000", "9007199254740992"]) await write(priceChange(value), 400);
  assert.equal((await product()).amount, 99000);
  await write([{ key: "drawing.0.price", content: { kind: "image", value: "/2000.png" } }], 400);
  await write(priceChange("0")); assert.equal((await product()).amount, 0);
  await write(priceChange("85000"), 403, "https://other.test");
  isAdmin = false; await write(priceChange("85000"), 401); isAdmin = true;
  await write([{ key: "drawing.0.price", content: null }]); assert.equal((await product()).amount, 150000);
  assert.equal(demoPostVisible(await read(), "facade.0"), true);
  assert.equal((await results()).length, 1);
  await write(state("hidden"));
  assert.equal(demoPostState(await read(), "facade.0"), "hidden");
  assert.equal(demoPostVisible(await read(), "facade.0"), false);
  assert.equal(demoPostVisible(await read(), "facade.0", true), true);
  assert.equal(demoPostVisible(await read(), "facade.1"), true);
  assert.equal((await results()).length, 0);
  await write(state("public"));
  assert.equal((await results()).length, 1);
  await write([{ key: "facade.0.title", content: { kind: "text", value: "Edited demo" } }]);
  assert.equal((await read())["facade.0.title"].value, "Edited demo");
  await write(state("deleted"));
  assert.equal(demoPostState(await read(), "facade.0"), "deleted");
  assert.equal((await results()).length, 0);
  assert.equal(demoPostVisible(await read(), "facade.0", true), false);
  assert.equal((await read())["facade.0.title"], undefined);
  for (const value of ["public", "hidden"]) await write(state(value), 409);
  await write([{ key: "facade.0.visibility", content: null }], 409);
  await write([{ key: "facade.0.title", content: { kind: "text", value: "Restore attempt" } }], 409);
  await write([{ key: "drawing.0.visibility", content: { kind: "text", value: "deleted" } }]);
  assert.equal(demoPostVisible(await read(), "drawing.0"), false);
  assert.equal(demoPostVisible(await read(), "drawing.0", true), false);
  assert.equal(demoPostVisible(await read(), "drawing.1"), true);
  await write(state("deleted"), 403, "https://other.test");
  isAdmin = false;
  await write(state("deleted"), 401);
  assert.equal(demoPostState(await read(), "facade.0"), "deleted");
  console.log("PASS: demo hide/show and permanent deletion, override removal, no admin restore/reset, unrelated demos stay visible, admin and origin checks enforced.");
} finally { sqlite.close(); }
