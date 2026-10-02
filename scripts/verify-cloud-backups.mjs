import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { archiveBucket, productionQuery, root, wrangler } from "./cloudflare-data.mjs";

const directory = path.join(root, ".sites-runtime/cloud-backup-verification");
mkdirSync(directory, { recursive: true });
const sha256 = bytes => createHash("sha256").update(bytes).digest("hex");
function download(key, file) {
  wrangler(["r2", "object", "get", `${archiveBucket}/${key}`, "--file", file, "--remote", "--config", "wrangler.finance-backup.jsonc"], { capture: true });
  return readFileSync(file);
}
const [state] = productionQuery("SELECT * FROM finance_backup_state WHERE id = 1")[0];
assert.ok(state.last_chunk_key && state.last_sha256, "No confirmed cloud financial archive yet");
const archive = download(state.last_chunk_key, path.join(directory, "financial-chunk.json"));
assert.equal(sha256(archive), state.last_sha256);
assert.equal(JSON.parse(archive.toString("utf8")).toInclusive, state.last_event_id);
const productionDirectory = path.join(root, ".sites-runtime/backups/production");
const receiptName = readdirSync(productionDirectory).filter(name => name.endsWith(".json")).sort().at(-1);
if (receiptName) {
  const receipt = JSON.parse(readFileSync(path.join(productionDirectory, receiptName), "utf8"));
  const dump = download(receipt.backupKey, path.join(directory, "production.sql"));
  assert.equal(sha256(dump), receipt.dumpSha256);
  const restored = new DatabaseSync(":memory:");
  restored.exec(dump.toString("utf8"));
  assert.equal(restored.prepare("PRAGMA integrity_check").get().integrity_check, "ok");
  assert.equal(restored.prepare("SELECT count(*) AS n FROM wallet_transactions").get().n, receipt.originalTransactions);
  restored.close();
}
const localMarker = path.join(root, ".sites-runtime/local-cloud-backup/uploaded.json");
const restoredLocal = [];
if (existsSync(localMarker)) {
  const marker = JSON.parse(readFileSync(localMarker, "utf8"));
  const manifest = JSON.parse(download(marker.manifestKey, path.join(directory, "local-manifest.json")).toString("utf8"));
  for (const entry of manifest.databases) {
    // Names originate in the local snapshot manifest; keep recovery files inside
    // this verification directory even if a manifest was changed unexpectedly.
    const file = path.join(directory, path.basename(entry.name));
    assert.equal(sha256(download(entry.key, file)), entry.sha256);
    const restored = new DatabaseSync(file, { readOnly: true });
    assert.equal(restored.prepare("PRAGMA integrity_check").get().integrity_check, "ok");
    restoredLocal.push({ accounts: restored.prepare("SELECT count(*) AS n FROM website_accounts").get().n, transactions: restored.prepare("SELECT count(*) AS n FROM wallet_transactions").get().n });
    restored.close();
  }
}
console.log(JSON.stringify({ cloudFinancialArchiveVerified: true, archivedThrough: state.last_event_id, lastCheckedAt: state.last_checked_at, cloudSqlSnapshotRestored: Boolean(receiptName), localCloudCopiesVerified: restoredLocal }));
