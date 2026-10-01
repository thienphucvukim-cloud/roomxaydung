import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const source = JSON.parse(readFileSync(new URL("../wrangler.jsonc", import.meta.url), "utf8"));
let built;
try {
  built = JSON.parse(readFileSync(new URL("../dist/server/wrangler.json", import.meta.url), "utf8"));
} catch {
  throw new Error("Run pnpm run build:cloudflare before deploying.");
}
const identity = config => ({
  name: config.name,
  account_id: config.account_id,
  d1_databases: (config.d1_databases ?? []).map(({ binding, database_name, database_id }) => ({ binding, database_name, database_id })),
  r2_buckets: (config.r2_buckets ?? []).map(({ binding, bucket_name }) => ({ binding, bucket_name })),
});
assert.deepEqual(identity(built), identity(source),
  "The build uses different Cloudflare bindings. Run pnpm run build:cloudflare before deploying.");
const result = spawnSync(process.execPath, [
  fileURLToPath(new URL("../node_modules/wrangler/bin/wrangler.js", import.meta.url)),
  "deploy", "--config", "dist/server/wrangler.json", ...process.argv.slice(2),
], { stdio: "inherit", windowsHide: true });
if (result.error) throw result.error;
process.exit(result.status ?? 1);
