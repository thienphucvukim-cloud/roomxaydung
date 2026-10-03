import { spawn } from "node:child_process";
import path from "node:path";

const localUrl = "http://localhost:5173/";
let ready = false;
try {
  const response = await fetch(localUrl, { signal: AbortSignal.timeout(1500) });
  ready = response.ok;
} catch {
  // Opening the browser must never start a local server implicitly.
}

if (!ready) {
  console.error("Local server is not running. Start it manually with pnpm dev only when needed, and stop it with Ctrl+C.");
  process.exitCode = 1;
} else {
  let command;
  let args;
  if (process.platform === "win32") {
    command = path.join(process.env.SystemRoot || "C:\\Windows", "System32", "rundll32.exe");
    args = ["url.dll,FileProtocolHandler", localUrl];
  } else if (process.platform === "darwin") {
    command = "open";
    args = [localUrl];
  } else {
    command = "xdg-open";
    args = [localUrl];
  }
  const browser = spawn(command, args, { stdio: "ignore", windowsHide: true });
  browser.on("error", (error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
  console.log(`Opened ${localUrl}`);
}
