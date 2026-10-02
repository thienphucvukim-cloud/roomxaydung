// node --experimental-vm-modules scripts/test-catalog-promotions.mjs
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { createContext, SourceTextModule, SyntheticModule } from "node:vm";
import ts from "typescript";
import { catalogPageWindow } from "../lib/catalog-pagination.ts";

const sqlite = new DatabaseSync(":memory:");
for (const file of readdirSync("drizzle").filter(file => file.endsWith(".sql")).sort()) sqlite.exec(readFileSync(`drizzle/${file}`, "utf8"));
let userId = "author";
const database = {
  prepare(sql) {
    let params = [];
    const statement = {
      bind(...values) { params = values; return statement; },
      async first() { return sqlite.prepare(sql).get(...params) ?? null; },
      async all() { return { results: sqlite.prepare(sql).all(...params) }; },
      run() { return { meta: { changes: Number(sqlite.prepare(sql).run(...params).changes) } }; },
    };
    return statement;
  },
  async batch(statements) {
    sqlite.exec("BEGIN");
    try { const results = statements.map(statement => statement.run()); sqlite.exec("COMMIT"); return results; }
    catch (error) { sqlite.exec("ROLLBACK"); throw error; }
  },
};
const context = createContext({ URL, Response, Request, console, crypto, Date });
const helpers = new SourceTextModule(ts.transpileModule(readFileSync("lib/catalog-promotions.ts", "utf8"), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText, { context });
await helpers.link(() => { throw new Error("Unexpected helper import"); });
await helpers.evaluate();
const route = new SourceTextModule(ts.transpileModule(readFileSync("app/api/catalog-promotions/route.ts", "utf8"), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText, { context });
await route.link(specifier => {
  if (specifier.endsWith("catalog-promotions")) return helpers;
  const namespace = specifier === "cloudflare:workers" ? { env: { DB: database } } : { getPaymentBuyerId: async () => userId };
  return new SyntheticModule(Object.keys(namespace), function () { for (const [key, value] of Object.entries(namespace)) this.setExport(key, value); }, { context });
});
await route.evaluate();
const { GET, POST } = route.namespace;
const { promotionMonthlyPrice, promotionExpiry, placePromotedItems } = helpers.namespace;
const insert = sqlite.prepare("INSERT INTO posts (user_id, author_name, category, title, content, audience, created_at) VALUES (?, 'Author', ?, 'Title', '', ?, '2026-10-02')");
const drawing = Number(insert.run("author", "Bản vẽ cộng đồng", "Công khai").lastInsertRowid);
const drawing2 = Number(insert.run("author", "Bản vẽ cộng đồng", "Công khai").lastInsertRowid);
const interior = Number(insert.run("author", "Nội thất cộng đồng", "Công khai").lastInsertRowid);
const privatePost = Number(insert.run("author", "Nội thất cộng đồng", "Riêng tư").lastInsertRowid);
sqlite.prepare("INSERT INTO wallet_transactions (user_id, kind, amount, order_code, reference, description, created_at) VALUES ('author', 'topup', 200000, 1, 'topup', 'Topup', '2026-10-02')").run();
const balance = () => sqlite.prepare("SELECT SUM(amount) AS balance FROM wallet_transactions WHERE user_id = 'author'").get().balance;
async function buy(body, expected = 201) {
  const response = await POST(new Request("http://localhost/api/catalog-promotions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ months: 1, purchaseId: crypto.randomUUID(), ...body }) }));
  const data = await response.json();
  assert.equal(response.status, expected, JSON.stringify(data));
  return data;
}
try {
  assert.deepEqual(Array.from({ length: 16 }, (_, i) => promotionMonthlyPrice(i + 1)), [50000, 40000, 30000, 20000, ...Array(12).fill(10000)]);
  assert.throws(() => promotionMonthlyPrice(17));
  assert.equal(promotionExpiry(new Date("2027-01-31T12:00:00Z"), 1), "2027-02-28T12:00:00.000Z");
  assert.equal(promotionExpiry(new Date("2028-01-31T12:00:00Z"), 1), "2028-02-29T12:00:00.000Z");
  assert.equal(promotionExpiry(new Date("2027-02-28T18:00:00Z"), 1), "2027-03-31T18:00:00.000Z", "Months follow the Vietnam calendar");
  const items = Array.from({ length: 16 }, (_, index) => ({ id: index, position: index === 0 ? 16 : index === 1 ? 2 : null }));
  const placed = placePromotedItems(items, item => item.position);
  assert.equal(placed.length, 16); assert.equal(placed[15].id, 0); assert.equal(placed[1].id, 1);
  assert.equal(new Set(placed.map(item => item.id)).size, 16);
  assert.equal(placePromotedItems([{ position: 16 }], item => item.position).length, 16);
  for (const postCount of [0, 1, 15, 16, 17, 31, 32, 33]) {
    for (const modelCount of [0, 6, 17]) {
      const posts = Array.from({ length: postCount }, (_, i) => `post-${i}`);
      const models = Array.from({ length: modelCount }, (_, i) => `model-${i}`);
      const rendered = [];
      const { totalPages } = catalogPageWindow(1, postCount, modelCount, 16);
      for (let page = 1; page <= totalPages; page++) {
        const window = catalogPageWindow(page, postCount, modelCount, 16);
        const cards = [...posts.slice((page - 1) * 16, page * 16), ...models.slice(window.modelStart, window.modelEnd)];
        assert.ok(cards.length <= 16);
        rendered.push(...cards);
      }
      assert.deepEqual(rendered, [...posts, ...models], "16-item pagination must not lose or repeat records");
    }
  }
  const requestId = crypto.randomUUID();
  await buy({ postId: drawing, position: 1, purchaseId: requestId });
  assert.equal(balance(), 150000);
  await buy({ postId: drawing, position: 1, purchaseId: requestId }, 200);
  assert.equal(balance(), 150000, "Retries must not charge twice");
  await buy({ postId: drawing2, position: 1 }, 409);
  await buy({ postId: drawing, position: 2 }, 409);
  assert.equal(balance(), 150000, "Conflicts must not debit the wallet");
  await buy({ postId: interior, position: 1, months: 2 });
  assert.equal(balance(), 50000, "Interior slots are independent and charged by month");
  await buy({ postId: drawing2, position: 2, months: 2 }, 402);
  assert.equal(balance(), 50000);
  await buy({ postId: privatePost, position: 3 }, 403);
  userId = "other";
  await buy({ postId: drawing2, position: 2 }, 403);
  userId = "author";
  for (const position of [0, 17, 1.5, "1"]) await buy({ postId: drawing2, position }, 400);
  for (const months of [0, 13, 1.5, "1"]) await buy({ postId: drawing2, position: 2, months }, 400);
  const response = await GET(new Request("http://localhost/api/catalog-promotions?category=" + encodeURIComponent("Bản vẽ cộng đồng")));
  const available = await response.json();
  assert.equal(available.active.length, 1); assert.equal(available.owned.length, 2);
  sqlite.prepare("UPDATE catalog_promotions SET expires_at = '2020-01-01' WHERE post_id = ?").run(drawing);
  await buy({ postId: drawing2, position: 1 });
  assert.equal(balance(), 0, "Expired slots must become available again");
  console.log("PASS: monthly pricing, calendar expiry, exact placement, ownership, atomic wallet debit, retries, slot conflicts, separate catalogs, insufficient funds, and expired slot reuse.");
} finally { sqlite.close(); }
