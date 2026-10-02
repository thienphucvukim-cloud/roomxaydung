import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import "./sites-env.mjs";
import { backupLocalDatabases, localBindings, localStatePath, migrationFingerprint } from "./local-data.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));

export async function prepareLocalDatabase() {
  const binding = localBindings.d1_databases[0]?.binding;
  if (!binding) return;
  const runtime = path.join(root, ".sites-runtime/local");
  mkdirSync(runtime, { recursive: true });
  const configPath = path.join(runtime, "wrangler.json");
  writeFileSync(configPath, JSON.stringify({
    name: "tipook-local",
    compatibility_date: "2026-05-15",
    d1_databases: localBindings.d1_databases,
  }, null, 2));
  const fingerprint = migrationFingerprint();
  const marker = path.join(localStatePath, ".migration-fingerprint");
  if (!existsSync(marker) || readFileSync(marker, "utf8") !== fingerprint) {
    const snapshot = await backupLocalDatabases();
    if (snapshot) console.log(`Đã sao lưu database local trước migration: ${snapshot}`);
  }
  const result = spawnSync(process.execPath, [
    path.join(root, "node_modules/wrangler/bin/wrangler.js"),
    "d1", "migrations", "apply", binding, "--local",
    "--config", configPath, "--persist-to", localStatePath,
  ], { cwd: root, env: { ...process.env, CI: "true" }, encoding: "utf8", windowsHide: true });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`Không thể khởi tạo dữ liệu local:\n${result.stdout}\n${result.stderr}`);
  }
  mkdirSync(localStatePath, { recursive: true });
  writeFileSync(marker, fingerprint);
  console.log("Dữ liệu local đã sẵn sàng.");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await prepareLocalDatabase();
}
