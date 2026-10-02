import assert from "node:assert/strict";
import { requestTargetLink } from "../lib/request-target-link.ts";

assert.equal(requestTargetLink("https://nhadepchat.top", "post", "123", "Bản vẽ cộng đồng"),
  "https://nhadepchat.top/file-ban-ve-nha-dep-chat?postId=123#post-123");
assert.equal(requestTargetLink("https://nhadepchat.top", "post", "456", "Nội thất cộng đồng"),
  "https://nhadepchat.top/noi-that?postId=456#post-456");
const title = "Nhà 2 tầng 5 × 12m & sân vườn";
const catalogLink = new URL(requestTargetLink("http://localhost:5173", "drawing", title));
assert.equal(catalogLink.origin, "http://localhost:5173");
assert.equal(catalogLink.pathname, "/file-ban-ve-nha-dep-chat/page/1");
assert.equal(catalogLink.searchParams.get("q"), title);
console.log("Request links identify drawing posts, interior posts, and catalog drawings correctly.");
