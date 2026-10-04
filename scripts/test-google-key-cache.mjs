import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const source = ts.transpileModule(readFileSync("lib/google-key-cache.ts", "utf8"), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText
  .replace('import { GOOGLE_KEYS_URL } from "@/lib/google-oauth";', 'const GOOGLE_KEYS_URL = "https://www.googleapis.com/oauth2/v3/certs";');
const { createGoogleKeyCache } = await import("data:text/javascript;base64," + Buffer.from(source).toString("base64"));
let now = 100_000, requests = 0, kid = "first", control = "public, max-age=60", age = "10", failed = false;
const fetchKeys = async () => {
  requests++;
  if (failed) return new Response(null, { status: 503 });
  return Response.json({ keys: [{ kid, kty: "RSA" }] }, { headers: { "Cache-Control": control, Age: age } });
};
const cache = createGoogleKeyCache(fetchKeys, () => now);
const initial = await Promise.all([cache.get(), cache.get(), cache.get()]);
assert.equal(requests, 1, "Concurrent logins must share a key fetch");
assert.deepEqual(initial[0], initial[1]);
now += 49_000;
await cache.get();
assert.equal(requests, 1);
now += 1001;
await cache.get();
assert.equal(requests, 2, "Age must shorten the permitted cache lifetime");
const token = name => Buffer.from(JSON.stringify({ alg: "RS256", kid: name })).toString("base64url") + ".payload.signature";
const oldKeys = await cache.get();
kid = "rotated";
const rotated = await cache.forToken(token(kid), oldKeys);
assert.equal(rotated[0].kid, "rotated");
assert.equal(requests, 3, "A rotated signing key must trigger a refresh before expiry");
await cache.forToken(token(kid), oldKeys);
assert.equal(requests, 3, "A concurrent callback with the old set must reuse the refreshed keys");
await assert.rejects(cache.forToken(token("rotated").replace(/^./, "!"), rotated));
now += 60_000;
failed = true;
await assert.rejects(cache.get(), /Cannot retrieve/);
await assert.rejects(cache.get(), /Cannot retrieve/);
assert.equal(requests, 5, "Failed requests cannot stick in the cache or serve expired keys");
failed = false;
await cache.get();
assert.equal(requests, 6);
for (const directive of ["no-store, max-age=60", "no-cache, max-age=60", "public", "max-age=0"]) {
  control = directive;
  const uncached = createGoogleKeyCache(fetchKeys, () => now);
  const before = requests;
  await uncached.get(); await uncached.get();
  assert.equal(requests - before, 2, directive);
}
control = "public, max-age=999999"; age = "0";
const bounded = createGoogleKeyCache(fetchKeys, () => now);
await bounded.get();
const before = requests;
now += 21600_001;
await bounded.get();
assert.equal(requests, before + 1, "Cache lifetime must have a six-hour upper bound");
console.log("PASS: Google key reuse, concurrent fetches, cache age/expiry, rotation, failure recovery, no-store and bounded TTL.");
