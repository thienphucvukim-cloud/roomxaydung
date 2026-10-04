import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import ts from "typescript";

export function checkTerminology() {
  const compatibility = new Set(["lib/legacy-contracts.ts", "lib/post-metadata.ts", "scripts/test-post-metadata.mjs", "scripts/test-post-metadata-runtime.mjs"]);
  const staleModules = /(?:facade-(?:page|catalog|feed|pagination)|community-gallery|drawing-community)/;
  let checked = 0;
  for (const directory of ["app", "components", "lib", "db", "worker", "build", "scripts"]) {
    for (const relative of readdirSync(directory, { recursive: true })) {
      const file = directory + "/" + relative.replaceAll("\\", "/");
      if (!/\.(?:ts|tsx|mjs)$/.test(file)) continue;
      if (file === "scripts/check-terminology.mjs") continue;
      const source = readFileSync(file, "utf8");
      assert.ok(!staleModules.test(source), `${file}: obsolete component/module name`);
      assert.ok(!/tipook-(?:content|avatar|wallet|messages|action)-changed/.test(source), `${file}: obsolete event name`);
      const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
      const visit = node => {
        if (!compatibility.has(file) && ts.isIdentifier(node)) {
          assert.ok(!/facade/i.test(node.text), `${file}: obsolete house model identifier ${node.text}`);
          assert.ok(!["feeling", "pollQuestion", "facadeModels", "FacadePage", "CommunityGallery", "DrawingCommunity"].includes(node.text), `${file}: obsolete business identifier ${node.text}`);
        }
        ts.forEachChild(node, visit);
      };
      visit(ast);
      if (ast.statements.some(statement => ts.isExpressionStatement(statement) && statement.expression.text === "use client")) {
        assert.ok(ts.isExpressionStatement(ast.statements[0]) && ast.statements[0].expression.text === "use client", `${file}: client directive must be first`);
      }
      checked++;
    }
  }
  console.log(`PASS: terminology and component imports in ${checked} source files; legacy business fields confined to compatibility boundaries.`);
}
if (path.resolve(process.argv[1] || "") === path.resolve(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, "$1"))) checkTerminology();
