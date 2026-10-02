import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { backupLocalDatabases, localStatePath } from "./local-data.mjs";
import { archiveBucket, root, wrangler } from "./cloudflare-data.mjs";

const runtime = path.join(root, ".sites-runtime/local-cloud-backup");
mkdirSync(runtime, { recursive: true });
const marker = path.join(runtime, "uploaded.json");
const sqliteDirectory = path.join(localStatePath, "v3/d1/miniflare-D1DatabaseObject");
const sha256 = data => createHash("sha256").update(data).digest("hex");
try {
  if (!existsSync(sqliteDirectory)) throw new Error("No local database found");
  // Compare before taking snapshots. A write during backup is detected on the
  // next run, instead of marking unbacked data as already uploaded.
  const fingerprint = Object.fromEntries(readdirSync(sqliteDirectory).filter(name => name.endsWith(".sqlite") && name !== "metadata.sqlite").sort().map(name => {
    const source = path.join(sqliteDirectory, name);
    const hash = createHash("sha256").update(readFileSync(source));
    if (existsSync(source + "-wal")) hash.update(readFileSync(source + "-wal"));
    return [name, hash.digest("hex")];
  }));
  const previous = existsSync(marker) ? JSON.parse(readFileSync(marker, "utf8")) : null;
  if (JSON.stringify(previous?.fingerprint) === JSON.stringify(fingerprint)) {
    writeFileSync(path.join(runtime, "status.json"), JSON.stringify({ lastCheckedAt: new Date().toISOString(), lastUploadedAt: previous.uploadedAt, error: null }));
  } else {
    const snapshot = await backupLocalDatabases(localStatePath, path.join(runtime, "snapshots"));
    if (!snapshot) throw new Error("No local databases to back up");
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const projectKey = sha256(path.resolve(root)).slice(0, 16);
    const manifest = { version: 1, source: "localhost", createdAt: new Date().toISOString(), databases: [] };
    for (const name of Object.keys(fingerprint)) {
      const file = path.join(snapshot, name);
      const digest = sha256(readFileSync(file));
      const key = `local/v1/${projectKey}/${stamp}/${name}-${digest}.sqlite`;
      wrangler(["r2", "object", "put", `${archiveBucket}/${key}`, "--file", file, "--remote", "--config", "wrangler.finance-backup.jsonc", "--content-type", "application/vnd.sqlite3"], { capture: true });
      manifest.databases.push({ name, key, sha256: digest, bytes: statSync(file).size });
    }
    const file = path.join(snapshot, "cloud-manifest.json");
    writeFileSync(file, JSON.stringify(manifest, null, 2));
    const manifestKey = `local/v1/${projectKey}/${stamp}/manifest.json`;
    wrangler(["r2", "object", "put", `${archiveBucket}/${manifestKey}`, "--file", file, "--remote", "--config", "wrangler.finance-backup.jsonc", "--content-type", "application/json"], { capture: true });
    const uploadedAt = new Date().toISOString();
    writeFileSync(marker, JSON.stringify({ fingerprint, uploadedAt, manifestKey }, null, 2));
    writeFileSync(path.join(runtime, "status.json"), JSON.stringify({ lastCheckedAt: uploadedAt, lastUploadedAt: uploadedAt, error: null }));
    console.log("Local databases backed up to private Cloudflare R2; production transactions remain separate.");
  }
} catch {
  writeFileSync(path.join(runtime, "status.json"), JSON.stringify({ lastCheckedAt: new Date().toISOString(), error: "Cloud upload failed; original local databases retained. Retry with Cloudflare access." }));
  throw new Error("Local cloud backup failed; local data has not been removed");
}
