import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const origin = process.env.TIPOOK_TEST_ORIGIN || "http://127.0.0.1:8788";
assert.ok(["localhost", "127.0.0.1"].includes(new URL(origin).hostname), "Local fixtures only");
const registered = await fetch(origin + "/api/auth/register", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username: "terms_" + crypto.randomUUID().slice(0, 8), password: "fixture-password-123", name: "Terminology Fixture" }) });
assert.equal(registered.status, 200, await registered.clone().text());
const cookie = registered.headers.getSetCookie().find(value => value.startsWith("tipook_auth_session=")).split(";")[0];
async function send(route, method, body, expected) {
  const response = await fetch(origin + route, { method, headers: { cookie, "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  const result = await response.json(); assert.equal(response.status, expected, JSON.stringify(result)); return result;
}
const form = new FormData(); form.set("purpose", "drawing-preview"); form.set("file", new File([readFileSync("scripts/fixtures/upload.webp")], "preview.webp", { type: "image/webp" }));
const uploaded = await fetch(origin + "/api/files", { method: "POST", headers: { cookie }, body: form });
assert.equal(uploaded.status, 201, await uploaded.clone().text());
const { attachment } = await uploaded.json();
const title = "Terminology " + crypto.randomUUID().slice(0, 8);
const { post } = await send("/api/posts", "POST", { category: "Bộ sưu tập ảnh", title, content: "Bài kiểm tra tương thích", location: "5 × 20m", feeling: "Hiện đại", pollQuestion: "0đ", attachments: [attachment] }, 201);
assert.equal(post.specifications, "5 × 20m"); assert.equal(post.listingType, "Hiện đại"); assert.equal(post.priceLabel, "0đ"); assert.equal(post.feeling, post.listingType);
let edited = await send("/api/my-posts", "PATCH", { id: post.id, location: "6 × 18m", feeling: "Nhà phố" }, 200);
assert.equal(edited.post.specifications, "6 × 18m"); assert.equal(edited.post.listingType, "Nhà phố");
edited = await send("/api/my-posts", "PATCH", { id: post.id, specifications: "7 × 16m", listingType: "Nhà vườn", feeling: "Cũ" }, 200);
assert.equal(edited.post.listingType, "Nhà vườn"); assert.equal(edited.post.feeling, "Nhà vườn");
await send("/api/my-posts", "PATCH", { id: post.id, priceLabel: "1đ" }, 400); // house model posts do not have editable sale prices
await send("/api/my-posts", "PATCH", { id: post.id, pollQuestion: "1đ" }, 400); // legacy alias follows the same catalog restriction
for (const route of ["/api/posts?category=" + encodeURIComponent("Bộ sưu tập ảnh") + "&postId=" + post.id, "/api/my-posts?id=" + post.id, "/api/news-feed?q=" + encodeURIComponent(title)]) {
  const listed = await send(route, "GET", null, 200);
  const found = listed.posts.find(item => item.id === post.id); assert.ok(found, route);
  assert.equal(found.specifications, "7 × 16m"); assert.equal(found.location, found.specifications); assert.equal(found.listingType, "Nhà vườn"); assert.equal(found.feeling, found.listingType);
}
console.log("PASS: production build accepts old tab payloads, returns canonical/compatible metadata in every feed, preserves editing rules and canonical precedence.");
