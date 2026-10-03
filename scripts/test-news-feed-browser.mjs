import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

// Local browser regression checks use mocked APIs and do not publish test posts.
// Run with node scripts/test-news-feed-browser.mjs after starting the local server.
const origin = process.env.TIPOOK_TEST_ORIGIN || 'http://localhost:5173';
assert.ok(['localhost', '127.0.0.1'].includes(new URL(origin).hostname));
const root = process.cwd();
const dir = path.join(root, '.sites-runtime/news-review');
mkdirSync(dir, { recursive: true });
const browserPath = process.env.TIPOOK_BROWSER_PATH || (process.platform === 'win32' ? 'C:/Program Files/Google/Chrome/Application/chrome.exe' : process.platform === 'darwin' ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' : 'chromium');
const chrome = spawn(browserPath, ['--headless=new', '--no-sandbox', '--disable-gpu', '--disable-software-rasterizer', '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=9224', `--user-data-dir=${path.join(dir, 'chrome')}`, 'about:blank'], { windowsHide: true, stdio: 'ignore' });
let startupError;
chrome.on('error', error => { startupError = error; });
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
let socket;
try {
  let tabs;
  for (let i = 0; i < 80; i++) { try { tabs = await (await fetch('http://127.0.0.1:9224/json/list')).json(); break; } catch { await pause(250); } }
  assert.ok(tabs?.length, startupError?.message || 'Headless Chrome must start (set TIPOOK_BROWSER_PATH if needed)');
  socket = new WebSocket(tabs[0].webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
  let seq = 0;
  const pending = new Map();
  const exceptions = [];
  socket.addEventListener('message', event => {
    const payload = JSON.parse(event.data);
    if (payload.id) { const request = pending.get(payload.id); pending.delete(payload.id); if (payload.error) request?.reject(new Error(JSON.stringify(payload.error))); else request?.resolve(payload.result); }
    if (payload.method === 'Runtime.exceptionThrown') exceptions.push(payload.params.exceptionDetails.text + ': ' + payload.params.exceptionDetails.exception?.description);
  });
  const send = (method, params = {}) => new Promise((resolve, reject) => { const id = ++seq; pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params })); });
  const evaluate = async expression => {
    const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
    return result.result.value;
  };
  const waitFor = async (expression, label) => { for (let i = 0; i < 150; i++) { if (await evaluate(`Boolean(${expression})`)) return; await pause(100); } console.log(await evaluate(`JSON.stringify({ url:location.href, body:document.body?.innerText.slice(0,3500), review:!!window.review })`), exceptions); writeFileSync(path.join(dir, 'failure.png'), Buffer.from((await send('Page.captureScreenshot', { format: 'png' })).data, 'base64')); throw new Error('Timeout: ' + label); };
  await send('Runtime.enable'); await send('Page.enable');
  const fixture = {
    id: 900001, userId: 'review-author', authorName: 'Người chia sẻ', avatarUrl: null, category: 'Bản vẽ cộng đồng',
    title: 'Nhà phố 5 × 20m', content: 'Giá bán: 150000đ\nChi phí 125000000 VND\nLiên hệ 0912345678', location: '5 × 20m', feeling: null, pollQuestion: '150000', comments: 1,
    createdAt: '2026-10-03T08:00:00.000Z', sourceHref: '/file-ban-ve-nha-dep-chat?postId=900001#post-900001', sourceLabel: 'Kho bản vẽ',
    images: Array.from({ length: 7 }, (_, index) => ({ url: index % 2 ? '/mat-bang-5x20.png' : '/community-house.png', name: `Ảnh ${index + 1}` })),
  };
  await send('Page.addScriptToEvaluateOnNewDocument', { source: `(() => {
    const nativeFetch = window.fetch.bind(window);
    const post = ${JSON.stringify(fixture)};
    window.reviewErrors = [];
    window.addEventListener('error', event => { if (event.message) window.reviewErrors.push(event.message); });
    window.review = { comments: [{ id: 1, userId: 'review-reader', authorName: 'Người đọc', content: 'Bình luận có ảnh', imageUrl: '/community-house.png', createdAt: '2026-10-03T08:01:00.000Z' }], liked: false, uploads: [], failSend: false, failMore: true };
    window.review.feedRequests = [];
    window.fetch = async (input, init = {}) => {
      const url = new URL(typeof input === 'string' ? input : input.url, location.origin);
      const method = init.method || 'GET';
      const json = (value, status = 200) => Promise.resolve(new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } }));
      if (url.pathname === '/api/me') return json({ user: { id: 'review-user', name: 'Người kiểm tra', authenticated: true, avatarUrl: null } });
      if (url.pathname === '/api/news-feed') {
        const category = window.review.sourceCategory || post.category;
        const sourcePath = category === 'Bộ sưu tập ảnh' ? '/kho-mau-nha-dep-chat' : category === 'Nội thất cộng đồng' ? '/noi-that' : '/file-ban-ve-nha-dep-chat';
        const original = { ...post, category, sourceHref: sourcePath + '?postId=' + post.id + '#post-' + post.id, comments: window.review.comments.length };
        const second = { ...post, id: 900002, title: 'Bài viết tiếp theo', content: 'Nội dung bài đăng tiếp theo', category: 'Bảng tin', sourceLabel: 'Bảng tin', sourceHref: '/bai-viet/900002', images: [], comments: 0, createdAt: '2026-10-02T08:00:00.000Z' };
        const items = [original, second].filter(item => (!url.searchParams.get('category') || item.category === url.searchParams.get('category')) && (!url.searchParams.get('postId') || item.id === Number(url.searchParams.get('postId'))) && (!url.searchParams.get('q') || (item.title + item.content).includes(url.searchParams.get('q'))));
        const page = Number(url.searchParams.get('page') || 1);
        window.review.feedRequests.push(page);
        if (page === 2 && window.review.failMore) { window.review.failMore = false; return json({ error: 'Lỗi tải thêm thử nghiệm.' }, 503); }
        return json({ posts: items.slice(page - 1, page), total: items.length, page, totalPages: Math.max(1, items.length) });
      }
      if (url.pathname === '/api/posts' && url.searchParams.get('postId')) {
        const target = { ...post, category: url.searchParams.get('category'), attachments: post.images.map((image, index) => ({ key: 'review-' + index, name: image.name, type: 'image/png', size: 100, url: image.url })) };
        return json({ posts: url.searchParams.get('postId') === String(post.id) ? [target] : [], total: 1, nextCursor: null });
      }
      if (url.pathname === '/api/actions') { if (method !== 'GET') window.review.liked = method === 'POST'; return json({ actions: window.review.liked ? [{}] : [], count: window.review.liked ? 1 : 0 }); }
      if (url.pathname === '/api/files' && method === 'POST') { const file = init.body.get('file'); window.review.uploads.push({ name: file.name, size: file.size, type: file.type }); return json({ attachment: { key: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', url: '/community-house.png', name: file.name } }, 201); }
      if (url.pathname === '/api/comments') {
        if (method === 'GET') return json({ comments: window.review.comments, total: window.review.comments.length, nextCursor: null });
        const body = JSON.parse(init.body);
        if (window.review.failSend) return json({ error: 'Lỗi thử nghiệm, hãy thử lại.' }, 503);
        const comment = { id: window.review.comments.length + 1, userId: 'review-user', authorName: 'Người kiểm tra', content: body.content, imageUrl: body.imageKey ? '/community-house.png' : null, createdAt: new Date().toISOString() };
        window.review.comments.push(comment); window.review.lastBody = body; return json({ comment, total: window.review.comments.length }, 201);
      }
      return nativeFetch(input, init);
    };
  })();` });
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: origin });
  await waitFor(`document.querySelector('button[aria-label="Xem ảnh 1 của bài viết Nhà phố 5 × 20m"]')`, 'feed hydration');
  assert.equal(await evaluate(`Math.round(document.querySelector('main').getBoundingClientRect().width)`), 1320);
  assert.ok(await evaluate(`document.querySelector('article').innerText.includes('150.000đ') && document.querySelector('article').innerText.includes('125.000.000 VND')`));
  assert.equal(await evaluate(`document.querySelector('article time').closest('a')`), null);
  await waitFor(`document.querySelector('[role="alert"]')?.textContent.includes('Lỗi tải thêm thử nghiệm.')`, 'load-more failure');
  assert.equal(await evaluate(`document.querySelectorAll('article').length`), 1);
  await evaluate(`Array.from(document.querySelectorAll('button')).find(button => button.textContent === 'Thử tải thêm bài đăng').click()`);
  await waitFor(`document.querySelectorAll('article').length === 2`, 'infinite scroll retry preserves the first page and appends the second');
  assert.deepEqual(await evaluate('window.review.feedRequests'), [1, 2, 2], 'Loading/retrying page two must not reload page one');
  await evaluate(`window.dispatchEvent(new Event('focus'))`);
  await pause(250);
  assert.deepEqual(await evaluate('window.review.feedRequests'), [1, 2, 2], 'Returning to a scrolled feed must not refetch every loaded page');
  await evaluate(`Array.from(document.querySelectorAll('button')).find(button => button.textContent.includes('Làm mới')).click()`);
  await waitFor(`window.review.feedRequests.length === 5 && !Array.from(document.querySelectorAll('button')).find(button => button.textContent.includes('Làm mới')).disabled`, 'manual refresh updates loaded pages');
  assert.deepEqual(await evaluate('window.review.feedRequests'), [1, 2, 2, 1, 2]);
  await evaluate(`document.querySelector('button[aria-label="Xem ảnh 5 của bài viết Nhà phố 5 × 20m"]').click()`);
  await waitFor(`document.querySelector('[role="dialog"] [role="status"]')?.textContent.includes('5 / 7')`, 'clicked fifth photo');
  assert.equal(await evaluate('location.pathname'), '/');
  await evaluate(`document.querySelector('button[aria-label="Ảnh tiếp theo"]').click()`);
  await waitFor(`document.querySelector('[role="dialog"] [role="status"]')?.textContent.includes('6 / 7')`, 'sixth hidden photo');
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'ArrowRight', code: 'ArrowRight', windowsVirtualKeyCode: 39 });
  await waitFor(`document.querySelector('[role="dialog"] [role="status"]')?.textContent.includes('7 / 7')`, 'keyboard navigation');
  await evaluate(`document.querySelector('button[aria-label="Phóng to ảnh"]').click()`);
  assert.equal(await evaluate(`document.querySelector('button[aria-label="Thu nhỏ ảnh"]').getAttribute('aria-pressed')`), 'true');
  await evaluate(`document.querySelector('button[aria-label="Thu nhỏ ảnh"]').click()`);
  await waitFor(`document.querySelector('[role="dialog"] textarea') && document.querySelector('[role="dialog"]').innerText.includes('Bình luận có ảnh')`, 'comments in viewer');
  assert.equal(await evaluate(`document.querySelector('[role="dialog"] aside').getBoundingClientRect().width`), 380);
  writeFileSync(path.join(dir, 'desktop-viewer.png'), Buffer.from((await send('Page.captureScreenshot', { format: 'png' })).data, 'base64'));
  await evaluate(`document.querySelector('[role="dialog"] button[data-requires-account][aria-pressed="false"]').click()`);
  await waitFor(`window.review.liked`, 'like persisted');
  await evaluate(`document.querySelector('button[aria-label="Đóng trình xem ảnh"]').click()`);
  await waitFor(`!document.querySelector('[role="dialog"]')`, 'viewer close');
  assert.equal(await evaluate(`document.querySelector('article button[aria-pressed="true"]')?.textContent.includes('Đã thích')`), true);
  assert.equal(await evaluate(`document.activeElement.getAttribute('aria-label')`), 'Xem ảnh 5 của bài viết Nhà phố 5 × 20m');
  const photoBytes = readFileSync('public/community-house.png').toString('base64');
  await evaluate(`(() => { const raw = atob(${JSON.stringify(photoBytes)}); const data = Uint8Array.from(raw, c => c.charCodeAt(0)); const transfer = new DataTransfer(); transfer.items.add(new File([data], 'review.png', { type: 'image/png' })); const input = document.querySelector('input[aria-label="Thêm ảnh bình luận"]'); input.files = transfer.files; input.dispatchEvent(new Event('change', { bubbles: true })); })()`);
  await waitFor(`document.querySelector('button[aria-label="Bỏ ảnh bình luận"]')`, 'uploaded image preview');
  assert.equal(await evaluate('window.review.uploads[0].type'), 'image/webp');
  assert.ok(await evaluate('window.review.uploads[0].size <= 1024 * 1024'));
  await evaluate(`window.review.failSend = true; document.querySelector('button[aria-label="Gửi bình luận"]').click()`);
  await waitFor(`document.querySelector('article [role="alert"]')`, 'failed comment feedback');
  assert.ok(await evaluate(`Boolean(document.querySelector('button[aria-label="Bỏ ảnh bình luận"]'))`));
  await evaluate(`window.review.failSend = false; document.querySelector('button[aria-label="Gửi bình luận"]').click()`);
  await waitFor(`window.review.comments.length === 2 && !document.querySelector('button[aria-label="Bỏ ảnh bình luận"]')`, 'image-only comment sent');
  assert.equal(await evaluate('window.review.lastBody.content'), '');
  assert.ok(await evaluate('window.review.lastBody.imageKey'));
  await evaluate(`(() => { const input = document.querySelector('textarea'); const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set; setter.call(input, 'Bình luận nhiều dòng\\nGiá 250000đ'); input.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  await evaluate(`document.querySelector('button[aria-label="Gửi bình luận"]').click()`);
  await waitFor(`window.review.comments.length === 3`, 'text comment sent');
  assert.ok(await evaluate(`document.querySelector('article').innerText.includes('Giá 250.000đ')`));
  await evaluate(`document.querySelector('button[aria-label="Xem ảnh bình luận của Người đọc"]').click()`);
  await waitFor(`document.querySelector('[role="dialog"] [role="status"]')?.textContent.includes('1 / 1')`, 'comment photo viewer');
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
  await waitFor(`!document.querySelector('[role="dialog"]')`, 'escape closes');
  assert.equal(await evaluate(`document.activeElement.getAttribute('aria-label')`), 'Xem ảnh bình luận của Người đọc');
  await evaluate(`window.scrollTo(0,0)`);
  writeFileSync(path.join(dir, 'desktop.png'), Buffer.from((await send('Page.captureScreenshot', { format: 'png' })).data, 'base64'));
  for (const width of [320, 375, 390, 430, 768, 1023]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height: 844, deviceScaleFactor: 1, mobile: true });
    await pause(100);
    const layout = await evaluate(`(() => {
      const bounds = element => { const rect = element.getBoundingClientRect(); return { left: rect.left, right: rect.right, width: rect.width }; };
      const filters = document.querySelector('[aria-label="Lọc bảng tin"]');
      return {
        viewport: innerWidth,
        elements: [filters.parentElement, document.querySelector('section[aria-label="Bài đăng mới"]'), ...document.querySelectorAll('article')].map(bounds),
        filterWidth: filters.clientWidth,
        filterScrollWidth: filters.scrollWidth,
        featuredHidden: getComputedStyle(document.querySelector('[aria-labelledby="featured-news-heading"]')).display === 'none',
      };
    })()`);
    if (width === 390) writeFileSync(path.join(dir, 'mobile-feed.png'), Buffer.from((await send('Page.captureScreenshot', { format: 'png' })).data, 'base64'));
    assert.equal(layout.viewport, width, 'Mobile content must not expand the layout viewport');
    assert.ok(layout.elements.every(rect => rect.left >= 0 && rect.right <= width + 1), `Feed cards and filters must fit the ${width}px viewport: ${JSON.stringify(layout)}`);
    assert.equal(layout.featuredHidden, true);
    if (width <= 430) {
      assert.ok(layout.filterScrollWidth > layout.filterWidth, `Categories must scroll within their own row at ${width}px`);
      await evaluate(`document.querySelector('[aria-label="Lọc bảng tin"]').scrollLeft = 10000`);
      assert.ok(await evaluate(`document.querySelector('[aria-label="Lọc bảng tin"]').scrollLeft > 0 && document.querySelector('article').getBoundingClientRect().right <= innerWidth + 1`), 'Scrolling categories must keep posts within the viewport');
    }
  }
  assert.deepEqual(await evaluate('window.reviewErrors'), [], 'Resizing the feed with comments open must not trigger script or ResizeObserver errors');
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await evaluate(`document.querySelector('button[aria-label="Xem ảnh 1 của bài viết Nhà phố 5 × 20m"]').click()`);
  await waitFor(`document.querySelector('[role="dialog"]')`, 'mobile viewer');
  await pause(350);
  assert.equal(await evaluate(`document.querySelector('[role="dialog"]').getBoundingClientRect().width`), 390);
  assert.ok(await evaluate(`document.querySelector('[role="dialog"] aside').getBoundingClientRect().height > 200`));
  assert.ok(await evaluate(`document.documentElement.scrollWidth <= innerWidth`));
  await evaluate(`(() => { const area = document.querySelector('[role="dialog"] img[alt="Ảnh 1"]').parentElement; const start = new Touch({ identifier: 1, target: area, clientX: 300, clientY: 200 }); const end = new Touch({ identifier: 1, target: area, clientX: 80, clientY: 210 }); area.dispatchEvent(new TouchEvent('touchstart', { bubbles: true, touches: [start], changedTouches: [start], targetTouches: [start] })); area.dispatchEvent(new TouchEvent('touchend', { bubbles: true, changedTouches: [end] })); })()`);
  await waitFor(`document.querySelector('[role="dialog"] [role="status"]')?.textContent.includes('2 / 7')`, 'mobile swipe');
  writeFileSync(path.join(dir, 'mobile-viewer.png'), Buffer.from((await send('Page.captureScreenshot', { format: 'png' })).data, 'base64'));
  await evaluate(`document.querySelector('button[aria-label="Đóng trình xem ảnh"]').click()`);
  await evaluate(`Array.from(document.querySelectorAll('aside button')).find(button => button.textContent === 'Bảng tin').click()`);
  await waitFor(`document.querySelectorAll('article').length === 1 && document.querySelector('article').textContent.includes('Nội dung bài đăng tiếp theo')`, 'category filtering resets loaded pages');
  await evaluate(`Array.from(document.querySelectorAll('aside button')).find(button => button.textContent === 'Tất cả').click()`);
  await waitFor(`document.querySelector('button[aria-label="Xem ảnh 1 của bài viết Nhà phố 5 × 20m"]')`, 'reset category');
  await send('Page.navigate', { url: origin + '/bai-viet/900001' });
  await waitFor(`document.querySelector('textarea[aria-label="Nội dung bình luận"]')`, 'detail page automatically loads comments');
  assert.equal(await evaluate('location.pathname'), '/bai-viet/900001');
  for (const [category, sourcePath] of [['Bản vẽ cộng đồng', '/file-ban-ve-nha-dep-chat'], ['Bộ sưu tập ảnh', '/kho-mau-nha-dep-chat'], ['Nội thất cộng đồng', '/noi-that']]) {
    await send('Page.navigate', { url: origin });
    await waitFor(`document.querySelector('button[aria-label="Xem ảnh 1 của bài viết Nhà phố 5 × 20m"]')`, 'feed for source navigation');
    await evaluate(`window.review.sourceCategory = ${JSON.stringify(category)}; window.dispatchEvent(new Event('tipook-content-changed'))`);
    await pause(350);
    await waitFor(`Array.from(document.querySelectorAll('article a')).some(link => link.getAttribute('href') === ${JSON.stringify(sourcePath + '?postId=900001#post-900001')})`, 'original source link');
    await evaluate(`Array.from(document.querySelector('article').querySelectorAll('a')).find(link => link.textContent.includes('Xem bài viết')).click()`);
    await waitFor(`location.pathname === ${JSON.stringify(sourcePath)} && new URLSearchParams(location.search).get('postId') === '900001' && document.getElementById('post-900001')`, 'opens original post in ' + sourcePath);
    assert.equal(await evaluate('location.hash'), '#post-900001');
    assert.equal(await evaluate(`document.querySelectorAll('article[id^="post-"]').length`), 1);
    assert.ok(await evaluate(`document.getElementById('post-900001').textContent.includes('Nhà phố 5 × 20m')`));
  }
  assert.deepEqual(exceptions, []);
  console.log('PASS: feed fits 320–1023px with scrollable categories; desktop/mobile photos and comments; retries, likes, prices, infinite scroll; View post navigates to the exact original post in Facades, Drawings and Interiors.');
  console.log('Screenshots: ' + dir);
} finally { socket?.close(); chrome.kill(); }
