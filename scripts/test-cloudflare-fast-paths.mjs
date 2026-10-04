import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { readPublicFile } from "../lib/public-file.ts";
import * as images from "vinext/server/image-optimization";
import { discardUnreadBody } from "../worker/request-body.ts";

let streamChunks = 0;
const rejectedPost = new Request("https://example.test/api/auth/login", { method: "POST", duplex: "half", body: new ReadableStream({
  pull(controller) { if (streamChunks < 3) { streamChunks++; controller.enqueue(new Uint8Array(1024)); } else controller.close(); },
}) });
await discardUnreadBody(rejectedPost);
assert.equal(streamChunks, 3, "Early denials must finish copying the incoming stream before returning through a DO stub");
assert.equal(rejectedPost.bodyUsed, true);
await discardUnreadBody(rejectedPost);

const key = "11111111-1111-4111-8111-111111111111";
const origin = "https://nhadepchat.example";
let accessType = "public", exists = true, reads = 0, heads = 0;
const object = () => ({
  customMetadata: { accessType, fileName: encodeURIComponent('Ảnh "nhà".png') },
  httpEtag: '"fixture-etag"', size: 5,
  writeHttpMetadata(headers) { headers.set("content-type", "image/png"); },
});
const bucket = {
  async get(actual) {
    reads++;
    assert.equal(actual, key);
    return exists ? { ...object(), body: new Response("image").body } : null;
  },
  async head(actual) {
    heads++;
    assert.equal(actual, key);
    return exists ? object() : null;
  },
};
const fileRequest = (suffix = "", method = "GET") => new Request(`${origin}/api/files?key=${key}${suffix}`, { method });
let response = await readPublicFile(fileRequest(), bucket);
assert.equal(response.status, 200);
assert.equal(await response.text(), "image");
assert.equal(response.headers.get("content-type"), "image/png");
assert.equal(response.headers.get("etag"), '"fixture-etag"');
assert.equal(response.headers.get("content-length"), "5");
assert.equal(response.headers.get("cache-control"), "private, max-age=3600");
assert.ok(response.headers.get("content-disposition").startsWith("inline;"));
assert.ok(response.headers.get("content-disposition").includes("filename*=UTF-8''"));
assert.equal(response.headers.get("x-content-type-options"), "nosniff");
assert.equal(response.headers.get("content-security-policy"), "sandbox");
response = await readPublicFile(fileRequest("&download=1"), bucket);
assert.ok(response.headers.get("content-disposition").startsWith("attachment;"));
await response.body.cancel();
const readsBeforeHead = reads;
response = await readPublicFile(fileRequest("", "HEAD"), bucket);
assert.equal(response.status, 200);
assert.equal(response.body, null);
assert.equal(reads, readsBeforeHead);
assert.equal(heads, 1);
accessType = "private";
for (const method of ["GET", "HEAD"]) {
  response = await readPublicFile(fileRequest("&download=1", method), bucket);
  assert.equal(response.status, 403, "Private drawings must never be served by the preview endpoint");
  if (method === "HEAD") assert.equal(response.body, null);
}
accessType = "public";
exists = false;
assert.equal((await readPublicFile(fileRequest(), bucket)).status, 404);
exists = true;
const readsBeforeInvalid = reads;
assert.equal((await readPublicFile(new Request(origin + "/api/files?key=../../private"), bucket)).status, 400);
assert.equal(reads, readsBeforeInvalid);
assert.equal((await readPublicFile(fileRequest())).status, 500);

