import assert from "node:assert/strict";
import { catalogPageHref, catalogPageWindow as houseModelPageWindow, CATALOG_PAGE_SIZE as HOUSE_MODEL_PAGE_SIZE } from "../lib/catalog-pagination.ts";

// Verify that mixing community posts and built-in models loses no items at page boundaries.
for (const modelCount of [0, 6, 10]) {
for (const postCount of [0, 10, 14, 19, 20, 21, 30, 40, 45, 100]) {
  const posts = Array.from({ length: postCount }, (_, i) => `post-${i}`);
  const models = Array.from({ length: modelCount }, (_, i) => `model-${i}`);
  const all = [...posts, ...models];
  const rendered = [];
  const { totalPages } = houseModelPageWindow(1, posts.length, models.length);
  for (let page = 1; page <= totalPages; page++) {
    const window = houseModelPageWindow(page, posts.length, models.length);
    const offset = (page - 1) * HOUSE_MODEL_PAGE_SIZE;
    const cards = [...posts.slice(offset, offset + HOUSE_MODEL_PAGE_SIZE), ...models.slice(window.modelStart, window.modelEnd)];
    assert.ok(cards.length <= 20);
    if (page < totalPages) assert.equal(cards.length, 20);
    rendered.push(...cards);
  }
  assert.deepEqual(rendered, all);
  const extraPage = houseModelPageWindow(totalPages + 1, posts.length, models.length);
  assert.deepEqual(models.slice(extraPage.modelStart, extraPage.modelEnd), []);
}
}
assert.equal(houseModelPageWindow(1, 0, 0).totalPages, 1);
for (const base of ["/kho-mau-nha-dep-chat", "/file-ban-ve-nha-dep-chat", "/noi-that"]) {
assert.equal(catalogPageHref(base, 1), base);
const searchLink = new URL(catalogPageHref(base, 2, " Mặt tiền & 5m "), "https://example.test");
assert.equal(searchLink.pathname, base);
assert.equal(searchLink.searchParams.get("page"),"2");
assert.equal(searchLink.searchParams.get("q"), "Mặt tiền & 5m");
}
console.log("Catalog pagination: boundaries, empty catalogs and search links for all three catalogs passed.");
