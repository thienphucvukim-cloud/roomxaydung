// Run against fixtures only; never contacts Telegram, storage, or a live account.
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { createContext, SourceTextModule, SyntheticModule } from "node:vm";
import ts from "typescript";
import * as schema from "../db/schema.ts";

let identity = null;
const guest = "guest_11111111-1111-4111-8111-111111111111";
let views = 0;
const fail = () => { throw new Error("Guest must not access account data or services"); };
const db = { select: fail, update: fail, delete: fail, insert: table => {
  assert.equal(table, schema.catalogViews, "Only visit analytics can be written anonymously");
  return { values: value => ({ onConflictDoNothing: async () => { assert.equal(value.userId, guest); views++; } }) };
} };
const target = { targetType: "house-model", targetId: "fixture", kind: "facade" };
const fixtures = {
  "@/lib/website-auth": { getAuthenticatedIdentity: async () => identity, isAdminIdentity: () => false, validOrigin: () => true },
  "next/headers": { cookies: async () => ({ get: () => ({ value: guest }) }) },
  "cloudflare:workers": { env: { BUCKET: { put: fail, head: fail, delete: fail } } },
  "@/db": { getDb: () => db }, "@/db/schema": schema,
  "@/lib/catalog-engagement": { resolveCatalogTarget: async () => target, catalogEngagement: async () => ({ views }) },
};
const actual = new Set(["@/lib/member-access", "@/lib/member-identity", "@/lib/payment-identity", "@/lib/session-cookie"]);
const context = createContext({ Request, Response, Headers, File, FormData, URL, URLSearchParams, crypto, console });
const cache = new Map();
const apiSources = readdirSync("app/api", { recursive: true }).filter(file => file.endsWith("route.ts")).map(file => {
  const location = "app/api/" + file.replaceAll("\\", "/");
  return { identifier: "@/" + location.slice(0, -3), source: ts.createSourceFile(location, readFileSync(location, "utf8"), ts.ScriptTarget.Latest, true) };
});
function canonical(name, reference) {
  return name.startsWith(".") ? "@/" + path.posix.normalize(path.posix.join(path.posix.dirname(reference.identifier.slice(2)), name)) : name;
}
async function load(name, reference) {
  const id = canonical(name, reference);
  if (cache.has(id)) return cache.get(id);
  let namespace = fixtures[id];
  if (!namespace && !id.startsWith("@/")) namespace = await import(id);
  if (!namespace && !actual.has(id) && !id.startsWith("@/app/api/")) {
    // Non-auth services are inert; exporting the requested names catches any use.
    namespace = {};
    for (const { identifier, source } of apiSources) for (const node of source.statements) {
      if (!ts.isImportDeclaration(node) || canonical(node.moduleSpecifier.text, { identifier }) !== id) continue;
      const bindings = node.importClause?.namedBindings;
      if (bindings && ts.isNamedImports(bindings)) for (const element of bindings.elements) namespace[element.propertyName?.text || element.name.text] = fail;
    }
  }
  const vmModule = namespace ? new SyntheticModule(Object.keys(namespace), function () {
    for (const [key, value] of Object.entries(namespace)) this.setExport(key, value);
  }, { context, identifier: id }) : new SourceTextModule(ts.transpileModule(readFileSync(id.slice(2) + ".ts", "utf8"), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  }).outputText, { context, identifier: id });
  cache.set(id, vmModule);
  return vmModule;
}
async function route(name) {
  const vmModule = await load(`@/app/api/${name}/route`);
  if (vmModule.status === "unlinked") await vmModule.link(load);
  if (vmModule.status === "linked") await vmModule.evaluate();
  return vmModule.namespace;
}
const mutations = {
  actions: ["POST", "DELETE"], posts: ["POST"], comments: ["POST"], "model-comments": ["POST"], requests: ["POST"],
  files: ["POST", "DELETE"], "delivery-profile": ["PUT"], "professional-profile": ["PUT"], messages: ["POST", "PATCH"],
  "wallet/topups": ["POST"], "wallet/purchase": ["POST"], "catalog-promotions": ["POST"], "my-posts": ["PATCH", "DELETE"], avatar: ["POST", "DELETE"],
};
let checked = 0;
for (const [name, methods] of Object.entries(mutations)) {
  const api = await route(name);
  for (const method of methods) {
    const response = await api[method](new Request(`https://app.test/api/${name}`, { method, headers: { Cookie: `tipook_buyer_session=${guest}`, "Content-Type": "application/json" }, body: "{}" }));
    assert.equal(response.status, 401, `${method} ${name}: ${await response.text()}`);
    checked++;
  }
}
for (const name of ["requests", "delivery-profile", "my-posts"]) assert.equal((await (await route(name)).GET(new Request(`https://app.test/api/${name}`))).status, 401);
const me = await (await route("me")).GET();
assert.equal(me.status, 200);
assert.equal((await me.json()).user, null);
assert.deepEqual(await (await (await route("actions")).GET(new Request("https://app.test/api/actions"))).json(), { actions: [] });
assert.equal((await (await route("professional-profile")).GET()).status, 200);
assert.deepEqual(await (await (await route("messages")).GET(new Request("https://app.test/api/messages"))).json(), { messages: [] });
const engagement = await route("catalog-engagement");
assert.equal((await engagement.GET(new Request("https://app.test/api/catalog-engagement?targetType=house-model&targetId=fixture"))).status, 200);
assert.equal((await engagement.POST(new Request("https://app.test/api/catalog-engagement", { method: "POST", body: JSON.stringify({ ...target, action: "view" }) }))).status, 200);
assert.equal(views, 1, "Visitors may still open galleries and count a view");
const payment = cache.get("@/lib/payment-identity").namespace;
assert.equal(await payment.getPaymentBuyerId(), null, "A visitor cookie is never an authenticated buyer");
identity = { userId: "member-fixture", displayName: "An", email: null };
assert.equal(await payment.getPaymentBuyerId(), identity.userId);
assert.equal(await cache.get("@/lib/member-access").namespace.memberAccessResponse(), null);
const member = await cache.get("@/lib/member-identity").namespace.currentMember();
assert.equal(member.userId, identity.userId);
assert.equal(member.authorName, identity.displayName);
db.select = () => ({ from: () => ({ where: () => ({ limit: async () => [] }) }) });
db.insert = table => {
  assert.equal(table, schema.userActions);
  return { values: value => ({ onConflictDoUpdate: () => ({ returning: async () => {
    assert.equal(value.userId, identity.userId);
    return [{ id: 1, ...value }];
  } }) }) };
};
const actionResponse = await (await route("actions")).POST(new Request("https://app.test/api/actions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ actionType: "save", targetType: "house-model", targetId: "fixture" }) }));
assert.equal(actionResponse.status, 200);
assert.equal((await actionResponse.json()).action.userId, identity.userId, "Signed-in members can save content under their own account");
console.log(`PASS: ${checked} protected API mutations, private reads, anonymous browsing/analytics, visitor cookie isolation and authenticated identity.`);

// Exercise the actual client gate handlers without a browser or real network.
let uiMember = { loaded: true, authenticated: false };
let requestedPath = null;
class ElementFixture { constructor(protectedControl) { this.protectedControl = protectedControl; } closest() { return this.protectedControl ? this : null; } }
const uiContext = createContext({ Element: ElementFixture });
const uiFixtures = {
  react: { useState: () => [requestedPath, value => { requestedPath = value; }] },
  "react/jsx-runtime": { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }), Fragment: "fragment" },
  "next/navigation": { usePathname: () => "/kho-mau-nha-dep-chat" },
  "@/components/member-avatar": { useCurrentMember: () => uiMember },
  "@/components/ui/dialog": Object.fromEntries(["Dialog", "DialogContent", "DialogHeader", "DialogTitle"].map(name => [name, name])),
  "@/components/client-navigation-link": { ClientNavigationLink: "a" },
};
const gateModule = new SourceTextModule(ts.transpileModule(readFileSync("components/member-access.tsx", "utf8"), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX },
}).outputText, { context: uiContext });
await gateModule.link(async name => {
  const namespace = uiFixtures[name];
  return new SyntheticModule(Object.keys(namespace), function () { for (const [key, value] of Object.entries(namespace)) this.setExport(key, value); }, { context: uiContext });
});
await gateModule.evaluate();
const { MemberAccessGate, MemberOnly } = gateModule.namespace;
const click = (protectedControl, key) => {
  let blocked = false;
  const event = { target: new ElementFixture(protectedControl), key, preventDefault: () => { blocked = true; }, stopPropagation: () => {} };
  const tree = MemberAccessGate({ children: "public content" });
  (key ? tree.props.onKeyDownCapture : tree.props.onClickCapture)(event);
  return blocked;
};
assert.equal(click(false), false, "Public navigation, search and gallery controls remain usable");
assert.equal(click(true), true, "Guest clicks cannot invoke member actions");
assert.equal(requestedPath, "/kho-mau-nha-dep-chat");
assert.equal(click(true, "Enter"), true, "Keyboard activation cannot bypass the gate");
assert.equal(click(true, "Tab"), false, "Keyboard navigation stays available");
assert.notEqual(MemberOnly({ children: "private functionality" }), "private functionality");
uiMember = { loaded: true, authenticated: true };
assert.equal(click(true), false);
assert.equal(MemberOnly({ children: "private functionality" }), "private functionality");
console.log("PASS: guest click/keyboard gate, public navigation, sign-up prompt and authenticated controls.");
