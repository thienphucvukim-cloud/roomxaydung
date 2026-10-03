// Read-only local navigation checks. Run after starting the local server.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const origin = process.env.TIPOOK_TEST_ORIGIN || 'http://localhost:5173';
assert.ok(['localhost', '127.0.0.1'].includes(new URL(origin).hostname));
const dir = path.resolve('.sites-runtime/menu-review');
mkdirSync(dir, { recursive: true });
const browserPath = process.env.TIPOOK_BROWSER_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const chrome = spawn(browserPath, ['--headless=new', '--no-sandbox', '--disable-gpu', '--disable-software-rasterizer', '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=9228', `--user-data-dir=${path.join(dir, 'chrome')}`, 'about:blank'], { windowsHide: true, stdio: 'ignore' });
let startupError, socket;
chrome.on('error', error => { startupError = error; });
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
try {
  let tabs;
  for (let i = 0; i < 80; i++) {
    try { tabs = await (await fetch('http://127.0.0.1:9228/json/list')).json(); break; } catch { await pause(250); }
  }
  assert.ok(tabs?.some(tab => tab.type === 'page'), startupError?.message || 'Chrome must start');
  socket = new WebSocket(tabs.find(tab => tab.type === 'page').webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
  let seq = 0;
  const pending = new Map(), exceptions = [];
  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    if (message.id) {
      const task = pending.get(message.id); pending.delete(message.id);
      if (message.error) task?.reject(new Error(JSON.stringify(message.error))); else task?.resolve(message.result);
    }
    if (message.method === 'Runtime.exceptionThrown') exceptions.push(message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text);
  });
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++seq;
    const timer = setTimeout(() => reject(new Error('CDP timeout: ' + method)), 30000);
    pending.set(id, { resolve: value => { clearTimeout(timer); resolve(value); }, reject: error => { clearTimeout(timer); reject(error); } });
    socket.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async expression => {
    const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
    return result.result.value;
  };
  const waitFor = async expression => {
    for (let i = 0; i < 300; i++) { if (await evaluate(`Boolean(${expression})`)) return; await pause(100); }
    throw new Error('Timeout: ' + expression + '\n' + await evaluate('document.body?.innerText.slice(0,1000)'));
  };
  const click = async (selector, touch = false) => {
    await waitFor(`document.querySelector(${JSON.stringify(selector)})`);
    const point = await evaluate(`(() => { const r = document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2}; })()`);
    if (touch) {
      await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...point, radiusX: 1, radiusY: 1, force: 1 }] });
      await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      return;
    }
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...point });
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', button: 'left', clickCount: 1, ...point });
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', button: 'left', clickCount: 1, ...point });
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 1, y: 120 });
  };
  await send('Runtime.enable'); await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: origin });
  await waitFor(`window.next?.router && document.querySelector('.desktop-tab-link') && document.querySelector('main')`);
  // Allow effects and hydration to settle before the first interaction.
  await pause(1000);
  await evaluate(`void (window.menuReview = { header:document.querySelector('.social-header'), desktop:document.querySelector('.animated-tab-nav:not(.mobile-social-nav)'), mobile:document.querySelector('.mobile-social-nav') })`);
  const route = async (href, mobile = false) => {
    const selector = `${mobile ? '.mobile-dock-link' : '.desktop-tab-link'}[href="${href}"]`;
    const started = Date.now();
    await click(selector, mobile);
    await waitFor(`location.pathname === ${JSON.stringify(href)} && document.querySelector(${JSON.stringify(selector)})?.getAttribute('aria-current') === 'page'`);
    await pause(350);
    assert.equal(await evaluate(`window.menuReview?.header === document.querySelector('.social-header')`), true, 'Header must stay mounted across navigation');
    assert.equal(await evaluate(`window.menuReview.${mobile ? 'mobile' : 'desktop'} === document.querySelector(${JSON.stringify(mobile ? '.mobile-social-nav' : '.animated-tab-nav:not(.mobile-social-nav)')})`), true, 'Menu must stay mounted');
    const alignment = await evaluate(`(() => { const nav=document.querySelector(${JSON.stringify(mobile ? '.mobile-social-nav' : '.animated-tab-nav:not(.mobile-social-nav)')}); const active=nav.querySelector('[aria-current="page"]').getBoundingClientRect(), light=nav.querySelector('.tab-liquid-light').getBoundingClientRect(); return Math.abs(active.x+active.width/2-light.x-light.width/2); })()`);
    assert.ok(alignment < 2, 'Highlight must align with the current page');
    assert.equal(await evaluate(`document.documentElement.scrollWidth <= innerWidth`), true);
    console.log(`PASS ${mobile ? 'mobile' : 'desktop'} ${href} (${Date.now() - started}ms incl. settle)`);
  };
  for (const href of ['/kho-mau-nha-dep-chat', '/file-ban-ve-nha-dep-chat', '/noi-that', '/tinh-vat-tu-nha-dep-chat', '/thue-thiet-ke', '/']) await route(href);
  await evaluate('history.back()');
  await waitFor(`location.pathname === '/thue-thiet-ke' && document.querySelector('.desktop-tab-link[aria-current="page"]')?.getAttribute('href') === '/thue-thiet-ke'`);
  await pause(350);
  assert.equal(await evaluate(`document.querySelector('.desktop-tab-link[data-highlighted="true"]')?.getAttribute('href')`), '/thue-thiet-ke', 'Back must clear stale pointer focus');
  await evaluate('history.forward()');
  await waitFor(`location.pathname === '/' && document.querySelector('.desktop-tab-link[aria-current="page"]')?.getAttribute('href') === '/'`);
  await evaluate(`document.querySelector('.desktop-tab-link[href="/noi-that"]').focus()`);
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
  await waitFor(`location.pathname === '/noi-that'`);
  await pause(350);
  writeFileSync(path.join(dir, 'desktop.png'), Buffer.from((await send('Page.captureScreenshot', { format: 'png' })).data, 'base64'));

  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await send('Emulation.setTouchEmulationEnabled', { enabled: true });
  for (const href of ['/', '/kho-mau-nha-dep-chat', '/file-ban-ve-nha-dep-chat', '/noi-that', '/thue-thiet-ke']) await route(href, true);
  await click('button[aria-label="Mở menu"]', true);
  await waitFor(`document.querySelector('[data-slot="sheet-content"][data-state="open"]')`);
  await pause(550);
  await click('[data-slot="sheet-content"] a[href="/tinh-vat-tu-nha-dep-chat"]', true);
  await waitFor(`location.pathname === '/tinh-vat-tu-nha-dep-chat' && !document.querySelector('[data-slot="sheet-content"]')`);
  await route('/', true);
  writeFileSync(path.join(dir, 'mobile.png'), Buffer.from((await send('Page.captureScreenshot', { format: 'png' })).data, 'base64'));
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  assert.ok(await evaluate(`parseFloat(getComputedStyle(document.querySelector('.tab-liquid-light')).transitionDuration) < .001`), 'Reduced motion must disable movement');
  await route('/noi-that', true);
  assert.deepEqual(exceptions, [], 'No uncaught browser exceptions');
  console.log('PASS: persistent desktop/mobile menus, current-page alignment, Back/Forward, keyboard, mobile sheet, reduced motion, no horizontal overflow or browser exceptions.');
  console.log('Screenshots: ' + dir);
} finally {
  if (socket?.readyState === 1) socket.send(JSON.stringify({ id: 999999, method: 'Browser.close' }));
  socket?.close(); chrome.kill();
}
