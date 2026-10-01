import assert from "node:assert/strict";
import { cloudflareRequest } from "../lib/cloudflare-request.ts";

const request = new Request("https://tipook.example/api/posts", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Cookie: "tipook_member_session=guest_fixture",
    "OAI-Authenticated-User-Id": "admin",
    "oai-authenticated-user-email": "admin@example.test",
    "oai-authenticated-user-full-name": "Admin",
    "oai-authenticated-user-future-field": "spoofed",
  },
  body: JSON.stringify({ title: "fixture" }),
});
const sanitized = cloudflareRequest(request);
assert.equal(sanitized.url, request.url);
assert.equal(sanitized.method, "POST");
assert.equal(sanitized.headers.get("Content-Type"), "application/json");
assert.equal(sanitized.headers.get("Cookie"), "tipook_member_session=guest_fixture");
assert.ok(Array.from(sanitized.headers.keys()).every(name => !name.startsWith("oai-authenticated-user-")));
assert.deepEqual(await sanitized.json(), { title: "fixture" });
assert.equal(request.headers.get("oai-authenticated-user-id"), "admin");
console.log("Cloudflare: spoofed identity headers removed; method, body and guest cookie preserved.");
