import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import "./sites-env.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));

export function prepareLocalDatabase() {
  const hosting = JSON.parse(readFileSync(path.join(root, ".openai/hosting.json"), "utf8"));
  if (!hosting.d1) return;
  const runtime = path.join(root, ".sites-runtime/local");
  mkdirSync(runtime, { recursive: true });
  const configPath = path.join(runtime, "wrangler.json");
  writeFileSync(configPath, JSON.stringify({
    name: "tipook-local",
    compatibility_date: "2026-05-15",
    d1_databases: [{
      binding: hosting.d1,
      database_name: "site-creator-d1",
      database_id: "00000000-0000-4000-8000-000000000000",
      migrations_dir: path.join(root, "drizzle"),
    }],
  }, null, 2));
  const result = spawnSync(process.execPath, [
    path.join(root, "node_modules/wrangler/bin/wrangler.js"),
    "d1", "migrations", "apply", hosting.d1, "--local",
    "--config", configPath, "--persist-to", path.join(root, ".wrangler/state"),
  ], { cwd: root, env: { ...process.env, CI: "true" }, encoding: "utf8", windowsHide: true });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`Không thể khởi tạo dữ liệu local:\n${result.stdout}\n${result.stderr}`);
  }
  console.log("Dữ liệu local đã sẵn sàng.");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  prepareLocalDatabase();
}
