import { readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

if (process.argv.includes("--cloudflare")) {
  const wrangler = fileURLToPath(new URL("../node_modules/wrangler/bin/wrangler.js", import.meta.url));
  const env = { ...process.env, WRANGLER_SEND_METRICS: "false", WRANGLER_WRITE_LOGS: "false" };
  const list = spawnSync(process.execPath, [wrangler, "secret", "list", "--config", "wrangler.jsonc"], { env, encoding: "utf8", windowsHide: true });
  if (list.status !== 0) throw new Error("Cannot inspect Worker secret names. Check Cloudflare authentication.");
  if (JSON.parse(list.stdout).some(item => item.name === "TIPOOK_MFA_KEY")) {
    console.log("Worker MFA encryption key already exists; preserved.");
  } else {
    const result = spawnSync(process.execPath, [wrangler, "secret", "put", "TIPOOK_MFA_KEY", "--config", "wrangler.jsonc"], { env, input: randomBytes(32).toString("hex"), encoding: "utf8", windowsHide: true });
    if (result.status !== 0) throw new Error("Cannot configure Worker MFA encryption key.");
    console.log("Configured Worker MFA encryption key securely through stdin.");
  }
} else {
  const file = new URL("../.dev.vars", import.meta.url);
  const source = readFileSync(file, "utf8");
  const existing = source.match(/^TIPOOK_MFA_KEY\s*=\s*["']?([a-f0-9]{64})["']?\s*$/m);
  if (existing) console.log("Local MFA encryption key already exists; preserved.");
  else {
    if (/^TIPOOK_MFA_KEY\s*=/m.test(source)) throw new Error("Existing TIPOOK_MFA_KEY is invalid; repair it without rotating an active key.");
    writeFileSync(file, source.trimEnd() + `\nTIPOOK_MFA_KEY=${randomBytes(32).toString("hex")}\n`);
    console.log("Configured local MFA encryption key in ignored .dev.vars.");
  }
}
