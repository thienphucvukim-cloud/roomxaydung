// node --experimental-vm-modules scripts/test-finance-archive.mjs
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { createContext, SourceTextModule } from "node:vm";
import ts from "typescript";

const sqlite = new DatabaseSync(":memory:");
for (const file of readdirSync("drizzle").filter(file => file.endsWith(".sql")).sort()) sqlite.exec(readFileSync(`drizzle/${file}`, "utf8"));
const insert = (id, amount) => sqlite.prepare("INSERT INTO wallet_transactions (user_id,kind,amount,order_code,reference,description,created_at) VALUES ('buyer',?,?,?,?,'test','2026-10-02')").run(amount > 0 ? "topup" : "purchase", amount, id, "fixture:" + id);
insert(1, 100000); insert(2, -20000);
assert.throws(() => sqlite.prepare("UPDATE wallet_transactions SET amount=0 WHERE id=1").run(), /immutable/);
assert.throws(() => sqlite.prepare("DELETE FROM wallet_transactions WHERE id=1").run(), /cannot be deleted/);
assert.throws(() => sqlite.prepare("DELETE FROM finance_audit_events").run(), /immutable/);
assert.throws(() => sqlite.prepare("UPDATE finance_audit_events SET new_payload='{}'").run(), /immutable/);
sqlite.exec("CREATE TRIGGER simulate_audit_failure BEFORE INSERT ON finance_audit_events WHEN NEW.record_key = '3' BEGIN SELECT RAISE(ABORT, 'Simulated audit failure'); END");
assert.throws(() => insert(3, 50000), /audit failure/);
assert.equal(sqlite.prepare("SELECT count(*) AS n FROM wallet_transactions").get().n, 2, "A failed audit rolls back the money write");
sqlite.exec("DROP TRIGGER simulate_audit_failure");
const context = createContext({ crypto, TextEncoder, Date });
const archiveModule = new SourceTextModule(ts.transpileModule(readFileSync("lib/finance-archive.ts", "utf8"), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText, { context });
await archiveModule.link(() => { throw new Error("Unexpected import"); });
await archiveModule.evaluate();
const { archiveFinance } = archiveModule.namespace;
let failStorage = false, failCheckpoint = false;
const database = {
  prepare(sql) {
    let params = [];
    const statement = {
      bind(...values) { params = values; return statement; },
      async run() {
        if (failCheckpoint && sql.includes("SET last_event_id")) { failCheckpoint = false; throw new Error("Checkpoint unavailable"); }
        return { meta: { changes: Number(sqlite.prepare(sql).run(...params).changes) } };
      },
      read() { return { results: sqlite.prepare(sql).all(...params) }; },
    };
    return statement;
  },
  async batch(statements) {
    sqlite.exec("BEGIN");
    try { const result = statements.map(statement => statement.read()); sqlite.exec("COMMIT"); return result; }
    catch (error) { sqlite.exec("ROLLBACK"); throw error; }
  },
};
const objects = new Map();
const bucket = {
  async head(key) { return objects.get(key) ?? null; },
  async put(key, body, options) {
    if (failStorage) throw new Error("R2 unavailable");
    if (objects.has(key)) return null;
    const object = { body, customMetadata: options.customMetadata };
    objects.set(key, object); return object;
  },
};
const env = { DB: database, FINANCE_BACKUPS: bucket, DATABASE_ID: "fixture-database" };
const cursor = () => sqlite.prepare("SELECT * FROM finance_backup_state WHERE id=1").get();
failStorage = true;
await assert.rejects(archiveFinance(env));
assert.equal(cursor().last_event_id, 0);
assert.ok(cursor().last_error);
failStorage = false; failCheckpoint = true;
await assert.rejects(archiveFinance(env));
assert.equal(cursor().last_event_id, 0, "R2 success followed by D1 failure must retry safely");
assert.equal(objects.size, 1);
await archiveFinance(env);
assert.equal(objects.size, 1, "Retry reuses the confirmed immutable object");
assert.equal(cursor().last_error, null);
for (let id = 3; id <= 603; id++) insert(id, 1);
await Promise.all([archiveFinance(env), archiveFinance(env)]);
assert.equal(cursor().last_event_id, sqlite.prepare("SELECT max(id) AS n FROM finance_audit_events").get().n);
// Verify the selected hash chain and reconstruct every financial row, without
// relying on the original database. Orphan chunks from overlapping runs are safe.
let key = cursor().last_chunk_key, expectedHash = cursor().last_sha256;
const chain = [];
while (key) {
  const archived = objects.get(key);
  assert.ok(archived);
  const actualHash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(archived.body))), byte => byte.toString(16).padStart(2, "0")).join("");
  assert.equal(actualHash, expectedHash);
  const chunk = JSON.parse(archived.body);
  chain.unshift(chunk); key = chunk.previousChunkKey; expectedHash = chunk.previousSha256;
}
const restored = new Map(); let lastId = 0;
for (const chunk of chain) {
  assert.equal(chunk.fromExclusive, lastId, "No gap between archived chunks");
  for (const event of chunk.events) { assert.ok(event.id > lastId); restored.set(event.table_name + ":" + event.record_key, JSON.parse(event.new_payload)); lastId = event.id; }
  assert.equal(lastId, chunk.toInclusive);
}
const restoredBalance = [...restored.entries()].filter(([key]) => key.startsWith("wallet_transactions:")).reduce((sum, [, row]) => sum + row.amount, 0);
assert.equal(restoredBalance, sqlite.prepare("SELECT sum(amount) AS n FROM wallet_transactions").get().n);
assert.equal(restoredBalance, 80601);
assert.deepEqual(restored.get("wallet_sale_settings:1"), { id: 1, admin_percent: 20, updated_by: null, updated_at: null });
console.log("PASS: immutable ledger/audit, atomic money+audit writes, R2 outage, checkpoint failure, retry, concurrent archivers, hash-chain continuity and balance restoration from cloud archive.");
