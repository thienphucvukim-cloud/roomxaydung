import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHmac } from "node:crypto";
import ts from "typescript";
const secret = "local-download-fixture-secret";
const fixtureEnv = "data:text/javascript," + encodeURIComponent(`export const env = { DOWNLOAD_LINK_SECRET: ${JSON.stringify(secret)} };`);
const source = ts.transpileModule(readFileSync("lib/download-links.ts", "utf8"), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText.replace('"cloudflare:workers"', JSON.stringify(fixtureEnv)).replace('"./legacy-contracts"', JSON.stringify(new URL("../lib/legacy-contracts.ts", import.meta.url).href));
const { createDownloadToken, verifyDownloadToken } = await import("data:text/javascript," + encodeURIComponent(source));
const [order, attachment, expires, buyer] = [123456, 9, 1900000000, "member-download-fixture"];
const historical = createHmac("sha256", secret).update(`tipook-download:${order}:${attachment}:${expires}:${buyer}`).digest("hex");
assert.equal(await createDownloadToken(order, attachment, expires, buyer), historical);
assert.equal(await verifyDownloadToken(order, attachment, expires, buyer, historical), true);
assert.equal(await verifyDownloadToken(order, attachment, expires, "other-member", historical), false);
assert.equal(await verifyDownloadToken(order, attachment + 1, expires, buyer, historical), false);
assert.equal(await verifyDownloadToken(order + 1, attachment, expires, buyer, historical), false);
assert.equal(await verifyDownloadToken(order, attachment, expires + 1, buyer, historical), false);
assert.equal(await verifyDownloadToken(order, attachment, expires, buyer, "bad"), false);
console.log("PASS: historical download signatures still verify; buyer, order, attachment and expiry tampering is rejected.");
