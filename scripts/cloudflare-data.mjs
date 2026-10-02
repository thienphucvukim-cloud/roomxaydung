import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import "./sites-env.mjs";

export const root = fileURLToPath(new URL("../", import.meta.url));
export const productionConfig = JSON.parse(readFileSync(path.join(root, "wrangler.jsonc"), "utf8"));
export const archiveConfig = JSON.parse(readFileSync(path.join(root, "wrangler.finance-backup.jsonc"), "utf8"));
export const productionDatabase = productionConfig.d1_databases.find(database => database.binding === "DB");
assert.ok(productionDatabase?.database_id && productionDatabase.database_id !== "00000000-0000-4000-8000-000000000000", "Production requires its real D1 database");
assert.equal(archiveConfig.account_id, productionConfig.account_id, "Finance archiver must use the production account");
assert.equal(archiveConfig.vars.DATABASE_ID, productionDatabase.database_id, "Finance archiver must back up the production database");
assert.equal(archiveConfig.d1_databases[0].database_id, productionDatabase.database_id);
export const archiveBucket = archiveConfig.r2_buckets[0].bucket_name;

export function wrangler(args, { capture = false } = {}) {
  const result = spawnSync(process.execPath, [path.join(root, "node_modules/wrangler/bin/wrangler.js"), ...args], {
    cwd: root, env: { ...process.env, CI: "true" }, encoding: "utf8", windowsHide: true,
    stdio: capture ? "pipe" : "inherit", maxBuffer: 128 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(capture ? `Cloudflare command failed: ${result.stderr || "Check Cloudflare access and configuration"}` : "Cloudflare command failed; stopped before the next step");
  return result.stdout;
}

export function productionQuery(sql) {
  const result = JSON.parse(wrangler(["d1", "execute", productionDatabase.database_name, "--remote", "--config", "wrangler.jsonc", "--command", sql, "--json"], { capture: true }));
  assert.ok(result.every(statement => statement.success), "Production query failed");
  return result.map(statement => statement.results);
}

export function requireProductionSchema() {
  const [rows, triggers] = productionQuery("SELECT name FROM d1_migrations; SELECT name FROM sqlite_master WHERE type = 'trigger' AND name IN ('wallet_transactions_no_update', 'wallet_transactions_no_delete', 'wallet_transactions_audit_insert')");
  const applied = new Set(rows.map(row => row.name));
  const missing = readdirSync(path.join(root, "drizzle")).filter(name => name.endsWith(".sql") && !applied.has(name));
  assert.equal(missing.length, 0, `Production schema is not ready: ${missing.join(", ")}. Run pnpm run db:migrate:cloudflare first.`);
  assert.equal(triggers.length, 3, "Financial ledger protection is missing; deployment stopped");
}
