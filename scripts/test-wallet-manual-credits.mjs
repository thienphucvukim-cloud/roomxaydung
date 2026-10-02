// node --experimental-vm-modules scripts/test-wallet-manual-credits.mjs
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { createContext, SourceTextModule, SyntheticModule } from "node:vm";
import ts from "typescript";

const sqlite = new DatabaseSync(":memory:");
for (const file of readdirSync("drizzle").filter(file => file.endsWith(".sql")).sort()) sqlite.exec(readFileSync(`drizzle/${file}`, "utf8"));
for (const userId of ["buyer", "other"]) sqlite.prepare("INSERT INTO website_accounts (user_id, display_name, email, password_hash, created_at) VALUES (?, ?, ?, 'hash', '2026-10-02')").run(userId, userId, `${userId}@example.com`);
let admin = { userId: "admin" };
let failLedger = false;
const database = {
  prepare(sql) {
    let params = [];
    const statement = {
      bind(...values) { params = values; return statement; },
      async first() { return sqlite.prepare(sql).get(...params) ?? null; },
      async all() { return { results: sqlite.prepare(sql).all(...params) }; },
      run() {
        if (failLedger && sql.startsWith("INSERT INTO wallet_transactions")) throw new Error("Simulated database failure");
        return { meta: { changes: Number(sqlite.prepare(sql).run(...params).changes) } };
      },
    };
    return statement;
  },
  async batch(statements) {
    sqlite.exec("BEGIN");
    try { const results = statements.map(statement => statement.run()); sqlite.exec("COMMIT"); return results; }
    catch (error) { sqlite.exec("ROLLBACK"); throw error; }
  },
};
const context = createContext({ URL, Response, Request, crypto, Date, console });
const route = new SourceTextModule(ts.transpileModule(readFileSync("app/api/admin/wallet-credits/route.ts", "utf8"), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText, { context });
await route.link(specifier => {
  const namespaces = {
    "cloudflare:workers": { env: { DB: database } },
    "@/lib/admin-auth": { requireAdmin: async () => admin },
    "@/lib/website-auth": { validOrigin: request => request.headers.get("origin") === new URL(request.url).origin },
  };
  const namespace = namespaces[specifier];
  if (!namespace) throw new Error(`Unexpected import: ${specifier}`);
  return new SyntheticModule(Object.keys(namespace), function () { for (const [key, value] of Object.entries(namespace)) this.setExport(key, value); }, { context });
});
await route.evaluate();
const { GET, POST } = route.namespace;
const body = { userId: "buyer", amount: 100000, reason: "Cộng bù chuyển khoản ABC123", requestId: crypto.randomUUID() };
async function post(payload = body, origin = "http://localhost") {
  return POST(new Request("http://localhost/api/admin/wallet-credits", { method: "POST", headers: { "content-type": "application/json", origin }, body: JSON.stringify(payload) }));
}
const counts = () => [sqlite.prepare("SELECT count(*) AS n FROM wallet_manual_credits").get().n, sqlite.prepare("SELECT count(*) AS n FROM wallet_transactions").get().n];
const balance = userId => sqlite.prepare("SELECT coalesce(sum(amount), 0) AS balance FROM wallet_transactions WHERE user_id = ?").get(userId).balance;

for (const status of [401, 403]) {
  admin = { error: Response.json({ error: "Forbidden" }, { status }) };
  assert.equal((await post()).status, status);
  assert.equal((await GET(new Request("http://localhost/api/admin/wallet-credits"))).status, status);
}
admin = { userId: "admin" };
assert.equal((await post(body, "http://evil.example")).status, 403);
for (const invalid of [null, { amount: 0 }, { amount: -1 }, { amount: 1.5 }, { amount: 20000001 }, { amount: "100000" }, { reason: " " }, { reason: "x".repeat(501) }, { requestId: "invalid" }, { userId: "" }]) {
  assert.equal((await post(invalid === null ? null : { ...body, ...invalid })).status, 400);
}
assert.equal((await POST(new Request("http://localhost/api/admin/wallet-credits", { method: "POST", headers: { origin: "http://localhost" }, body: "{" }))).status, 400);
assert.equal((await post({ ...body, userId: "missing" })).status, 404);
assert.deepEqual(counts(), [0, 0]);

const created = await post({ ...body, performedBy: "forged-admin", createdAt: "forged-time" });
assert.equal(created.status, 201);
const result = await created.json();
assert.equal(result.credit.performedBy, "admin");
assert.equal(result.credit.reason, body.reason);
assert.ok(Number.isSafeInteger(result.credit.orderCode));
assert.ok(Number.isFinite(Date.parse(result.credit.createdAt)));
assert.equal(balance("buyer"), 100000);
assert.equal(balance("other"), 0);
const ledger = sqlite.prepare("SELECT * FROM wallet_transactions WHERE reference = ?").get(result.credit.reference);
assert.equal(ledger.order_code, result.credit.orderCode);
assert.equal(ledger.created_at, result.credit.createdAt);

const repeated = await post();
assert.equal(repeated.status, 200);
assert.equal((await repeated.json()).replayed, true);
const concurrent = await Promise.all([post(), post()]);
assert.ok(concurrent.every(response => response.status === 200));
for (const changed of [{ amount: 200000 }, { userId: "other" }, { reason: "Changed" }]) assert.equal((await post({ ...body, ...changed })).status, 409);
admin = { userId: "another-admin" };
assert.equal((await post()).status, 409);
admin = { userId: "admin" };
assert.deepEqual(counts(), [1, 1]);
assert.equal(balance("buyer"), 100000);

const retryBody = { ...body, requestId: crypto.randomUUID() };
failLedger = true;
assert.equal((await post(retryBody)).status, 500);
assert.deepEqual(counts(), [1, 1]);
failLedger = false;
assert.equal((await post(retryBody)).status, 201);
assert.deepEqual(counts(), [2, 2]);
assert.equal(balance("buyer"), 200000);
const history = await GET(new Request("http://localhost/api/admin/wallet-credits?q=buyer%40example.com"));
assert.equal(history.status, 200);
const data = await history.json();
assert.equal(data.accounts.length, 1);
assert.equal(data.accounts[0].userId, "buyer");
assert.equal(data.credits.length, 2);
assert.equal((await GET(new Request("http://localhost/api/admin/wallet-credits?q=%27%20OR%201%3D1"))).status, 200);
console.log("Manual wallet credits passed: admin access, origin, validation, account search, audit, balance, replay, conflicts and atomic rollback.");
