import { existsSync } from "node:fs";
import { spawn } from "node:child_process";
import path from "node:path";
import { projectRoot } from "./sites-env.mjs";
import { prepareLocalDatabase } from "./prepare-local-db.mjs";

const config = path.join(projectRoot, "dist/server/wrangler.json");
if (!existsSync(config)) throw new Error("Chạy pnpm build trước khi pnpm start.");
prepareLocalDatabase();
const variables = path.join(projectRoot, ".dev.vars");
const child = spawn(process.execPath, [
  path.join(projectRoot, "node_modules/wrangler/bin/wrangler.js"),
  "dev", "--config", config,
  ...(existsSync(variables) ? ["--env-file", variables] : []),
  "--local", "--persist-to", path.join(projectRoot, ".wrangler/state"),
  "--ip", "127.0.0.1", "--inspector-port", "0", ...process.argv.slice(2),
], { cwd: projectRoot, stdio: "inherit", env: process.env, windowsHide: true });
process.on("SIGINT", () => child.kill("SIGINT"));
process.on("SIGTERM", () => child.kill("SIGTERM"));
child.on("error", error => { console.error(error.message); process.exitCode = 1; });
child.on("exit", code => { process.exitCode = code ?? 0; });
