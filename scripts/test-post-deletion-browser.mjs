import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

// Native browser clicks against local mocked APIs; no real posts are deleted.
const origin = process.env.TIPOOK_TEST_ORIGIN || 'http://localhost:5173';
assert.ok(['localhost', '127.0.0.1'].includes(new URL(origin).hostname));
const dir = path.resolve('.sites-runtime/post-deletion-review');
mkdirSync(dir, { recursive: true });
const browserPath = process.env.TIPOOK_BROWSER_PATH || (process.platform === 'win32' ? 'C:/Program Files/Google/Chrome/Application/chrome.exe' : process.platform === 'darwin' ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' : 'chromium');
const chrome = spawn(browserPath, ['--headless=new', '--no-sandbox', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=9228', `--user-data-dir=${path.join(dir, 'chrome-' + Date.now())}`, 'about:blank'], { windowsHide: true, stdio: 'ignore' });
let startupError, socket;
chrome.on('error', error => { startupError = error; });
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
try {
  let tabs;
  for (let i = 0; i < 80; i++) { try { tabs = await (await fetch('http://127.0.0.1:9228/json/list')).json(); if (tabs.some(tab => tab.type === 'page')) break; } catch { /* Wait for the test page. */ } await pause(250); }
  const page = tabs?.find(tab => tab.type === 'page' && tab.url === 'about:blank') || tabs?.find(tab => tab.type === 'page');
  assert.ok(page, startupError?.message || 'Headless Chrome must start');
  socket = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
  let seq = 0;
  const pending = new Map(), exceptions = [];
  socket.addEventListener('message', event => {
    const data = JSON.parse(event.data);
    if (data.id) { const request = pending.get(data.id); pending.delete(data.id); if (data.error) request?.reject(new Error(JSON.stringify(data.error))); else request?.resolve(data.result); }
    if (data.method === 'Runtime.exceptionThrown') exceptions.push(data.params.exceptionDetails.exception?.description || data.params.exceptionDetails.text);
  });
  const send = (method, params = {}) => new Promise((resolve, reject) => { const id = ++seq; pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params })); });
  const evaluate = async expression => {
    const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
    return result.result.value;
  };
  const waitFor = async (expression, label) => { for (let i = 0; i < 150; i++) { if (await evaluate(`Boolean(${expression})`)) return; await pause(100); } console.log(await evaluate('JSON.stringify({url:location.href,ready:document.readyState,html:document.documentElement?.outerHTML.slice(0,1500),state:window.deleteReview})'), exceptions); throw new Error('Timeout: ' + label); };
  const click = async expression => {
    const point = await evaluate(`(() => { const button = ${expression}; button.scrollIntoView({ block: 'center', inline: 'center' }); const rect = button.getBoundingClientRect(); return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }; })()`);
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', button: 'left', clickCount: 1, ...point });
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', button: 'left', clickCount: 1, ...point });
  };
  const panelButton = label => `Array.from(document.querySelector('.owner-record-detail').querySelectorAll('button')).find(button => button.textContent.trim() === ${JSON.stringify(label)})`;
  await send('Runtime.enable'); await send('Page.enable');
  await send('Page.addScriptToEvaluateOnNewDocument', { source: `(() => {
    const nativeFetch = window.fetch.bind(window);
    const initial = { content: { 'facade.4.visibility': { kind: 'text', value: 'deleted' }, 'facade.5.visibility': { kind: 'text', value: 'deleted' } }, posts: [{ id: 711, userId: 'review-user', authorName: 'Người đăng', category: 'Bảng tin', title: 'Bài người dùng đã xóa', content: 'Nội dung được giữ trong quản trị', audience: 'Đã xóa bởi tác giả', createdAt: '2026-10-05' }], authorPost: { id: 712, userId: 'review-user', authorName: 'Người đăng', category: 'Bảng tin', title: 'Bài đăng kiểm tra', content: 'Nội dung kiểm tra', audience: 'Công khai', createdAt: '2026-10-05', images: [], specifications: '', listingType: '', priceLabel: null, comments: 0, sourceLabel: 'Bảng tin', sourceHref: '/bai-viet/712' } };
    window.deleteReview = JSON.parse(sessionStorage.getItem('deleteReview') || JSON.stringify(initial));
    const review = window.deleteReview; review.requests = []; review.fail = false; review.confirm = true; review.prompts = [];
    window.confirm = text => { review.prompts.push(text); return review.confirm; };
    const save = () => sessionStorage.setItem('deleteReview', JSON.stringify(review));
    window.fetch = async (input, init = {}) => {
      const url = new URL(typeof input === 'string' ? input : input.url, location.origin);
      const method = init.method || 'GET';
      const json = (value, status = 200) => Promise.resolve(new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } }));
      if (url.pathname === '/api/me') return json({ user: { id: 'review-user', name: 'Người kiểm tra', isAdmin: !location.search.includes('review-user'), authenticated: true } });
      if (url.pathname === '/api/site-content') {
        if (method === 'GET') return json({ content: review.content });
        const body = JSON.parse(init.body); review.requests.push({ path: url.pathname, method, body });
        if (review.fail) return json({ error: 'Lỗi thử nghiệm. Hãy thử lại.' }, 503);
        for (const item of body.changes) review.content[item.key] = item.content;
        save(); return json({ ok: true, content: review.content });
      }
      if (url.pathname === '/api/posts') return json({ posts: [], total: 0, nextCursor: null });
      if (url.pathname === '/api/news-feed') return json({ posts: review.authorPost.audience === 'Công khai' ? [review.authorPost] : [], total: review.authorPost.audience === 'Công khai' ? 1 : 0, totalPages: 1 });
      if (url.pathname === '/api/my-posts') {
        if (method === 'GET') return json({ posts: [review.authorPost], totalPages: 1, isAdmin: false });
        const body = JSON.parse(init.body); review.requests.push({ path: url.pathname, method, body });
        if (review.fail) return json({ error: 'Lỗi thử nghiệm. Hãy thử lại.' }, 503);
        if (method === 'DELETE') { review.authorPost.audience = 'Đã xóa bởi tác giả'; review.posts.push({ ...review.authorPost }); }
        else if (body.action) review.authorPost.audience = body.action === 'hide' ? 'Chỉ mình tôi' : 'Công khai';
        save(); return json({ ok: true, post: review.authorPost });
      }
      if (url.pathname === '/api/admin/manage/posts') {
        if (method === 'GET') {
          const items = review.posts.filter(post => !url.searchParams.get('filter') || url.searchParams.get('filter') === 'deleted' && post.audience === 'Đã xóa bởi tác giả');
          return json({ items: items.map(post => Object.fromEntries(Object.entries(post).filter(([key]) => key !== 'userId'))), total: items.length });
        }
        const body = JSON.parse(init.body); review.requests.push({ path: url.pathname, method, body });
        if (review.fail) return json({ error: 'Lỗi thử nghiệm. Hãy thử lại.' }, 503);
        review.posts = review.posts.filter(post => post.id !== body.id); save(); return json({ ok: true });
      }
      if (url.pathname === '/api/actions') return json({ actions: [], count: 0 });
      return nativeFetch(input, init);
    };
  })();` });
  const demo = `document.querySelector('[data-site-key="facade.0.title"]')?.closest('article')`;
  const demoButton = label => `Array.from((${demo})?.querySelectorAll('button') || []).find(button => button.textContent.trim() === ${JSON.stringify(label)})`;
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 900, deviceScaleFactor: 1, mobile: true });
  await send('Page.navigate', { url: origin + '/kho-mau-nha-dep-chat' });
  await waitFor(demoButton('Ẩn'), 'admin demo controls');
  assert.equal(await evaluate(`Boolean(document.querySelector('[data-site-key="facade.4.title"]') || document.querySelector('[data-site-key="facade.5.title"]'))`), false, 'Deleted demos must be absent even for admin');
  assert.equal(await evaluate(`document.body.innerText.includes('Khôi phục')`), false);
  await click(demoButton('Ẩn')); await waitFor(demoButton('Hiện lại'), 'demo hide');
  await click(demoButton('Hiện lại')); await waitFor(demoButton('Ẩn'), 'demo show');
  await evaluate('window.deleteReview.confirm = false');
  const requests = await evaluate('window.deleteReview.requests.length');
  await click(demoButton('Xóa'));
  assert.equal(await evaluate('window.deleteReview.requests.length'), requests, 'Cancel deletion must send no write');
  assert.ok((await evaluate('window.deleteReview.prompts.at(-1)')).includes('vĩnh viễn'));
  await evaluate('window.deleteReview.confirm = true; window.deleteReview.fail = true');
  await click(demoButton('Xóa')); await waitFor(`(${demo})?.querySelector('[role="alert"]')`, 'failed demo delete');
  assert.ok(await evaluate(`Boolean(${demo})`));
  await evaluate('window.deleteReview.fail = false');
  await click(demoButton('Xóa')); await waitFor(`!(${demo})`, 'permanent demo removal');
  await send('Page.reload'); await waitFor(`document.querySelector('[data-site-key="facade.1.title"]') && !(${demo})`, 'deleted demo stays absent after reload');
  writeFileSync(path.join(dir, 'mobile-after-delete.png'), Buffer.from((await send('Page.captureScreenshot', { format: 'png' })).data, 'base64'));
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: origin + '/?quan-ly=noi-dung' });
  await waitFor(`document.querySelector('.admin-table tbody tr')`, 'retained author post');
  assert.ok(await evaluate(`document.querySelector('.admin-table').innerText.includes('Người dùng đã xóa')`));
  assert.equal(await evaluate(`document.querySelector('.admin-table button[aria-label="Hiện bài đăng"]')`), null);
  await click(`document.querySelector('.admin-table-title')`);
  await waitFor(`document.querySelector('.owner-record-detail')`, 'read-only retained post');
  assert.equal(await evaluate(`document.querySelector('.owner-record-detail input')`), null);
  assert.equal(await evaluate(`document.querySelector('.owner-management').innerText.includes('Khôi phục')`), false);
  await evaluate('window.deleteReview.fail = true');
  await click(panelButton('Xóa vĩnh viễn'));
  await waitFor(`document.querySelector('.owner-management [role="alert"]')`, 'admin deletion error');
  assert.equal(await evaluate('window.deleteReview.posts.length'), 1);
  await evaluate('window.deleteReview.fail = false');
  await click(panelButton('Xóa vĩnh viễn'));
  await waitFor(`!document.querySelector('.admin-table tbody tr') && !document.querySelector('.owner-record-detail')`, 'admin permanently removes retained post');
  await send('Page.navigate', { url: origin + '/?review-user=1' });
  await waitFor(`document.querySelector('button[aria-label="Quản lý bài viết"]')`, 'author controls');
  await click(`document.querySelector('button[aria-label="Quản lý bài viết"]')`);
  await waitFor(`document.querySelector('[role="dialog"] input')`, 'author edit dialog');
  const dialogButton = label => `Array.from(document.querySelector('[role="dialog"]').querySelectorAll('button')).find(button => button.textContent.trim() === ${JSON.stringify(label)})`;
  await click(dialogButton('Xóa bài viết'));
  await waitFor(`document.querySelector('[role="dialog"]').innerText.includes('chỉ được lưu trong quản trị')`, 'author retention explanation');
  await click(dialogButton('Hủy'));
  assert.equal(await evaluate(`window.deleteReview.requests.filter(item => item.method === 'DELETE').length`), 0);
  await click(dialogButton('Xóa bài viết')); await click(dialogButton('Xác nhận xóa'));
  await waitFor(`!document.querySelector('[role="dialog"]')`, 'author deletion success');
  assert.equal(await evaluate('window.deleteReview.authorPost.audience'), 'Đã xóa bởi tác giả');
  await send('Page.navigate', { url: origin + '/?quan-ly=noi-dung' });
  await waitFor(`document.querySelector('.admin-table tbody tr')?.innerText.includes('Bài đăng kiểm tra')`, 'author deletion retained in admin');
  assert.equal(exceptions.length, 0, exceptions.join('\n'));
  console.log('PASS: mobile admin demos disappear permanently across reload; hide/show, cancel, failure/retry; retained author posts appear read-only in admin and can be permanently deleted; real native clicks and no JS errors.');
} finally { socket?.close(); chrome.kill(); }