// Exercise the real Worker with a stub framework. Fast requests must never
// import React; authenticated/write requests must retain router + auth handling.
let imports = 0, dispatched = 0, lastRequest;
const context = vm.createContext({ Request, Response, Headers, URL, Array, crypto: globalThis.crypto, Uint8Array });
const framework = new vm.SyntheticModule(["default"], function () {
  this.setExport("default", { fetch(request) {
    dispatched++;
    lastRequest = request;
    return new Response("framework");
  } });
}, { context });
await framework.link(() => {});
await framework.evaluate();
const apiRouter = new vm.SyntheticModule(["dispatchApi"], function () {
  this.setExport("dispatchApi", request => {
    dispatched++;
    lastRequest = request;
    return new Response("framework");
  });
}, { context });
await apiRouter.link(() => {});
await apiRouter.evaluate();
const imageModule = new vm.SyntheticModule(["handleConfiguredImageOptimization", "isImageOptimizationPath"], function () {
  this.setExport("handleConfiguredImageOptimization", images.handleConfiguredImageOptimization);
  this.setExport("isImageOptimizationPath", images.isImageOptimizationPath);
}, { context });
await imageModule.link(() => {});
await imageModule.evaluate();
const kdfModule = new vm.SyntheticModule(["ApiRuntime"], function () { this.setExport("ApiRuntime", class {}); }, { context });
await kdfModule.link(() => {});
await kdfModule.evaluate();
const modules = new Map();
async function load(identifier) {
  if (modules.has(identifier)) return modules.get(identifier);
  const source = ts.transpileModule(readFileSync(new URL(identifier, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const sourceModule = new vm.SourceTextModule(source, {
    context, identifier,
    importModuleDynamically(specifier) {
      assert.equal(specifier, "vinext/server/fetch-handler");
      imports++;
      return framework;
    },
  });
  modules.set(identifier, sourceModule);
  await sourceModule.link((specifier, referencing) => specifier === "./api-router" ? apiRouter : specifier === "./api-runtime" ? kdfModule : specifier === "vinext/server/image-optimization" ? imageModule : load(new URL(specifier.endsWith(".ts") ? specifier : specifier + ".ts", referencing.identifier).href));
  return sourceModule;
}
const entryModule = await load(new URL("../worker/cloudflare.ts", import.meta.url).href);
await entryModule.evaluate();
const worker = entryModule.namespace.default;
const env = { BUCKET: bucket };
response = await worker.fetch(fileRequest(), env, {});
assert.equal(await response.text(), "image");
response = await worker.fetch(new Request(origin + "/api/me", { headers: {
  Cookie: "tipook_buyer_session=guest_fixture",
  "oai-authenticated-user-id": "forged-owner",
} }), env, {});
assert.deepEqual(await response.json(), { user: null, counts: { posts: 0, actions: 0, requests: 0 } });
assert.equal(response.headers.get("cache-control"), "private, no-store");
for (const path of ["/wp-admin/install.php", "/wp-includes/file.php", "/wp-login.php", "/xmlrpc.php"]) {
  assert.equal((await worker.fetch(new Request(origin + path), env, {})).status, 404);
}
response = await worker.fetch(new Request(origin + "/favicon.ico"), env, {});
assert.equal(response.status, 302);
assert.equal(response.headers.get("location"), "/nhadepchat-browser-icon.png?v=4");
assert.equal((await worker.fetch(new Request(origin + "/signin-with-chatgpt"), env, {})).status, 503);
const imageUrl = origin + "/_next/image?url=" + encodeURIComponent("/api/files?key=" + key) + "&w=640&q=75";
response = await worker.fetch(new Request(imageUrl), env, {});
assert.equal(response.status, 200);
assert.equal(await response.text(), "image");
assert.equal(response.headers.get("x-content-type-options"), "nosniff");
accessType = "private";
assert.equal((await worker.fetch(new Request(imageUrl), env, {})).status, 404, "Image optimization must not bypass private-file denial");
accessType = "public";
assert.equal((await worker.fetch(new Request(origin + "/_next/image?url=https%3A%2F%2Fexternal.example%2Fimage&w=640&q=75"), env, {})).status, 400);
const assetRequests = [];
const assets = { async fetch(request) {
  assetRequests.push(new URL(request.url).pathname);
  if (request.url.endsWith("/version.json")) return Response.json({ buildId: "current-build", rscCompatibilityId: "current-wire" });
  return new Response(request.url.endsWith(".nav.rsc") ? "navigation" : request.url.endsWith(".rsc") ? "flight" : "html");
} };
for (const path of ["/", "/dang-nhap?return_to=%2Ftai-khoan", "/file-ban-ve-nha-dep-chat?q=CAD&sort=downloads&page=2", "/kho-mau-nha-dep-chat?postId=42"]) {
  response = await worker.fetch(new Request(origin + path), { ASSETS: assets }, {});
  assert.equal(await response.text(), "html");
  assert.ok(!response.headers.has("set-cookie"));
}
for (const build of ["current-build", "old-build"]) {
  const manifest = JSON.stringify({ schemaVersion: 1, entries: [{ id: "layout:/", privacy: "public", artifactCompatibility: { deploymentVersion: build } }] });
  response = await worker.fetch(new Request(origin + "/dang-ky?_rsc", { headers: { RSC: "1", "X-Vinext-Client-Reuse-Manifest": manifest } }), { ASSETS: assets }, {});
  if (build === "old-build") {
    assert.equal(response.status, 409, "Old clients must reload before decoding new client references");
  } else {
    assert.equal(await response.text(), "navigation");
    assert.equal(response.headers.get("X-Vinext-RSC-Compatibility-Id"), "current-wire");
    assert.ok(response.headers.get("Vary").includes("X-Vinext-Client-Reuse-Manifest"));
  }
}
assert.ok(assetRequests.every(path => !path.includes("?")));
response = await worker.fetch(new Request(origin + "/file-ban-ve-nha-dep-tipook/page/3?q=CAD&sort=downloads"), env, {});
assert.equal(response.status, 308);
assert.equal(response.headers.get("location"), "/file-ban-ve-nha-dep-chat?q=CAD&sort=downloads&page=3");
assert.equal((await worker.fetch(new Request(origin + "/noi-that/page/0"), env, {})).status, 404);
assert.equal((await worker.fetch(new Request(origin + "/unknown-route"), { ASSETS: assets }, {})).status, 404);
assert.equal(imports, 0);
for (const cookie of ["tipook_auth_session=" + "a".repeat(64), "tipook_auth_session=invalid"]) {
  response = await worker.fetch(new Request(origin + "/api/me", { headers: {
    Cookie: cookie, "oai-authenticated-user-id": "forged-owner",
  } }), env, {});
  assert.equal(await response.text(), "framework");
  assert.equal(lastRequest.headers.get("cookie"), cookie);
  assert.equal(lastRequest.headers.get("oai-authenticated-user-id"), null);
}
for (const method of ["POST", "DELETE"]) {
  const request = new Request(origin + "/api/files?key=" + key, {
    method, headers: { "content-type": "text/plain", "oai-authenticated-user-id": "forged-owner" }, body: "upload",
  });
  assert.equal((await worker.fetch(request, env, {})).status, 200);
  assert.equal(lastRequest.method, method);
  assert.equal(lastRequest.headers.get("oai-authenticated-user-id"), null);
  assert.equal(await lastRequest.text(), "upload");
}
assert.equal(dispatched, 4);
assert.equal(imports, 0, "API requests must never import the page renderer");
let remoteCalls = 0;
const API_RUNTIME = { idFromName(name) { assert.match(name, /^api-(?:[0-9]|1[0-5])$/); return name; }, get() {
  return { fetch(request) { remoteCalls++; lastRequest = request; return new Response("runtime"); } };
} };
response = await worker.fetch(new Request(origin + "/api/auth/login", { method: "POST", headers: { "oai-authenticated-user-id": "fake-admin", cookie: "tipook_auth_session=fixture" }, body: "fixture" }), { API_RUNTIME }, {});
assert.equal(await response.text(), "runtime");
assert.equal(lastRequest.headers.get("oai-authenticated-user-id"), null);
assert.equal(lastRequest.headers.get("cookie"), "tipook_auth_session=fixture");
assert.equal(await lastRequest.text(), "fixture");
assert.equal(remoteCalls, 1);
assert.equal(imports, 0);
console.log("PASS: streamed public files, private drawing denial, HEAD metadata, lazy Worker paths and authenticated/write request isolation.");
