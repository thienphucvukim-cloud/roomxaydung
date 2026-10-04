import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { checkTerminology } from "./check-terminology.mjs";

checkTerminology();

// Use the production Wrangler bindings instead of the local Sites placeholders.
process.env.TIPOOK_DEPLOY_TARGET = "cloudflare";
process.env.WRANGLER_SEND_METRICS ??= "false";
process.env.WRANGLER_WRITE_LOGS ??= "false";
const cli = new URL("../node_modules/vinext/dist/cli.js", import.meta.url);
const result = spawnSync(process.execPath, [fileURLToPath(cli), "build", ...process.argv.slice(2)], { stdio: "inherit", env: process.env, windowsHide: true });
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);
const { prerenderCloudflareShells } = await import("./prerender-cloudflare-shells.mjs");
await prerenderCloudflareShells();
