import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { SourceTextModule, SyntheticModule, createContext } from "node:vm";
import ts from "typescript";

let now = 1_000_000, batches = 0, finish;
const tasks = [];
const database = { prepare: sql => ({ bind: time => ({ sql, time }) }), batch: statements => {
  batches++;
  assert.equal(statements.length, 2);
  assert.ok(statements.every(statement => statement.time === now));
  return new Promise((resolve, reject) => { finish = { resolve, reject }; });
} };
class DurableObject { constructor(ctx, env) { this.ctx = ctx; this.env = env; } }
const context = createContext({ URL, Date: { now: () => now }, console: { error() {} } });
const dependencies = {
  "cloudflare:workers": { DurableObject },
  "../lib/cloudflare-request": { cloudflareRequest: request => request },
  "./api-router": { dispatchApi: async () => new Response("ok") },
  "./request-body": { discardUnreadBody: async () => {} },
  "../lib/seo": { isPublicSeoPage: () => false, isSitemapPath: () => false },
  "./public-page-runtime": { publicPageResponse: async () => new Response("public") },
};
const source = ts.transpileModule(readFileSync("worker/api-runtime.ts", "utf8"), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
const root = new SourceTextModule(source, { context });
await root.link(name => {
  const exports = dependencies[name];
  return new SyntheticModule(Object.keys(exports), function () { for (const [name, value] of Object.entries(exports)) this.setExport(name, value); }, { context });
});
await root.evaluate();
const runtime = new root.namespace.ApiRuntime({ waitUntil: task => tasks.push(task) }, { DB: database });
assert.equal((await runtime.fetch(new Request("https://nhadepchat.top/api/auth/google"))).status, 200);
assert.equal(batches, 1, "Response must complete before the pending cleanup resolves");
await runtime.fetch(new Request("https://nhadepchat.top/api/me"));
assert.equal(batches, 1, "Cleanup must be throttled across requests");
finish.reject(new Error("database unavailable"));
await tasks.shift();
await runtime.fetch(new Request("https://nhadepchat.top/api/me"));
assert.equal(batches, 2, "Cleanup failure must allow a retry");
finish.resolve([]); await tasks.shift();
now += 15 * 60_000 - 1;
await runtime.fetch(new Request("https://nhadepchat.top/api/me"));
assert.equal(batches, 2);
now++;
await runtime.fetch(new Request("https://nhadepchat.top/api/me"));
assert.equal(batches, 3);
finish.resolve([]); await tasks.shift();
console.log("PASS: login responses do not wait for expiry cleanup; maintenance is throttled and recovers after failure.");
