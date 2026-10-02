// node --experimental-vm-modules scripts/test-catalog-promotion-form.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createContext, SourceTextModule, SyntheticModule } from "node:vm";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import * as pricing from "../lib/catalog-promotions.ts";

let active = [{ position: 1, expiresAt: "2027-01-01T00:00:00Z" }];
let stateIndex = 0;
const context = createContext({ console });
const source = ts.transpileModule(readFileSync("components/catalog-promotion-fields.tsx", "utf8"), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX } }).outputText;
const formModule = new SourceTextModule(source, { context });
await formModule.link(async specifier => {
  const namespace = specifier === "react"
    ? { useEffect: () => {}, useState: () => [stateIndex++ === 0 ? active : "", () => {}] }
    : specifier === "@/lib/catalog-promotions" ? pricing : await import(specifier);
  return new SyntheticModule(Object.keys(namespace), function () { for (const [key, value] of Object.entries(namespace)) this.setExport(key, value); }, { context });
});
await formModule.evaluate();
const Fields = formModule.namespace.CatalogPromotionFields;
function render(value) {
  stateIndex = 0;
  return renderToStaticMarkup(Fields({ category: "Bản vẽ cộng đồng", value, onChange() {}, disabled: false }));
}
const off = render(null);
assert.match(off, /role="switch"/);
assert.doesNotMatch(off, /checked=""/);
assert.doesNotMatch(off, /Phí quảng cáo|Vị trí 1<\/strong>/, "Advertising off must hide booking controls and calculated fees");
const on = render({ position: 2, months: 3 });
assert.match(on, /checked=""/);
assert.match(on, /120\.000đ/, "Three months at position 2 must show the total");
const buttons = Array.from(on.matchAll(/<button\b[^>]*>[\s\S]*?<\/button>/g), match => match[0]);
assert.equal(buttons.length, 16);
assert.match(buttons[0], /disabled=""/);
assert.match(buttons[0], /Đã đặt/);
assert.doesNotMatch(buttons[0], /[\d.]+đ|\/tháng/, "Occupied slots must hide their price");
assert.match(buttons[1], /40\.000đ/);
assert.doesNotMatch(buttons[1], /disabled=""/);
active = null;
const checking = render({ position: 0, months: 1 });
assert.match(checking, /Đang kiểm tra/);
assert.doesNotMatch(checking, /<span class="mt-1 block">[\d.]+đ<\/span>/, "Unverified slots must not display prices");
console.log("PASS: advertising defaults off, fees appear only when enabled, monthly totals, all 16 positions, occupied prices hidden and selection disabled, and loading availability.");
