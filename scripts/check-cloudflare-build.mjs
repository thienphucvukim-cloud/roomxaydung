import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { STATIC_SHELL_PATHS, STATIC_SHELL_TEMPLATES, shellAssetPath } from "../lib/static-shells.ts";

const directory = fileURLToPath(new URL("../dist/server/", import.meta.url));
export function checkCloudflareBuild() {
  let checked = 0;
  function inspect(directoryPath) {
    for (const entry of readdirSync(directoryPath, { withFileTypes: true })) {
      const file = path.join(directoryPath, entry.name);
      if (entry.isDirectory()) { inspect(file); continue; }
      if (!entry.name.endsWith(".js")) continue;
      const source = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
      function visit(node) {
        let specifier;
        if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) specifier = node.moduleSpecifier;
        else if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) specifier = node.arguments[0];
        if (specifier && (ts.isStringLiteral(specifier) || ts.isNoSubstitutionTemplateLiteral(specifier)) && specifier.text.startsWith(".")) {
          assert.ok(existsSync(path.resolve(path.dirname(file), specifier.text)), `Missing built module: ${specifier.text} imported from ${path.relative(directory, file)}`);
          checked++;
        }
        ts.forEachChild(node, visit);
      }
      visit(source);
    }
  }
  inspect(directory);
  assert.ok(checked > 0, "Cloudflare build has no module imports");
  const client = path.resolve(directory, "../client");
  const version = JSON.parse(readFileSync(path.join(client, "_shells/version.json"), "utf8"));
  assert.equal(version.buildId, readFileSync(path.join(directory, "BUILD_ID"), "utf8").trim(), "Public shells belong to a different build");
  assert.ok(version.rscCompatibilityId);
  assert.ok(readFileSync(path.join(client, "_shells/not-found.html"), "utf8").length);
  for (const pathname of [...STATIC_SHELL_PATHS, ...STATIC_SHELL_TEMPLATES.map(template => template.prefix + template.marker)]) {
    for (const [rsc, navigation] of [[false, false], [true, false], [true, true]]) {
      const file = path.join(client, shellAssetPath(pathname, rsc, navigation));
      assert.ok(existsSync(file) && readFileSync(file, "utf8").length, `Missing public shell: ${file}`);
    }
  }
  return checked;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(`PASS: ${checkCloudflareBuild()} relative imports in the Cloudflare build resolve to existing modules.`);
}
