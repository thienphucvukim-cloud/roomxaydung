import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { archiveBucket, productionDatabase, productionQuery, requireProductionSchema, root, wrangler } from "./cloudflare-data.mjs";

const sha256 = value => createHash("sha256").update(value).digest("hex");
const [{ highWater }] = productionQuery("SELECT coalesce(max(id),0) AS highWater FROM wallet_transactions")[0];
assert.ok(Number.isSafeInteger(highWater));
const fields = "id, user_id, kind, amount, order_code, reference, target_type, target_id, seller_user_id, description, created_at";
const query = `SELECT ${fields} FROM wallet_transactions WHERE id <= ${highWater} ORDER BY id`;
const originalLedger = productionQuery(query)[0];
const directory = path.join(root, ".sites-runtime/backups/production");
mkdirSync(directory, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const dumpPath = path.join(directory, `${stamp}.sql`);
// Wrangler's export output includes a temporary signed download URL; keep it
// inside the process and report only the permanent private backup object key.
wrangler(["d1", "export", productionDatabase.database_name, "--remote", "--config", "wrangler.jsonc", "--output", dumpPath], { capture: true });
const dumpHash = sha256(readFileSync(dumpPath));
const objectKey = `database/v1/${stamp}-${dumpHash}.sql`;
wrangler(["r2", "object", "put", `${archiveBucket}/${objectKey}`, "--file", dumpPath, "--remote", "--config", "wrangler.finance-backup.jsonc", "--content-type", "application/sql"]);
// A failed export or cloud upload aborts before applying a single migration.
wrangler(["d1", "migrations", "apply", productionDatabase.database_name, "--remote", "--config", "wrangler.jsonc"]);
assert.deepEqual(productionQuery(query)[0], originalLedger, "Existing financial transactions changed during migration; deployment must stop and the cloud snapshot must be reviewed");
requireProductionSchema();
writeFileSync(path.join(directory, `${stamp}.json`), JSON.stringify({ databaseId: productionDatabase.database_id, backupKey: objectKey, dumpSha256: dumpHash, ledgerSha256: sha256(JSON.stringify(originalLedger)), highWater, originalTransactions: originalLedger.length, verifiedAt: new Date().toISOString() }, null, 2));
console.log("Migration verified: existing transactions preserved; full SQL snapshot saved to private Cloudflare R2.");
