import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { unstable_getMiniflareWorkerOptions } from "wrangler";
import { shellAssetPath, STATIC_SHELL_PATHS, STATIC_SHELL_TEMPLATES } from "../lib/static-shells.ts";
import "./sites-env.mjs";

export async function prerenderCloudflareShells() {
  const root = fileURLToPath(new URL("../", import.meta.url));
  const server = path.join(root, "dist/server");
  const client = path.join(root, "dist/client");
  const config = JSON.parse(readFileSync(path.join(server, "wrangler.json"), "utf8"));
  const configPath = path.join(root, ".sites-runtime/shell-builder.json");
  // This renderer has no production resources, user sessions or secrets. A
  // shared shell can only contain public UI and placeholder/loading states.
  writeFileSync(configPath, JSON.stringify({ ...config, name: "tipook-shell-builder", account_id: undefined, configPath: undefined,
    main: path.join(server, config.main), routes: [], workers_dev: false, vars: {}, d1_databases: [], r2_buckets: [], durable_objects: { bindings: [] }, migrations: [],
    assets: { ...config.assets, directory: client }, observability: { enabled: false } }));
  const { workerOptions, main, externalWorkers } = unstable_getMiniflareWorkerOptions(configPath);
  const require = createRequire(import.meta.resolve("wrangler"));
  const { Miniflare } = require("miniflare");
  function findModules(directory) {
    return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
      const file = path.join(directory, entry.name);
      return entry.isDirectory() ? findModules(file) : entry.name.endsWith(".js") ? [{ type: "ESModule", path: file }] : entry.name.endsWith(".wasm") ? [{ type: "CompiledWasm", path: file }] : [];
    });
  }
  const modules = [{ type: "ESModule", path: main }, ...findModules(server).filter(module => module.path !== main)];
  const mf = new Miniflare({ cf: false, port: 0, host: "127.0.0.1", workers: [
    { ...workerOptions, bindings: {}, modules, modulesRoot: server }, ...externalWorkers,
  ] });
  mkdirSync(path.join(client, "_shells"), { recursive: true });
  let rscCompatibilityId;
  try {
    const paths = [...STATIC_SHELL_PATHS, ...STATIC_SHELL_TEMPLATES.map(template => template.prefix + template.marker)];
    for (const pathname of paths) {
      for (const rsc of [false, true]) {
        const response = await mf.dispatchFetch("http://localhost" + pathname, {
          headers: rsc ? { RSC: "1" } : {},
        });
        const body = await response.text();
        assert.equal(response.status, 200, `Shell ${pathname} (${rsc ? "RSC" : "HTML"}) failed: ${body.slice(0, 500)}`);
        assert.ok(body.length > 0, `Empty shell: ${pathname}`);
        assert.ok(!body.includes("tipook_auth_session="), "Shared shell must not contain a login token");
        const file = path.join(client, shellAssetPath(pathname, rsc));
        mkdirSync(path.dirname(file), { recursive: true });
        writeFileSync(file, body);
        if (rsc) {
          rscCompatibilityId ??= response.headers.get("X-Vinext-RSC-Compatibility-Id");
          const record = body.match(/^0:(\{[^\n]+\})/m);
          assert.ok(record, `RSC shell ${pathname} has no route metadata: ${body.slice(0, 250)}`);
          const elements = JSON.parse(record[1]);
          // Match Vinext's outgoing AppElementsWire patch: omit the retained
          // root element and name it in skippedLayoutIds. The Worker serves
          // this only to clients retaining the public root from this build.
          assert.equal(elements.__artifactCompatibility?.rscPayloadSchemaVersion, 1);
          assert.equal(elements.__layoutFlags?.["layout:/"], "s");
          assert.ok(elements["layout:/"]);
          delete elements["layout:/"];
          elements.__skippedLayoutIds = ["layout:/"];
          const payload = body.replace(record[0], "0:" + JSON.stringify(elements));
          writeFileSync(path.join(client, shellAssetPath(pathname, true, true)), payload);
        }
      }
    }
    assert.ok(rscCompatibilityId, "Missing RSC compatibility header");
    const missing = await mf.dispatchFetch("http://localhost/__tipook_missing_route__");
    assert.equal(missing.status, 404);
    writeFileSync(path.join(client, "_shells/not-found.html"), await missing.text());
    writeFileSync(path.join(client, "_shells/version.json"), JSON.stringify({ buildId: readFileSync(path.join(server, "BUILD_ID"), "utf8").trim(), rscCompatibilityId }));
    console.log(`PASS: generated ${paths.length} public HTML/RSC shells without database bindings or secrets.`);
  } finally { await mf.dispose(); }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await prerenderCloudflareShells();
