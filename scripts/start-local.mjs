import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { spawn } from "node:child_process";
import path from "node:path";
import { projectRoot } from "./sites-env.mjs";
import { prepareLocalDatabase } from "./prepare-local-db.mjs";
import { localBuildConfig, localStatePath } from "./local-data.mjs";

const config = path.join(projectRoot, "dist/server/wrangler.json");
if (!existsSync(config)) throw new Error("Chạy pnpm build trước khi pnpm start.");
await prepareLocalDatabase();
const localConfig = path.join(projectRoot, "dist/server/wrangler.local.json");
writeFileSync(localConfig, JSON.stringify(localBuildConfig(JSON.parse(readFileSync(config, "utf8"))), null, 2));
const variables = path.join(projectRoot, ".dev.vars");
const child = spawn(process.execPath, [
  path.join(projectRoot, "node_modules/wrangler/bin/wrangler.js"),
  "dev", "--config", localConfig,
  ...(existsSync(variables) ? ["--env-file", variables] : []),
  "--local", "--persist-to", localStatePath,
  "--ip", "127.0.0.1", "--inspector-port", "0", ...process.argv.slice(2),
], { cwd: projectRoot, stdio: "inherit", env: process.env, windowsHide: true });
process.on("SIGINT", () => child.kill("SIGINT"));
process.on("SIGTERM", () => child.kill("SIGTERM"));
child.on("error", error => { console.error(error.message); process.exitCode = 1; });
child.on("exit", code => { process.exitCode = code ?? 0; });
