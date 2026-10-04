// Local only. Capture the deployed UI before SEO, then compare its geometry.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
const origin = process.env.TIPOOK_TEST_ORIGIN || "http://127.0.0.1:8790";
assert.ok(["localhost", "127.0.0.1"].includes(new URL(origin).hostname));
const baseline = process.argv.includes("--baseline"), dir = path.resolve(".sites-runtime/seo-ui-review");
mkdirSync(dir, { recursive: true });
const data = await (await fetch(origin + "/api/news-feed")).json();
assert.ok(data.posts.length, "Seed the local review database first");
const post = data.posts[0];
const routes = ["/", "/bai-viet/" + post.id, "/kho-mau-nha-dep-chat", "/file-ban-ve-nha-dep-chat", "/noi-that", "/nguoi-dung/" + post.userId];
const chrome = spawn("C:/Program Files/Google/Chrome/Application/chrome.exe", ["--headless=new", "--no-sandbox", "--disable-gpu", "--no-first-run", "--no-default-browser-check", "--remote-debugging-port=9237", `--user-data-dir=${path.join(dir, "chrome")}`, "about:blank"], { windowsHide: true, stdio: "ignore" });
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
let socket;
try {
  let tabs;
  for (let i = 0; i < 80; i++) { try { tabs = await (await fetch("http://127.0.0.1:9237/json/list")).json(); break; } catch { await pause(250); } }
  assert.ok(tabs?.length); socket = new WebSocket(tabs.find(tab => tab.type === "page").webSocketDebuggerUrl);
  await new Promise(resolve => socket.addEventListener("open", resolve, { once: true }));
  let seq = 0; const pending = new Map(), errors = [];
  socket.addEventListener("message", event => {
    const value = JSON.parse(event.data);
    if (value.id) { const task = pending.get(value.id); pending.delete(value.id); if (value.error) task.reject(new Error(JSON.stringify(value.error))); else task.resolve(value.result); }
    if (value.method === "Runtime.exceptionThrown") errors.push(value.params.exceptionDetails.exception?.description || value.params.exceptionDetails.text);
  });
  const send = (method, params = {}) => new Promise((resolve, reject) => { const id = ++seq; pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params })); });
  const evaluate = async expression => { const result = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true }); if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description); return result.result.value; };
  await send("Page.enable"); await send("Runtime.enable");
  const records = [];
  for (const width of [1440, 390]) for (const route of routes) {
    await send("Emulation.setDeviceMetricsOverride", { width, height: width === 390 ? 844 : 1000, deviceScaleFactor: 1, mobile: width === 390 });
    await send("Page.navigate", { url: origin + route });
    let ready = false;
    for (let i = 0; i < 200; i++) {
      ready = await evaluate("Boolean(window.next?.router && document.querySelector('main') && !document.querySelector('main [role=\"status\"]') && (document.querySelector('article[id^=\"post-\"]') || document.querySelector('article[data-auth-model-query]') || location.pathname.startsWith('/nguoi-dung/'))) ");
      if (ready) break; await pause(100);
    }
    assert.ok(ready, route); await evaluate("document.fonts.ready"); await pause(800);
    const geometry = await evaluate(`(() => { const selectors=['header.sticky','main','.mobile-social-nav','article[id^="post-"]','article[data-auth-model-query]']; return selectors.map(selector=>{const element=document.querySelector(selector);if(!element)return [selector,null];const r=element.getBoundingClientRect();return [selector,{x:Math.round(r.x),y:Math.round(r.y),width:Math.round(r.width),height:Math.round(r.height)}];});})()`);
    const record = { route, width, geometry, title: await evaluate("document.title") };
    records.push(record);
    const filename = `${width}-${route === "/" ? "home" : route.slice(1).replaceAll("/", "-")}-${baseline ? "before" : "after"}.png`;
    writeFileSync(path.join(dir, filename), Buffer.from((await send("Page.captureScreenshot", { format: "png" })).data, "base64"));
    assert.ok(await evaluate("document.documentElement.scrollWidth <= innerWidth"), "No horizontal overflow: " + route);
  }
  if (!baseline) {
    const before = JSON.parse(readFileSync(path.join(dir, "before.json"), "utf8"));
    for (const record of records) {
      const previous = before.find(item => item.route === record.route && item.width === record.width); assert.ok(previous);
      // The house catalog already shuffles card order on every load. Compare
      // its column width and grid origin, not an individual shuffled card slot.
      for (let i = 0; i < record.geometry.length; i++) {
        const [selector, current] = record.geometry[i], old = previous.geometry[i][1];
        if (!current || !old) { assert.equal(current, old, selector); continue; }
        const shuffledCard = record.route === "/kho-mau-nha-dep-chat" && selector.startsWith("article");
        for (const key of shuffledCard ? ["width"] : ["x", "y", "width"]) assert.ok(Math.abs(current[key] - old[key]) <= 2, `${record.route} ${record.width} ${selector} ${key}: ${old[key]} -> ${current[key]}`);
      }
      if (record.route === "/kho-mau-nha-dep-chat") for (const key of ["x", "y"]) {
        const first = geometry => Math.min(...geometry.filter(([selector, rect]) => selector.startsWith("article") && rect).map(([, rect]) => rect[key]));
        assert.ok(Math.abs(first(record.geometry) - first(previous.geometry)) <= 2, "House grid origin must remain unchanged");
      }
    }
  }
  assert.deepEqual(errors, [], "No hydration or browser exceptions");
  writeFileSync(path.join(dir, baseline ? "before.json" : "after.json"), JSON.stringify(records, null, 2));
  console.log(`PASS: ${records.length} ${baseline ? "baseline" : "matching"} desktop/mobile views; screenshots in ${dir}.`);
} finally { socket?.close(); chrome.kill(); }
