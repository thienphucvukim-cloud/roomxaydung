// Run with node --experimental-vm-modules scripts/test-local-admin-auth.mjs.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { SourceTextModule, SyntheticModule, createContext } from "node:vm";
import ts from "typescript";

const source = ts.transpileModule(readFileSync("lib/local-admin-auth.ts", "utf8"), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText;
async function check(dev, flag, url, expected) {
  const context = createContext({ URL });
  const bindings = new SyntheticModule(["env"], function () {
    this.setExport("env", { TIPOOK_LOCAL_ADMIN_PASSWORD_ONLY: flag });
  }, { context });
  const authModule = new SourceTextModule(source, {
    context, initializeImportMeta(meta) { meta.env = { DEV: dev }; },
  });
  await authModule.link(() => bindings);
  await authModule.evaluate();
  assert.equal(authModule.namespace.localAdminPasswordOnly({ url }), expected, `${dev}, ${flag}, ${url}`);
}
for (const host of ["localhost", "127.0.0.1", "[::1]"]) {
  await check(true, "1", `http://${host}:5173/admin`, true);
  await check(false, "1", `http://${host}:5173/admin`, false);
  await check(true, "0", `http://${host}:5173/admin`, false);
  await check(true, undefined, `http://${host}:5173/admin`, false);
}
for (const host of ["nhadepchat.top", "localhost.example.com", "192.168.1.2"]) {
  await check(true, "1", `https://${host}/admin`, false);
}
console.log("PASS: local admin password mode requires development, explicit opt-in and loopback host; production stays disabled.");
