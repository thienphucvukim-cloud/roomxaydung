import { fileURLToPath } from "node:url";

// Use the production Wrangler bindings instead of the local Sites placeholders.
process.env.TIPOOK_DEPLOY_TARGET = "cloudflare";
process.env.WRANGLER_SEND_METRICS ??= "false";
process.env.WRANGLER_WRITE_LOGS ??= "false";
const cli = new URL("../node_modules/vinext/dist/cli.js", import.meta.url);
process.argv = [process.execPath, fileURLToPath(cli), "build", ...process.argv.slice(2)];
await import(cli.href);
