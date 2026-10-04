import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

// Read only the two Google credentials. Never print their values, put them in
// command arguments, create a credentials export, or upload other local vars.
const root = fileURLToPath(new URL("../", import.meta.url));
const lines = readFileSync(new URL("../.dev.vars", import.meta.url), "utf8").split(/\r?\n/);
function setting(name) {
  const line = lines.find(line => new RegExp(`^\\s*${name}\\s*=`).test(line));
  return line?.slice(line.indexOf("=") + 1).trim().replace(/^(['"])(.*)\1$/, "$2") || "";
}
const secrets = { GOOGLE_CLIENT_ID: setting("GOOGLE_CLIENT_ID"), GOOGLE_CLIENT_SECRET: setting("GOOGLE_CLIENT_SECRET") };
assert.match(secrets.GOOGLE_CLIENT_ID, /^\d+-[A-Za-z0-9_-]+\.apps\.googleusercontent\.com$/, "Missing or invalid Google Client ID in .dev.vars");
assert.ok(secrets.GOOGLE_CLIENT_SECRET.length >= 20 && !/\s/.test(secrets.GOOGLE_CLIENT_SECRET), "Missing or invalid Google Client Secret in .dev.vars");
assert.ok(!/your[-_ ]|placeholder|fixture|paste[-_ ]|replace[-_ ]/i.test(Object.values(secrets).join(" ")), "Replace placeholder Google credentials first");
if (!process.argv.includes("--apply")) {
  console.log("PASS: both Google credentials are present. Use --apply to update Cloudflare Secrets.");
} else {
  const config = JSON.parse(readFileSync(new URL("../wrangler.jsonc", import.meta.url), "utf8"));
  assert.equal(config.name, "tipook-web");
  assert.ok(config.routes.some(route => route.pattern === "nhadepchat.top" && route.custom_domain));
  const result = spawnSync(process.execPath, [fileURLToPath(new URL("../node_modules/wrangler/bin/wrangler.js", import.meta.url)), "secret", "bulk", "--config", "wrangler.jsonc"], {
    cwd: root, input: JSON.stringify(secrets), encoding: "utf8", windowsHide: true, env: { ...process.env, CI: "true", WRANGLER_SEND_METRICS: "false" },
    stdio: ["pipe", "pipe", "pipe"],
  });
  if (result.error || result.status !== 0) throw new Error("Google secret update failed; inspect the Cloudflare dashboard before retrying.");
  console.log("PASS: GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET saved to Cloudflare Secrets for tipook-web.");
}
