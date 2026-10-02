import { createHash, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

const root = fileURLToPath(new URL("../", import.meta.url));
const hosting = JSON.parse(readFileSync(path.join(root, ".openai/hosting.json"), "utf8"));
export const localStatePath = path.resolve(root, process.env.TIPOOK_LOCAL_STATE_PATH || ".wrangler/state");
export const localBindings = {
  d1_databases: hosting.d1 ? [{ binding: hosting.d1, database_name: "site-creator-d1", database_id: "00000000-0000-4000-8000-000000000000", migrations_dir: path.join(root, "drizzle") }] : [],
  r2_buckets: hosting.r2 ? [{ binding: hosting.r2, bucket_name: "site-creator-r2" }] : [],
};

// Keep generated build paths relative to dist/server while replacing only local
// resource identities. Never modify the deployable production configuration.
export function localBuildConfig(built) {
  return { ...built, name: "tipook-local", account_id: undefined, routes: [], workers_dev: false, ...localBindings };
}

export function migrationFingerprint(directory = path.join(root, "drizzle")) {
  const hash = createHash("sha256");
  for (const name of readdirSync(directory).filter(name => name.endsWith(".sql")).sort()) hash.update(name).update("\0").update(readFileSync(path.join(directory, name))).update("\0");
  return hash.digest("hex");
}

export async function backupLocalDatabases(statePath = localStatePath, backupRoot = path.join(root, ".sites-runtime/backups")) {
  const sourceDirectory = path.join(statePath, "v3/d1/miniflare-D1DatabaseObject");
  if (!existsSync(sourceDirectory)) return null;
  const files = readdirSync(sourceDirectory).filter(name => name.endsWith(".sqlite") && name !== "metadata.sqlite");
  if (!files.length) return null;
  const destination = path.join(backupRoot, new Date().toISOString().replace(/[:.]/g, "-") + "-" + randomUUID());
  mkdirSync(destination, { recursive: true });
  for (const file of files) {
    const database = new DatabaseSync(path.join(sourceDirectory, file), { readOnly: true });
    try { database.prepare("VACUUM INTO ?").run(path.join(destination, file)); }
    finally { database.close(); }
  }
  writeFileSync(path.join(destination, "manifest.json"), JSON.stringify({ createdAt: new Date().toISOString(), statePath, databases: files }, null, 2));
  return destination;
}
