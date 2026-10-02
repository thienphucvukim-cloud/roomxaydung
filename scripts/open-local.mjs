import { closeSync, mkdirSync, openSync } from "node:fs";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const localUrl = "http://localhost:5173/";
const runtimeDirectory = path.join(projectRoot, ".sites-runtime", "local");
const logPath = path.join(runtimeDirectory, "dev-server.log");

const isReady = async () => {
  try {
    const response = await fetch(localUrl, { signal: AbortSignal.timeout(1500) });
    return response.ok;
  } catch {
    return false;
  }
};

const waitUntilReady = async (child) => {
  let exitCode;
  child?.once("exit", (code) => { exitCode = code ?? 1; });
  const deadline = Date.now() + 30_000;

  while (Date.now() < deadline) {
    if (await isReady()) return;
    if (exitCode !== undefined) {
      throw new Error(`Máy chủ local đã dừng với mã ${exitCode}. Xem log: ${logPath}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new Error(`Máy chủ local không sẵn sàng sau 30 giây. Xem log: ${logPath}`);
};

const openBrowser = (url) => {
  let command;
  let args;

  if (process.platform === "win32") {
    command = path.join(process.env.SystemRoot || "C:\\Windows", "System32", "rundll32.exe");
    args = ["url.dll,FileProtocolHandler", url];
  } else if (process.platform === "darwin") {
    command = "open";
    args = [url];
  } else {
    command = "xdg-open";
    args = [url];
  }

  const browser = spawn(command, args, {
    detached: true,
    stdio: "ignore",
    windowsHide: true,
  });
  browser.unref();
};

let server;
if (!(await isReady())) {
  mkdirSync(runtimeDirectory, { recursive: true });
  const log = openSync(logPath, "a");
  server = spawn(process.execPath, [path.join(projectRoot, "scripts", "run-framework.mjs"), "dev"], {
    cwd: projectRoot,
    detached: true,
    env: { ...process.env, NO_COLOR: "1" },
    stdio: ["ignore", log, log],
    windowsHide: true,
  });
  server.unref();
  closeSync(log);
}

await waitUntilReady(server);
openBrowser(localUrl);
console.log(`Đã mở ${localUrl}`);
console.log("Máy chủ chạy nền độc lập; Codex có thể tiếp tục viết code và thay đổi sẽ tự cập nhật.");
