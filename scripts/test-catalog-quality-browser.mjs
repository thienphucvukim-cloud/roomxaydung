import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

// Native browser clicks against local mocked APIs; no real posts are reviewed.
const origin = process.env.TIPOOK_TEST_ORIGIN || 'http://localhost:5173';
assert.ok(['localhost', '127.0.0.1'].includes(new URL(origin).hostname));
const dir = path.resolve('.sites-runtime/catalog-quality-review');
mkdirSync(dir, { recursive: true });
const browserPath = process.env.TIPOOK_BROWSER_PATH || (process.platform === 'win32' ? 'C:/Program Files/Google/Chrome/Application/chrome.exe' : process.platform === 'darwin' ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' : 'chromium');
const chrome = spawn(browserPath, ['--headless=new', '--no-sandbox', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=9229', `--user-data-dir=${path.join(dir, 'chrome-' + Date.now())}`, 'about:blank'], { windowsHide: true, stdio: 'ignore' });
let startupError, socket;
chrome.on('error', error => { startupError = error; });
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
try {
  let tabs;
  for (let i = 0; i < 80; i++) { try { tabs = await (await fetch('http://127.0.0.1:9229/json/list')).json(); if (tabs.some(tab => tab.type === 'page')) break; } catch { /* Wait for the test page. */ } await pause(250); }
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
  const waitFor = async (expression, label) => { for (let i = 0; i < 150; i++) { if (await evaluate(`Boolean(${expression})`)) return; await pause(100); } console.log(await evaluate('JSON.stringify({url:location.href,ready:document.readyState,html:document.documentElement?.outerHTML.slice(0,1500),state:window.qualityReview})'), exceptions); throw new Error('Timeout: ' + label); };
  const click = async expression => {
    const point = await evaluate(`(() => { const button = ${expression}; button.scrollIntoView({ block: 'center', inline: 'center' }); const rect = button.getBoundingClientRect(); return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }; })()`);
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', button: 'left', clickCount: 1, ...point });
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', button: 'left', clickCount: 1, ...point });
  };
  await send('Runtime.enable'); await send('Page.enable');
  const houses = ['Nhà phố 3 tầng xanh mát', 'Nhà phố lệch tầng thoáng sáng', 'Nhà 3 tầng có sân trước', 'Nhà phố có khoảng xanh giữa nhà', 'Nhà ống 3 tầng mặt tiền lam gỗ', 'Nhà phố kết hợp kinh doanh'];
  await send('Page.addScriptToEvaluateOnNewDocument', { source: `(() => {
    const nativeFetch = window.fetch.bind(window);
    const houses = ${JSON.stringify(houses)};
    window.qualityReview = { flags: JSON.parse(sessionStorage.getItem('qualityFlags') || '{}'), requests: [], failSave: false, failLoad: location.search.includes('quality-load-error') && !sessionStorage.getItem('qualityLoadFailed'), loadRequests: 0 };
    const review = window.qualityReview;
    window.fetch = async (input, init = {}) => {
      const url = new URL(typeof input === 'string' ? input : input.url, location.origin), method = init.method || 'GET';
      const json = (body, status = 200) => Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }));
      const admin = !location.search.includes('review-user');
      if (url.pathname === '/api/me') return json({ user: { id: 'review-user', name: 'Người kiểm tra', isAdmin: admin, authenticated: true } });
      if (url.pathname === '/api/site-content') return json({ content: {} });
      if (url.pathname === '/api/admin/catalog-quality') {
        if (method === 'GET') {
          review.loadRequests++;
          if (review.failLoad) { sessionStorage.setItem('qualityLoadFailed', 'true'); return json({ error: 'Lỗi tải đánh giá thử nghiệm.' }, 503); }
          return json({ flags: Object.keys(review.flags).filter(key => review.flags[key]).map(key => { const split = key.indexOf(':'); return { targetType: key.slice(0, split), targetId: key.slice(split + 1) }; }) });
        }
        const body = JSON.parse(init.body); review.requests.push(body);
        if (review.failSave) return json({ error: 'Lỗi lưu đánh giá thử nghiệm.' }, 503);
        review.flags[body.targetType + ':' + body.targetId] = body.lowQuality;
        sessionStorage.setItem('qualityFlags', JSON.stringify(review.flags)); return json({ ok: true });
      }
      if (url.pathname === '/api/posts') {
        const category = url.searchParams.get('category'), isHouse = category === 'Bộ sưu tập ảnh';
        const start = isHouse ? 9100 : category === 'Bản vẽ cộng đồng' ? 9200 : 9300;
        const posts = [1, 2].map(index => ({ id: start + index, userId: 'review-author', authorName: 'Tác giả kiểm tra', title: 'Bài kiểm tra chất lượng ' + index, content: 'Nội dung hồ sơ kiểm tra', category, audience: 'Công khai', createdAt: '2026-10-05T08:00:00.000Z', specifications: '5x20m', listingType: 'Hiện đại', priceLabel: '', promotionPosition: null, downloads: 0, comments: 0, attachments: [], sortScore: 0 }));
        const demos = JSON.parse(url.searchParams.get('modelKeys') || '[]').map(key => isHouse ? 'model:' + key : 'drawing:' + key);
        const keys = [...posts.map(post => 'post:' + post.id), ...demos];
        const flagged = key => key.startsWith('post:') ? Boolean(review.flags[key]) : isHouse ? Boolean(review.flags['demo:facade.' + houses.indexOf(key.slice(6))]) : false;
        const order = [...keys.filter(key => !flagged(key)), ...keys.filter(flagged)];
        return json({ posts, total: posts.length, pageSize: 16, page: 1, nextCursor: null, catalogOrder: order });
      }
      if (url.pathname === '/api/professional-profile') return json({ profile: { accountType: 'architect' } });
      if (url.pathname === '/api/actions') return json({ actions: [], count: 0 });
      return nativeFetch(input, init);
    };
  })();` });
  const postButton = (id, label) => `Array.from(document.getElementById('post-${id}')?.querySelectorAll('button') || []).find(button => button.textContent.trim() === ${JSON.stringify(label)})`;
  const lastId = id => `document.getElementById('post-${id}')?.parentElement.lastElementChild?.id === 'post-${id}'`;
  for (const [route, id, width] of [['/kho-mau-nha-dep-chat', 9101, 390], ['/file-ban-ve-nha-dep-chat', 9201, 1440], ['/noi-that', 9301, 320]]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width < 1024 });
    await send('Page.navigate', { url: origin + route + (id === 9101 ? '?quality-load-error=1' : '') });
    await waitFor(postButton(id, 'Đẩy xuống cuối'), 'quality control');
    if (id === 9101) {
      await waitFor(`document.getElementById('post-${id}').innerText.includes('Lỗi tải đánh giá')`, 'private flags load failure');
      assert.equal(await evaluate(`(${postButton(id, 'Đẩy xuống cuối')}).disabled`), true);
      await evaluate('window.qualityReview.failLoad = false');
      await click(postButton(id, 'Thử lại'));
    }
    await waitFor(`!(${postButton(id, 'Đẩy xuống cuối')})?.disabled`, 'quality flags ready');
    await evaluate('window.qualityReview.failSave = true');
    await click(postButton(id, 'Đẩy xuống cuối'));
    await waitFor(`document.getElementById('post-${id}').innerText.includes('Lỗi lưu đánh giá')`, 'save failure');
    assert.equal(await evaluate(`(${postButton(id, 'Đẩy xuống cuối')}).getAttribute('aria-pressed')`), 'false');
    await evaluate('window.qualityReview.failSave = false');
    await click(postButton(id, 'Đẩy xuống cuối'));
    await waitFor(postButton(id, 'Bỏ đánh giá ngầm'), 'flag saved');
    await waitFor(lastId(id), 'post moved after every normal post and demo');
    assert.deepEqual(await evaluate('window.qualityReview.requests.at(-1)'), { targetType: 'post', targetId: String(id), lowQuality: true });
    const box = await evaluate(`(() => { const article = document.getElementById('post-${id}').getBoundingClientRect(), button = (${postButton(id, 'Bỏ đánh giá ngầm')}).getBoundingClientRect(); return { articleWidth: article.width, buttonWidth: button.width }; })()`);
    assert.ok(box.buttonWidth <= box.articleWidth, 'Quality buttons must fit mobile cards');
    if (id === 9301) writeFileSync(path.join(dir, 'mobile-quality-control.png'), Buffer.from((await send('Page.captureScreenshot', { format: 'png' })).data, 'base64'));
    await send('Page.reload');
    await waitFor(postButton(id, 'Bỏ đánh giá ngầm'), 'flag persists after reload');
    await waitFor(lastId(id), 'demotion persists after reload');
    await click(postButton(id, 'Bỏ đánh giá ngầm'));
    await waitFor(postButton(id, 'Đẩy xuống cuối'), 'flag removed');
    await waitFor(`document.getElementById('post-${id}')?.parentElement.firstElementChild?.id === 'post-${id}'`, 'normal order restored');
  }
  await send('Page.navigate', { url: origin + '/kho-mau-nha-dep-chat' });
  const demo = `document.querySelector('[data-site-key="facade.0.title"]')?.closest('article')`;
  const demoButton = label => `Array.from((${demo})?.querySelectorAll('button') || []).find(button => button.textContent.trim() === ${JSON.stringify(label)})`;
  await waitFor(`!(${demoButton('Đẩy xuống cuối')})?.disabled && (${demoButton('Đẩy xuống cuối')})`, 'demo quality control');
  await click(demoButton('Đẩy xuống cuối'));
  await waitFor(`(${demo})?.parentElement.lastElementChild === (${demo})`, 'demo moved last');
  assert.deepEqual(await evaluate('window.qualityReview.requests.at(-1)'), { targetType: 'demo', targetId: 'facade.0', lowQuality: true });
  await send('Page.navigate', { url: origin + '/kho-mau-nha-dep-chat?review-user=1' });
  await waitFor(`document.getElementById('post-9101') && window.qualityReview`, 'regular member view');
  assert.equal(await evaluate(`Boolean(document.querySelector('[aria-label="Đánh giá ngầm của admin"]'))`), false);
  assert.equal(await evaluate(`document.body.innerText.includes('Kém chất lượng') || document.body.innerText.includes('Bỏ đánh giá ngầm')`), false, 'Internal labels stay hidden from ordinary users');
  assert.equal(await evaluate('window.qualityReview.loadRequests'), 0, 'Members never fetch internal ratings');
  assert.deepEqual(exceptions, []);
  console.log('PASS: native admin clicks for all three catalogs at 320/390/1440px; load/save errors and retries; mark/unmark reorders immediately and persists; demos supported; private controls and labels never appear for members.');
} finally { socket?.close(); chrome.kill(); }
